export function DashboardShell({ children }) {
  return (
    <div className="astro-bg relative min-h-dvh overflow-hidden px-4 py-6">
      <div className="astro-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto w-full max-w-7xl space-y-4">{children}</div>
    </div>
  );
}

