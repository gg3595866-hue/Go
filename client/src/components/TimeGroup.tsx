import { type Match } from "@shared/schema";
import MatchCard from "./MatchCard";
import { Clock } from "lucide-react";

interface TimeGroupProps {
  timeRange: string;
  matches: Match[];
}

export default function TimeGroup({ timeRange, matches }: TimeGroupProps) {
  return (
    <div className="mb-6" data-testid={`group-time-${timeRange}`}>
      {/* Time Header */}
      <div className="sticky top-[57px] z-40 bg-muted/50 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold" data-testid={`text-timerange-${timeRange}`}>
            {timeRange}
          </h2>
          <span className="text-xs text-muted-foreground ml-auto" data-testid={`text-match-count-${timeRange}`}>
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
      </div>

      {/* Matches */}
      <div className="space-y-3 p-4">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}
