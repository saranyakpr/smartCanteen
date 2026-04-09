import type { Metadata } from 'next';

import './globals.css';

import Providers from './providers';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Smart Canteen',
  description: 'Smart Canteen demo (frontend-only) for Madura Coats.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
