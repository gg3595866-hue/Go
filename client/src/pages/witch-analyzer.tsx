import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Key,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Timer,
  Copy,
  Send,
  RefreshCw
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

// ============================================================
// Parses a JS fetch() call string into { url, method, headers, body }
// ============================================================
function parseFetchCall(raw: string): { url: string; method: string; headers: Record<string, string>; body: string | null } | null {
  try {
    // Extract first string argument (URL)
    const urlMatch = raw.match(/fetch\s*\(\s*["'`]([^"'`]+)["'`]/);
    if (!urlMatch) return null;
    const url = urlMatch[1];

    // Extract the options object literal as text
    const optionsMatch = raw.match(/fetch\s*\([^,]+,\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
    if (!optionsMatch) return { url, method: "GET", headers: {}, body: null };

    const optText = optionsMatch[1];

    // method
    const methodMatch = optText.match(/"method"\s*:\s*"([A-Z]+)"/);
    const method = methodMatch ? methodMatch[1] : "GET";

    // body
    const bodyMatch = optText.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    let body: string | null = null;
    if (bodyMatch) {
      body = bodyMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // headers — extract the "headers" block
    const headersMatch = optText.match(/"headers"\s*:\s*\{([\s\S]*?)\},/);
    const headers: Record<string, string> = {};
    if (headersMatch) {
      const hBlock = headersMatch[1];
      const pairs = hBlock.matchAll(/"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
      for (const [, k, v] of pairs) {
        headers[k] = v.replace(/\\"/g, '"');
      }
    }

    return { url, method, headers, body };
  } catch {
    return null;
  }
}

function toYaml(obj: any, indent = 0): string {
  if (obj === null) return "null";
  if (typeof obj === "boolean" || typeof obj === "number") return String(obj);
  if (typeof obj === "string") return obj.includes("\n") ? `|\n${obj.split("\n").map(l => "  ".repeat(indent + 1) + l).join("\n")}` : obj;
  if (Array.isArray(obj)) {
    return obj.map(v => "  ".repeat(indent) + "- " + toYaml(v, indent + 1)).join("\n");
  }
  return Object.entries(obj)
    .map(([k, v]) => {
      const valStr = typeof v === "object" && v !== null
        ? "\n" + toYaml(v, indent + 1)
        : " " + toYaml(v, indent + 1);
      return "  ".repeat(indent) + k + ":" + valStr;
    })
    .join("\n");
}

function toHex(str: string): string {
  return Array.from(str.slice(0, 512))
    .map(c => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join(" ");
}

function toBase64(str: string): string {
  try { return btoa(unescape(encodeURIComponent(str))); } catch { return btoa(str.slice(0, 1000)); }
}

function flattenObject(obj: any, prefix = ""): Array<{ key: string; value: string; type: string }> {
  const rows: Array<{ key: string; value: string; type: string }> = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      rows.push(...flattenObject(v, fullKey));
    } else {
      rows.push({ key: fullKey, value: Array.isArray(v) ? JSON.stringify(v) : String(v ?? ""), type: typeof v });
    }
  }
  return rows;
}

function ApiProxyTab() {
  const [fetchText, setFetchText] = useState("");
  const [parsed, setParsed] = useState<{ url: string; method: string; headers: Record<string, string>; body: string | null } | null>(null);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewFormat, setViewFormat] = useState("pretty");
  const [copied, setCopied] = useState("");

  const handleParse = () => {
    setParseError("");
    const p = parseFetchCall(fetchText.trim());
    if (!p) { setParseError("Could not parse this fetch() call. Make sure you pasted the full JS snippet."); return; }
    setParsed(p);
  };

  const handleGo = async () => {
    if (!parsed) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const resp = await fetch("/api/witch/proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: parsed.url,
          method: parsed.method,
          headers: parsed.headers,
          body: parsed.body,
        }),
      });
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const formats = useMemo(() => {
    if (!result) return [];
    const p = result.parsed;
    const raw = result.rawText || "";
    const flatRows = p ? flattenObject(p) : [];
    const statusLine = `HTTP ${result.status} ${result.statusText} — ${result.elapsed}ms`;

    return [
      {
        id: "pretty",
        label: "Pretty JSON",
        content: p ? JSON.stringify(p, null, 2) : raw,
      },
      {
        id: "raw",
        label: "Raw Text",
        content: raw,
      },
      {
        id: "minified",
        label: "Minified",
        content: p ? JSON.stringify(p) : raw,
      },
      {
        id: "yaml",
        label: "YAML",
        content: p ? toYaml(p) : raw,
      },
      {
        id: "table",
        label: "Table",
        content: flatRows,
        isTable: true,
      },
      {
        id: "headers",
        label: "Resp Headers",
        content: result.headers ? JSON.stringify(result.headers, null, 2) : "{}",
      },
      {
        id: "base64",
        label: "Base64",
        content: toBase64(raw),
      },
      {
        id: "hex",
        label: "Hex",
        content: toHex(raw),
      },
      {
        id: "summary",
        label: "Summary",
        content: [
          statusLine,
          `URL: ${parsed?.url}`,
          `Method: ${parsed?.method}`,
          `Response size: ${raw.length} chars`,
          `Keys (top-level): ${p && typeof p === "object" ? Object.keys(p).join(", ") : "N/A"}`,
          `Flat fields: ${flatRows.length}`,
          "",
          "Top-level values:",
          ...(p && typeof p === "object"
            ? Object.entries(p).slice(0, 20).map(([k, v]) => `  ${k}: ${JSON.stringify(v).slice(0, 80)}`)
            : [raw.slice(0, 200)]),
        ].join("\n"),
      },
      {
        id: "curl",
        label: "cURL",
        content: [
          `curl -X ${parsed?.method || "GET"} \\`,
          `  '${parsed?.url}' \\`,
          ...Object.entries(parsed?.headers || {}).map(([k, v]) => `  -H '${k}: ${v}' \\`),
          parsed?.body ? `  -d '${parsed.body}'` : "",
        ].filter(Boolean).join("\n"),
      },
    ];
  }, [result, parsed]);

  const activeFormat = formats.find(f => f.id === viewFormat) || formats[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            API Proxy — Paste &amp; Send
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste a complete <code className="bg-muted px-1 rounded text-xs">fetch()</code> call (copied from DevTools → Network tab → Copy as fetch). The server will forward it and return the response in multiple formats.
          </p>
          <Textarea
            className="font-mono text-xs h-44 resize-none"
            placeholder={`fetch("https://1x-bet.mobi/games-frame/service-api/...", {\n  "headers": { "x-auth": "Bearer ..." },\n  "body": "...",\n  "method": "POST",\n  ...\n});`}
            value={fetchText}
            onChange={e => { setFetchText(e.target.value); setParsed(null); setParseError(""); }}
            data-testid="input-fetch-text"
          />
          {parseError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" />{parseError}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleParse}
              disabled={!fetchText.trim()}
              data-testid="button-parse-fetch"
            >
              <Search className="w-4 h-4 mr-1" />
              Parse
            </Button>
            <Button
              size="sm"
              onClick={handleGo}
              disabled={!parsed || loading}
              data-testid="button-send-request"
            >
              {loading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {loading ? "Sending…" : "Go"}
            </Button>
            {parsed && (
              <span className="text-xs text-green-400 font-mono">
                ✓ {parsed.method} {parsed.url.slice(0, 60)}{parsed.url.length > 60 ? "…" : ""}
              </span>
            )}
          </div>

          {parsed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground mb-1 font-medium">Method &amp; URL</p>
                <p className="font-mono"><span className="text-primary font-bold">{parsed.method}</span> {parsed.url.slice(0, 80)}</p>
              </div>
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground mb-1 font-medium">Headers ({Object.keys(parsed.headers).length})</p>
                {Object.entries(parsed.headers).slice(0, 4).map(([k, v]) => (
                  <p key={k} className="font-mono truncate"><span className="text-cyan-400">{k}:</span> {String(v).slice(0, 30)}</p>
                ))}
                {Object.keys(parsed.headers).length > 4 && <p className="text-muted-foreground">+{Object.keys(parsed.headers).length - 4} more</p>}
              </div>
              <div className="rounded border border-border p-2">
                <p className="text-muted-foreground mb-1 font-medium">Body</p>
                <p className="font-mono truncate text-yellow-400">{parsed.body ? parsed.body.slice(0, 80) : "(none)"}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              <XCircle className="w-4 h-4 inline mr-1" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {result.ok
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <XCircle className="w-5 h-5 text-red-500" />}
                Response
                <Badge variant={result.status < 300 ? "default" : "destructive"}>
                  HTTP {result.status} {result.statusText}
                </Badge>
                <span className="text-xs text-muted-foreground font-normal">{result.elapsed}ms</span>
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResult(null)}
                data-testid="button-clear-result"
              >
                <Trash2 className="w-4 h-4 mr-1" />Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Format selector — 10 tabs */}
            <div className="flex flex-wrap gap-1">
              {formats.map(f => (
                <button
                  key={f.id}
                  onClick={() => setViewFormat(f.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    viewFormat === f.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                  }`}
                  data-testid={`button-format-${f.id}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Format content */}
            {activeFormat && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                  onClick={() => copy(
                    (activeFormat as any).isTable
                      ? (activeFormat.content as any[]).map((r: any) => `${r.key}\t${r.value}`).join("\n")
                      : String(activeFormat.content),
                    activeFormat.id
                  )}
                  data-testid={`button-copy-${activeFormat.id}`}
                >
                  {copied === activeFormat.id ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </Button>

                {(activeFormat as any).isTable ? (
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="bg-muted/60 border-b border-border">
                          <th className="text-left p-2 font-medium text-muted-foreground">Key</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeFormat.content as any[]).map((row: any, i: number) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                            <td className="p-2 text-cyan-400 font-medium">{row.key}</td>
                            <td className="p-2 text-muted-foreground">{row.type}</td>
                            <td className="p-2 break-all">{String(row.value).slice(0, 200)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ScrollArea className="h-[480px] w-full rounded-md border border-border bg-muted/30 p-3">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {String(activeFormat.content)}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
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
  const [solutionGrid, setSolutionGrid] = useState<boolean[][] | null>(null);
  const [solutionGridSource, setSolutionGridSource] = useState<string>("");
  const [solutionGridTime, setSolutionGridTime] = useState<Date | null>(null);
  // Inspector tab state
  const [inspectorSessionId, setInspectorSessionId] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [playResponses, setPlayResponses] = useState<any[]>([]);
  const [cellTimings, setCellTimings] = useState<any[]>([]);
  // PRNG Pattern Learning state
  const [frequencyTable, setFrequencyTable] = useState<any[][] | null>(null);
  const [totalGamesCollected, setTotalGamesCollected] = useState(0);
  const [extractedSeeds, setExtractedSeeds] = useState<any[]>([]);
  const [rsMetadataLog, setRsMetadataLog] = useState<any[]>([]);
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

  const analyzeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const resp = await fetch(`/api/witch/analyze-session/${sessionId}`);
      if (!resp.ok) throw new Error('Analysis failed');
      return resp.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      addLog({
        type: data.gridCandidates?.length > 0 ? "success" : "warning",
        row: null,
        cell: null,
        message: `Analysis complete: ${data.summary}`,
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

      case "mimick_solution_grid":
        // data.data.grid may be null for init_broadcast (only frequency table is sent)
        if (data.data?.frequencyTable) {
          setFrequencyTable(data.data.frequencyTable);
        }
        if (data.data?.totalGames != null) {
          setTotalGamesCollected(data.data.totalGames);
        }
        if (data.data?.grid && Array.isArray(data.data.grid)) {
          setSolutionGrid(data.data.grid);
          setSolutionGridSource(data.data.source || "unknown");
          setSolutionGridTime(new Date());
          const gamesMsg = data.data.totalGames ? ` | PRNG db: ${data.data.totalGames} games` : '';
          addLog({
            type: "success",
            row: null,
            cell: null,
            message: `POST-GAME GRID CAPTURED (${data.data.source || "unknown"}) — ${data.data.rowCount || data.data.grid.length} rows saved to PRNG database${gamesMsg}`,
            source: "mimick",
          });
          // Log each row's safe cells
          data.data.grid.forEach((row: boolean[], rowIdx: number) => {
            const safeCells = row.map((v: boolean, i: number) => v ? i + 1 : null).filter(Boolean);
            if (safeCells.length > 0) {
              addLog({
                type: "success",
                row: rowIdx + 1,
                cell: null,
                message: `Row ${rowIdx + 1} safe cells: [${safeCells.join(', ')}]`,
                source: "mimick",
              });
            }
          });
        }
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

      case "play_button_clicked":
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: "Play button clicked — watching for Play response...",
          source: "mimick",
        });
        break;

      case "play_response_captured":
        setPlayResponses(prev => [{ ...data.data, receivedAt: new Date() }, ...prev.slice(0, 9)]);
        addLog({
          type: "success",
          row: null,
          cell: null,
          message: `PLAY RESPONSE captured — URL: ${data.data?.url?.substring(0, 60) || 'unknown'} | Body: ${data.data?.rawText?.substring(0, 80) || '(empty)'}`,
          source: "mimick",
        });
        break;

      case "cell_timing":
        setCellTimings(prev => [data.data, ...prev.slice(0, 99)]);
        addLog({
          type: "info",
          row: null,
          cell: null,
          message: `Cell timing: ${data.data?.elapsedMs}ms → ${data.data?.result}`,
          source: "mimick",
        });
        break;

      case "seed_extracted":
        setExtractedSeeds(prev => [data, ...prev.slice(0, 199)]);
        addLog({
          type: "token",
          row: null,
          cell: null,
          message: `Seed/nonce extracted: ${data.key} = ${String(data.value).substring(0, 32)}`,
          source: "extension",
        });
        break;

      case "rs_metadata_extracted":
        setRsMetadataLog(prev => [data, ...prev.slice(0, 199)]);
        addLog({
          type: "network",
          row: null,
          cell: null,
          message: `RS metadata: AI=${data.AI} SB=${data.SB} AN=${data.AN} BS=${data.BS}`,
          source: "extension",
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
        <h1 className="text-2xl font-bold mb-2">Witch Analyzer Pro <span className="text-sm font-normal text-green-400 ml-2">v12.0 — Passive Mode</span></h1>
        <p className="text-muted-foreground">
          Passive packet capture from page load · Safe cell overlay · RNG seed analysis · Server probing tools · Zero auto-clicking
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

      <Tabs defaultValue="patterns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
          <TabsTrigger value="grid" data-testid="tab-grid">Game Grid</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
          <TabsTrigger value="inspector" data-testid="tab-inspector">Inspector</TabsTrigger>
          <TabsTrigger value="network" data-testid="tab-network">Network</TabsTrigger>
          <TabsTrigger value="tokens" data-testid="tab-tokens">Seeds</TabsTrigger>
          <TabsTrigger value="proxy" data-testid="tab-proxy">API Proxy</TabsTrigger>
        </TabsList>

        {/* ===== PATTERNS TAB — PRNG Frequency Heatmap ===== */}
        <TabsContent value="patterns">
          {/* Header + Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500" data-testid="text-games-collected">{totalGamesCollected}</div>
                <div className="text-xs text-muted-foreground mt-1">Games Collected</div>
                <div className="text-xs text-muted-foreground">Need ≥10 for predictions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">{extractedSeeds.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Seeds/Nonces Extracted</div>
                <div className="text-xs text-muted-foreground">For PRNG analysis</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-cyan-500">{rsMetadataLog.length}</div>
                <div className="text-xs text-muted-foreground mt-1">RS Responses Logged</div>
                <div className="text-xs text-muted-foreground">Game round metadata</div>
              </CardContent>
            </Card>
          </div>

          {/* Strategy explanation */}
          <Card className="mb-4 border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">How it works: </span>
                  The game sends the full 10×5 grid only <strong>after</strong> each game ends (provably-fair reveal).
                  The extension automatically saves every post-game RS[0].F grid to localStorage.
                  After enough games, if the casino PRNG has any bias, it will show up here as cells with
                  higher-than-expected safe rates. The overlay shows the statistically safest cell per row.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Frequency Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                PRNG Frequency Heatmap
                {totalGamesCollected > 0 && (
                  <Badge variant="outline" className="text-xs">{totalGamesCollected} games</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {frequencyTable && frequencyTable.length > 0 ? (
                <div className="space-y-1">
                  {/* Column headers */}
                  <div className="flex items-center gap-1 mb-2">
                    <div className="w-14 text-xs text-muted-foreground text-center">Row</div>
                    {[1,2,3,4,5].map(c => (
                      <div key={c} className="flex-1 text-xs text-muted-foreground text-center font-medium">C{c}</div>
                    ))}
                    <div className="w-20 text-xs text-muted-foreground text-center">Best Cell</div>
                  </div>
                  {frequencyTable.map((rowFreqs: any[], rowIdx: number) => {
                    // Expected safe rate for this row based on game rules
                    const expectedRate = rowIdx < 4 ? 0.8 : rowIdx < 7 ? 0.6 : rowIdx < 9 ? 0.4 : 0.2;
                    // Find best cell
                    let bestIdx = 0, bestRate = -1;
                    rowFreqs.forEach((cell: any, ci: number) => {
                      const rate = cell?.rate ?? cell;
                      if (rate != null && rate > bestRate) { bestRate = rate; bestIdx = ci; }
                    });
                    return (
                      <div key={rowIdx} className="flex items-center gap-1">
                        <div className="w-14 text-xs font-medium text-center">
                          Row {rowIdx + 1}
                          <div className="text-muted-foreground" style={{fontSize:'9px'}}>exp {(expectedRate*100).toFixed(0)}%</div>
                        </div>
                        {rowFreqs.map((cell: any, ci: number) => {
                          const rate = cell?.rate ?? cell;
                          const safeCount = cell?.safeCount ?? null;
                          const total = cell?.total ?? null;
                          const pct = rate != null ? Math.round(rate * 100) : null;
                          const bias = rate != null ? rate - expectedRate : 0;
                          // Color: green if above expected, red if below, neutral if null
                          const isBest = ci === bestIdx && pct != null;
                          const bgColor = pct == null
                            ? 'bg-muted/30'
                            : bias > 0.08 ? 'bg-green-500/30'
                            : bias > 0.03 ? 'bg-green-500/15'
                            : bias < -0.08 ? 'bg-red-500/30'
                            : bias < -0.03 ? 'bg-red-500/15'
                            : 'bg-muted/20';
                          return (
                            <div
                              key={ci}
                              className={`flex-1 rounded-md p-1 text-center ${bgColor} ${isBest ? 'ring-1 ring-green-500' : ''}`}
                              title={safeCount != null ? `Safe: ${safeCount}/${total}` : 'No data'}
                            >
                              <div className="text-xs font-bold">
                                {pct != null ? `${pct}%` : '—'}
                              </div>
                              {bias !== 0 && pct != null && (
                                <div className={`text-muted-foreground ${bias > 0 ? 'text-green-500' : 'text-red-500'}`} style={{fontSize:'9px'}}>
                                  {bias > 0 ? '+' : ''}{(bias * 100).toFixed(0)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="w-20 text-center">
                          {bestRate >= 0 ? (
                            <Badge variant="outline" className={`text-xs ${bestRate > expectedRate + 0.05 ? 'border-green-500 text-green-600 dark:text-green-400' : ''}`}>
                              Cell {bestIdx + 1} {bestRate > expectedRate + 0.05 ? '↑' : ''}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500/30"></span> Above expected (PRNG bias)</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500/30"></span> Below expected</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded ring-1 ring-green-500"></span> Best cell (overlay recommendation)</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No pattern data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Play games with the extension active. After each game ends, the RS[0].F grid
                    reveal is automatically saved. Collect 10+ games to see statistical patterns.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    As data grows, the overlay switches to frequency-based cell recommendations automatically.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RS Metadata Log — Game IDs for PRNG sequence analysis */}
          {rsMetadataLog.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-500" />
                  RS Response Metadata — Game Round IDs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-36">
                  <div className="p-3 space-y-1">
                    {rsMetadataLog.slice(0, 50).map((meta: any, idx: number) => (
                      <div key={idx} className="text-xs font-mono flex flex-wrap gap-2 py-1 border-b border-border/30">
                        <Badge variant="outline" className="text-xs">AI:{meta.AI || '?'}</Badge>
                        <span className="text-muted-foreground">SB:{meta.SB} AN:{meta.AN} BS:{meta.BS}</span>
                        <span className="text-muted-foreground text-xs">{new Date(meta.timestamp || 0).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Extracted Seeds/Nonces */}
          {extractedSeeds.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-yellow-500" />
                  Extracted Cryptographic Fields
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-36">
                  <div className="p-3 space-y-1">
                    {extractedSeeds.slice(0, 50).map((seed: any, idx: number) => (
                      <div key={idx} className="text-xs font-mono flex flex-wrap gap-2 py-1 border-b border-border/30">
                        <Badge variant="secondary" className="text-xs">{seed.key}</Badge>
                        <span className="text-muted-foreground truncate max-w-[200px]">{String(seed.value).substring(0, 48)}</span>
                        <span className="text-muted-foreground text-xs">{new Date(seed.timestamp || 0).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="grid">
          {solutionGrid && (
            <Card className="mb-4 border-green-500/50 bg-green-500/5">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <CardTitle className="text-lg text-green-600 dark:text-green-400">
                    Solution Grid — Winning Cells Detected
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {solutionGridTime && (
                    <span className="text-xs text-muted-foreground">
                      {solutionGridTime.toLocaleTimeString()} · source: {solutionGridSource}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSolutionGrid(null); setSolutionGridTime(null); }}
                    data-testid="button-clear-solution-grid"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Green cells are safe to click. The extension will use these automatically when auto-play is on.
                </p>
                <div className="space-y-1">
                  {solutionGrid.map((row, rowIndex) => {
                    const safeCells = row.map((v, i) => v ? i + 1 : null).filter(Boolean);
                    return (
                      <div key={rowIndex} className={`flex items-center gap-1 ${rowIndex + 1 === currentRow ? "bg-green-500/10 rounded-md p-1 -mx-1" : ""}`}>
                        <span className="w-8 text-xs font-medium text-muted-foreground">
                          R{rowIndex + 1}
                        </span>
                        {row.map((isSafe, cellIndex) => (
                          <div
                            key={cellIndex}
                            className={`w-10 h-10 flex items-center justify-center text-sm font-bold rounded-md border ${
                              isSafe
                                ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300"
                                : "bg-red-500/10 border-red-400/30 text-muted-foreground/40"
                            }`}
                            data-testid={`solution-cell-${rowIndex + 1}-${cellIndex + 1}`}
                          >
                            {cellIndex + 1}
                          </div>
                        ))}
                        {safeCells.length > 0 && (
                          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">
                            safe: {safeCells.join(', ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

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

        <TabsContent value="inspector">
          <div className="space-y-4">
            {/* Play Response Panel — most important */}
            <Card className={playResponses.length > 0 ? "border-pink-500/50 bg-pink-500/5" : ""}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-pink-500" />
                  <CardTitle className="text-lg">Play Response Capture</CardTitle>
                  <Badge variant="outline" className="text-xs">{playResponses.length} captured</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPlayResponses([])} data-testid="button-clear-play-responses">
                  <Trash2 className="w-4 h-4 mr-1" />Clear
                </Button>
              </CardHeader>
              <CardContent>
                {playResponses.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 space-y-3">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3">
                      <p className="font-medium text-green-600 dark:text-green-400 mb-1">Confirmed: Grid is in RS[0].F</p>
                      <p className="text-xs">The server sends the full 10×5 solution grid in the Play response body under <code className="bg-muted px-1 rounded">RS[0].F</code>. Each row is 5 booleans — <strong>true = safe</strong>, false = losing. The extension now auto-detects this field on every response.</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">How to use:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Install the v9.0 extension and connect it to this server</li>
                        <li>Go to 1xbet and open the Witch game</li>
                        <li>Click the Play button — the grid appears here AND in the Game Grid tab</li>
                        <li>Enable auto-play and the extension clicks exactly one safe cell per row</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playResponses.map((pr, idx) => (
                      <div key={idx} className="border rounded-md p-3 border-pink-500/30">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className="bg-pink-500/20 text-pink-600 border-pink-500">PLAY RESPONSE</Badge>
                          <Badge variant="outline">{pr.status}</Badge>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">{pr.url}</span>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 mt-2">
                          <p className="text-xs font-mono text-foreground break-all whitespace-pre-wrap max-h-48 overflow-auto">
                            {pr.rawText || JSON.stringify(pr.body, null, 2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cell Timing Probe */}
            <Card className={cellTimings.length > 0 ? "border-cyan-500/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-cyan-500" />
                  <CardTitle className="text-lg">Timing Probe</CardTitle>
                  <Badge variant="outline" className="text-xs">{cellTimings.length} clicks</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => setCellTimings([])} data-testid="button-clear-timings">
                  <Trash2 className="w-4 h-4 mr-1" />Clear
                </Button>
              </CardHeader>
              <CardContent>
                {cellTimings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Cell click → result timing will appear here. Safe and poison cells may have different response times — this reveals the pattern.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const wins = cellTimings.filter(t => t.result === 'win' || t.result === 'WIN');
                      const losses = cellTimings.filter(t => t.result === 'lose' || t.result === 'LOSE');
                      const avgWin = wins.length ? Math.round(wins.reduce((a,b) => a + b.elapsedMs, 0) / wins.length) : 0;
                      const avgLoss = losses.length ? Math.round(losses.reduce((a,b) => a + b.elapsedMs, 0) / losses.length) : 0;
                      return (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-green-500/10 rounded-md p-2 text-center">
                            <div className="text-lg font-bold text-green-600">{avgWin}ms</div>
                            <div className="text-xs text-muted-foreground">Avg WIN time</div>
                          </div>
                          <div className="bg-red-500/10 rounded-md p-2 text-center">
                            <div className="text-lg font-bold text-red-600">{avgLoss}ms</div>
                            <div className="text-xs text-muted-foreground">Avg LOSE time</div>
                          </div>
                          <div className={`rounded-md p-2 text-center ${Math.abs(avgLoss - avgWin) > 50 ? 'bg-yellow-500/10' : 'bg-muted/30'}`}>
                            <div className={`text-lg font-bold ${Math.abs(avgLoss - avgWin) > 50 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                              {Math.abs(avgLoss - avgWin)}ms
                            </div>
                            <div className="text-xs text-muted-foreground">Delta {Math.abs(avgLoss - avgWin) > 50 ? '⚡ EXPLOITABLE' : ''}</div>
                          </div>
                        </div>
                      );
                    })()}
                    <ScrollArea className="h-40">
                      <div className="space-y-1">
                        {cellTimings.map((t, idx) => (
                          <div key={idx} className={`flex items-center gap-2 p-1 rounded text-xs ${
                            (t.result === 'win' || t.result === 'WIN') ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                            <span className={`font-bold ${(t.result === 'win' || t.result === 'WIN') ? 'text-green-600' : 'text-red-600'}`}>
                              {t.elapsedMs}ms
                            </span>
                            <span className="text-muted-foreground">{t.result}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session Deep Analyzer */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-lg">Session Deep Analyzer</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Select value={inspectorSessionId} onValueChange={setInspectorSessionId}>
                    <SelectTrigger className="flex-1" data-testid="select-inspector-session">
                      <SelectValue placeholder="Select a session to analyze..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionsData?.sessions?.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.id.substring(0, 24)}... — {new Date(s.startTime).toLocaleTimeString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => inspectorSessionId && analyzeSessionMutation.mutate(inspectorSessionId)}
                    disabled={!inspectorSessionId || analyzeSessionMutation.isPending}
                    data-testid="button-analyze-session"
                  >
                    <Search className="w-4 h-4 mr-1" />
                    {analyzeSessionMutation.isPending ? 'Analyzing...' : 'Analyze'}
                  </Button>
                </div>

                {analysisResult && (
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 font-mono">
                      {analysisResult.summary}
                    </div>

                    {/* Grid candidates — this is the jackpot */}
                    {analysisResult.gridCandidates?.length > 0 ? (
                      <div className="border border-green-500/50 rounded-md p-3 bg-green-500/5">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-green-600 dark:text-green-400 text-sm">
                            GRID DATA FOUND — {analysisResult.gridCandidates.length} candidate(s)
                          </span>
                        </div>
                        {analysisResult.gridCandidates.map((c: any, idx: number) => (
                          <div key={idx} className="mt-2 p-2 bg-green-500/10 rounded text-xs">
                            <div className="font-medium mb-1">Source: {c.source} {c.url ? `| ${c.url.substring(0, 50)}` : ''}</div>
                            {c.grid && c.grid.map((row: boolean[], rIdx: number) => (
                              <div key={rIdx} className="flex gap-1 mb-1">
                                <span className="w-6 text-muted-foreground">R{rIdx+1}</span>
                                {row.map((v: boolean, ci: number) => (
                                  <span key={ci} className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${v ? 'bg-green-500/30 text-green-600' : 'bg-red-500/20 text-red-500/50'}`}>
                                    {ci+1}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-yellow-500/30 rounded-md p-3 bg-yellow-500/5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-yellow-600 dark:text-yellow-400">No grid data found in JSON responses. Game may use binary protocol or per-click determination.</span>
                        </div>
                      </div>
                    )}

                    {/* Game-related requests */}
                    {analysisResult.gameRelatedRequests?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Game-Related Responses ({analysisResult.gameRelatedRequests.length})</p>
                        <div className="space-y-2">
                          {analysisResult.gameRelatedRequests.map((r: any, idx: number) => (
                            <div key={idx} className={`border rounded-md overflow-hidden ${r.isPlayResponse ? 'border-pink-500/50' : 'border-border'}`}>
                              <button
                                className="w-full flex items-center gap-2 p-2 text-xs text-left hover-elevate"
                                onClick={() => {
                                  const key = `resp-${idx}`;
                                  setExpandedItems(prev => {
                                    const next = new Set(prev);
                                    next.has(key) ? next.delete(key) : next.add(key);
                                    return next;
                                  });
                                }}
                                data-testid={`expand-response-${idx}`}
                              >
                                {expandedItems.has(`resp-${idx}`) ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                                {r.isPlayResponse && <Badge className="text-xs bg-pink-500/20 text-pink-600 border-pink-500">PLAY</Badge>}
                                <Badge variant={r.status < 400 ? "default" : "destructive"}>{r.status}</Badge>
                                <span className="font-mono truncate flex-1">{r.url}</span>
                                <span className="shrink-0 text-muted-foreground">{r.bodyLength}b</span>
                              </button>
                              {expandedItems.has(`resp-${idx}`) && (
                                <div className="p-2 bg-muted/30 border-t border-border">
                                  {r.allArraysOf5?.length > 0 && (
                                    <div className="mb-2 p-2 bg-yellow-500/10 rounded text-xs">
                                      <span className="font-medium text-yellow-600">Arrays of 5 found:</span>
                                      {r.allArraysOf5.map((arr: any, ai: number) => (
                                        <div key={ai} className="font-mono mt-1">{JSON.stringify(arr)}</div>
                                      ))}
                                    </div>
                                  )}
                                  <pre className="text-xs font-mono break-all whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto">
                                    {r.bodyPreview}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All responses list */}
                    <details>
                      <summary className="text-sm font-medium cursor-pointer text-muted-foreground">
                        All Responses ({analysisResult.allResponses?.length || 0})
                      </summary>
                      <div className="mt-2 space-y-1 max-h-60 overflow-auto">
                        {analysisResult.allResponses?.map((r: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs p-1 rounded border-b border-border/50">
                            <Badge variant="outline" className="text-xs shrink-0">{r.status}</Badge>
                            <span className="font-mono truncate flex-1 text-muted-foreground">{r.url}</span>
                            <span className="shrink-0 text-muted-foreground">{r.bodyLength}b</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
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
                          capture.isPlayResponse
                            ? 'border-pink-500/50 bg-pink-500/5'
                            : capture.captureType === 'mimick_request' 
                            ? 'border-blue-500/30 bg-blue-500/5' 
                            : 'border-green-500/30 bg-green-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {capture.isPlayResponse && (
                            <Badge className="text-xs bg-pink-500/20 text-pink-600 border-pink-500">PLAY</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {capture.captureType === 'mimick_request' ? 'REQ' : 'RES'}
                          </Badge>
                          <span className="font-mono">{capture.method || 'GET'}</span>
                          {capture.status && (
                            <Badge variant={capture.status < 400 ? "default" : "destructive"}>
                              {capture.status}
                            </Badge>
                          )}
                          {capture.bodyLength && (
                            <span className="text-muted-foreground">{capture.bodyLength}b</span>
                          )}
                        </div>
                        <p className="font-mono text-muted-foreground truncate">{capture.url}</p>
                        {capture.isGameRelated && (
                          <Badge className="mt-1 bg-purple-500/20 text-purple-600 border-purple-500">
                            Game Related
                          </Badge>
                        )}
                        {/* Show body preview for game-related responses */}
                        {(capture.isGameRelated || capture.isPlayResponse) && capture.captureType !== 'mimick_request' && capture.body && (
                          <div className="mt-2 bg-muted/50 rounded p-2">
                            <p className="font-mono text-xs break-all">
                              {typeof capture.body === 'string' 
                                ? capture.body.substring(0, 200) 
                                : JSON.stringify(capture.body).substring(0, 200)}
                            </p>
                          </div>
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

        {/* ===== API PROXY TAB ===== */}
        <TabsContent value="proxy">
          <ApiProxyTab />
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

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-400 font-medium">Passive Mode — No Auto-Click</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Extension v12.0</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Advanced decoder engine — tries Base64, Hex, XOR, Bitmask50, Diff, and Timeline analysis on every server response. Passive only.
              </p>
              <Button
                onClick={handleDownloadExtension}
                className="flex items-center gap-2"
                data-testid="button-download-extension"
              >
                <Download className="w-4 h-4" />
                Download Extension (v12.0)
              </Button>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1 text-green-400">New in v12.0:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>✅ Decoder Engine — Base64 · Hex→ASCII · XOR · URL · Double-JSON · Reverse</li>
                  <li>✅ Bitmask50 — tests any integer as 10×5 grid (LSB + MSB)</li>
                  <li>✅ Response Diff — field-by-field comparison between games</li>
                  <li>✅ Game Event Timeline — GAME_START vs ROW_CLICK classifier</li>
                  <li>✅ 7 analysis tabs: Grid · Decode · Diff · Packets · RNG · Probe · Server</li>
                  <li>🚫 Zero auto-clicking — purely passive</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
