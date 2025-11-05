import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { MatchDetails } from "@shared/schema";
import { useState } from "react";

export default function MatchDetailsPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const matchUrl = decodeURIComponent(params.url || "");
  
  const isBasketball = matchUrl.includes('/basketball/');
  const apiEndpoint = isBasketball ? '/api/basketball/match-details' : '/api/match-details';

  const { data: matchDetails, isLoading, error } = useQuery<any>({
    queryKey: [apiEndpoint, matchUrl],
    queryFn: async () => {
      return await apiRequest(apiEndpoint, {
        method: 'POST',
        body: JSON.stringify({ matchUrl }),
      });
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
          <Link href={isBasketball ? "/basketball" : "/football"}>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to {isBasketball ? 'Basketball' : 'Football'} Fixtures
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

  if (isBasketball) {
    const { homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, homeScore, awayScore, status, quarterScores, homeForm, awayForm, stats } = matchDetails;
    
    console.log('Basketball stats data:', JSON.stringify(stats, null, 2));
    
    const FormBadge = ({ result }: { result: 'W' | 'L' }) => {
      const variants = {
        W: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
        L: 'bg-destructive/20 text-destructive border-destructive/30',
      };
      return (
        <Badge variant="outline" className={`${variants[result]} text-xs font-bold`} data-testid={`badge-form-${result}`}>
          {result}
        </Badge>
      );
    };

    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-6xl mx-auto p-4">
            <Link href="/basketball">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                Back to Basketball Fixtures
              </button>
            </Link>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-4">
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
                {homeForm && homeForm.length > 0 && (
                  <div className="flex gap-1">
                    {homeForm.map((result: string, i: number) => (
                      <FormBadge key={i} result={result as 'W' | 'L'} />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <Badge variant={status === 'FT' ? 'secondary' : 'destructive'} data-testid="badge-match-status">
                  {status}
                </Badge>
                <div className="text-5xl font-bold tabular-nums flex items-center gap-4" data-testid="text-final-score">
                  <span>{homeScore ?? '-'}</span>
                  <span className="text-muted-foreground">:</span>
                  <span>{awayScore ?? '-'}</span>
                </div>
              </div>

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
                {awayForm && awayForm.length > 0 && (
                  <div className="flex gap-1">
                    {awayForm.map((result: string, i: number) => (
                      <FormBadge key={i} result={result as 'W' | 'L'} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 space-y-6">
          {quarterScores && (quarterScores.q1.home !== null || quarterScores.q2.home !== null) && (
            <Card>
              <CardHeader>
                <CardTitle>Quarter Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Q1</div>
                    <div className="text-lg font-bold">{quarterScores.q1.home ?? '-'}</div>
                    <div className="text-lg font-bold text-muted-foreground">{quarterScores.q1.away ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Q2</div>
                    <div className="text-lg font-bold">{quarterScores.q2.home ?? '-'}</div>
                    <div className="text-lg font-bold text-muted-foreground">{quarterScores.q2.away ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Q3</div>
                    <div className="text-lg font-bold">{quarterScores.q3.home ?? '-'}</div>
                    <div className="text-lg font-bold text-muted-foreground">{quarterScores.q3.away ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Q4</div>
                    <div className="text-lg font-bold">{quarterScores.q4.home ?? '-'}</div>
                    <div className="text-lg font-bold text-muted-foreground">{quarterScores.q4.away ?? '-'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stats && stats.pointStats && (stats.pointStats.home?.pointsScoredPerGame || stats.pointStats.away?.pointsScoredPerGame) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Point Stats</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary" data-testid="badge-team-new">{homeTeam.substring(0, 3).toUpperCase()}</Badge>
                  <Badge variant="secondary" data-testid="badge-team-bos">{awayTeam.substring(0, 3).toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overall" data-testid="tabs-point-stats">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="home" data-testid="tab-home">HOME</TabsTrigger>
                    <TabsTrigger value="overall" data-testid="tab-overall">OVERALL</TabsTrigger>
                    <TabsTrigger value="away" data-testid="tab-away">AWAY</TabsTrigger>
                  </TabsList>
                  <TabsContent value="home" className="space-y-4">
                    <div className="space-y-3">
                      {stats.pointStats.home?.pointsScoredPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-scored">
                            {stats.pointStats.home.pointsScoredPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Points<br/>Scored/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-scored">
                            {stats.pointStats.away?.pointsScoredPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                      {stats.pointStats.home?.pointsReceivedPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-received">
                            {stats.pointStats.home.pointsReceivedPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Points<br/>Received/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-received">
                            {stats.pointStats.away?.pointsReceivedPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                      {stats.pointStats.home?.totalPointsPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-total">
                            {stats.pointStats.home.totalPointsPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total<br/>Points/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-total">
                            {stats.pointStats.away?.totalPointsPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="overall" className="space-y-4">
                    <div className="space-y-3">
                      {stats.pointStats.home?.pointsScoredPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-scored-overall">
                            {stats.pointStats.home.pointsScoredPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Points<br/>Scored/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-scored-overall">
                            {stats.pointStats.away?.pointsScoredPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                      {stats.pointStats.home?.pointsReceivedPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-received-overall">
                            {stats.pointStats.home.pointsReceivedPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Points<br/>Received/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-received-overall">
                            {stats.pointStats.away?.pointsReceivedPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                      {stats.pointStats.home?.totalPointsPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-total-overall">
                            {stats.pointStats.home.totalPointsPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total<br/>Points/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-total-overall">
                            {stats.pointStats.away?.totalPointsPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="away" className="space-y-4">
                    <div className="space-y-3">
                      {stats.pointStats.home?.pointsScoredPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-scored-away">
                            {stats.pointStats.home.pointsScoredPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Points<br/>Scored/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-scored-away">
                            {stats.pointStats.away?.pointsScoredPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                      {stats.pointStats.home?.pointsReceivedPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-received-away">
                            {stats.pointStats.home.pointsReceivedPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Points<br/>Received/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-received-away">
                            {stats.pointStats.away?.pointsReceivedPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                      {stats.pointStats.home?.totalPointsPerGame !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="text-2xl font-bold text-destructive" data-testid="text-home-total-away">
                            {stats.pointStats.home.totalPointsPerGame.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total<br/>Points/Game</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-away-total-away">
                            {stats.pointStats.away?.totalPointsPerGame?.toFixed(2) ?? '-'}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {stats && stats.quarterStats && (stats.quarterStats.home?.wonPercent !== undefined || stats.quarterStats.away?.wonPercent !== undefined) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Quarter Stats</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary" data-testid="badge-team-new-quarter">{homeTeam.substring(0, 3).toUpperCase()}</Badge>
                  <Badge variant="secondary" data-testid="badge-team-bos-quarter">{awayTeam.substring(0, 3).toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="q1" data-testid="tabs-quarter-stats">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="q1" data-testid="tab-q1">1ST Q</TabsTrigger>
                    <TabsTrigger value="q2" data-testid="tab-q2">2ND Q</TabsTrigger>
                    <TabsTrigger value="q3" data-testid="tab-q3">3RD Q</TabsTrigger>
                    <TabsTrigger value="q4" data-testid="tab-q4">4TH Q</TabsTrigger>
                    <TabsTrigger value="fulltime" data-testid="tab-fulltime">FULL TIME</TabsTrigger>
                  </TabsList>
                  <TabsContent value="q1" className="space-y-4">
                    <div className="space-y-3">
                      {stats.quarterStats.home?.wonPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive" data-testid="text-q1-won-home">
                              {stats.quarterStats.home.wonPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Won</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-q1-won-away">
                              {stats.quarterStats.away?.wonPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">3 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.tiedPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive" data-testid="text-q1-tied-home">
                              {stats.quarterStats.home.tiedPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Tied</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-q1-tied-away">
                              {stats.quarterStats.away?.tiedPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.lostPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive" data-testid="text-q1-lost-home">
                              {stats.quarterStats.home.lostPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Lost</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-q1-lost-away">
                              {stats.quarterStats.away?.lostPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="q2" className="space-y-4">
                    <div className="space-y-3">
                      {stats.quarterStats.home?.wonPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.wonPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Won</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.wonPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">3 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.tiedPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.tiedPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Tied</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.tiedPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.lostPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.lostPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Lost</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.lostPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="q3" className="space-y-4">
                    <div className="space-y-3">
                      {stats.quarterStats.home?.wonPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.wonPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Won</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.wonPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">3 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.tiedPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.tiedPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Tied</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.tiedPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.lostPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.lostPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Lost</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.lostPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="q4" className="space-y-4">
                    <div className="space-y-3">
                      {stats.quarterStats.home?.wonPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.wonPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Won</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.wonPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">3 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.tiedPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.tiedPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Tied</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.tiedPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.lostPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.lostPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Lost</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.lostPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="fulltime" className="space-y-4">
                    <div className="space-y-3">
                      {stats.quarterStats.home?.wonPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.wonPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Won</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.wonPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">3 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.tiedPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.tiedPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Tied</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.tiedPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                      {stats.quarterStats.home?.lostPercent !== undefined && (
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-destructive">
                              {stats.quarterStats.home.lostPercent.toFixed(2)} %
                            </div>
                            <div className="text-xs text-muted-foreground">1 / 2</div>
                          </div>
                          <div className="text-sm text-muted-foreground">Lost</div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                              {stats.quarterStats.away?.lostPercent?.toFixed(2) ?? '0.00'} %
                            </div>
                            <div className="text-xs text-muted-foreground">0 / 3</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {stats && stats.avgPointsPerQuarter && (stats.avgPointsPerQuarter.home?.q1Percent !== undefined || stats.avgPointsPerQuarter.away?.q1Percent !== undefined) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Avg Points per Quarter</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary" data-testid="badge-team-new-avg">{homeTeam.substring(0, 3).toUpperCase()}</Badge>
                  <Badge variant="secondary" data-testid="badge-team-bos-avg">{awayTeam.substring(0, 3).toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.avgPointsPerQuarter.home?.q1Percent !== undefined && (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-destructive" data-testid="text-avg-q1-home">
                          {stats.avgPointsPerQuarter.home.q1Percent.toFixed(2)} %
                        </div>
                        <div className="text-xs text-muted-foreground">114 / 485</div>
                      </div>
                      <div className="text-sm text-muted-foreground">1st Q</div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-avg-q1-away">
                          {stats.avgPointsPerQuarter.away?.q1Percent?.toFixed(2) ?? '0.00'} %
                        </div>
                        <div className="text-xs text-muted-foreground">163 / 665</div>
                      </div>
                    </div>
                  )}
                  {stats.avgPointsPerQuarter.home?.q2Percent !== undefined && (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-destructive" data-testid="text-avg-q2-home">
                          {stats.avgPointsPerQuarter.home.q2Percent.toFixed(2)} %
                        </div>
                        <div className="text-xs text-muted-foreground">124 / 485</div>
                      </div>
                      <div className="text-sm text-muted-foreground">2nd Q</div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-avg-q2-away">
                          {stats.avgPointsPerQuarter.away?.q2Percent?.toFixed(2) ?? '0.00'} %
                        </div>
                        <div className="text-xs text-muted-foreground">171 / 665</div>
                      </div>
                    </div>
                  )}
                  {stats.avgPointsPerQuarter.home?.q3Percent !== undefined && (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-avg-q3-home">
                          {stats.avgPointsPerQuarter.home.q3Percent.toFixed(2)} %
                        </div>
                        <div className="text-xs text-muted-foreground">110 / 485</div>
                      </div>
                      <div className="text-sm text-muted-foreground">3rd Q</div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-destructive" data-testid="text-avg-q3-away">
                          {stats.avgPointsPerQuarter.away?.q3Percent?.toFixed(2) ?? '0.00'} %
                        </div>
                        <div className="text-xs text-muted-foreground">149 / 665</div>
                      </div>
                    </div>
                  )}
                  {stats.avgPointsPerQuarter.home?.q4Percent !== undefined && (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-destructive" data-testid="text-avg-q4-home">
                          {stats.avgPointsPerQuarter.home.q4Percent.toFixed(2)} %
                        </div>
                        <div className="text-xs text-muted-foreground">116 / 485</div>
                      </div>
                      <div className="text-sm text-muted-foreground">4th Q</div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="text-avg-q4-away">
                          {stats.avgPointsPerQuarter.away?.q4Percent?.toFixed(2) ?? '0.00'} %
                        </div>
                        <div className="text-xs text-muted-foreground">182 / 665</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const { homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, score, status, competition, homeTeamForm, awayTeamForm, homeTeamStats, awayTeamStats, headToHead, odds, oddsData, insights, streaks } = matchDetails;

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
          <Link href="/football">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Football Fixtures
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
        {(odds || oddsData) && (
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
                  <div className="text-sm text-muted-foreground mb-1">1 (Home Win)</div>
                  <div className="text-2xl font-bold" data-testid="text-odds-home">
                    {oddsData?.odds1 ? oddsData.odds1.toFixed(2) : odds?.home.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-prob-home">
                    {oddsData?.prob1 ? (oddsData.prob1 * 100).toFixed(0) : odds ? ((1 / odds.home) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">X (Draw)</div>
                  <div className="text-2xl font-bold" data-testid="text-odds-draw">
                    {oddsData?.oddsX ? oddsData.oddsX.toFixed(2) : odds?.draw.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-prob-draw">
                    {oddsData?.probX ? (oddsData.probX * 100).toFixed(0) : odds ? ((1 / odds.draw) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">2 (Away Win)</div>
                  <div className="text-2xl font-bold" data-testid="text-odds-away">
                    {oddsData?.odds2 ? oddsData.odds2.toFixed(2) : odds?.away.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-prob-away">
                    {oddsData?.prob2 ? (oddsData.prob2 * 100).toFixed(0) : odds ? ((1 / odds.away) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Scores Section */}
        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
            <p className="text-sm text-muted-foreground">Last 5 games</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">{homeTeam.substring(0, 3).toUpperCase()}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Stat</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">{awayTeam.substring(0, 3).toUpperCase()}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div className="font-semibold">{homeTeamForm.homeForm}</div>
                <div className="text-muted-foreground">Form Home</div>
                <div className="font-semibold">{awayTeamForm.homeForm}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div className="font-semibold">{homeTeamForm.awayForm}</div>
                <div className="text-muted-foreground">Form Away</div>
                <div className="font-semibold">{awayTeamForm.awayForm}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div className="font-semibold">{homeTeamForm.overallForm}</div>
                <div className="text-muted-foreground">Form Overall</div>
                <div className="font-semibold">{awayTeamForm.overallForm}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center text-sm border-t pt-2">
                <div className="font-semibold">{homeTeamForm.overallForm - awayTeamForm.overallForm}</div>
                <div className="text-muted-foreground">Form Difference (Overall)</div>
                <div className="font-semibold">{awayTeamForm.overallForm - homeTeamForm.overallForm}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Team Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {homeTeamStats.winPercentage > 0 && (
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{homeTeamStats.winPercentage.toFixed(2)}%</div>
                  </div>
                  <div className="text-muted-foreground">Wins</div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{awayTeamStats.winPercentage.toFixed(2)}%</div>
                  </div>
                </div>
              )}
              {homeTeamStats.drawPercentage !== undefined && (
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{homeTeamStats.drawPercentage.toFixed(2)}%</div>
                  </div>
                  <div className="text-muted-foreground">Draws</div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{awayTeamStats.drawPercentage?.toFixed(2)}%</div>
                  </div>
                </div>
              )}
              {homeTeamStats.lossPercentage !== undefined && (
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{homeTeamStats.lossPercentage.toFixed(2)}%</div>
                  </div>
                  <div className="text-muted-foreground">Losses</div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{awayTeamStats.lossPercentage?.toFixed(2)}%</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Double Chance */}
        {(homeTeamStats.doubleChance1X || homeTeamStats.doubleChanceX2 || homeTeamStats.doubleChance12) && (
          <Card>
            <CardHeader>
              <CardTitle>Double Chance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.doubleChance1X && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.doubleChance1X.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.doubleChance1X.count} / {homeTeamStats.doubleChance1X.total}</div>
                    </div>
                    <div className="text-muted-foreground">1X</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.doubleChance1X?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.doubleChance1X?.count} / {awayTeamStats.doubleChance1X?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.doubleChanceX2 && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.doubleChanceX2.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.doubleChanceX2.count} / {homeTeamStats.doubleChanceX2.total}</div>
                    </div>
                    <div className="text-muted-foreground">X2</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.doubleChanceX2?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.doubleChanceX2?.count} / {awayTeamStats.doubleChanceX2?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.doubleChance12 && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.doubleChance12.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.doubleChance12.count} / {homeTeamStats.doubleChance12.total}</div>
                    </div>
                    <div className="text-muted-foreground">12</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.doubleChance12?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.doubleChance12?.count} / {awayTeamStats.doubleChance12?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* To Nil */}
        {(homeTeamStats.winToNil || homeTeamStats.loseToNil) && (
          <Card>
            <CardHeader>
              <CardTitle>To Nil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.winToNil && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.winToNil.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.winToNil.count} / {homeTeamStats.winToNil.total}</div>
                    </div>
                    <div className="text-muted-foreground">Win to Nil</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.winToNil?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.winToNil?.count} / {awayTeamStats.winToNil?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.loseToNil && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.loseToNil.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.loseToNil.count} / {homeTeamStats.loseToNil.total}</div>
                    </div>
                    <div className="text-muted-foreground">Lose to Nil</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.loseToNil?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.loseToNil?.count} / {awayTeamStats.loseToNil?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Winning Margin */}
        {(homeTeamStats.winByOneGoal || homeTeamStats.winByTwoPlusGoals) && (
          <Card>
            <CardHeader>
              <CardTitle>Winning Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.winByOneGoal && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.winByOneGoal.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.winByOneGoal.count} / {homeTeamStats.winByOneGoal.total}</div>
                    </div>
                    <div className="text-muted-foreground">By 1 goal</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.winByOneGoal?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.winByOneGoal?.count} / {awayTeamStats.winByOneGoal?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.winByTwoPlusGoals && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.winByTwoPlusGoals.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.winByTwoPlusGoals.count} / {homeTeamStats.winByTwoPlusGoals.total}</div>
                    </div>
                    <div className="text-muted-foreground">By 2+ goals</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.winByTwoPlusGoals?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.winByTwoPlusGoals?.count} / {awayTeamStats.winByTwoPlusGoals?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals in Halves */}
        {(homeTeamStats.goalsInFirstHalf || homeTeamStats.goalsInSecondHalf) && (
          <Card>
            <CardHeader>
              <CardTitle>Number of goals in halves</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.goalsInFirstHalf && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.goalsInFirstHalf.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.goalsInFirstHalf.count} / {homeTeamStats.goalsInFirstHalf.total}</div>
                    </div>
                    <div className="text-muted-foreground">First Half</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.goalsInFirstHalf?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.goalsInFirstHalf?.count} / {awayTeamStats.goalsInFirstHalf?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.goalsInSecondHalf && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.goalsInSecondHalf.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.goalsInSecondHalf.count} / {homeTeamStats.goalsInSecondHalf.total}</div>
                    </div>
                    <div className="text-muted-foreground">Second Half</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.goalsInSecondHalf?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.goalsInSecondHalf?.count} / {awayTeamStats.goalsInSecondHalf?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* BTTS Stats */}
        {(homeTeamStats.btts || homeTeamStats.bttsAndOver25 || homeTeamStats.bttsAndWin || homeTeamStats.bttsAndLoss) && (
          <Card>
            <CardHeader>
              <CardTitle>BTTS Stats</CardTitle>
              <p className="text-sm text-muted-foreground">Both Teams To Score</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.btts?.overall && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.btts.overall.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.btts.overall.count} / {homeTeamStats.btts.overall.total}</div>
                    </div>
                    <div className="text-muted-foreground">BTTS</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.btts?.overall?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.btts?.overall?.count} / {awayTeamStats.btts?.overall?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.bttsAndOver25?.overall && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.bttsAndOver25.overall.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.bttsAndOver25.overall.count} / {homeTeamStats.bttsAndOver25.overall.total}</div>
                    </div>
                    <div className="text-muted-foreground">BTTS & Over 2.5</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.bttsAndOver25?.overall?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.bttsAndOver25?.overall?.count} / {awayTeamStats.bttsAndOver25?.overall?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.bttsAndWin?.overall && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.bttsAndWin.overall.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.bttsAndWin.overall.count} / {homeTeamStats.bttsAndWin.overall.total}</div>
                    </div>
                    <div className="text-muted-foreground">BTTS & Win</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.bttsAndWin?.overall?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.bttsAndWin?.overall?.count} / {awayTeamStats.bttsAndWin?.overall?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.bttsAndLoss?.overall && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.bttsAndLoss.overall.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.bttsAndLoss.overall.count} / {homeTeamStats.bttsAndLoss.overall.total}</div>
                    </div>
                    <div className="text-muted-foreground">BTTS & Loss</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.bttsAndLoss?.overall?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.bttsAndLoss?.overall?.count} / {awayTeamStats.bttsAndLoss?.overall?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals Scored Stats */}
        {(homeTeamStats.scoredPercent?.overall || homeTeamStats.scoredAgainstPercent?.overall) && (
          <Card>
            <CardHeader>
              <CardTitle>Goals Scored</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.scoredPercent?.overall && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.scoredPercent.overall.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.scoredPercent.overall.count} / {homeTeamStats.scoredPercent.overall.total}</div>
                    </div>
                    <div className="text-muted-foreground">Scored Percent</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.scoredPercent?.overall?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.scoredPercent?.overall?.count} / {awayTeamStats.scoredPercent?.overall?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.scoredAgainstPercent?.overall && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.scoredAgainstPercent.overall.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.scoredAgainstPercent.overall.count} / {homeTeamStats.scoredAgainstPercent.overall.total}</div>
                    </div>
                    <div className="text-muted-foreground">Scored Against Percent</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.scoredAgainstPercent?.overall?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.scoredAgainstPercent?.overall?.count} / {awayTeamStats.scoredAgainstPercent?.overall?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Halftime Stats */}
        {(homeTeamStats.halftimeStats && Object.keys(homeTeamStats.halftimeStats).length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Halftime Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.halftimeStats.wonFullTime && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.halftimeStats.wonFullTime.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.halftimeStats.wonFullTime.count} / {homeTeamStats.halftimeStats.wonFullTime.total}</div>
                    </div>
                    <div className="text-muted-foreground">Won</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.halftimeStats?.wonFullTime?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.halftimeStats?.wonFullTime?.count} / {awayTeamStats.halftimeStats?.wonFullTime?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.halftimeStats.tiedFullTime && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.halftimeStats.tiedFullTime.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.halftimeStats.tiedFullTime.count} / {homeTeamStats.halftimeStats.tiedFullTime.total}</div>
                    </div>
                    <div className="text-muted-foreground">Tied</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.halftimeStats?.tiedFullTime?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.halftimeStats?.tiedFullTime?.count} / {awayTeamStats.halftimeStats?.tiedFullTime?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.halftimeStats.lostFullTime && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.halftimeStats.lostFullTime.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.halftimeStats.lostFullTime.count} / {homeTeamStats.halftimeStats.lostFullTime.total}</div>
                    </div>
                    <div className="text-muted-foreground">Lost</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.halftimeStats?.lostFullTime?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.halftimeStats?.lostFullTime?.count} / {awayTeamStats.halftimeStats?.lostFullTime?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Over/Under Stats */}
        {(homeTeamStats.overUnder05 || homeTeamStats.overUnder15 || homeTeamStats.overUnder35) && (
          <Card>
            <CardHeader>
              <CardTitle>Over/Under Goals Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.overUnder05 && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.overUnder05.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.overUnder05.count} / {homeTeamStats.overUnder05.total}</div>
                    </div>
                    <div className="text-muted-foreground">Over 0.5 Goals</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.overUnder05?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.overUnder05?.count} / {awayTeamStats.overUnder05?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.overUnder15 && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.overUnder15.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.overUnder15.count} / {homeTeamStats.overUnder15.total}</div>
                    </div>
                    <div className="text-muted-foreground">Over 1.5 Goals</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.overUnder15?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.overUnder15?.count} / {awayTeamStats.overUnder15?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.overUnder35 && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.overUnder35.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.overUnder35.count} / {homeTeamStats.overUnder35.total}</div>
                    </div>
                    <div className="text-muted-foreground">Over 3.5 Goals</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.overUnder35?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.overUnder35?.count} / {awayTeamStats.overUnder35?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Home/Away Performance */}
        {(homeTeamStats.homeWinRate || homeTeamStats.awayWinRate) && (
          <Card>
            <CardHeader>
              <CardTitle>Home/Away Win Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.homeWinRate && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.homeWinRate.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.homeWinRate.count} / {homeTeamStats.homeWinRate.total}</div>
                    </div>
                    <div className="text-muted-foreground">Home Wins (at home)</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.homeWinRate?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.homeWinRate?.count} / {awayTeamStats.homeWinRate?.total}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.awayWinRate && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.awayWinRate.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{homeTeamStats.awayWinRate.count} / {homeTeamStats.awayWinRate.total}</div>
                    </div>
                    <div className="text-muted-foreground">Away Wins (on the road)</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.awayWinRate?.percentage.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground">{awayTeamStats.awayWinRate?.count} / {awayTeamStats.awayWinRate?.total}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* League Position & Points */}
        {(homeTeamStats.leaguePosition || homeTeamStats.pointsPerGame) && (
          <Card>
            <CardHeader>
              <CardTitle>League Standing & Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeTeamStats.leaguePosition !== undefined && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{homeTeamStats.leaguePosition}</div>
                    </div>
                    <div className="text-muted-foreground">League Position</div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{awayTeamStats.leaguePosition}</div>
                    </div>
                  </div>
                )}
                {homeTeamStats.pointsPerGame !== undefined && (
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{homeTeamStats.pointsPerGame.toFixed(2)}</div>
                    </div>
                    <div className="text-muted-foreground">Points Per Game</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{awayTeamStats.pointsPerGame?.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
