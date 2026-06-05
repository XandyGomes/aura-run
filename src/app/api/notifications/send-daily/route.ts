import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import webpush from 'web-push';

const vapidPublicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
const vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidSubject = (process.env.VAPID_SUBJECT || 'mailto:alexandre@example.com').trim();

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // Verifica token secreto se estiver configurado no .env
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'Chaves VAPID não configuradas nas variáveis de ambiente.' }, { status: 500 });
  }

  // ROTA DE TESTE MANUAL: ?test_athlete_id=NUMERO&type=kit|race
  const testAthleteId = searchParams.get('test_athlete_id');
  if (testAthleteId) {
    const type = searchParams.get('type') || 'race';
    const title = type === 'kit' ? '🎁 Retirada de Kit (Teste)!' : '🏁 Dia de Corrida (Teste)!';
    const body = type === 'kit' 
      ? 'Este é um alerta de teste para retirada de kit. Tudo funcionando! 🎉'
      : 'Este é um alerta de teste para o dia da corrida. Boa sorte! 🏃‍♂️⚡';

    try {
      const { data: subs, error: subsErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('athlete_id', Number(testAthleteId));

      if (subsErr) throw subsErr;

      if (!subs || subs.length === 0) {
        return NextResponse.json({ error: 'Nenhum dispositivo registrado para este atleta. Certifique-se de ativar as notificações no celular na tela de corridas.' }, { status: 400 });
      }

      let sent = 0;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify({ title, body, url: '/races' })
          );
          sent++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
      return NextResponse.json({ success: true, message: `Push de teste enviado para ${sent} dispositivo(s).` });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // PROCESSAMENTO DIÁRIO COMUM (CRON JOB)
  try {
    // Pega a data atual em São Paulo no formato YYYY-MM-DD
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    
    // Busca todas as corridas ativas que têm kit ou corrida hoje
    const { data: races, error: racesErr } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'upcoming')
      .or(`date.eq.${today},kit_date.eq.${today}`);

    if (racesErr) throw racesErr;

    if (!races || races.length === 0) {
      return NextResponse.json({ message: `Nenhum alerta para hoje (${today}).` });
    }

    let notificationsSent = 0;
    let subscriptionsRemoved = 0;

    for (const race of races) {
      const isRaceDay = race.date === today;
      
      const title = isRaceDay ? '🏁 Dia de Corrida! Boa sorte!' : '🎁 Retirada de Kit!';
      const body = isRaceDay
        ? `Hoje é o dia da sua corrida: ${race.name}. Dê o seu melhor! 🏃‍♂️🚀`
        : `Hoje é o dia de retirar o kit para a prova: ${race.name}. Não esqueça seus documentos!`;

      // Busca as inscrições de push registradas para este atleta
      const { data: subs, error: subsErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('athlete_id', race.athlete_id);

      if (subsErr || !subs) continue;

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify({
              title,
              body,
              url: '/races',
            })
          );
          notificationsSent++;
        } catch (err: any) {
          // Limpa tokens inativos / expirados
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
            subscriptionsRemoved++;
          } else {
            console.error(`Falha ao enviar push para inscrição ID ${sub.id}:`, err.message);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      racesChecked: races.length,
      notificationsSent,
      subscriptionsRemoved,
    });
  } catch (error: any) {
    console.error('[Send Daily API] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
