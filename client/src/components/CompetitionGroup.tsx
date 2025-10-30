import { type Match } from "@shared/schema";
import MatchCard from "./MatchCard";

interface CompetitionGroupProps {
  competition: string;
  competitionLogo?: string;
  matches: Match[];
}

export default function CompetitionGroup({ competition, competitionLogo, matches }: CompetitionGroupProps) {
  return (
    <div className="mb-6" data-testid={`group-competition-${competition}`}>
      {/* Competition Header */}
      <div className="sticky top-[57px] z-40 bg-muted/50 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {competitionLogo ? (
            <img
              src={competitionLogo}
              alt={competition}
              className="w-5 h-5 object-contain"
              data-testid={`img-competition-logo-${competition}`}
            />
          ) : (
            <div className="w-5 h-5 bg-primary/20 rounded-sm flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">⚽</span>
            </div>
          )}
          <h2 className="text-sm font-semibold uppercase tracking-wide" data-testid={`text-competition-${competition}`}>
            {competition}
          </h2>
          <span className="text-xs text-muted-foreground ml-auto" data-testid={`text-match-count-${competition}`}>
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
