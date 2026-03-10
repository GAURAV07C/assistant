import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Separator } from '../../ui/separator';

export function VoiceTab({
  voiceSettings,
  voiceBusy,
  onRefreshVoice,
  onApplyVoice,
  onToggleVoiceLoop,
  micSupported,
  voiceLoopEnabled,
  micListening,
  voiceMode,
  onVoiceModeChange,
  voiceEdge,
  onVoiceEdgeChange,
  voiceCustomId,
  onVoiceCustomIdChange,
  voiceRate,
  onVoiceRateChange,
  voiceUploadName,
  onVoiceUploadNameChange,
  voiceUploadEdge,
  onVoiceUploadEdgeChange,
  voiceUploadRate,
  onVoiceUploadRateChange,
  onVoiceUploadFileChange,
  onUploadCustomVoice,
  formatJsonCompact,
  textSyncTtsEnabled,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Voice Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onRefreshVoice} disabled={voiceBusy}>
              Refresh
            </Button>
            <Button type="button" onClick={onApplyVoice} disabled={voiceBusy}>
              {voiceBusy ? 'Working...' : 'Apply Voice'}
            </Button>
            <Button type="button" variant="secondary" onClick={onToggleVoiceLoop} disabled={!micSupported}>
              {!micSupported
                ? 'Mic Unsupported'
                : voiceLoopEnabled || micListening
                  ? 'Stop Voice Loop'
                  : 'Start Voice Loop'}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Mode</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={voiceMode === 'edge' ? 'default' : 'secondary'}
                  onClick={() => onVoiceModeChange?.('edge')}
                >
                  Edge
                </Button>
                <Button
                  type="button"
                  variant={voiceMode === 'custom' ? 'default' : 'secondary'}
                  onClick={() => onVoiceModeChange?.('custom')}
                >
                  Custom
                </Button>
              </div>
              <Input
                placeholder="Edge voice (e.g., en-IN-NeerjaNeural)"
                value={voiceEdge}
                onChange={(e) => onVoiceEdgeChange?.(e.target.value)}
              />
              <Input
                placeholder="Custom voice id"
                value={voiceCustomId}
                onChange={(e) => onVoiceCustomIdChange?.(e.target.value)}
              />
              <Input
                placeholder="Rate (e.g., +22%)"
                value={voiceRate}
                onChange={(e) => onVoiceRateChange?.(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Current Settings</div>
              <pre className="max-h-64 overflow-auto rounded-lg border bg-card/40 p-3 font-mono text-xs text-muted-foreground backdrop-blur">
                {formatJsonCompact(voiceSettings)}
              </pre>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Upload Custom Voice (optional)</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input placeholder="Name" value={voiceUploadName} onChange={(e) => onVoiceUploadNameChange?.(e.target.value)} />
              <Input
                placeholder="Edge voice"
                value={voiceUploadEdge}
                onChange={(e) => onVoiceUploadEdgeChange?.(e.target.value)}
              />
              <Input placeholder="Rate" value={voiceUploadRate} onChange={(e) => onVoiceUploadRateChange?.(e.target.value)} />
            </div>
            <input
              type="file"
              onChange={(e) => onVoiceUploadFileChange?.(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-secondary-foreground hover:file:bg-secondary/80"
            />
            <Button type="button" onClick={onUploadCustomVoice} disabled={voiceBusy}>
              {voiceBusy ? 'Working...' : 'Save Custom Voice'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TTS Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            When enabled, Astro tries to keep voice in sync with streamed text (best-effort).
          </div>
          <Badge variant="outline">
            {textSyncTtsEnabled ? 'Text+TTS Sync: On' : 'Text+TTS Sync: Off'}
          </Badge>
          <Separator />
          <div className="text-xs text-muted-foreground">Mic Status</div>
          <div className="text-sm text-foreground">
            {micSupported ? (micListening ? 'Listening' : 'Idle') : 'Unsupported'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

