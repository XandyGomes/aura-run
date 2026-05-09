'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './BottomNav.module.css';

const navItems = [
  { href: '/', icon: '🏠', label: 'Início' },
  { href: '/stats', icon: '📈', label: 'Estatísticas' },
  { href: '/workout', icon: '⚡', label: 'Treinar', big: true },
  { href: '/coach', icon: '💬', label: 'Aura AI' },
  { href: '/profile', icon: '👤', label: 'Perfil' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={`${styles.navBar} glass`}>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
        >
          <span className={styles.navIcon} style={item.big ? { fontSize: '32px', marginTop: '-10px' } : {}}>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
      <div style={{ position: 'absolute', bottom: '-20px', width: '100%', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px', fontWeight: '500' }}>
        BY XANDY GOMES
      </div>
    </nav>
  );
}
