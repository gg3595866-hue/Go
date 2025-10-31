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

export default function ProcessingPage() {
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

      const response = await fetch('/api/bulk-upload/database', {
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

      const response = await fetch('/api/bulk-upload/tester', {
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

  const handleDatabaseUpload = () => {
    if (dbStatus.status === 'processing') return;
    databaseUpload.mutate(databaseDate);
  };

  const handleTestLoad = () => {
    if (testStatus.status === 'processing') return;
    testLoad.mutate(testerDate);
  };

  const getProgress = (processed: number, total: number) => {
    if (total === 0) return 0;
    return (processed / total) * 100;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Processing</h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Database Bulk Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Database Bulk Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Date:</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="date"
                      value={databaseDate}
                      onChange={(e) => setDatabaseDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-md bg-background"
                      data-testid="input-database-date"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleDatabaseUpload}
                disabled={dbStatus.status === 'processing'}
                className="w-full"
                data-testid="button-start-database-upload"
              >
                {dbStatus.status === 'processing' ? 'PROCESSING...' : 'START BULK UPLOAD'}
              </Button>

              <div className="space-y-3 p-4 bg-muted/30 rounded-md">
                <div>
                  <div className="text-sm font-medium text-primary mb-1">STATUS:</div>
                  <div className="text-lg font-bold capitalize" data-testid="text-db-status">
                    {dbStatus.status}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">PROGRESS:</div>
                  <div className="text-lg font-bold mb-2" data-testid="text-db-progress">
                    {getProgress(dbStatus.processed, dbStatus.totalMatches).toFixed(0)}%
                  </div>
                  <Progress value={getProgress(dbStatus.processed, dbStatus.totalMatches)} />
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">TOTAL MATCHES:</div>
                  <div className="text-lg font-bold" data-testid="text-db-total">
                    {dbStatus.totalMatches}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">PROCESSED:</div>
                  <div className="text-lg font-bold" data-testid="text-db-processed">
                    {dbStatus.processed}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">STORED:</div>
                  <div className="text-lg font-bold" data-testid="text-db-stored">
                    {dbStatus.stored}
                  </div>
                </div>

                {dbStatus.currentMatch && (
                  <div>
                    <div className="text-sm font-medium text-primary mb-1">CURRENT:</div>
                    <div className="text-sm" data-testid="text-db-current">
                      {dbStatus.currentMatch}
                    </div>
                  </div>
                )}

                {dbStatus.error && (
                  <div>
                    <div className="text-sm font-medium text-destructive mb-1">ERROR:</div>
                    <div className="text-sm text-destructive" data-testid="text-db-error">
                      {dbStatus.error}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Test Match Loading */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Test Match Loading</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Date:</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="date"
                      value={testerDate}
                      onChange={(e) => setTesterDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-md bg-background"
                      data-testid="input-tester-date"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleTestLoad}
                disabled={testStatus.status === 'processing'}
                className="w-full"
                data-testid="button-start-test-load"
              >
                {testStatus.status === 'processing' ? 'PROCESSING...' : 'START TEST LOADING'}
              </Button>

              <div className="space-y-3 p-4 bg-muted/30 rounded-md">
                <div>
                  <div className="text-sm font-medium text-primary mb-1">STATUS:</div>
                  <div className="text-lg font-bold capitalize" data-testid="text-test-status">
                    {testStatus.status}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">PROGRESS:</div>
                  <div className="text-lg font-bold mb-2" data-testid="text-test-progress">
                    {getProgress(testStatus.processed, testStatus.totalMatches).toFixed(0)}%
                  </div>
                  <Progress value={getProgress(testStatus.processed, testStatus.totalMatches)} />
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">TOTAL MATCHES:</div>
                  <div className="text-lg font-bold" data-testid="text-test-total">
                    {testStatus.totalMatches}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">PROCESSED:</div>
                  <div className="text-lg font-bold" data-testid="text-test-processed">
                    {testStatus.processed}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-primary mb-1">LOADED:</div>
                  <div className="text-lg font-bold" data-testid="text-test-loaded">
                    {testStatus.loaded}
                  </div>
                </div>

                {testStatus.currentMatch && (
                  <div>
                    <div className="text-sm font-medium text-primary mb-1">CURRENT:</div>
                    <div className="text-sm" data-testid="text-test-current">
                      {testStatus.currentMatch}
                    </div>
                  </div>
                )}

                {testStatus.error && (
                  <div>
                    <div className="text-sm font-medium text-destructive mb-1">ERROR:</div>
                    <div className="text-sm text-destructive" data-testid="text-test-error">
                      {testStatus.error}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
