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
import type { BasketballStats, BasketballPrediction } from "@shared/schema";

type EnrichedBasketballStats = BasketballStats & {
  homeTeamName: string;
  awayTeamName: string;
};

export default function BasketballTesterPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: stats, isLoading } = useQuery<EnrichedBasketballStats[]>({
    queryKey: ['/api/basketball-stats/tester'],
  });

  const filteredStats = stats?.filter((stat) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      stat.homeTeamName.toLowerCase().includes(query) ||
      stat.awayTeamName.toLowerCase().includes(query)
    );
  });

  const { data: predictions } = useQuery<BasketballPrediction[]>({
    queryKey: ['/api/basketball/ml/predictions'],
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/basketball/ml/predict', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Predictions Completed",
        description: `Generated ${data.predictions} predictions for ${data.totalMatches} matches`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/basketball/ml/predictions'] });
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
      const response = await fetch('/api/basketball-stats/tester/clear', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear data');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/basketball-stats/tester'] });
      toast({
        title: "Success",
        description: "All basketball tester statistics have been cleared.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear basketball tester statistics.",
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
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Basketball Tester</h1>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <CardTitle>Basketball Statistics Tester</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => predictMutation.mutate()}
                  disabled={predictMutation.isPending || !stats || stats.length === 0}
                  data-testid="button-predict"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  {predictMutation.isPending ? "Predicting..." : "Predict All"}
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
                        This action cannot be undone. This will permanently delete all basketball statistics from the tester database.
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
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by team name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">ID</TableHead>
                    <TableHead className="min-w-[150px]">Home Team</TableHead>
                    <TableHead className="min-w-[150px]">Away Team</TableHead>
                    <TableHead className="min-w-[130px]">Home Pts Scored/G</TableHead>
                    <TableHead className="min-w-[130px]">Away Pts Scored/G</TableHead>
                    <TableHead className="min-w-[140px]">Home Pts Received/G</TableHead>
                    <TableHead className="min-w-[140px]">Away Pts Received/G</TableHead>
                    <TableHead className="min-w-[80px]">H Won</TableHead>
                    <TableHead className="min-w-[80px]">A Won</TableHead>
                    <TableHead className="min-w-[80px]">H Tied</TableHead>
                    <TableHead className="min-w-[80px]">A Tied</TableHead>
                    <TableHead className="min-w-[80px]">H Lost</TableHead>
                    <TableHead className="min-w-[80px]">A Lost</TableHead>
                    <TableHead className="min-w-[100px]">H Avg Q1</TableHead>
                    <TableHead className="min-w-[100px]">A Avg Q1</TableHead>
                    <TableHead className="min-w-[100px]">H Avg Q2</TableHead>
                    <TableHead className="min-w-[100px]">A Avg Q2</TableHead>
                    <TableHead className="min-w-[100px]">H Avg Q3</TableHead>
                    <TableHead className="min-w-[100px]">A Avg Q3</TableHead>
                    <TableHead className="min-w-[100px]">H Avg Q4</TableHead>
                    <TableHead className="min-w-[100px]">A Avg Q4</TableHead>
                    <TableHead className="min-w-[110px]">Prediction</TableHead>
                    <TableHead className="min-w-[120px]">Predicted Score</TableHead>
                    <TableHead className="min-w-[100px]">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filteredStats || filteredStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={24} className="text-center text-muted-foreground py-8" data-testid="text-no-data">
                        {searchQuery.trim() ? "No matches found." : "No data available. Add basketball statistics to see them here."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStats.map((stat) => {
                      const prediction = predictions?.find(p => p.basketballStatsId === stat.id);
                      
                      return (
                        <TableRow key={stat.id} data-testid={`row-stat-${stat.id}`}>
                          <TableCell>{stat.id}</TableCell>
                          <TableCell className="font-medium">{stat.homeTeamName}</TableCell>
                          <TableCell className="font-medium">{stat.awayTeamName}</TableCell>
                          <TableCell>{stat.homePointsScoredPerGame.toFixed(1)}</TableCell>
                          <TableCell>{stat.awayPointsScoredPerGame.toFixed(1)}</TableCell>
                          <TableCell>{stat.homePointsReceivedPerGame.toFixed(1)}</TableCell>
                          <TableCell>{stat.awayPointsReceivedPerGame.toFixed(1)}</TableCell>
                          <TableCell>{stat.homeWon}</TableCell>
                          <TableCell>{stat.awayWon}</TableCell>
                          <TableCell>{stat.homeTied}</TableCell>
                          <TableCell>{stat.awayTied}</TableCell>
                          <TableCell>{stat.homeLost}</TableCell>
                          <TableCell>{stat.awayLost}</TableCell>
                          <TableCell>{stat.homeAvgPointsQ1.toFixed(1)}</TableCell>
                          <TableCell>{stat.awayAvgPointsQ1.toFixed(1)}</TableCell>
                          <TableCell>{stat.homeAvgPointsQ2.toFixed(1)}</TableCell>
                          <TableCell>{stat.awayAvgPointsQ2.toFixed(1)}</TableCell>
                          <TableCell>{stat.homeAvgPointsQ3.toFixed(1)}</TableCell>
                          <TableCell>{stat.awayAvgPointsQ3.toFixed(1)}</TableCell>
                          <TableCell>{stat.homeAvgPointsQ4.toFixed(1)}</TableCell>
                          <TableCell>{stat.awayAvgPointsQ4.toFixed(1)}</TableCell>
                          <TableCell>
                            {prediction ? (
                              <span className="font-semibold">
                                {prediction.predResult === 'H' ? stat.homeTeamName : stat.awayTeamName}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {prediction ? (
                              `${prediction.predHomePoints.toFixed(0)} - ${prediction.predAwayPoints.toFixed(0)}`
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {prediction ? (
                              `${(prediction.confidence * 100).toFixed(1)}%`
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      );
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
