import { type Match } from "@shared/schema";
import MatchCard from "./MatchCard";
import { Button } from "@/components/ui/button";
import { Database, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface CompetitionGroupProps {
  competition: string;
  competitionLogo?: string;
  matches: Match[];
}

interface UploadProgress {
  status: string;
  message?: string;
  totalMatches: number;
  processed: number;
  stored: number;
}

export default function CompetitionGroup({ competition, competitionLogo, matches }: CompetitionGroupProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const { toast } = useToast();

  // Generate year options (current year down to 10 years ago)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => currentYear - i);

  const handleBulkUpload = async () => {
    if (!selectedYear) {
      toast({
        title: "Year required",
        description: "Please select a year to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({
      status: 'starting',
      message: 'Starting upload...',
      totalMatches: 0,
      processed: 0,
      stored: 0,
    });

    try {
      const response = await fetch('/api/bulk-upload/league', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competition,
          year: parseInt(selectedYear),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk upload');
      }

      // Set up reader to listen for SSE progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Buffer for incomplete lines
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split by newlines
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        // Process complete lines
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              // Extract JSON data after "data: " prefix and trim any whitespace/CR
              const jsonStr = trimmedLine.substring(6).trim();
              const data = JSON.parse(jsonStr);
              setUploadProgress(data);

              if (data.status === 'completed') {
                toast({
                  title: "Upload completed",
                  description: `Successfully stored ${data.stored} matches for ${competition} ${selectedYear}`,
                });
                setIsUploading(false);
                setTimeout(() => {
                  setIsDialogOpen(false);
                  setUploadProgress(null);
                  setSelectedYear('');
                }, 2000);
              } else if (data.status === 'error') {
                toast({
                  title: "Upload failed",
                  description: data.error || 'An error occurred during upload',
                  variant: "destructive",
                });
                setIsUploading(false);
              }
            } catch (error) {
              console.error('Failed to parse SSE data:', error, 'Line:', line);
            }
          }
        }
      }

      // Process any remaining data in buffer
      const trimmedBuffer = buffer.trim();
      if (trimmedBuffer && trimmedBuffer.startsWith('data: ')) {
        try {
          const jsonStr = trimmedBuffer.substring(6).trim();
          const data = JSON.parse(jsonStr);
          setUploadProgress(data);

          if (data.status === 'completed') {
            toast({
              title: "Upload completed",
              description: `Successfully stored ${data.stored} matches for ${competition} ${selectedYear}`,
            });
            setIsUploading(false);
            setTimeout(() => {
              setIsDialogOpen(false);
              setUploadProgress(null);
              setSelectedYear('');
            }, 2000);
          } else if (data.status === 'error') {
            toast({
              title: "Upload failed",
              description: data.error || 'An error occurred during upload',
              variant: "destructive",
            });
            setIsUploading(false);
          }
        } catch (error) {
          console.error('Failed to parse final SSE data:', error);
        }
      }

      // Safety: If stream ended without completion/error, reset state
      if (isUploading) {
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const progressPercentage = uploadProgress
    ? uploadProgress.totalMatches > 0
      ? Math.round((uploadProgress.processed / uploadProgress.totalMatches) * 100)
      : 0
    : 0;

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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDialogOpen(true)}
            data-testid={`button-league-upload-${competition}`}
            className="ml-2"
          >
            <Database className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Matches */}
      <div className="space-y-3 p-4">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>

      {/* League Bulk Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid={`dialog-league-upload-${competition}`}>
          <DialogHeader>
            <DialogTitle>League Bulk Upload</DialogTitle>
            <DialogDescription>
              Upload historical matches for {competition} to the training database.
              Select a year to fetch all matches from that season.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="year-select" className="text-sm font-medium">
                Select Year
              </label>
              <Select
                value={selectedYear}
                onValueChange={setSelectedYear}
                disabled={isUploading}
              >
                <SelectTrigger id="year-select" data-testid="select-year-trigger">
                  <SelectValue placeholder="Choose a year..." />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()} data-testid={`select-year-${year}`}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {uploadProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {uploadProgress.message || `${uploadProgress.status}...`}
                  </span>
                  <span className="font-medium">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} data-testid="progress-upload" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Processed: {uploadProgress.processed}/{uploadProgress.totalMatches || 0}</span>
                  <span>Stored: {uploadProgress.stored}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isUploading}
              data-testid="button-cancel-upload"
            >
              {isUploading ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={isUploading || !selectedYear}
              data-testid="button-start-upload"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Start Upload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
