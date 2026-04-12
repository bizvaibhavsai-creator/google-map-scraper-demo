import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Google Maps Scraper',
  description: 'Search and scrape Google Maps business data and contact info',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell min-h-screen text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
