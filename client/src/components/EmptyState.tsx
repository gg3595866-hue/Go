import { CalendarOff } from "lucide-react";

interface EmptyStateProps {
  message?: string;
  suggestion?: string;
}

export default function EmptyState({ 
  message = "No fixtures scheduled for this date",
  suggestion = "Try selecting another date"
}: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-[400px] p-8"
      data-testid="component-empty-state"
    >
      <CalendarOff className="w-16 h-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-message">
        {message}
      </h3>
      <p className="text-sm text-muted-foreground" data-testid="text-empty-suggestion">
        {suggestion}
      </p>
    </div>
  );
}
