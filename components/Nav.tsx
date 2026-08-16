'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PAGES = [
  { href: '/', label: 'Overview', sub: 'Headline result' },
  { href: '/mission', label: 'Mission Detail', sub: 'Fire plan & logs' },
  { href: '/methodology', label: 'Methodology', sub: 'How it works' },
  { href: '/national', label: 'National Map', sub: 'All India' },
];

export default function Nav({ right }: { right?: React.ReactNode }) {
  const path = usePathname();
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 14px',
      borderBottom: '1px solid var(--line)', background: 'var(--panel)',
      flexShrink: 0, height: 46,
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--amb)', letterSpacing: '.06em' }}>
          InterceptIQ
        </span>
        <span style={{ fontSize: 8, color: 'var(--dim2)' }}>CK115</span>
      </Link>

      <nav style={{ display: 'flex', gap: 2, height: '100%' }}>
        {PAGES.map((p) => {
          const on = path === p.href;
          return (
            <Link key={p.href} href={p.href} style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '0 13px', height: '100%',
              borderBottom: `2px solid ${on ? 'var(--amb)' : 'transparent'}`,
              background: on ? 'rgba(255,176,32,.07)' : 'transparent',
            }}>
              <span style={{
                fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase',
                color: on ? 'var(--amb)' : 'var(--txt)',
              }}>{p.label}</span>
              <span style={{ fontSize: 8, color: 'var(--dim2)' }}>{p.sub}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
        {right}
      </div>
    </header>
  );
}
