'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';


interface Reminder {
  id: string;
  name: string;
  type: 'kit' | 'race';
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function KitReminder() {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const checkReminders = async () => {
      try {
        const idStr = getCookie('strava_athlete_id');
        if (!idStr) return;
        const athleteId = Number(idStr);

        const today = new Date().toISOString().split('T')[0];
        
        const { data: races, error } = await supabase
          .from('races')
          .select('*')
          .eq('athlete_id', athleteId)
          .eq('status', 'upcoming');

        if (error) throw error;
        if (!races) return;
        
        const activeReminders: Reminder[] = [];

        races.forEach(r => {
          if (r.kit_date === today) {
            activeReminders.push({ id: `${r.id}-kit`, name: r.name, type: 'kit' });
          }
          if (r.date === today) {
            activeReminders.push({ id: `${r.id}-race`, name: r.name, type: 'race' });
          }
        });

        setReminders(activeReminders);

        // Browser Notification
        if (activeReminders.length > 0 && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          activeReminders.forEach(rem => {
            const title = rem.type === 'kit' ? '🎁 Retirada de Kit!' : '🏁 É hoje! Dia de Corrida!';
            const body = rem.type === 'kit' 
              ? `Hoje é o dia de retirar o kit para a corrida: ${rem.name}`
              : `Hoje é o dia da corrida: ${rem.name}. Boa prova e boa sorte! 🏃‍♂️🚀`;
            new Notification(title, {
              body,
              icon: '/logo.png'
            });
          });
        }
      } catch (e) {
        console.error('Error checking reminders', e);
      }
    };

    checkReminders();
    // Check every hour if the page stays open
    const interval = setInterval(checkReminders, 3600000);
    return () => clearInterval(interval);
  }, []);

  if (reminders.length === 0) return null;

  return (
    <div style={{ padding: '0 16px 16px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
      {reminders.map(r => (
        <Link key={r.id} href="/races" style={{ textDecoration: 'none' }}>
          <div style={{ 
            background: r.type === 'race' 
              ? 'linear-gradient(135deg, #00E5A0, #00B37E)' 
              : 'linear-gradient(135deg, #FF4D00, #FF7340)', 
            borderRadius: '20px', 
            padding: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px',
            boxShadow: r.type === 'race' 
              ? '0 8px 24px rgba(0,229,160,0.25)' 
              : '0 8px 24px rgba(255,77,0,0.3)',
            animation: 'pulse-scale 2s infinite ease-in-out',
            marginBottom: '8px'
          }}>
            <div style={{ 
              width: 44, 
              height: 44, 
              borderRadius: '14px', 
              background: 'rgba(255,255,255,0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '24px',
              flexShrink: 0
            }}>
              {r.type === 'race' ? '🏁' : '🎁'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Atenção Atleta</div>
              <div style={{ fontSize: '15px', fontWeight: '900', color: 'white', lineHeight: '1.2' }}>
                {r.type === 'race' ? 'HOJE: Dia de Corrida! 🏃‍♂️' : 'HOJE: Retirada de Kit!'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', marginTop: '2px' }}>{r.name}</div>
            </div>
            <div style={{ fontSize: '20px', color: 'white', opacity: 0.8 }}>→</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
