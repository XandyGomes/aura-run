'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Race {
  id: string;
  name: string;
  date: string;
  kitDate?: string;
  status: string;
}

const STORAGE_KEY = 'aura_races_v1';

export default function KitReminder() {
  const [reminders, setReminders] = useState<Race[]>([]);

  useEffect(() => {
    const checkKits = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        
        const races: Race[] = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        
        const kitsToday = races.filter(r => r.kitDate === today && r.status === 'upcoming');
        setReminders(kitsToday);

        // Optional: Browser Notification
        if (kitsToday.length > 0 && Notification.permission === 'granted') {
          kitsToday.forEach(r => {
            new Notification('🎁 Retirada de Kit!', {
              body: `Hoje é o dia de retirar o kit para a corrida: ${r.name}`,
              icon: '/logo.png'
            });
          });
        } else if (kitsToday.length > 0 && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (e) {
        console.error('Error checking kits', e);
      }
    };

    checkKits();
    // Check every hour if the page stays open
    const interval = setInterval(checkKits, 3600000);
    return () => clearInterval(interval);
  }, []);

  if (reminders.length === 0) return null;

  return (
    <div style={{ padding: '0 16px 16px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
      {reminders.map(r => (
        <Link key={r.id} href="/races" style={{ textDecoration: 'none' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #FF4D00, #FF7340)', 
            borderRadius: '20px', 
            padding: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px',
            boxShadow: '0 8px 24px rgba(255,77,0,0.3)',
            animation: 'pulse-scale 2s infinite ease-in-out'
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
              🎁
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Atenção Atleta</div>
              <div style={{ fontSize: '15px', fontWeight: '900', color: 'white', lineHeight: '1.2' }}>HOJE: Retirada de Kit!</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', marginTop: '2px' }}>{r.name}</div>
            </div>
            <div style={{ fontSize: '20px', color: 'white', opacity: 0.8 }}>→</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
