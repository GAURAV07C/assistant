import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function SkillCard({
  name,
  level,
  xp,
  lastUsed,
}: {
  name: string;
  level: number;
  xp: number;
  lastUsed: string;
}) {
  return (
    <Card className="border-slate-800/80 bg-slate-950/65">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2 rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" style={{ width: `${Math.max(0, Math.min(100, level))}%` }} />
        </div>
        <div className="text-xs text-slate-400">Level: {level}%</div>
        <div className="text-xs text-slate-400">XP: {xp}</div>
        <div className="text-xs text-slate-400">Last used: {lastUsed}</div>
      </CardContent>
    </Card>
  );
}
