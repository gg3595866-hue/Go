import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
import type { MatchStats } from "@shared/schema";

export default function DatabasePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: stats, isLoading } = useQuery<MatchStats[]>({
    queryKey: ['/api/match-stats/database'],
  });

  const clearData = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/match-stats/database/clear', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear data');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/match-stats/database'] });
      toast({
        title: "Success",
        description: "All database statistics have been cleared.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear database statistics.",
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
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Database</h1>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Match Statistics Database</CardTitle>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={clearData.isPending || !stats || stats.length === 0}
                    data-testid="button-clear-database"
                  >
                    Clear Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all match statistics from the database.
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
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">ID</TableHead>
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
                    <TableHead className="min-w-[140px]">League Home Wins</TableHead>
                    <TableHead className="min-w-[120px]">League Draws</TableHead>
                    <TableHead className="min-w-[140px]">League Away Wins</TableHead>
                    <TableHead className="min-w-[140px]">League Under 2.5</TableHead>
                    <TableHead className="min-w-[140px]">League Over 2.5</TableHead>
                    <TableHead className="min-w-[140px]">League Avg Goals</TableHead>
                    <TableHead className="min-w-[120px]">FT Home Score</TableHead>
                    <TableHead className="min-w-[120px]">FT Away Score</TableHead>
                    <TableHead className="min-w-[120px]">HT Home Score</TableHead>
                    <TableHead className="min-w-[120px]">HT Away Score</TableHead>
                    <TableHead className="min-w-[100px]">FT Result</TableHead>
                    <TableHead className="min-w-[100px]">BTTS</TableHead>
                    <TableHead className="min-w-[120px]">Over 2.5</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!stats || stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={51} className="text-center text-muted-foreground py-8" data-testid="text-no-data">
                        No data available. Add match statistics to see them here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.map((stat) => (
                      <TableRow key={stat.id} data-testid={`row-stat-${stat.id}`}>
                        <TableCell>{stat.id}</TableCell>
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
                        <TableCell>{(stat.leagueHomeWins * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueDraws * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueAwayWins * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueUnder25 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(stat.leagueOver25 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{stat.leagueAvgGoals?.toFixed(2)}</TableCell>
                        <TableCell>{stat.ftHomeScore ?? '-'}</TableCell>
                        <TableCell>{stat.ftAwayScore ?? '-'}</TableCell>
                        <TableCell>{stat.htHomeScore ?? '-'}</TableCell>
                        <TableCell>{stat.htAwayScore ?? '-'}</TableCell>
                        <TableCell>{stat.ftResult ?? '-'}</TableCell>
                        <TableCell>{stat.bttsYesNo === 1 ? 'Yes' : stat.bttsYesNo === 0 ? 'No' : '-'}</TableCell>
                        <TableCell>{stat.uO25Goals === 1 ? 'Over' : stat.uO25Goals === 0 ? 'Under' : '-'}</TableCell>
                      </TableRow>
                    ))
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
