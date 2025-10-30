import { type Match } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface MatchCardProps {
  match: Match;
}

export default function MatchCard({ match }: MatchCardProps) {
  const isFinished = match.status === 'FT';
  const isLive = match.status === 'LIVE';
  const isScheduled = match.status === 'SCHEDULED';

  return (
    <div 
      className="bg-card border border-card-border rounded-md p-4 hover-elevate active-elevate-2 cursor-pointer"
      data-testid={`card-match-${match.id}`}
    >
      <div className="flex items-center gap-4">
        {/* Time/Status Column */}
        <div className="flex flex-col items-center justify-center w-14 flex-shrink-0">
          {isFinished && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-status-ft">
              FT
            </Badge>
          )}
          {isLive && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <Badge variant="destructive" className="text-xs" data-testid="badge-status-live">
                LIVE
              </Badge>
            </div>
          )}
          {isScheduled && (
            <span className="text-sm font-medium tabular-nums" data-testid="text-match-time">
              {match.time}
            </span>
          )}
        </div>

        {/* Teams Section */}
        <div className="flex-1 flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {match.homeTeamLogo ? (
              <img
                src={match.homeTeamLogo}
                alt={match.homeTeam}
                className="w-8 h-8 object-contain flex-shrink-0"
                data-testid={`img-logo-${match.homeTeam}`}
              />
            ) : (
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-muted-foreground">
                  {match.homeTeam.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-medium truncate" data-testid={`text-team-${match.homeTeam}`}>
              {match.homeTeam}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
            {match.homeScore !== null && match.awayScore !== null ? (
              <>
                <div className="flex items-center gap-2 text-xl font-bold tabular-nums" data-testid="text-score">
                  <span>{match.homeScore}</span>
                  <span className="text-muted-foreground">-</span>
                  <span>{match.awayScore}</span>
                </div>
                {match.homeHalfScore !== null && match.awayHalfScore !== null && (
                  <div className="text-xs text-muted-foreground tabular-nums" data-testid="text-halftime-score">
                    ({match.homeHalfScore} - {match.awayHalfScore})
                  </div>
                )}
              </>
            ) : (
              <div className="text-xl font-bold text-muted-foreground">-</div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {match.awayTeamLogo ? (
              <img
                src={match.awayTeamLogo}
                alt={match.awayTeam}
                className="w-8 h-8 object-contain flex-shrink-0"
                data-testid={`img-logo-${match.awayTeam}`}
              />
            ) : (
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-muted-foreground">
                  {match.awayTeam.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-medium truncate" data-testid={`text-team-${match.awayTeam}`}>
              {match.awayTeam}
            </span>
          </div>
        </div>

        {/* Odds Section */}
        {match.odds && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground">1</span>
              <span className="text-sm font-medium tabular-nums" data-testid="text-odds-home">
                {match.odds.home.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground">X</span>
              <span className="text-sm font-medium tabular-nums" data-testid="text-odds-draw">
                {match.odds.draw.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground">2</span>
              <span className="text-sm font-medium tabular-nums" data-testid="text-odds-away">
                {match.odds.away.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
