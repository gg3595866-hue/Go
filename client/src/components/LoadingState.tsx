export default function LoadingState() {
  return (
    <div className="space-y-6 p-4" data-testid="component-loading-state">
      {[1, 2, 3].map((group) => (
        <div key={group} className="space-y-3">
          {/* Competition Header Skeleton */}
          <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
          
          {/* Match Cards Skeleton */}
          {[1, 2, 3].map((match) => (
            <div 
              key={match}
              className="bg-card border border-card-border rounded-md p-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-8 bg-muted rounded animate-pulse" />
                <div className="flex-1 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="w-16 h-8 bg-muted rounded animate-pulse" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="hidden sm:flex gap-2">
                  <div className="w-12 h-8 bg-muted rounded animate-pulse" />
                  <div className="w-12 h-8 bg-muted rounded animate-pulse" />
                  <div className="w-12 h-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
