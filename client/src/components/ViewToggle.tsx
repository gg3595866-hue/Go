interface ViewToggleProps {
  view: 'competition' | 'time';
  onViewChange: (view: 'competition' | 'time') => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
      <span className="text-sm text-muted-foreground">Group by</span>
      <div className="flex items-center gap-1 bg-muted rounded-md p-1">
        <button
          onClick={() => onViewChange('competition')}
          data-testid="button-view-competition"
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
            view === 'competition'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover-elevate'
          }`}
        >
          competition
        </button>
        <button
          onClick={() => onViewChange('time')}
          data-testid="button-view-time"
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
            view === 'time'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover-elevate'
          }`}
        >
          time
        </button>
      </div>
    </div>
  );
}
