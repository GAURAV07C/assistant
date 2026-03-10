export function JsonPanel({ title, value }) {
  return (
    <div className="space-y-1">
      {title ? <div className="text-xs text-muted-foreground">{title}</div> : null}
      <pre className="max-h-64 overflow-auto rounded-lg border bg-card/40 p-3 text-xs text-muted-foreground backdrop-blur">
        {value}
      </pre>
    </div>
  );
}

