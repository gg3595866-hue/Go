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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useState, useMemo } from "react";
import type { BasketballStats } from "@shared/schema";

const ITEMS_PER_PAGE = 50;

export default function BasketballDatabasePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  
  const { data: stats, isLoading } = useQuery<BasketballStats[]>({
    queryKey: ['/api/basketball-stats/database'],
  });

  const totalPages = useMemo(() => {
    if (!stats) return 0;
    return Math.ceil(stats.length / ITEMS_PER_PAGE);
  }, [stats]);

  const paginatedStats = useMemo(() => {
    if (!stats) return [];
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return stats.slice(startIndex, endIndex);
  }, [stats, currentPage]);

  const clearData = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/basketball-stats/database/clear', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear data');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/basketball-stats/database'] });
      toast({
        title: "Success",
        description: "All basketball database statistics have been cleared.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear basketball database statistics.",
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
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Basketball Database</h1>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <CardTitle>Basketball Statistics Database</CardTitle>
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
                      This action cannot be undone. This will permanently delete all basketball statistics from the database.
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
                    <TableHead className="min-w-[160px]">Home Pts Scored/Game</TableHead>
                    <TableHead className="min-w-[160px]">Away Pts Scored/Game</TableHead>
                    <TableHead className="min-w-[180px]">Home Pts Received/Game</TableHead>
                    <TableHead className="min-w-[180px]">Away Pts Received/Game</TableHead>
                    <TableHead className="min-w-[100px]">Home Won</TableHead>
                    <TableHead className="min-w-[100px]">Away Won</TableHead>
                    <TableHead className="min-w-[100px]">Home Tied</TableHead>
                    <TableHead className="min-w-[100px]">Away Tied</TableHead>
                    <TableHead className="min-w-[100px]">Home Lost</TableHead>
                    <TableHead className="min-w-[100px]">Away Lost</TableHead>
                    <TableHead className="min-w-[140px]">Home Avg Pts Q1</TableHead>
                    <TableHead className="min-w-[140px]">Away Avg Pts Q1</TableHead>
                    <TableHead className="min-w-[140px]">Home Avg Pts Q2</TableHead>
                    <TableHead className="min-w-[140px]">Away Avg Pts Q2</TableHead>
                    <TableHead className="min-w-[140px]">Home Avg Pts Q3</TableHead>
                    <TableHead className="min-w-[140px]">Away Avg Pts Q3</TableHead>
                    <TableHead className="min-w-[120px]">FT Home Pts</TableHead>
                    <TableHead className="min-w-[120px]">FT Away Pts</TableHead>
                    <TableHead className="min-w-[100px]">FT Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!stats || stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={24} className="text-center text-muted-foreground py-8" data-testid="text-no-data">
                        No data available. Add basketball statistics to see them here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStats.map((stat) => (
                      <TableRow key={stat.id} data-testid={`row-stat-${stat.id}`}>
                        <TableCell>{stat.id}</TableCell>
                        <TableCell>{stat.homeTeamId}</TableCell>
                        <TableCell>{stat.awayTeamId}</TableCell>
                        <TableCell>{stat.leagueId}</TableCell>
                        <TableCell>{stat.countryId}</TableCell>
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
                        <TableCell>{stat.ftHomePoints ?? '-'}</TableCell>
                        <TableCell>{stat.ftAwayPoints ?? '-'}</TableCell>
                        <TableCell>{stat.ftResult ?? '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {stats && stats.length > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, stats.length)} of {stats.length} entries
                </div>
                
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
