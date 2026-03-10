import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="border-cyan-500/20 bg-slate-950/55 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-slate-100">{value}</div>
        {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
