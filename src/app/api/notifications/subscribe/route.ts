import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, athleteId } = body;
    
    if (!subscription || !athleteId) {
      return NextResponse.json({ error: 'Inscrição ou ID de atleta ausentes.' }, { status: 400 });
    }
    
    const endpoint = subscription.endpoint;
    
    // Verifica se esta inscrição exata já está cadastrada
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('athlete_id', athleteId)
      .filter('subscription->>endpoint', 'eq', endpoint)
      .maybeSingle();
      
    if (existing) {
      // Atualiza os dados
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ subscription })
        .eq('id', existing.id);
        
      if (error) throw error;
    } else {
      // Insere uma nova inscrição para este dispositivo do atleta
      const { error } = await supabase
        .from('push_subscriptions')
        .insert([{ athlete_id: athleteId, subscription }]);
        
      if (error) throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Subscribe API] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
