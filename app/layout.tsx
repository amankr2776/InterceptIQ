import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { MissionProvider } from '@/lib/store';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'CK115 — Interceptor Allocation C2',
  description: 'Real-time interceptor launch-area allocation and engagement planning.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body>
        <MissionProvider>{children}</MissionProvider>
      </body>
    </html>
  );
}
