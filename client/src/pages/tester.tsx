import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Brain, Search } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { MatchStats, RatingPrediction } from "@shared/schema";

type EnrichedMatchStats = MatchStats & {
  homeTeamName: string;
  awayTeamName: string;
};

export default function TesterPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading } = useQuery<EnrichedMatchStats[]>({
    queryKey: ['/api/match-stats/tester'],
  });

  // Filter stats based on search query
  const filteredStats = stats?.filter((stat) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      stat.homeTeamName.toLowerCase().includes(query) ||
      stat.awayTeamName.toLowerCase().includes(query)
    );
  });

  const { data: predictions } = useQuery<RatingPrediction[]>({
    queryKey: ['/api/ml/predictions'],
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/ml/predict', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Predictions Completed",
        description: `Generated ${data.predictions} predictions for ${data.totalMatches} matches`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/predictions'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Prediction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearData = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/match-stats/tester/clear', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear data');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/match-stats/tester'] });
      toast({
        title: "Success",
        description: "All tester statistics have been cleared.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear tester statistics.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-full mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-full mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Tester</h1>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Match Statistics Tester</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => predictMutation.mutate()}
                  disabled={predictMutation.isPending || !stats || stats.length === 0}
                  data-testid="button-predict"
                  variant="default"
                >
                  {predictMutation.isPending ? (
                    <>Predicting...</>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Predict
                    </>
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={clearData.isPending || !stats || stats.length === 0}
                      data-testid="button-clear-tester"
                    >
                      Clear Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all match statistics from the tester database.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => clearData.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            {predictions && predictions.length > 0 && (
              <div className="mt-3 p-3 bg-primary/10 rounded-md">
                <p className="text-sm text-muted-foreground">
                  {predictions.length} prediction(s) available. Predictions shown alongside match statistics below.
                </p>
              </div>
            )}
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by team name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-teams"
                />
              </div>
              {searchQuery && filteredStats && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing {filteredStats.length} of {stats?.length || 0} match(es)
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">ID</TableHead>
                    <TableHead className="min-w-[150px]">Home Team</TableHead>
                    <TableHead className="min-w-[150px]">Away Team</TableHead>
                    <TableHead className="min-w-[100px]">Home Team ID</TableHead>
                    <TableHead className="min-w-[100px]">Away Team ID</TableHead>
                    <TableHead className="min-w-[100px]">League ID</TableHead>
                    <TableHead className="min-w-[100px]">Country ID</TableHead>
                    <TableHead className="min-w-[120px]">Home Form Home L5</TableHead>
                    <TableHead className="min-w-[120px]">Away Form Away L5</TableHead>
                    <TableHead className="min-w-[150px]">Home Form Overall L5</TableHead>
                    <TableHead className="min-w-[150px]">Away Form Overall L5</TableHead>
                    <TableHead className="min-w-[150px]">Form Diff Overall</TableHead>
                    <TableHead className="min-w-[120px]">Home Win Rate L8</TableHead>
                    <TableHead className="min-w-[120px]">Away Win Rate L8</TableHead>
                    <TableHead className="min-w-[120px]">Home Draw Rate L8</TableHead>
                    <TableHead className="min-w-[120px]">Away Draw Rate L8</TableHead>
                    <TableHead className="min-w-[120px]">Home Loss Rate L8</TableHead>
                    <TableHead className="min-w-[120px]">Away Loss Rate L8</TableHead>
                    <TableHead className="min-w-[140px]">Home To Nil Rate L8</TableHead>
                    <TableHead className="min-w-[140px]">Away To Nil Rate L8</TableHead>
                    <TableHead className="min-w-[180px]">Home Win Margin 1G L8</TableHead>
                    <TableHead className="min-w-[180px]">Away Win Margin 1G L8</TableHead>
                    <TableHead className="min-w-[180px]">Home Win Margin 2G L8</TableHead>
                    <TableHead className="min-w-[180px]">Away Win Margin 2G L8</TableHead>
                    <TableHead className="min-w-[160px]">Home 1H Goal Rate</TableHead>
                    <TableHead className="min-w-[160px]">Away 1H Goal Rate</TableHead>
                    <TableHead className="min-w-[160px]">Home 2H Goal Rate</TableHead>
                    <TableHead className="min-w-[160px]">Away 2H Goal Rate</TableHead>
                    <TableHead className="min-w-[140px]">Home BTTS Rate L4</TableHead>
                    <TableHead className="min-w-[140px]">Away BTTS Rate L4</TableHead>
                    <TableHead className="min-w-[160px]">Home Scored Rate L4</TableHead>
                    <TableHead className="min-w-[160px]">Away Scored Rate L4</TableHead>
                    <TableHead className="min-w-[180px]">Home Scored Against L4</TableHead>
                    <TableHead className="min-w-[180px]">Away Scored Against L4</TableHead>
                    <TableHead className="min-w-[150px]">Home HT Won Rate L8</TableHead>
                    <TableHead className="min-w-[150px]">Away HT Won Rate L8</TableHead>
                    <TableHead className="min-w-[160px]">Home HT Tied Rate L8</TableHead>
                    <TableHead className="min-w-[160px]">Away HT Tied Rate L8</TableHead>
                    <TableHead className="min-w-[160px]">Home HT Lost Rate L8</TableHead>
                    <TableHead className="min-w-[160px]">Away HT Lost Rate L8</TableHead>
                    <TableHead className="min-w-[140px]">Home Win Rate Home</TableHead>
                    <TableHead className="min-w-[140px]">Home Win Rate Away</TableHead>
                    <TableHead className="min-w-[140px]">Away Win Rate Home</TableHead>
                    <TableHead className="min-w-[140px]">Away Win Rate Away</TableHead>
                    <TableHead className="min-w-[140px]">Home PPG</TableHead>
                    <TableHead className="min-w-[140px]">Away PPG</TableHead>
                    <TableHead className="min-w-[140px]">Home Over 0.5</TableHead>
                    <TableHead className="min-w-[140px]">Away Over 0.5</TableHead>
                    <TableHead className="min-w-[140px]">Home Over 1.5</TableHead>
                    <TableHead className="min-w-[140px]">Away Over 1.5</TableHead>
                    <TableHead className="min-w-[140px]">Home Over 3.5</TableHead>
                    <TableHead className="min-w-[140px]">Away Over 3.5</TableHead>
                    <TableHead className="min-w-[160px]">Home Failed Score</TableHead>
                    <TableHead className="min-w-[160px]">Away Failed Score</TableHead>
                    <TableHead className="min-w-[160px]">Home Goals Half Ratio</TableHead>
                    <TableHead className="min-w-[160px]">Away Goals Half Ratio</TableHead>
                    <TableHead className="min-w-[160px]">Relative Attack</TableHead>
                    <TableHead className="min-w-[160px]">Relative Defense</TableHead>
                    <TableHead className="min-w-[160px]">Momentum Diff</TableHead>
                    <TableHead className="min-w-[160px]">Recent Goal Diff</TableHead>
                    <TableHead className="min-w-[160px]">Expected Win Ratio H</TableHead>
                    <TableHead className="min-w-[160px]">Expected Win Ratio A</TableHead>
                    <TableHead className="min-w-[160px]">Win to Odds Index H</TableHead>
                    <TableHead className="min-w-[160px]">Win to Odds Index A</TableHead>
                    <TableHead className="min-w-[140px]">Expected Value 1</TableHead>
                    <TableHead className="min-w-[140px]">Expected Value X</TableHead>
                    <TableHead className="min-w-[140px]">Expected Value 2</TableHead>
                    <TableHead className="min-w-[160px]">Market Exp Goals H</TableHead>
                    <TableHead className="min-w-[160px]">Market Exp Goals A</TableHead>
                    <TableHead className="min-w-[140px]">Home League Pos</TableHead>
                    <TableHead className="min-w-[140px]">Away League Pos</TableHead>
                    <TableHead className="min-w-[160px]">Home League Pos Norm</TableHead>
                    <TableHead className="min-w-[160px]">Away League Pos Norm</TableHead>
                    <TableHead className="min-w-[160px]">Home Win Margin Ratio</TableHead>
                    <TableHead className="min-w-[160px]">Away Win Margin Ratio</TableHead>
                    <TableHead className="min-w-[140px]">League Home Wins</TableHead>
                    <TableHead className="min-w-[120px]">League Draws</TableHead>
                    <TableHead className="min-w-[140px]">League Away Wins</TableHead>
                    <TableHead className="min-w-[140px]">League Under 2.5</TableHead>
                    <TableHead className="min-w-[140px]">League Over 2.5</TableHead>
                    <TableHead className="min-w-[140px]">League Avg Goals</TableHead>
                    <TableHead className="min-w-[100px]">Odds 1</TableHead>
                    <TableHead className="min-w-[100px]">Odds X</TableHead>
                    <TableHead className="min-w-[100px]">Odds 2</TableHead>
                    <TableHead className="min-w-[100px]">Prob 1</TableHead>
                    <TableHead className="min-w-[100px]">Prob X</TableHead>
                    <TableHead className="min-w-[100px]">Prob 2</TableHead>
                    <TableHead className="min-w-[120px]">Full Time Score</TableHead>
                    <TableHead className="min-w-[120px]">Half Time Score</TableHead>
                    <TableHead className="min-w-[100px]">FT Result</TableHead>
                    <TableHead className="min-w-[100px]">BTTS</TableHead>
                    <TableHead className="min-w-[120px]">Over 2.5</TableHead>
                    <TableHead className="min-w-[100px] bg-primary/5">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filteredStats || filteredStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={93} className="text-center text-muted-foreground py-8" data-testid="text-no-data">
                        {searchQuery ? `No matches found for "${searchQuery}"` : "No data available. Add match statistics to see them here."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStats.map((stat) => {
                      const prediction = predictions?.find(p => p.matchStatsId === stat.id);
                      return <TableRow key={stat.id} data-testid={`row-stat-${stat.id}`}>
                        <TableCell>{stat.id}</TableCell>
                        <TableCell className="font-medium capitalize">{stat.homeTeamName}</TableCell>
                        <TableCell className="font-medium capitalize">{stat.awayTeamName}</TableCell>
                        <TableCell>{stat.homeTeamId}</TableCell>
                        <TableCell>{stat.awayTeamId}</TableCell>
                        <TableCell>{stat.leagueId}</TableCell>
                        <TableCell>{stat.countryId}</TableCell>
                        <TableCell>{stat.homeTeamFormHomeL5}</TableCell>
                        <TableCell>{stat.awayTeamFormAwayL5}</TableCell>
                        <TableCell>{stat.homeTeamFormOverallL5}</TableCell>
                        <TableCell>{stat.awayTeamFormOverallL5}</TableCell>
                        <TableCell>{stat.homeTeamFormDiffOverall}</TableCell>
                        <TableCell>{(stat.homeTeamWinRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamWinRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamDrawRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamDrawRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamLossRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamLossRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamToNilRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamToNilRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamWinningMargin1GoalRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamWinningMargin1GoalRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamWinningMargin2GoalRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamWinningMargin2GoalRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamFirstHalfGoalRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamFirstHalfGoalRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamSecondHalfGoalRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamSecondHalfGoalRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamBttsRateL4 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamBttsRateL4 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamScoredRateL4 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamScoredRateL4 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamScoredAgainstRateL4 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamScoredAgainstRateL4 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamHtWonRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamHtWonRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamHtTiedRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamHtTiedRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamHtLostRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamHtLostRateL8 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamWinRateHome * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamWinRateAway * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamWinRateHome * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamWinRateAway * 100).toFixed(1)}%</TableCell>
                        <TableCell>{stat.homeTeamPointsPerGame.toFixed(2)}</TableCell>
                        <TableCell>{stat.awayTeamPointsPerGame.toFixed(2)}</TableCell>
                        <TableCell>{(stat.homeTeamOver05Rate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamOver05Rate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamOver15Rate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamOver15Rate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamOver35Rate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamOver35Rate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.homeTeamFailedToScoreRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.awayTeamFailedToScoreRate * 100).toFixed(1)}%</TableCell>
                        <TableCell>{stat.homeTeamGoalsPerHalfRatio.toFixed(2)}</TableCell>
                        <TableCell>{stat.awayTeamGoalsPerHalfRatio.toFixed(2)}</TableCell>
                        <TableCell>{stat.relativeAttackStrength.toFixed(2)}</TableCell>
                        <TableCell>{stat.relativeDefenseStrength.toFixed(2)}</TableCell>
                        <TableCell>{stat.momentumDifference.toFixed(2)}</TableCell>
                        <TableCell>{stat.recentGoalDifference.toFixed(2)}</TableCell>
                        <TableCell>{stat.expectedWinRatioHome.toFixed(2)}</TableCell>
                        <TableCell>{stat.expectedWinRatioAway.toFixed(2)}</TableCell>
                        <TableCell>{stat.winToOddsIndexHome.toFixed(2)}</TableCell>
                        <TableCell>{stat.winToOddsIndexAway.toFixed(2)}</TableCell>
                        <TableCell>{stat.expectedValue1.toFixed(2)}</TableCell>
                        <TableCell>{stat.expectedValueX.toFixed(2)}</TableCell>
                        <TableCell>{stat.expectedValue2.toFixed(2)}</TableCell>
                        <TableCell>{stat.marketExpectedGoalsHome.toFixed(2)}</TableCell>
                        <TableCell>{stat.marketExpectedGoalsAway.toFixed(2)}</TableCell>
                        <TableCell>{stat.homeTeamLeaguePosition}</TableCell>
                        <TableCell>{stat.awayTeamLeaguePosition}</TableCell>
                        <TableCell>{stat.homeTeamLeaguePositionNormalized.toFixed(2)}</TableCell>
                        <TableCell>{stat.awayTeamLeaguePositionNormalized.toFixed(2)}</TableCell>
                        <TableCell>{stat.homeTeamWinMarginRatio.toFixed(2)}</TableCell>
                        <TableCell>{stat.awayTeamWinMarginRatio.toFixed(2)}</TableCell>
                        <TableCell>{(stat.leagueHomeWins * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueDraws * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueAwayWins * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueUnder25 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueOver25 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{stat.leagueAvgGoals?.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.odds1?.toFixed(2) ?? '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-1x2-${stat.id}`}>
                                Pred: {prediction.predictedResult}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.oddsX?.toFixed(2) ?? '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-1x2-x-${stat.id}`}>
                                Pred: {prediction.predictedResult}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.odds2?.toFixed(2) ?? '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-1x2-2-${stat.id}`}>
                                Pred: {prediction.predictedResult}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.prob1 != null ? `${(stat.prob1 * 100).toFixed(0)}%` : '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-prob-1-${stat.id}`}>
                                Pred: {prediction.homeWinProb !== undefined ? (prediction.homeWinProb * 100).toFixed(0) + '%' : '-'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.probX != null ? `${(stat.probX * 100).toFixed(0)}%` : '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-prob-x-${stat.id}`}>
                                Pred: {prediction.drawProb !== undefined ? (prediction.drawProb * 100).toFixed(0) + '%' : '-'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.prob2 != null ? `${(stat.prob2 * 100).toFixed(0)}%` : '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-prob-2-${stat.id}`}>
                                Pred: {prediction.awayWinProb !== undefined ? (prediction.awayWinProb * 100).toFixed(0) + '%' : '-'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>
                              {stat.ftHomeScore !== null && stat.ftAwayScore !== null 
                                ? `FT ${stat.ftHomeScore}-${stat.ftAwayScore}` 
                                : '-'}
                            </div>
                            {prediction && prediction.predictedHomeScore !== null && prediction.predictedAwayScore !== null && (
                              <div className="text-xs text-primary" data-testid={`pred-ft-score-${stat.id}`}>
                                Pred: {prediction.predictedHomeScore.toFixed(1)}-{prediction.predictedAwayScore.toFixed(1)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>
                              {stat.htHomeScore !== null && stat.htAwayScore !== null 
                                ? `HT ${stat.htHomeScore}-${stat.htAwayScore}` 
                                : '-'}
                            </div>
                            {prediction && prediction.predictedHtHomeScore != null && prediction.predictedHtAwayScore != null && (
                              <div className="text-xs text-primary" data-testid={`pred-ht-score-${stat.id}`}>
                                Pred: {prediction.predictedHtHomeScore.toFixed(1)}-{prediction.predictedHtAwayScore.toFixed(1)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.ftResult ?? '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary font-medium" data-testid={`pred-result-${stat.id}`}>
                                Pred: {prediction.predictedResult}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.bttsYesNo === 1 ? 'Yes' : stat.bttsYesNo === 0 ? 'No' : '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-btts-${stat.id}`}>
                                Pred: {prediction.predictedBtts ? 'Yes' : 'No'} ({(prediction.bttsProb * 100).toFixed(0)}%)
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{stat.uO25Goals === 1 ? 'Over' : stat.uO25Goals === 0 ? 'Under' : '-'}</div>
                            {prediction && (
                              <div className="text-xs text-primary" data-testid={`pred-over-${stat.id}`}>
                                Pred: {prediction.predictedOver25 ? 'Over' : 'Under'} ({(prediction.over25Prob * 100).toFixed(0)}%)
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="bg-primary/5" data-testid={`pred-confidence-${stat.id}`}>
                          {prediction ? `${(prediction.confidence * 100).toFixed(0)}%` : '-'}
                        </TableCell>
                      </TableRow>;
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}