import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

// Geist for the interface; Geist Mono for every number, code and identifier,
// where the fixed advance width is what keeps columns aligned.
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NEXUS - Operations Intelligence',
  description:
    'Operations intelligence for delivery and logistics teams: live control tower, ' +
    'deterministic KPIs and AI-assisted analysis.',
};

export const viewport: Viewport = {
  themeColor: '#0b0e13',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
