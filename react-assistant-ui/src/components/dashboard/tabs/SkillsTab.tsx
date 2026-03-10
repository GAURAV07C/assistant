import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Separator } from '../../ui/separator';

export function SkillsTab({
  skillsBusy,
  skillsList,
  selectedSkillId,
  onSelectSkill,
  onRefresh,
  onLearnFromTask,
  skillTaskInput,
  onSkillTaskInputChange,
  selectedSkillEnabled,
  onToggleSelected,
  onEvolveSuccess,
  onEvolveFailure,
  skillRunInput,
  onSkillRunInputChange,
  onExecuteSkill,
  skillDetail,
  formatJsonCompact,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Skill Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={skillsBusy} onClick={onRefresh}>
              Refresh
            </Button>
            <Button type="button" disabled={skillsBusy} onClick={onLearnFromTask}>
              Learn From Task
            </Button>
          </div>

          <Input
            placeholder="Describe a task (e.g., 'analyze React performance bottleneck')"
            value={skillTaskInput}
            onChange={(e) => onSkillTaskInputChange?.(e.target.value)}
          />

          <Separator className="my-2" />

          <div className="max-h-[50vh] overflow-auto space-y-2">
            {skillsList.length ? (
              skillsList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void onSelectSkill?.(s.id)}
                  className={[
                    'w-full rounded-lg border bg-card/40 px-3 py-2 text-left transition-colors backdrop-blur',
                    'hover:bg-card/60',
                    selectedSkillId === s.id ? 'ring-2 ring-slate-300/20' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">{s.id}</div>
                    <Badge variant={s.enabled ? 'cyan' : 'outline'}>{s.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.level || 'unknown'}{' · '}uses: {s.uses ?? 0}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No skills found (or backend offline).</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Selected Skill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={skillsBusy || !selectedSkillId}
              onClick={onToggleSelected}
            >
              {selectedSkillEnabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={skillsBusy || !selectedSkillId}
              onClick={onEvolveSuccess}
            >
              Evolve: Success
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={skillsBusy || !selectedSkillId}
              onClick={onEvolveFailure}
            >
              Evolve: Failure
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Execute</div>
              <Input
                placeholder="Test message for this skill..."
                value={skillRunInput}
                onChange={(e) => onSkillRunInputChange?.(e.target.value)}
              />
              <Button
                type="button"
                disabled={skillsBusy || !selectedSkillId || !String(skillRunInput || '').trim()}
                onClick={onExecuteSkill}
              >
                Run Skill
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Detail</div>
              <pre className="max-h-64 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(skillDetail)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

