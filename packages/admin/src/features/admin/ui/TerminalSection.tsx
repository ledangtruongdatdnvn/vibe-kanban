import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Badge } from "@vibe/ui/components/Badge";
import { Button } from "@vibe/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { Input } from "@vibe/ui/components/Input";
import { Label } from "@vibe/ui/components/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vibe/ui/components/Select";
import { useTheme } from "@/shared/hooks/useTheme";
import { openLocalApiWebSocket } from "@/shared/lib/localApiTransport";
import { getTerminalTheme } from "@/shared/lib/terminalTheme";
import type {
  GitHubRepoImportInput,
  Repo,
  RepoGitAuthStatus,
  ToolMessage,
} from "@admin/features/admin/model/types";

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type TerminalSectionProps = {
  repos: Repo[];
  reposLoading: boolean;
  selectedRepoId: string;
  selectedRepo: Repo | null;
  gitAuthStatus: RepoGitAuthStatus | null;
  gitAuthLoading: boolean;
  repoImportBusy: boolean;
  repoImportMessage: ToolMessage;
  onSelectedRepoChange: (repoId: string) => void;
  onImportGitHubRepo: (input: GitHubRepoImportInput) => Promise<boolean>;
};

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(
    "",
  );
  return window.btoa(binary);
}

function decodeBase64(value: string) {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) || 0);
  return new TextDecoder().decode(bytes);
}

