import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  Zap
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "error" | "warning" | "click" | "auto-click";
  row: number | null;
  cell: number | null;
  message: string;
  source: "extension" | "webapp" | "system";
}

interface CellState {
  row: number;
  cell: number;
  status: "idle" | "selected" | "success" | "fail" | "pending";
  clickedBy: "extension" | "webapp" | "auto" | null;
  timestamp: Date | null;
}

export default function WitchAnalyzerPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentRow, setCurrentRow] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
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

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setLogs(prev => [...prev, newEntry]);
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

      case "play_started":
        setIsPlaying(true);
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: "Play button clicked - Auto-play started",
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
        const { row: resultRow, success, cellClicked } = data;
        addLog({
          type: success ? "success" : "error",
          row: resultRow,
          cell: cellClicked,
          message: `Row ${resultRow}: ${success ? "SUCCESS" : "FAILED"} - Cell ${cellClicked} was clicked`,
          source: "extension",
        });
        updateCellStatus(resultRow, cellClicked, success ? "success" : "fail", "auto");
        break;

      case "game_state":
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: `Game state update: ${JSON.stringify(data.state)}`,
          source: "extension",
        });
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
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: `Received: ${JSON.stringify(data)}`,
          source: "extension",
        });
    }
  }, [addLog]);

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
    addLog({
      type: "click",
      row,
      cell,
      message: `Clicked cell ${cell} in row ${row} from webapp`,
      source: "webapp",
    });
  }, [sendToExtension, updateCellStatus, addLog]);

  const handlePlay = useCallback(() => {
    sendToExtension({ action: "start_play" });
    setIsPlaying(true);
  }, [sendToExtension]);

  const handlePause = useCallback(() => {
    sendToExtension({ action: "stop_play" });
    setIsPlaying(false);
  }, [sendToExtension]);

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
    addLog({
      type: "info",
      row: null,
      cell: null,
      message: "Grid reset",
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
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const stats = {
    totalClicks: logs.filter(l => l.type === "click" || l.type === "auto-click").length,
    successes: logs.filter(l => l.type === "success").length,
    failures: logs.filter(l => l.type === "error").length,
    currentRow,
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Witch Analyzer</h1>
        <p className="text-muted-foreground">
          Real-time grid monitoring and extension control panel
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className="font-medium">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"} data-testid="status-connection">
              {isConnected ? "Online" : "Offline"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="font-medium">Current Row</span>
            </div>
            <Badge variant="outline" data-testid="text-current-row">{currentRow}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium">Success Rate</span>
            </div>
            <Badge variant="outline" data-testid="text-success-rate">
              {stats.successes}/{stats.successes + stats.failures}
            </Badge>
          </CardContent>
        </Card>
      </div>

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
                  <span className="w-6 text-xs font-medium text-muted-foreground">
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

            <div className="mt-4 flex items-center gap-4 text-xs">
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
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 p-2 rounded-md text-sm ${
                        log.type === "error"
                          ? "bg-red-500/10"
                          : log.type === "success"
                          ? "bg-green-500/10"
                          : log.type === "auto-click"
                          ? "bg-purple-500/10"
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
                        <p className="text-foreground break-words">{log.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

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
                Download and install the browser extension to connect with the game website.
                The extension will send real-time updates as you play.
              </p>
              <Button
                onClick={handleDownloadExtension}
                className="flex items-center gap-2"
                data-testid="button-download-extension"
              >
                <Download className="w-4 h-4" />
                Download Extension (v6.0)
              </Button>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Installation:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Download and extract the ZIP file</li>
                  <li>Open Chrome and go to chrome://extensions</li>
                  <li>Enable "Developer mode" in the top right</li>
                  <li>Click "Load unpacked" and select the extracted folder</li>
                  <li>The extension will auto-connect to this panel</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-md">
              <div className="text-2xl font-bold" data-testid="text-total-clicks">{stats.totalClicks}</div>
              <div className="text-sm text-muted-foreground">Total Clicks</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-md">
              <div className="text-2xl font-bold text-green-600" data-testid="text-successes">{stats.successes}</div>
              <div className="text-sm text-muted-foreground">Successes</div>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-md">
              <div className="text-2xl font-bold text-red-600" data-testid="text-failures">{stats.failures}</div>
              <div className="text-sm text-muted-foreground">Failures</div>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-md">
              <div className="text-2xl font-bold text-primary" data-testid="text-row-progress">{currentRow}/10</div>
              <div className="text-sm text-muted-foreground">Row Progress</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
