import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { MatchDetails } from "@shared/schema";

export default function MatchDetailsPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const matchUrl = decodeURIComponent(params.url || "");

  const { data: matchDetails, isLoading, error } = useQuery<MatchDetails>({
    queryKey: ['/api/match-details', matchUrl],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/match-details', { matchUrl });
      return await response.json();
    },
    enabled: !!matchUrl,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !matchDetails) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Fixtures
            </button>
          </Link>
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive">Failed to load match details</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, score, status, competition, homeTeamForm, awayTeamForm, homeTeamStats, awayTeamStats, headToHead, odds, insights, streaks } = matchDetails;

  const FormBadge = ({ result }: { result: 'W' | 'L' | 'D' }) => {
    const variants = {
      W: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
      L: 'bg-destructive/20 text-destructive border-destructive/30',
      D: 'bg-muted text-muted-foreground border-border',
    };
    return (
      <Badge variant="outline" className={`${variants[result]} text-xs font-bold`} data-testid={`badge-form-${result}`}>
        {result}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto p-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Fixtures
            </button>
          </Link>

          {/* Match Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-4">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-3 flex-1">
              {homeTeamLogo ? (
                <img src={homeTeamLogo} alt={homeTeam} className="w-20 h-20 object-contain" data-testid="img-home-team-logo" />
              ) : (
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">
                    {homeTeam.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-center" data-testid="text-home-team">{homeTeam}</h1>
              <div className="flex gap-1">
                {homeTeamForm.last5.map((result, i) => (
                  <FormBadge key={i} result={result} />
                ))}
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-2">
              <Badge variant={status === 'FT' ? 'secondary' : 'destructive'} data-testid="badge-match-status">
                {status}
              </Badge>
              <div className="text-5xl font-bold tabular-nums flex items-center gap-4" data-testid="text-final-score">
                <span>{score.home ?? '-'}</span>
                <span className="text-muted-foreground">:</span>
                <span>{score.away ?? '-'}</span>
              </div>
              {score.halfTime && (
                <div className="text-sm text-muted-foreground" data-testid="text-ht-score">
                  HT: {score.halfTime.home} - {score.halfTime.away}
                </div>
              )}
              <div className="text-sm text-muted-foreground">{competition}</div>
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center gap-3 flex-1">
              {awayTeamLogo ? (
                <img src={awayTeamLogo} alt={awayTeam} className="w-20 h-20 object-contain" data-testid="img-away-team-logo" />
              ) : (
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">
                    {awayTeam.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-center" data-testid="text-away-team">{awayTeam}</h1>
              <div className="flex gap-1">
                {awayTeamForm.last5.map((result, i) => (
                  <FormBadge key={i} result={result} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Betting Odds */}
        {odds && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Betting Odds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Home Win</div>
                  <div className="text-2xl font-bold" data-testid="text-odds-home">{odds.home.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{((1 / odds.home) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Draw</div>
                  <div className="text-2xl font-bold" data-testid="text-odds-draw">{odds.draw.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{((1 / odds.draw) * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Away Win</div>
                  <div className="text-2xl font-bold" data-testid="text-odds-away">{odds.away.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{((1 / odds.away) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Statistics Comparison */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Home Team Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{homeTeam} Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-semibold" data-testid="text-home-win-rate">{homeTeamStats.winPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goals Scored (Avg)</span>
                  <span className="font-semibold" data-testid="text-home-goals-scored">{homeTeamStats.goalsScored.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goals Conceded (Avg)</span>
                  <span className="font-semibold" data-testid="text-home-goals-conceded">{homeTeamStats.goalsConceded.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Clean Sheets</span>
                  <span className="font-semibold" data-testid="text-home-clean-sheets">{homeTeamStats.cleanSheetPercentage.toFixed(0)}%</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm font-medium mb-2">Form Scores</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Home</span>
                    <span className="font-semibold">{homeTeamForm.homeForm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Away</span>
                    <span className="font-semibold">{homeTeamForm.awayForm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overall</span>
                    <span className="font-semibold">{homeTeamForm.overallForm}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Away Team Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{awayTeam} Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-semibold" data-testid="text-away-win-rate">{awayTeamStats.winPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goals Scored (Avg)</span>
                  <span className="font-semibold" data-testid="text-away-goals-scored">{awayTeamStats.goalsScored.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goals Conceded (Avg)</span>
                  <span className="font-semibold" data-testid="text-away-goals-conceded">{awayTeamStats.goalsConceded.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Clean Sheets</span>
                  <span className="font-semibold" data-testid="text-away-clean-sheets">{awayTeamStats.cleanSheetPercentage.toFixed(0)}%</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm font-medium mb-2">Form Scores</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Home</span>
                    <span className="font-semibold">{awayTeamForm.homeForm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Away</span>
                    <span className="font-semibold">{awayTeamForm.awayForm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overall</span>
                    <span className="font-semibold">{awayTeamForm.overallForm}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Head to Head */}
        {headToHead && headToHead.totalMatches > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Head to Head</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                Last {headToHead.totalMatches} matches between these teams
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{headToHead.homeWins}</div>
                  <div className="text-xs text-muted-foreground">{homeTeam} Wins</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{headToHead.draws}</div>
                  <div className="text-xs text-muted-foreground">Draws</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{headToHead.awayWins}</div>
                  <div className="text-xs text-muted-foreground">{awayTeam} Wins</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Streaks & Insights */}
        {(streaks && streaks.length > 0) || (insights && insights.length > 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>Match Insights & Trends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {streaks && streaks.map((streak, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>{streak.description}</span>
                </div>
              ))}
              {insights && insights.slice(0, 8).map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Minus className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{insight}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* ML Training Data Notice */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ML Training Data Available
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This page contains comprehensive match data perfect for machine learning training and prediction models:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Team form sequences (W/L/D patterns)</li>
              <li>Performance metrics (goals, clean sheets, win rates)</li>
              <li>Head-to-head historical data</li>
              <li>Betting market intelligence (odds & probabilities)</li>
              <li>Trend analysis and streaks</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
