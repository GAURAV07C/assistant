import './globals.css';

export const metadata = {
  title: 'AI_OS_V3 Dashboard',
  description: 'Autonomous AI Operating System Control Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
