import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';

export function FilesTab({
  memoryProfile,
  newLearningFileName,
  onNewLearningFileNameChange,
  onRefreshLearningFiles,
  onCreateLearningFile,
  selectedLearningFile,
  onSelectedLearningFileChange,
  loadingLearningFile,
  savingLearningFile,
  onLoadLearningFile,
  onSaveLearningFile,
  learningFileContent,
  onLearningFileContentChange,
  learningFileMeta,
  workspacePathInput,
  onWorkspacePathInputChange,
  onListWorkspaceFiles,
  selectedWorkspaceFile,
  onSelectedWorkspaceFileChange,
  loadingWorkspaceFile,
  savingWorkspaceFile,
  onLoadWorkspaceFile,
  onSaveWorkspaceFile,
  workspaceFileContent,
  onWorkspaceFileContentChange,
  workspaceFileMeta,
  workspaceFiles,
  onPickWorkspaceFile,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Learning Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onRefreshLearningFiles}>
              Refresh List
            </Button>
            <Input
              placeholder="Create new file name (e.g., notes.json)"
              value={newLearningFileName}
              onChange={(e) => onNewLearningFileNameChange?.(e.target.value)}
            />
            <Button
              type="button"
              disabled={!String(newLearningFileName || '').trim()}
              onClick={onCreateLearningFile}
            >
              Create
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Select file (from memoryProfile.learning_files)"
              value={selectedLearningFile}
              onChange={(e) => onSelectedLearningFileChange?.(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={loadingLearningFile || !String(selectedLearningFile || '').trim()}
              onClick={onLoadLearningFile}
            >
              Load
            </Button>
            <Button
              type="button"
              disabled={savingLearningFile || !String(selectedLearningFile || '').trim()}
              onClick={onSaveLearningFile}
            >
              {savingLearningFile ? 'Saving...' : 'Save'}
            </Button>
          </div>

          <Textarea
            value={learningFileContent}
            onChange={(e) => onLearningFileContentChange?.(e.target.value)}
            placeholder="Learning file content..."
            rows={14}
          />

          <div className="text-xs text-muted-foreground">
            Meta:{' '}
            {learningFileMeta ? `bytes=${learningFileMeta.bytes}, updated=${learningFileMeta.updated_at}` : 'n/a'}
          </div>

          <Separator />
          <div className="text-xs text-muted-foreground">
            Available: {Array.isArray(memoryProfile?.learning_files) ? memoryProfile.learning_files.length : 0}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace File Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Workspace root path (server-side)"
              value={workspacePathInput}
              onChange={(e) => onWorkspacePathInputChange?.(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={onListWorkspaceFiles}>
              List
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="File path to load/save (server-side)"
              value={selectedWorkspaceFile}
              onChange={(e) => onSelectedWorkspaceFileChange?.(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={loadingWorkspaceFile || !String(selectedWorkspaceFile || '').trim()}
              onClick={onLoadWorkspaceFile}
            >
              Load
            </Button>
            <Button
              type="button"
              disabled={savingWorkspaceFile || !String(selectedWorkspaceFile || '').trim()}
              onClick={onSaveWorkspaceFile}
            >
              {savingWorkspaceFile ? 'Saving...' : 'Save'}
            </Button>
          </div>

          <Textarea
            value={workspaceFileContent}
            onChange={(e) => onWorkspaceFileContentChange?.(e.target.value)}
            placeholder="Workspace file content..."
            rows={14}
          />

          <div className="text-xs text-muted-foreground">
            Meta:{' '}
            {workspaceFileMeta ? `bytes=${workspaceFileMeta.bytes}, updated=${workspaceFileMeta.updated_at}` : 'n/a'}
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground">Workspace Files ({workspaceFiles.length})</div>
          <div className="max-h-40 overflow-auto space-y-1">
            {workspaceFiles.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => void onPickWorkspaceFile?.(f)}
                className="w-full rounded-md border bg-card/30 px-2 py-1 text-left font-mono text-xs text-foreground hover:bg-card/50"
              >
                {f}
              </button>
            ))}
            {!workspaceFiles.length ? <div className="text-xs text-muted-foreground">No files listed.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

