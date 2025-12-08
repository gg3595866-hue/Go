import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Target,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Radio,
  Eye,
  Save,
  RotateCcw,
  Network,
  Database,
  Key
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "error" | "warning" | "click" | "auto-click" | "network" | "token";
  row: number | null;
  cell: number | null;
  message: string;
  source: "extension" | "webapp" | "system" | "mimick";
}

interface CellState {
  row: number;
  cell: number;
  status: "idle" | "selected" | "success" | "fail" | "pending";
  clickedBy: "extension" | "webapp" | "auto" | null;
  timestamp: Date | null;
}

interface MimickSession {
  id: string;
  startTime: string;
  endTime?: string;
  requests: any[];
  responses: any[];
  websockets: any[];
  tokens: Record<string, any>;
  cellClicks: any[];
  rowResults: any[];
  gameState?: any;
  storedAt?: string;
}

interface CapturedToken {
  key: string;
  value: any;
  timestamp: string;
}

export default function WitchAnalyzerPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentRow, setCurrentRow] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [capturedTokens, setCapturedTokens] = useState<CapturedToken[]>([]);
  const [networkCaptures, setNetworkCaptures] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [grid, setGrid] = useState<CellState[][]>(() => 
    Array.from({ length: 10 }, (_, rowIndex) =>
      Array.from({ length: 5 }, (_, cellIndex) => ({
        row: rowIndex + 1,
        cell: cellIndex + 1,
        status: "idle" as const,
        clickedBy: null,
        timestamp: null,
      }))
    )
  );
  
  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: sessionsData, refetch: refetchSessions } = useQuery<{
    sessions: MimickSession[];
    goldenFlows: MimickSession[];
    totalCaptures: number;
  }>({
    queryKey: ['/api/witch/mimick/sessions'],
    refetchInterval: 5000
  });

  const saveGoldenFlowMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest('/api/witch/mimick/golden-flow', {
        method: 'POST',
        body: JSON.stringify({ sessionId })
      });
    },
    onSuccess: () => {
      refetchSessions();
      addLog({
        type: "success",
        row: null,
        cell: null,
        message: "Golden flow saved successfully",
        source: "system"
      });
    }
  });

  const clearSessionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/witch/mimick/sessions', { method: 'DELETE' });
    },
    onSuccess: () => {
      refetchSessions();
      addLog({
        type: "info",
        row: null,
        cell: null,
        message: "All sessions cleared",
        source: "system"
      });
    }
  });

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setLogs(prev => [...prev.slice(-500), newEntry]);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/witch`;
    
    addLog({
      type: "info",
      row: null,
      cell: null,
      message: "Connecting to WebSocket server...",
      source: "system",
    });

    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setIsConnected(true);
      addLog({
        type: "success",
        row: null,
        cell: null,
        message: "Connected to extension server",
        source: "system",
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      addLog({
        type: "warning",
        row: null,
        cell: null,
        message: "Disconnected from server. Reconnecting...",
        source: "system",
      });
      
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, [addLog]);

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case "extension_connected":
        addLog({
          type: "success",
          row: null,
          cell: null,
          message: "Browser extension connected successfully",
          source: "extension",
        });
        break;

      case "mimick_spy_ready":
        addLog({
          type: "success",
          row: null,
          cell: null,
          message: "Mimick Spy initialized and ready to capture",
          source: "mimick",
        });
        if (data.capturedTokens) {
          const tokens = Object.entries(data.capturedTokens).map(([key, value]) => ({
            key,
            value,
            timestamp: new Date().toISOString()
          }));
          setCapturedTokens(prev => [...prev, ...tokens]);
        }
        break;

      case "mimick_recording_started":
        setIsRecording(true);
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: `Recording started: ${data.sessionId}`,
          source: "mimick",
        });
        break;

      case "mimick_recording_stopped":
        setIsRecording(false);
        refetchSessions();
        addLog({
          type: "success",
          row: null,
          cell: null,
          message: "Recording stopped - session captured",
          source: "mimick",
        });
        break;

      case "mimick_request":
      case "mimick_response":
        setNetworkCaptures(prev => [...prev.slice(-100), {
          ...data.data,
          captureType: data.type,
          timestamp: new Date().toISOString()
        }]);
        addLog({
          type: "network",
          row: null,
          cell: null,
          message: `${data.type === 'mimick_request' ? 'REQ' : 'RES'}: ${data.data?.method || ''} ${data.data?.url?.substring(0, 50) || ''}`,
          source: "mimick",
        });
        break;

      case "mimick_token":
        setCapturedTokens(prev => [...prev, {
          key: data.data.key,
          value: data.data.value,
          timestamp: new Date().toISOString()
        }]);
        addLog({
          type: "token",
          row: null,
          cell: null,
          message: `Token captured: ${data.data.key}`,
          source: "mimick",
        });
        break;

      case "replay_action_executed":
        addLog({
          type: data.success ? "success" : "error",
          row: data.action?.row || null,
          cell: data.action?.cell || null,
          message: `Replay: ${data.success ? 'Executed' : 'Failed'} - Row ${data.action?.row}, Cell ${data.action?.cell}`,
          source: "mimick",
        });
        break;

      case "replay_completed":
        addLog({
          type: "success",
          row: null,
          cell: null,
          message: "Replay completed",
          source: "mimick",
        });
        break;

      case "play_started":
        setIsPlaying(true);
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: "Play button clicked - Game started",
          source: "extension",
        });
        break;

      case "play_stopped":
        setIsPlaying(false);
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: "Play stopped",
          source: "extension",
        });
        break;

      case "cell_selected":
        const { row, cell, result, autoClicked } = data;
        setCurrentRow(row);
        updateCellStatus(row, cell, result === "success" ? "success" : result === "fail" ? "fail" : "selected", autoClicked ? "auto" : "extension");
        addLog({
          type: autoClicked ? "auto-click" : "click",
          row,
          cell,
          message: `${autoClicked ? "Auto-clicked" : "Selected"} cell ${cell} in row ${row}${result ? ` - ${result.toUpperCase()}` : ""}`,
          source: "extension",
        });
        break;

      case "row_result":
        const { row: resultRow, success, cellClicked, cellState } = data;
        addLog({
          type: success ? "success" : "error",
          row: resultRow,
          cell: cellClicked,
          message: `Row ${resultRow}: ${success ? "SUCCESS" : "FAILED"} - Cell ${cellClicked}`,
          source: "extension",
        });
        updateCellStatus(resultRow, cellClicked, success ? "success" : "fail", "auto");
        if (success) {
          setCurrentRow(resultRow + 1);
        }
        break;

      case "game_state":
        if (data.state?.rowResults) {
          data.state.rowResults.forEach((rowResult: any) => {
            rowResult.cells.forEach((cellData: any) => {
              if (cellData.state === 'win' || cellData.state === 'lose') {
                updateCellStatus(rowResult.row, cellData.cell, cellData.state === 'win' ? 'success' : 'fail', 'auto');
              }
            });
          });
        }
        if (data.state?.activeRow) {
          setCurrentRow(data.state.activeRow);
        }
        if (data.state?.isGameEnded) {
          setIsPlaying(false);
        }
        break;

      case "error":
        addLog({
          type: "error",
          row: data.row || null,
          cell: data.cell || null,
          message: data.message || "Unknown error from extension",
          source: "extension",
        });
        break;

      default:
        if (data.type !== "welcome" && data.type !== "pong") {
          addLog({
            type: "info",
            row: null,
            cell: null,
            message: `Received: ${JSON.stringify(data).substring(0, 100)}`,
            source: "extension",
          });
        }
    }
  }, [addLog, refetchSessions]);

  const updateCellStatus = useCallback((row: number, cell: number, status: CellState["status"], clickedBy: CellState["clickedBy"]) => {
    setGrid(prev => prev.map((rowCells, rowIdx) =>
      rowIdx === row - 1
        ? rowCells.map((cellState, cellIdx) =>
            cellIdx === cell - 1
              ? { ...cellState, status, clickedBy, timestamp: new Date() }
              : cellState
          )
        : rowCells
    ));
  }, []);

  const sendToExtension = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      addLog({
        type: "info",
        row: message.row || null,
        cell: message.cell || null,
        message: `Sent to extension: ${message.action}`,
        source: "webapp",
      });
    } else {
      addLog({
        type: "error",
        row: null,
        cell: null,
        message: "Cannot send message - not connected to extension",
        source: "system",
      });
    }
  }, [addLog]);

  const handleCellClick = useCallback((row: number, cell: number) => {
    updateCellStatus(row, cell, "pending", "webapp");
    sendToExtension({
      action: "click_cell",
      row,
      cell,
    });
  }, [sendToExtension, updateCellStatus]);

  const handlePlay = useCallback(() => {
    sendToExtension({ action: "start_play" });
    setIsPlaying(true);
  }, [sendToExtension]);

  const handlePause = useCallback(() => {
    sendToExtension({ action: "stop_play" });
    setIsPlaying(false);
  }, [sendToExtension]);

  const handleStartRecording = useCallback(() => {
    sendToExtension({ action: "start_mimick_recording" });
    setIsRecording(true);
  }, [sendToExtension]);

  const handleStopRecording = useCallback(() => {
    sendToExtension({ action: "stop_mimick_recording" });
    setIsRecording(false);
  }, [sendToExtension]);

  const handleReplaySession = useCallback((sessionId: string) => {
    sendToExtension({ 
      action: "start_replay",
      sessionId: sessionId
    });
    addLog({
      type: "info",
      row: null,
      cell: null,
      message: `Starting replay of session: ${sessionId}`,
      source: "webapp"
    });
  }, [sendToExtension, addLog]);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
    addLog({
      type: "info",
      row: null,
      cell: null,
      message: "Logs cleared",
      source: "system",
    });
  }, [addLog]);

  const handleResetGrid = useCallback(() => {
    setGrid(Array.from({ length: 10 }, (_, rowIndex) =>
      Array.from({ length: 5 }, (_, cellIndex) => ({
        row: rowIndex + 1,
        cell: cellIndex + 1,
        status: "idle" as const,
        clickedBy: null,
        timestamp: null,
      }))
    ));
    setCurrentRow(1);
    setNetworkCaptures([]);
    setCapturedTokens([]);
    addLog({
      type: "info",
      row: null,
      cell: null,
      message: "Grid and captures reset",
      source: "system",
    });
  }, [addLog]);

  const handleDownloadExtension = useCallback(() => {
    window.open("/api/witch/extension/download", "_blank");
    addLog({
      type: "info",
      row: null,
      cell: null,
      message: "Extension download initiated",
      source: "system",
    });
  }, [addLog]);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getCellClassName = (cell: CellState) => {
    const baseClass = "w-10 h-10 flex items-center justify-center text-sm font-medium rounded-md border cursor-pointer transition-all duration-200";
    
    switch (cell.status) {
      case "success":
        return `${baseClass} bg-green-500/20 border-green-500 text-green-600 dark:text-green-400`;
      case "fail":
        return `${baseClass} bg-red-500/20 border-red-500 text-red-600 dark:text-red-400`;
      case "selected":
        return `${baseClass} bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400`;
      case "pending":
        return `${baseClass} bg-yellow-500/20 border-yellow-500 text-yellow-600 dark:text-yellow-400 animate-pulse`;
      default:
        return `${baseClass} bg-card border-border hover-elevate active-elevate-2`;
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "click":
        return <Target className="w-4 h-4 text-blue-500" />;
      case "auto-click":
        return <Zap className="w-4 h-4 text-purple-500" />;
      case "network":
        return <Network className="w-4 h-4 text-cyan-500" />;
      case "token":
        return <Key className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const stats = {
    totalClicks: logs.filter(l => l.type === "click" || l.type === "auto-click").length,
    successes: grid.flat().filter(c => c.status === "success").length,
    failures: grid.flat().filter(c => c.status === "fail").length,
    currentRow,
    networkCaptures: networkCaptures.length,
    tokens: capturedTokens.length,
    sessions: sessionsData?.sessions?.length || 0
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Witch Analyzer Pro</h1>
        <p className="text-muted-foreground">
          Advanced game monitoring with Mimick Spy - Full network capture and replay
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium">Status</span>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"} data-testid="status-connection">
              {isConnected ? "Online" : "Offline"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <Radio className={`w-4 h-4 ${isRecording ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
            <Badge variant={isRecording ? "destructive" : "outline"} data-testid="status-recording">
              {isRecording ? "Recording" : "Idle"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <Target className="w-4 h-4 text-primary" />
            <Badge variant="outline" data-testid="text-current-row">Row {currentRow}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <Badge variant="outline" data-testid="text-success-count">{stats.successes}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <XCircle className="w-4 h-4 text-red-500" />
            <Badge variant="outline" data-testid="text-failure-count">{stats.failures}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <Network className="w-4 h-4 text-cyan-500" />
            <Badge variant="outline" data-testid="text-network-count">{stats.networkCaptures}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <Database className="w-4 h-4 text-purple-500" />
            <Badge variant="outline" data-testid="text-sessions-count">{stats.sessions}</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="grid" data-testid="tab-grid">Game Grid</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
          <TabsTrigger value="network" data-testid="tab-network">Network</TabsTrigger>
          <TabsTrigger value="tokens" data-testid="tab-tokens">Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-lg">10x5 Grid</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetGrid}
                    data-testid="button-reset-grid"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {grid.map((row, rowIndex) => (
                    <div 
                      key={rowIndex} 
                      className={`flex items-center gap-1 ${rowIndex + 1 === currentRow ? "bg-primary/10 rounded-md p-1 -mx-1" : ""}`}
                    >
                      <span className="w-8 text-xs font-medium text-muted-foreground">
                        R{rowIndex + 1}
                      </span>
                      {row.map((cell) => (
                        <button
                          key={`${cell.row}-${cell.cell}`}
                          className={getCellClassName(cell)}
                          onClick={() => handleCellClick(cell.row, cell.cell)}
                          data-testid={`cell-${cell.row}-${cell.cell}`}
                        >
                          {cell.cell}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs flex-wrap">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500" />
                    <span>Success</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500" />
                    <span>Fail</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500" />
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500" />
                    <span>Pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-lg">Live Logs</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearLogs}
                  data-testid="button-clear-logs"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4" ref={logContainerRef}>
                  <div className="space-y-2">
                    {logs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No logs yet. Connect extension and start playing.
                      </div>
                    ) : (
                      logs.slice(-100).map((log) => (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2 p-2 rounded-md text-sm ${
                            log.type === "error"
                              ? "bg-red-500/10"
                              : log.type === "success"
                              ? "bg-green-500/10"
                              : log.type === "auto-click"
                              ? "bg-purple-500/10"
                              : log.type === "network"
                              ? "bg-cyan-500/10"
                              : log.type === "token"
                              ? "bg-orange-500/10"
                              : "bg-muted/50"
                          }`}
                          data-testid={`log-${log.id}`}
                        >
                          {getLogIcon(log.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {log.timestamp.toLocaleTimeString()}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.source}
                              </Badge>
                              {log.row && (
                                <Badge variant="secondary" className="text-xs">
                                  R{log.row}
                                </Badge>
                              )}
                              {log.cell && (
                                <Badge variant="secondary" className="text-xs">
                                  C{log.cell}
                                </Badge>
                              )}
                            </div>
                            <p className="text-foreground break-words text-xs">{log.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-lg">Captured Sessions</CardTitle>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => clearSessionsMutation.mutate()}
                  disabled={clearSessionsMutation.isPending}
                  data-testid="button-clear-sessions"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
                    <div className="space-y-2">
                      {sessionsData.sessions.slice().reverse().map((session) => (
                        <div
                          key={session.id}
                          className={`p-3 rounded-md border cursor-pointer transition-all ${
                            selectedSession === session.id 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover-elevate'
                          }`}
                          onClick={() => setSelectedSession(session.id)}
                          data-testid={`session-${session.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{session.id.substring(0, 20)}...</span>
                            <Badge variant="outline" className="text-xs">
                              {session.cellClicks?.length || 0} clicks
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(session.startTime).toLocaleTimeString()}</span>
                            <span>-</span>
                            <span>{session.rowResults?.length || 0} results</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplaySession(session.id);
                              }}
                              data-testid={`button-replay-${session.id}`}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Replay
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveGoldenFlowMutation.mutate(session.id);
                              }}
                              data-testid={`button-save-golden-${session.id}`}
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Save as Golden
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No sessions captured yet. Start recording and play a game.
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Golden Flows</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {sessionsData?.goldenFlows && sessionsData.goldenFlows.length > 0 ? (
                    <div className="space-y-2">
                      {sessionsData.goldenFlows.map((flow) => (
                        <div
                          key={flow.id}
                          className="p-3 rounded-md border border-yellow-500/50 bg-yellow-500/10"
                          data-testid={`golden-flow-${flow.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{flow.id.substring(0, 20)}...</span>
                            <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500">
                              Golden
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {flow.cellClicks?.length || 0} clicks | {flow.rowResults?.length || 0} results
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleReplaySession(flow.id)}
                            data-testid={`button-replay-golden-${flow.id}`}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Auto-Play This Flow
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No golden flows saved. Save a successful session as a golden flow.
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg">Network Captures ({networkCaptures.length})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNetworkCaptures([])}
                data-testid="button-clear-network"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {networkCaptures.length > 0 ? (
                  <div className="space-y-2">
                    {networkCaptures.slice().reverse().map((capture, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-md border text-xs ${
                          capture.captureType === 'mimick_request' 
                            ? 'border-blue-500/30 bg-blue-500/5' 
                            : 'border-green-500/30 bg-green-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {capture.captureType === 'mimick_request' ? 'REQ' : 'RES'}
                          </Badge>
                          <span className="font-mono">{capture.method || 'GET'}</span>
                          {capture.status && (
                            <Badge variant={capture.status < 400 ? "default" : "destructive"}>
                              {capture.status}
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-muted-foreground truncate">{capture.url}</p>
                        {capture.isGameRelated && (
                          <Badge className="mt-1 bg-purple-500/20 text-purple-600 border-purple-500">
                            Game Related
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No network captures yet. Network traffic will appear here during recording.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg">Captured Tokens ({capturedTokens.length})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCapturedTokens([])}
                data-testid="button-clear-tokens"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {capturedTokens.length > 0 ? (
                  <div className="space-y-2">
                    {capturedTokens.slice().reverse().map((token, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md border border-orange-500/30 bg-orange-500/5"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{token.key}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(token.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          {typeof token.value === 'object' 
                            ? JSON.stringify(token.value).substring(0, 100) 
                            : String(token.value).substring(0, 100)}
                          {(typeof token.value === 'string' && token.value.length > 100) ? '...' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No tokens captured yet. CSRF tokens, session IDs, and auth tokens will appear here.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={isPlaying ? handlePause : handlePlay}
                className="flex items-center gap-2"
                variant={isPlaying ? "destructive" : "default"}
                disabled={!isConnected}
                data-testid="button-play-pause"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Play
                  </>
                )}
              </Button>

              <Button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className="flex items-center gap-2"
                variant={isRecording ? "destructive" : "outline"}
                disabled={!isConnected}
                data-testid="button-record"
              >
                {isRecording ? (
                  <>
                    <Radio className="w-4 h-4 animate-pulse" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    Start Recording
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2">
                <Switch
                  checked={autoPlay}
                  onCheckedChange={(checked) => {
                    setAutoPlay(checked);
                    sendToExtension({ action: "set_auto_play", enabled: checked });
                  }}
                  disabled={!isConnected}
                  data-testid="switch-auto-play"
                />
                <span className="text-sm">Auto Play</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Extension</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Download v7.0 with Mimick Spy for full network capture and replay.
              </p>
              <Button
                onClick={handleDownloadExtension}
                className="flex items-center gap-2"
                data-testid="button-download-extension"
              >
                <Download className="w-4 h-4" />
                Download Extension (v7.0)
              </Button>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Features:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Full network request/response capture</li>
                  <li>Session recording and replay</li>
                  <li>Token and auth header capture</li>
                  <li>Golden flow saving for auto-play</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
