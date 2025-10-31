import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

interface BulkUploadStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  totalMatches: number;
  processed: number;
  stored: number;
  currentMatch?: string;
  error?: string;
}

interface TestLoadStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  totalMatches: number;
  processed: number;
  loaded: number;
  currentMatch?: string;
  error?: string;
}

export default function BasketballProcessingPage() {
  const [databaseDate, setDatabaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [testerDate, setTesterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dbStatus, setDbStatus] = useState<BulkUploadStatus>({
    status: 'idle',
    totalMatches: 0,
    processed: 0,
    stored: 0,
  });
  const [testStatus, setTestStatus] = useState<TestLoadStatus>({
    status: 'idle',
    totalMatches: 0,
    processed: 0,
    loaded: 0,
  });

  const databaseUpload = useMutation({
    mutationFn: async (date: string) => {
      setDbStatus({
        status: 'processing',
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });

      const response = await fetch('/api/basketball/bulk-upload/database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date }),
      });

      if (!response.ok) {
        throw new Error('Failed to start bulk upload');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setDbStatus(prev => ({
                ...prev,
                ...data,
              }));
            } catch (error) {
              console.error('Failed to parse SSE data:', error);
            }
          }
        }
      }
    },
  });

  const testLoad = useMutation({
    mutationFn: async (date: string) => {
      setTestStatus({
        status: 'processing',
        totalMatches: 0,
        processed: 0,
        loaded: 0,
      });

      const response = await fetch('/api/basketball/bulk-upload/tester', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date }),
      });

      if (!response.ok) {
        throw new Error('Failed to start test loading');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setTestStatus(prev => ({
                ...prev,
                ...data,
              }));
            } catch (error) {
              console.error('Failed to parse SSE data:', error);
            }
          }
        }
      }
    },
  });

  const getProgressPercentage = (processed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((processed / total) * 100);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Basketball Processing</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Bulk Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label htmlFor="database-date" className="text-sm font-medium mb-1 block">
                    Select Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      id="database-date"
                      type="date"
                      value={databaseDate}
                      onChange={(e) => setDatabaseDate(e.target.value)}
                      className="pl-10 pr-3 py-2 border rounded-md w-full bg-background"
                      data-testid="input-database-date"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => databaseUpload.mutate(databaseDate)}
                  disabled={databaseUpload.isPending || dbStatus.status === 'processing'}
                  data-testid="button-database-upload"
                >
                  {dbStatus.status === 'processing' ? 'Processing...' : 'Start Upload'}
                </Button>
              </div>

              {dbStatus.status !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {dbStatus.processed} / {dbStatus.totalMatches} matches</span>
                    <span>{getProgressPercentage(dbStatus.processed, dbStatus.totalMatches)}%</span>
                  </div>
                  <Progress 
                    value={getProgressPercentage(dbStatus.processed, dbStatus.totalMatches)} 
                  />
                  {dbStatus.currentMatch && (
                    <p className="text-sm text-muted-foreground">
                      Current: {dbStatus.currentMatch}
                    </p>
                  )}
                  {dbStatus.status === 'completed' && (
                    <p className="text-sm font-medium text-green-600">
                      Completed! Stored {dbStatus.stored} matches in the database.
                    </p>
                  )}
                  {dbStatus.status === 'error' && (
                    <p className="text-sm font-medium text-destructive">
                      Error: {dbStatus.error}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Match Loading</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label htmlFor="tester-date" className="text-sm font-medium mb-1 block">
                    Select Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      id="tester-date"
                      type="date"
                      value={testerDate}
                      onChange={(e) => setTesterDate(e.target.value)}
                      className="pl-10 pr-3 py-2 border rounded-md w-full bg-background"
                      data-testid="input-tester-date"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => testLoad.mutate(testerDate)}
                  disabled={testLoad.isPending || testStatus.status === 'processing'}
                  data-testid="button-tester-load"
                >
                  {testStatus.status === 'processing' ? 'Processing...' : 'Load Test Matches'}
                </Button>
              </div>

              {testStatus.status !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {testStatus.processed} / {testStatus.totalMatches} matches</span>
                    <span>{getProgressPercentage(testStatus.processed, testStatus.totalMatches)}%</span>
                  </div>
                  <Progress 
                    value={getProgressPercentage(testStatus.processed, testStatus.totalMatches)} 
                  />
                  {testStatus.currentMatch && (
                    <p className="text-sm text-muted-foreground">
                      Current: {testStatus.currentMatch}
                    </p>
                  )}
                  {testStatus.status === 'completed' && (
                    <p className="text-sm font-medium text-green-600">
                      Completed! Loaded {testStatus.loaded} matches into the tester.
                    </p>
                  )}
                  {testStatus.status === 'error' && (
                    <p className="text-sm font-medium text-destructive">
                      Error: {testStatus.error}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}