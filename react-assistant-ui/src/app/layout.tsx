import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export const metadata = {
  title: 'Astro Dashboard',
  description: 'Autonomous Astro control panel',
  applicationName: 'Astro',
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/icons/icon-192.png' },
    { rel: 'apple-touch-icon', url: '/icons/icon-512.png' },
  ],
};

export function generateViewport() {
  return {
    viewport: { width: 'device-width', initialScale: 1, maximumScale: 1 },
    themeColor: '#0dc6ff',
    colorScheme: 'dark',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background text-foreground antialiased font-sans">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