function connectionLabel(state: ConnectionState) {
  switch (state) {
    case "connecting":
      return "connecting";
    case "connected":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function connectionBadgeVariant(
  state: ConnectionState,
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "connected":
      return "default";
    case "connecting":
    case "idle":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

export function TerminalSection({
  repos,
  reposLoading,
  selectedRepoId,
  selectedRepo,
  gitAuthStatus,
  gitAuthLoading,
  repoImportBusy,
  repoImportMessage,
  onSelectedRepoChange,
  onImportGitHubRepo,
}: TerminalSectionProps) {
  const { theme } = useTheme();
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalViewportRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultMergeTarget = useMemo(() => {
    if (selectedRepo?.default_target_branch?.trim()) {
      return `origin/${selectedRepo.default_target_branch.trim()}`;
    }

    return "origin/main";
  }, [selectedRepo?.default_target_branch]);
  const [mergeTarget, setMergeTarget] = useState(defaultMergeTarget);

  useEffect(() => {
    setMergeTarget(defaultMergeTarget);
  }, [defaultMergeTarget, selectedRepoId]);
  const [importRepository, setImportRepository] = useState("");
  const [importFolderName, setImportFolderName] = useState("");
  const [importDisplayName, setImportDisplayName] = useState("");

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;

    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close(1000, "Host Admin terminal closed");
    }
  }, []);

  const sendResize = useCallback(() => {
    const terminal = terminalRef.current;
    const socket = socketRef.current;

    if (
      !terminal ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      terminal.cols <= 0 ||
      terminal.rows <= 0
    ) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "resize",
        cols: terminal.cols,
        rows: terminal.rows,
      }),
    );
  }, []);

  const sendInput = useCallback((value: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type: "input",
        data: encodeBase64(value),
      }),
    );
    return true;
  }, []);

  const runCommand = useCallback(
    (command: string) => {
      const normalized = command.trim();
      if (!normalized) {
        return;
      }

      if (!sendInput(`${normalized}\n`)) {
        setConnectionError("Terminal is not connected.");
        setConnectionState("error");
        return;
      }

      terminalRef.current?.focus();
    },
    [sendInput],
  );

  useEffect(() => {
    if (!terminalContainerRef.current || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      cursorInactiveStyle: "outline",
      cursorStyle: "block",
      fontSize: 12,
      fontFamily: '"IBM Plex Mono", monospace',
      fontWeight: "400",
      fontWeightBold: "600",
      letterSpacing: 0.2,
      lineHeight: 1.2,
      minimumContrastRatio: 4.5,
      rightClickSelectsWord: true,
      scrollback: 5000,
      smoothScrollDuration: 120,
      theme: getTerminalTheme(),
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(terminalContainerRef.current);
    fitAddon.fit();

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      const isMeta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isMeta && key === "c") {
        const selection = terminal.getSelection();
        if (!selection) {
          return true;
        }

        void navigator.clipboard?.writeText(selection);
        return false;
      }

      if (isMeta && key === "v") {
        void navigator.clipboard?.readText().then((text) => {
          if (text) {
            sendInput(text);
          }
        });
        return false;
      }

      return true;
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const inputSubscription = terminal.onData((data) => {
      sendInput(data);
    });

    return () => {
      inputSubscription.dispose();
      closeSocket();
      fitAddonRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
    };
  }, [closeSocket, sendInput]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTerminalTheme();
    }
  }, [theme]);

  useEffect(() => {
    if (!terminalViewportRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      sendResize();
    });

    observer.observe(terminalViewportRef.current);
    return () => observer.disconnect();
  }, [sendResize]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    closeSocket();
    setConnectionError(null);

    if (!terminal || !fitAddon) {
      return;
    }

    terminal.options.theme = getTerminalTheme();
    terminal.reset();
    fitAddon.fit();

    if (!selectedRepo) {
      setConnectionState("idle");
      terminal.writeln("[admin] Select a repository to open a shell.");
      return;
    }

    setConnectionState("connecting");
    terminal.writeln(
      `[admin] Connecting to ${selectedRepo.display_name || selectedRepo.name}…`,
    );

    let cancelled = false;

    void (async () => {
      try {
        const search = new URLSearchParams({
          cols: String(terminal.cols || 80),
          rows: String(terminal.rows || 24),
        });
        const ws = await openLocalApiWebSocket(
          `/api/repos/${encodeURIComponent(
            selectedRepo.id,
          )}/terminal/ws?${search.toString()}`,
          {
            hostScope: "none",
          },
        );

        if (cancelled) {
          ws.close(1000, "Cancelled");
          return;
        }

        socketRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            return;
          }

          setConnectionState("connected");
          setConnectionError(null);
          terminal.writeln(`[admin] Shell ready in ${selectedRepo.path}`);
          terminal.focus();
          sendResize();
        };

        ws.onmessage = (event) => {
          if (cancelled) {
            return;
          }

          try {
            const payload = JSON.parse(String(event.data)) as
              | { type: "output"; data?: string }
              | { type: "error"; message?: string };

            if (payload.type === "output" && typeof payload.data === "string") {
              terminal.write(decodeBase64(payload.data));
              return;
            }

            if (payload.type === "error") {
              const message =
                payload.message || "Terminal session closed unexpectedly.";
              setConnectionError(message);
              setConnectionState("error");
              terminal.writeln(`\r\n[admin] ${message}`);
            }
          } catch {
            setConnectionError("Received an invalid terminal payload.");
            setConnectionState("error");
          }
        };

        ws.onerror = () => {
          if (cancelled) {
            return;
          }

          setConnectionError("Failed to connect to the repo terminal.");
          setConnectionState("error");
        };

        ws.onclose = () => {
          if (cancelled) {
            return;
          }

          if (socketRef.current === ws) {
            socketRef.current = null;
          }

          setConnectionState((current) =>
            current === "error" ? "error" : "disconnected",
          );
        };
      } catch (error) {
        if (cancelled) {
          return;
        }

        setConnectionError(
          error instanceof Error
            ? error.message
            : "Failed to connect to the repo terminal.",
        );
        setConnectionState("error");
      }
    })();

    return () => {
      cancelled = true;
      closeSocket();
    };
  }, [closeSocket, selectedRepo, sendResize, sessionKey]);

  const quickActions = [
    { label: "git status", command: "git status" },
    { label: "fetch --all --prune", command: "git fetch --all --prune" },
    { label: "pull --ff-only", command: "git pull --ff-only" },
    { label: "push", command: "git push" },
    { label: "branch -vv", command: "git branch -vv" },
    { label: "log -20", command: "git log --oneline --decorate -20" },
  ];
  const terminalReady = !!selectedRepo && connectionState === "connected";
  const connectionStatusLabel = connectionLabel(connectionState);
  const selectedRepoName =
    selectedRepo?.display_name || selectedRepo?.name || "No repo selected";
  const gitAuthBadgeLabel = gitAuthLoading
    ? "checking"
    : gitAuthStatus?.ready
      ? "github app"
      : gitAuthStatus?.auth_mode === "https_no_auth"
        ? "https only"
        : gitAuthStatus?.auth_mode === "unsupported"
          ? "unsupported"
          : "unavailable";
  const gitAuthBadgeVariant = gitAuthLoading
    ? "secondary"
    : gitAuthStatus?.ready
      ? "default"
      : gitAuthStatus?.auth_mode === "unsupported"
        ? "destructive"
        : "outline";

  const handleImportSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      void (async () => {
        const success = await onImportGitHubRepo({
          repository: importRepository,
          folderName: importFolderName || undefined,
          displayName: importDisplayName || undefined,
        });

        if (success) {
          setImportRepository("");
          setImportFolderName("");
          setImportDisplayName("");
        }
      })();
    },
    [importDisplayName, importFolderName, importRepository, onImportGitHubRepo],
  );

  return (
    <Card className="border border-border bg-panel/80">
      <CardHeader>
        <CardTitle className="text-lg">Repo Terminal</CardTitle>
        <CardDescription>
          Open a shell directly in the selected repo root for pull, push, merge,
          and other git maintenance.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-double">
        {connectionError && (
          <Alert variant="destructive">
            <AlertDescription>{connectionError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-double xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0 flex flex-col gap-double">
            <div className="rounded-lg border border-border/80 bg-panel/60 p-base">
              <div className="flex flex-col gap-base lg:flex-row lg:items-end lg:justify-between">
                <div className="flex w-full max-w-[20rem] flex-col gap-half">
                  <Label htmlFor="terminal-repo-selector">Repository</Label>
                  <Select
                    value={selectedRepoId || undefined}
                    onValueChange={onSelectedRepoChange}
                    disabled={reposLoading || repos.length === 0}
                  >
                    <SelectTrigger
                      id="terminal-repo-selector"
                      className="bg-panel"
                    >
                      <SelectValue
                        placeholder={
                          reposLoading
                            ? "Loading repositories…"
                            : repos.length === 0
                              ? "No repositories"
                              : "Select a repository"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {repos.map((repo) => (
                        <SelectItem key={repo.id} value={repo.id}>
                          {repo.display_name || repo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-half">
                  <div className="flex items-center gap-half rounded-md border border-border/70 bg-secondary/40 px-half py-half">
                    <span className="text-xs uppercase tracking-[0.16em] text-low">
                      Connection
                    </span>
                    <Badge variant={connectionBadgeVariant(connectionState)}>
                      {connectionStatusLabel}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedRepo}
                    onClick={() => {
                      setConnectionError(null);
                      setSessionKey((value) => value + 1);
                    }}
                  >
                    Reconnect
                  </Button>
                </div>
              </div>

              <div className="mt-base flex flex-col gap-base border-t border-border/70 pt-base">
                <div className="flex flex-col gap-half">
                  <Label className="text-sm text-high">Quick actions</Label>
                  <div className="flex flex-wrap gap-half">
                    {quickActions.map((action) => (
                      <Button
                        key={action.command}
                        variant="outline"
                        size="sm"
                        disabled={!terminalReady}
                        onClick={() => runCommand(action.command)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-half">
                  <Label htmlFor="merge-target">Merge target</Label>
                  <div className="flex flex-col gap-half sm:flex-row">
                    <Input
                      id="merge-target"
                      value={mergeTarget}
                      onChange={(event) => setMergeTarget(event.target.value)}
                      placeholder="origin/main"
                      className="bg-panel sm:flex-1"
                    />
                    <Button
                      variant="outline"
                      disabled={!terminalReady || !mergeTarget.trim()}
                      onClick={() =>
                        runCommand(`git merge ${mergeTarget.trim()}`)
                      }
                    >
                      Run merge
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-[34rem] flex-col overflow-hidden rounded-lg border border-border/80 bg-secondary/70">
              <div className="border-b border-border/70 px-base py-half">
                <div className="flex min-w-0 flex-col gap-[0.2rem]">
                  <span className="truncate text-sm font-medium text-high">
                    {selectedRepoName}
                  </span>
                  <span className="truncate text-xs text-low">
                    {selectedRepo?.path ||
                      "Select a repository to open a shell."}
                  </span>
                </div>
              </div>

              <div
                ref={terminalViewportRef}
                className="relative min-h-[28rem] flex-1"
              >
                <div
                  ref={terminalContainerRef}
                  className="h-full w-full px-base py-half"
                />
                {!selectedRepo && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-secondary/90 px-double text-center text-sm text-low">
                    Select a repository to open a shell in its root directory.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-double">
            <div className="rounded-lg border border-border/80 bg-panel/60 p-base">
              <Label className="text-sm text-high">Repository details</Label>
              {selectedRepo ? (
                <div className="mt-base flex flex-col gap-base text-sm">
                  <div className="flex flex-col gap-[0.2rem]">
                    <span className="text-xs uppercase tracking-[0.16em] text-low">
                      Selected repo
                    </span>
                    <span className="font-medium text-high">
                      {selectedRepoName}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[0.2rem]">
                    <span className="text-xs uppercase tracking-[0.16em] text-low">
                      Repo path
                    </span>
                    <code className="break-all rounded bg-secondary/80 px-half py-[0.2rem] text-xs text-high">
                      {selectedRepo.path}
                    </code>
                  </div>
                  <div className="flex flex-col gap-[0.2rem]">
                    <span className="text-xs uppercase tracking-[0.16em] text-low">
                      Default target branch
                    </span>
                    <span className="text-high">
                      {selectedRepo.default_target_branch || "main"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-base text-sm text-low">
                  Select a repo to load shell details and Git metadata.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border/80 bg-panel/60 p-base">
              <div className="flex flex-wrap items-center gap-half">
                <Label className="text-sm text-high">Git auth</Label>
                <Badge variant={gitAuthBadgeVariant}>{gitAuthBadgeLabel}</Badge>
              </div>

              <p className="mt-base text-sm text-low">
                {gitAuthStatus?.message ||
                  "Select a repo to inspect Git auth readiness."}
              </p>

              {gitAuthStatus?.repo_full_name && (
                <div className="mt-base flex flex-col gap-[0.2rem]">
                  <span className="text-xs uppercase tracking-[0.16em] text-low">
                    GitHub repo
                  </span>
                  <code className="break-all rounded bg-secondary/80 px-half py-[0.2rem] text-xs text-high">
                    {gitAuthStatus.repo_full_name}
                  </code>
                </div>
              )}

              {gitAuthStatus?.https_remote_url && (
                <div className="mt-base flex flex-col gap-[0.2rem]">
                  <span className="text-xs uppercase tracking-[0.16em] text-low">
                    HTTPS remote
                  </span>
                  <code className="break-all rounded bg-secondary/80 px-half py-[0.2rem] text-xs text-high">
                    {gitAuthStatus.https_remote_url}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        <form
          className="grid gap-base rounded-lg border border-border/80 bg-panel/60 p-base xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={handleImportSubmit}
        >
          <div className="flex flex-col gap-half xl:col-span-4">
            <Label className="text-sm text-high" htmlFor="github-repo-import">
              Import from GitHub
            </Label>
            <p className="text-sm text-low">
              Clone a GitHub repo into the managed host repo root and register
              it for Terminal and Branches. This import path expects GitHub App
              access to the target repo.
            </p>
          </div>

          <div className="flex flex-col gap-half">
            <Label htmlFor="github-repo-import">Repository</Label>
            <Input
              id="github-repo-import"
              value={importRepository}
              onChange={(event) => setImportRepository(event.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              autoComplete="off"
              spellCheck={false}
              disabled={repoImportBusy}
            />
          </div>

          <div className="flex flex-col gap-half">
            <Label htmlFor="github-repo-folder">Folder name</Label>
            <Input
              id="github-repo-folder"
              value={importFolderName}
              onChange={(event) => setImportFolderName(event.target.value)}
              placeholder="Optional local folder"
              autoComplete="off"
              spellCheck={false}
              disabled={repoImportBusy}
            />
          </div>

          <div className="flex flex-col gap-half">
            <Label htmlFor="github-repo-display-name">Display name</Label>
            <Input
              id="github-repo-display-name"
              value={importDisplayName}
              onChange={(event) => setImportDisplayName(event.target.value)}
              placeholder="Optional admin label"
              autoComplete="off"
              spellCheck={false}
              disabled={repoImportBusy}
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full xl:w-auto"
              disabled={repoImportBusy || !importRepository.trim()}
            >
              {repoImportBusy ? "Importing…" : "Clone and register"}
            </Button>
          </div>

          {repoImportMessage && (
            <div className="xl:col-span-4">
              <Alert
                variant={
                  repoImportMessage.kind === "error" ? "destructive" : undefined
                }
              >
                <AlertDescription>{repoImportMessage.text}</AlertDescription>
              </Alert>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
