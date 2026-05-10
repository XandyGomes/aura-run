'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './BottomNav.module.css';

const navItems = [
  { href: '/',        icon: 'home',    label: 'Início'  },
  { href: '/stats',   icon: 'chart',   label: 'Stats'   },
  { href: '/workout', icon: 'run',     label: 'Treinar', big: true },
  { href: '/races',   icon: 'flag',    label: 'Corridas' },
  { href: '/coach',   icon: 'ai',      label: 'Aura AI' },
];

const SVG: Record<string, React.ReactElement> = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  run: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
    </svg>
  ),
  ai: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  flag: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
};

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      <div className={styles.bar}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`${styles.item} ${active ? styles.active : ''} ${item.big ? styles.big : ''}`}>
              {item.big ? (
                <div className={styles.bigBtn}>
                  {SVG[item.icon]}
                </div>
              ) : (
                <>
                  <span className={styles.icon}>{SVG[item.icon]}</span>
                  <span className={styles.label}>{item.label}</span>
                  {active && <span className={styles.dot} />}
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
