import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@vibe/ui/components/Checkbox";
import { Input } from "@vibe/ui/components/Input";
import { Label } from "@vibe/ui/components/Label";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableLoading,
  TableRow,
} from "@vibe/ui/components/Table";
import { Textarea } from "@vibe/ui/components/Textarea";
import { cn } from "@vibe/ui/lib/cn";

type Tool = "claude" | "codex";
type Tab = "credentials" | "workspaces" | "branches" | "cleanup";

type ToolMessage = {
  kind: "success" | "error";
  text: string;
} | null;

type StatusResponse = Record<Tool, string>;

type SessionResponse = {
  authenticated: boolean;
  configured: boolean;
};

type ActionResponse = {
  error?: string;
  message?: string;
};

type ApiEnvelope<T, E = { message?: string; workspaces?: string[] }> = {
  success: boolean;
  data: T | null;
  error_data: E | null;
  message: string | null;
};

type Workspace = {
  id: string;
  branch: string;
  archived: boolean;
  pinned: boolean;
  name: string | null;
  created_at: string;
  updated_at: string;
  worktree_deleted: boolean;
};

type Repo = {
  id: string;
  name: string;
  display_name: string | null;
};

type GitBranch = {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit_date: string;
};

type CleanupSummary = {
  orphan_cleanup_disabled: boolean;
  repos_checked: number;
  repos_pruned: number;
  repo_errors: string[];
};

type WorkspaceUsageRepo = {
  repo_id: string;
  repo_name: string;
  worktree_path: string;
  bytes: number;
  exists: boolean;
  error: string | null;
};

type WorkspaceUsageItem = {
  workspace_id: string;
  workspace_name: string | null;
  branch: string;
  workspace_dir: string | null;
  total_bytes: number;
  exists: boolean;
  error: string | null;
  repo_worktrees: WorkspaceUsageRepo[];
};

type WorkspaceUsageSummary = {
  total_bytes: number;
  workspace_count: number;
  existing_workspace_count: number;
  items: WorkspaceUsageItem[];
};

type ToolConfig = {
  command: string;
  description: string;
  hint?: string;
  placeholder: string;
  saveLabel: string;
  title: string;
};

const TOOL_ORDER: Tool[] = ["claude", "codex"];
const TABS: Array<{
  id: Tab;
  label: string;
  summary: string;
  description: string;
}> = [
  {
    id: "credentials",
    label: "Credentials",
    summary: "Claude and Codex access",
    description: "Paste or clear saved subscription credentials.",
  },
  {
    id: "workspaces",
    label: "Workspaces",
    summary: "Lifecycle-safe deletion",
    description: "Delete workspaces through the normal host backend flow.",
  },
  {
    id: "branches",
    label: "Branches",
    summary: "Local branch maintenance",
    description: "Remove stale local branches without touching remotes.",
  },
  {
    id: "cleanup",
    label: "Cleanup",
    summary: "Prune or wipe persisted state",
    description: "Run safe orphan cleanup or wipe mounted host data.",
  },
];

const TOOL_CONFIG: Record<Tool, ToolConfig> = {
  claude: {
    title: "Claude Code (Anthropic)",
    description: "On your local machine, run:",
    command: 'security find-generic-password -s "Claude Code-credentials" -w',
    placeholder:
      '{"claudeAiOauth":{"accessToken":"sk-ant-oat01-...","refreshToken":"sk-ant-ort01-...","expiresAt":...}}',
    saveLabel: "Save Claude credentials",
  },
  codex: {
    title: "Codex (OpenAI)",
    description: "On your local machine, run:",
    command: "cat ~/.codex/auth.json",
    hint: "Alternatively set OPENAI_API_KEY in .env.",
    placeholder: '{"token":"sk-...","...":""}',
    saveLabel: "Save Codex credentials",
  },
};

const INITIAL_STATUS: Record<Tool, string> = {
  claude: "loading…",
  codex: "loading…",
};

const INITIAL_VALUE: Record<Tool, string> = {
  claude: "",
  codex: "",
};

const INITIAL_MESSAGE: Record<Tool, ToolMessage> = {
  claude: null,
  codex: null,
};

const INITIAL_SAVING: Record<Tool, boolean> = {
  claude: false,
  codex: false,
};

function statusBadgeText(status: string) {
  if (status === "loading…") {
    return "loading…";
  }

  return status.startsWith("saved") ? "saved" : "not set";
}

function isSavedStatus(status: string) {
  return status.startsWith("saved");
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function OverviewCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-primary/60 px-double py-base">
      <div className="text-xs uppercase tracking-[0.12em] text-low">
        {label}
      </div>
      <div className="mt-half text-xl font-semibold text-high">{value}</div>
      <div className="mt-half text-sm text-low">{detail}</div>
    </div>
  );
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & ActionResponse;

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`,
    );
  }

  return data;
}

function extractEnvelopeError(payload: unknown, fallbackStatus: number) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string" &&
    payload.message
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error_data" in payload &&
    payload.error_data &&
    typeof payload.error_data === "object" &&
    "message" in payload.error_data &&
    typeof payload.error_data.message === "string"
  ) {
    return payload.error_data.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return `Request failed (${fallbackStatus})`;
}

async function requestEnvelope<T>(
  url: string,
  init?: RequestInit,
): Promise<{ data: T; payload: ApiEnvelope<T> }> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || payload.data == null) {
    throw new Error(extractEnvelopeError(payload, response.status));
  }

  return {
    data: payload.data,
    payload,
  };
}

async function requestEnvelopeAction(
  url: string,
  init?: RequestInit,
): Promise<ApiEnvelope<null>> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<null>;

  if (!response.ok || !payload.success) {
    throw new Error(extractEnvelopeError(payload, response.status));
  }

  return payload;
}

async function fetchSession() {
  return requestJson<SessionResponse>("/api/auth/session");
}

async function login(secret: string) {
  return requestJson<ActionResponse>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret }),
  });
}

async function logout() {
  return requestJson<ActionResponse>("/api/auth/logout", {
    method: "POST",
  });
}

async function fetchStatus(): Promise<StatusResponse> {
  return requestJson<StatusResponse>("/api/credentials/status");
}

async function saveCredentials(tool: Tool, credentials: string) {
  return requestJson<ActionResponse>("/api/credentials/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, credentials }),
  });
}

async function clearCredentials(tool: Tool | "all") {
  return requestJson<ActionResponse>("/api/credentials/clear", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool }),
  });
}

async function fetchWorkspaces() {
  return requestEnvelope<Workspace[]>("/api/workspaces");
}

async function fetchWorkspaceUsage() {
  return requestEnvelope<WorkspaceUsageSummary>("/api/workspace-usage");
}

async function deleteWorkspace(workspaceId: string, deleteBranches: boolean) {
  return requestEnvelopeAction(
    `/api/workspaces/${workspaceId}${
      deleteBranches ? "?delete_branches=true" : ""
    }`,
    {
      method: "DELETE",
    },
  );
}

async function fetchRepos() {
  return requestEnvelope<Repo[]>("/api/repos");
}

async function fetchBranches(repoId: string) {
  return requestEnvelope<GitBranch[]>(`/api/repos/${repoId}/branches`);
}

async function deleteBranch(repoId: string, branchName: string) {
  return requestEnvelopeAction(
    `/api/repos/${repoId}/branches/${encodeURIComponent(branchName)}`,
    {
      method: "DELETE",
    },
  );
}

async function cleanOrphanWorktrees() {
  return requestEnvelope<CleanupSummary>("/api/cleanup/orphan-worktrees", {
    method: "POST",
  });
}

async function cleanPersistedData() {
  return requestJson<ActionResponse>("/api/cleanup/data", {
    method: "POST",
  });
}

export function HostAdminPage() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loginSecret, setLoginSecret] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState<ToolMessage>(null);
  const [activeTab, setActiveTab] = useState<Tab>("credentials");

  const [statusByTool, setStatusByTool] =
    useState<Record<Tool, string>>(INITIAL_STATUS);
  const [valueByTool, setValueByTool] =
    useState<Record<Tool, string>>(INITIAL_VALUE);
  const [messageByTool, setMessageByTool] =
    useState<Record<Tool, ToolMessage>>(INITIAL_MESSAGE);
  const [savingByTool, setSavingByTool] =
    useState<Record<Tool, boolean>>(INITIAL_SAVING);
  const [clearingCredentials, setClearingCredentials] = useState<
    Tool | "all" | null
  >(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<ToolMessage>(null);
  const [workspaceUsage, setWorkspaceUsage] =
    useState<WorkspaceUsageSummary | null>(null);
  const [workspaceUsageLoading, setWorkspaceUsageLoading] = useState(false);
  const [workspaceUsageError, setWorkspaceUsageError] = useState<string | null>(
    null,
  );
  const [workspaceDeleteBranch, setWorkspaceDeleteBranch] = useState<
    Record<string, boolean>
  >({});
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(
    null,
  );

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesMessage, setBranchesMessage] = useState<ToolMessage>(null);
  const [deletingBranchName, setDeletingBranchName] = useState<string | null>(
    null,
  );

  const [cleanupMessage, setCleanupMessage] = useState<ToolMessage>(null);
  const [cleanupBusy, setCleanupBusy] = useState<null | "orphans" | "data">(
    null,
  );

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );
  const activeTabMeta = useMemo(
    () => TABS.find((tab) => tab.id === activeTab) ?? TABS[0],
    [activeTab],
  );
  const savedCredentialsCount = useMemo(
    () => TOOL_ORDER.filter((tool) => isSavedStatus(statusByTool[tool])).length,
    [statusByTool],
  );
  const workspaceUsageById = useMemo(
    () =>
      new Map(
        (workspaceUsage?.items ?? []).map((item) => [item.workspace_id, item]),
      ),
    [workspaceUsage],
  );
  const localBranchCount = useMemo(
    () => branches.filter((branch) => !branch.is_remote).length,
    [branches],
  );

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const nextSession = await fetchSession();
        if (!cancelled) {
          setSession(nextSession);
          setSessionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSessionError(
            error instanceof Error ? error.message : "Failed to load session.",
          );
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session?.authenticated) {
      return;
    }

    void Promise.all([
      refreshCredentialStatus(),
      refreshWorkspaces(),
      refreshWorkspaceUsage(),
      refreshRepos(),
    ]);
  }, [session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated || !selectedRepoId) {
      setBranches([]);
      return;
    }

    void refreshBranches(selectedRepoId);
  }, [selectedRepoId, session?.authenticated]);

  const refreshSession = async () => {
    const nextSession = await fetchSession();
    setSession(nextSession);
    setSessionError(null);
    return nextSession;
  };

  const refreshCredentialStatus = async () => {
    try {
      const data = await fetchStatus();
      setStatusByTool({
        claude: data.claude || "unknown",
        codex: data.codex || "unknown",
      });
    } catch {
      setStatusByTool({
        claude: "unknown",
        codex: "unknown",
      });
    }
  };

  const refreshWorkspaces = async () => {
    setWorkspacesLoading(true);
    try {
      const { data } = await fetchWorkspaces();
      setWorkspaces(data);
      setWorkspaceMessage(null);
    } catch (error) {
      setWorkspaceMessage({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Failed to load workspaces.",
      });
    } finally {
      setWorkspacesLoading(false);
    }
  };

  const refreshWorkspaceUsage = async () => {
    setWorkspaceUsageLoading(true);
    try {
      const { data } = await fetchWorkspaceUsage();
      setWorkspaceUsage(data);
      setWorkspaceUsageError(null);
    } catch (error) {
      setWorkspaceUsageError(
        error instanceof Error
          ? error.message
          : "Failed to load workspace usage.",
      );
    } finally {
      setWorkspaceUsageLoading(false);
    }
  };

  const refreshRepos = async () => {
    setReposLoading(true);
    try {
      const { data } = await fetchRepos();
      setRepos(data);
      setSelectedRepoId((previous) => {
        if (previous && data.some((repo) => repo.id === previous)) {
          return previous;
        }
        return data[0]?.id ?? "";
      });
      setBranchesMessage(null);
    } catch (error) {
      setBranchesMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to load repositories.",
      });
    } finally {
      setReposLoading(false);
    }
  };

  const refreshBranches = async (repoId: string) => {
    setBranchesLoading(true);
    try {
      const { data } = await fetchBranches(repoId);
      setBranches(data);
      setBranchesMessage(null);
    } catch (error) {
      setBranches([]);
      setBranchesMessage({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Failed to load branches.",
      });
    } finally {
      setBranchesLoading(false);
    }
  };

  const setToolValue = (tool: Tool, value: string) => {
    setValueByTool((previous) => ({
      ...previous,
      [tool]: value,
    }));
  };

  const setToolMessage = (tool: Tool, message: ToolMessage) => {
    setMessageByTool((previous) => ({
      ...previous,
      [tool]: message,
    }));
  };

  const setToolSaving = (tool: Tool, saving: boolean) => {
    setSavingByTool((previous) => ({
      ...previous,
      [tool]: saving,
    }));
  };

  const handleLogin = async () => {
    if (!loginSecret.trim()) {
      setLoginMessage({
        kind: "error",
        text: "Enter the admin secret first.",
      });
      return;
    }

    setLoginBusy(true);
    setLoginMessage(null);

    try {
      await login(loginSecret);
      setLoginSecret("");
      await refreshSession();
      setLoginMessage({
        kind: "success",
        text: "Authenticated.",
      });
    } catch (error) {
      setLoginMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Login failed.",
      });
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setSession({
      authenticated: false,
      configured: session?.configured ?? true,
    });
    setWorkspaces([]);
    setWorkspaceUsage(null);
    setWorkspaceUsageError(null);
    setRepos([]);
    setBranches([]);
  };

  const handleSave = async (tool: Tool) => {
    const raw = valueByTool[tool].trim();

    if (!raw) {
      setToolMessage(tool, {
        kind: "error",
        text: "Nothing to save.",
      });
      return;
    }

    try {
      JSON.parse(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error";

      setToolMessage(tool, {
        kind: "error",
        text: `Invalid JSON: ${message}`,
      });
      return;
    }

    setToolMessage(tool, null);
    setToolSaving(tool, true);

    try {
      const data = await saveCredentials(tool, raw);

      setToolMessage(tool, {
        kind: "success",
        text: `✓ ${data.message}`,
      });
      setToolValue(tool, "");
      await refreshCredentialStatus();
    } catch (error) {
      setToolMessage(tool, {
        kind: "error",
        text: error instanceof Error ? error.message : "Server error.",
      });
    } finally {
      setToolSaving(tool, false);
    }
  };

  const handleClearCredentials = async (tool: Tool | "all") => {
    const label =
      tool === "all" ? "all saved credentials" : `${tool} credentials`;
    const confirmed = window.confirm(`Delete ${label}?`);
    if (!confirmed) {
      return;
    }

    setClearingCredentials(tool);
    const targetTools = tool === "all" ? TOOL_ORDER : [tool];

    try {
      const data = await clearCredentials(tool);
      for (const currentTool of targetTools) {
        setToolMessage(currentTool, {
          kind: "success",
          text: `✓ ${data.message}`,
        });
        setToolValue(currentTool, "");
      }
      await refreshCredentialStatus();
    } catch (error) {
      for (const currentTool of targetTools) {
        setToolMessage(currentTool, {
          kind: "error",
          text:
            error instanceof Error
              ? error.message
              : "Failed to clear credentials.",
        });
      }
    } finally {
      setClearingCredentials(null);
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    const deleteBranches = workspaceDeleteBranch[workspace.id] ?? false;
    const workspaceLabel = workspace.name || workspace.branch;
    const confirmed = window.confirm(
      deleteBranches
        ? `Delete workspace "${workspaceLabel}" and its branch?`
        : `Delete workspace "${workspaceLabel}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingWorkspaceId(workspace.id);
    setWorkspaceMessage(null);

    try {
      await deleteWorkspace(workspace.id, deleteBranches);
      setWorkspaceMessage({
        kind: "success",
        text: `Workspace "${workspaceLabel}" queued for deletion.`,
      });
      await refreshWorkspaces();
      await refreshWorkspaceUsage();
      if (deleteBranches && selectedRepoId) {
        await refreshBranches(selectedRepoId);
      }
    } catch (error) {
      setWorkspaceMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete workspace.",
      });
    } finally {
      setDeletingWorkspaceId(null);
    }
  };

  const handleDeleteBranch = async (branch: GitBranch) => {
    if (!selectedRepoId) {
      return;
    }

    const confirmed = window.confirm(`Delete branch "${branch.name}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingBranchName(branch.name);
    setBranchesMessage(null);

    try {
      await deleteBranch(selectedRepoId, branch.name);
      setBranchesMessage({
        kind: "success",
        text: `Deleted branch "${branch.name}".`,
      });
      await refreshBranches(selectedRepoId);
    } catch (error) {
      setBranchesMessage({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Failed to delete branch.",
      });
    } finally {
      setDeletingBranchName(null);
    }
  };

  const handleCleanOrphans = async () => {
    const confirmed = window.confirm(
      "Run orphan workspace cleanup and git worktree prune across all registered repos?",
    );
    if (!confirmed) {
      return;
    }

    setCleanupBusy("orphans");
    setCleanupMessage(null);

    try {
      const { data } = await cleanOrphanWorktrees();
      const warnings = data.repo_errors.length
        ? ` ${data.repo_errors.length} repo(s) reported prune errors.`
        : "";

      setCleanupMessage({
        kind: "success",
        text: `Checked ${data.repos_checked} repo(s), pruned ${data.repos_pruned}.${warnings}`,
      });
      await refreshWorkspaces();
      await refreshWorkspaceUsage();
      if (selectedRepoId) {
        await refreshBranches(selectedRepoId);
      }
    } catch (error) {
      setCleanupMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to clean orphan worktrees.",
      });
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleCleanData = async () => {
    const confirmed = window.confirm(
      "Delete persisted host data and saved Claude/Codex credentials? The host service will need a restart or redeploy afterward.",
    );
    if (!confirmed) {
      return;
    }

    setCleanupBusy("data");
    setCleanupMessage(null);

    try {
      const data = await cleanPersistedData();
      setCleanupMessage({
        kind: "success",
        text: data.message || "Persisted host data deleted.",
      });
      await refreshCredentialStatus();
      await refreshWorkspaces();
      await refreshWorkspaceUsage();
      await refreshRepos();
    } catch (error) {
      setCleanupMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to clean persisted host data.",
      });
    } finally {
      setCleanupBusy(null);
    }
  };

  if (sessionError) {
    return (
      <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
        <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-double">
          <Alert variant="destructive">
            <AlertDescription>{sessionError}</AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
        <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-double">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Host Admin</CardTitle>
              <CardDescription>Loading session…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  if (!session.configured) {
    return (
      <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
        <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-double">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Host Admin</CardTitle>
              <CardDescription>
                Configure <code>HOST_ADMIN_SECRET</code> before exposing this
                service.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
        <div className="mx-auto flex w-full max-w-[30rem] flex-col gap-double">
          <header className="flex flex-col gap-half">
            <h1 className="text-xl font-semibold text-high">Host Admin</h1>
            <p className="text-base text-low">
              Temporary admin console for credentials, workspace cleanup, and
              branch operations.
            </p>
          </header>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Admin login</CardTitle>
              <CardDescription>
                Sign in with the shared admin secret configured in{" "}
                <code>HOST_ADMIN_SECRET</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-double">
              <div className="flex flex-col gap-half">
                <Label htmlFor="admin-secret">Admin secret</Label>
                <Input
                  id="admin-secret"
                  type="password"
                  value={loginSecret}
                  onChange={(event) => setLoginSecret(event.target.value)}
                  onCommandEnter={() => {
                    void handleLogin();
                  }}
                />
              </div>

              {loginMessage && (
                <Alert
                  variant={
                    loginMessage.kind === "error" ? "destructive" : "success"
                  }
                >
                  <AlertDescription>{loginMessage.text}</AlertDescription>
                </Alert>
              )}

              <Button onClick={() => void handleLogin()} disabled={loginBusy}>
                {loginBusy ? "Signing in…" : "Sign in"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
      <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-double">
        <Card className="overflow-hidden border border-border bg-panel/95 backdrop-blur-sm">
          <CardContent className="grid gap-double p-double lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
            <div className="flex flex-col gap-base">
              <div className="flex flex-wrap items-center gap-half">
                <h1 className="text-2xl font-semibold text-high">Host Admin</h1>
                <Badge variant="outline">start when needed</Badge>
                <Badge variant="outline">turn off when done</Badge>
              </div>
              <p className="max-w-[48rem] text-base leading-relaxed text-low">
                Manage saved credentials, workspace lifecycle cleanup, and safe
                branch deletion through the same host backend the app already
                uses. This stays separate from the main product flow, but now
                uses the same component language and panel rhythm as the rest of
                the app.
              </p>
              <div className="flex flex-wrap gap-half text-sm text-low">
                <span className="rounded-full border border-border px-half py-[0.2rem]">
                  Shared-secret login
                </span>
                <span className="rounded-full border border-border px-half py-[0.2rem]">
                  Cookie session
                </span>
                <span className="rounded-full border border-border px-half py-[0.2rem]">
                  Proxy to host on safe actions
                </span>
              </div>
            </div>

            <div className="grid gap-half sm:grid-cols-2">
              <OverviewCard
                label="Saved credentials"
                value={`${savedCredentialsCount}/2`}
                detail="Claude and Codex volumes"
              />
              <OverviewCard
                label="Worktree disk"
                value={
                  workspaceUsageLoading && !workspaceUsage
                    ? "Loading…"
                    : formatBytes(workspaceUsage?.total_bytes ?? 0)
                }
                detail={
                  workspaceUsage
                    ? `${workspaceUsage.existing_workspace_count}/${workspaceUsage.workspace_count} workspace dirs present`
                    : `${workspaces.length} tracked workspace records`
                }
              />
              <OverviewCard
                label="Registered repos"
                value={String(repos.length)}
                detail="Repos available for branch cleanup"
              />
              <OverviewCard
                label="Visible local branches"
                value={selectedRepoId ? String(localBranchCount) : "—"}
                detail={
                  selectedRepo
                    ? selectedRepo.display_name || selectedRepo.name
                    : "Select a repo in Branches"
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-double lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <Card className="border border-border bg-panel/95 backdrop-blur-sm lg:sticky lg:top-double">
            <CardHeader className="pb-base">
              <CardTitle className="text-base">Sections</CardTitle>
              <CardDescription>
                Use the rail like the app settings and workspace side panels.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-half">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "rounded-lg border px-base py-base text-left transition-colors",
                    activeTab === tab.id
                      ? "border-foreground bg-primary/70"
                      : "border-border bg-transparent hover:bg-primary/40",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className="text-sm font-medium text-high">
                    {tab.label}
                  </div>
                  <div className="mt-[0.15rem] text-xs text-low">
                    {tab.summary}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="min-w-0 flex flex-col gap-double">
            <Card className="border border-border bg-panel/95 backdrop-blur-sm">
              <CardHeader className="gap-base border-b border-border/70">
                <div className="flex flex-col gap-base lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-col gap-half">
                    <div className="flex items-center gap-half">
                      <CardTitle className="text-xl text-high">
                        {activeTabMeta.label}
                      </CardTitle>
                      <Badge variant="outline">{activeTabMeta.summary}</Badge>
                    </div>
                    <CardDescription className="max-w-[42rem] text-sm leading-relaxed">
                      {activeTabMeta.description}
                    </CardDescription>
                  </div>

                  <Button variant="outline" onClick={() => void handleLogout()}>
                    Log out
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {activeTab === "credentials" && (
              <div className="grid gap-double lg:grid-cols-2">
                {TOOL_ORDER.map((tool) => {
                  const config = TOOL_CONFIG[tool];
                  const status = statusByTool[tool];
                  const message = messageByTool[tool];
                  const isSaving = savingByTool[tool];
                  const isClearing =
                    clearingCredentials === tool ||
                    clearingCredentials === "all";

                  return (
                    <Card
                      key={tool}
                      className="border border-border bg-panel/80"
                    >
                      <CardHeader className="gap-double">
                        <div className="flex items-center justify-between gap-half">
                          <CardTitle className="text-lg">
                            {config.title}
                          </CardTitle>
                          <Badge
                            variant={
                              isSavedStatus(status) ? "default" : "outline"
                            }
                          >
                            {statusBadgeText(status)}
                          </Badge>
                        </div>
                        <CardDescription className="space-y-half">
                          <p>{config.description}</p>
                          <code className="block rounded border border-border px-half py-half text-xs">
                            {config.command}
                          </code>
                          {config.hint && <p>{config.hint}</p>}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex flex-col gap-double">
                        <div className="flex flex-col gap-half">
                          <Label htmlFor={`credentials-${tool}`}>
                            Credentials JSON
                          </Label>
                          <Textarea
                            id={`credentials-${tool}`}
                            rows={10}
                            placeholder={config.placeholder}
                            value={valueByTool[tool]}
                            onChange={(event) =>
                              setToolValue(tool, event.target.value)
                            }
                          />
                        </div>

                        {message && (
                          <Alert
                            variant={
                              message.kind === "error"
                                ? "destructive"
                                : "success"
                            }
                          >
                            <AlertDescription>{message.text}</AlertDescription>
                          </Alert>
                        )}

                        <div className="flex flex-wrap gap-half">
                          <Button
                            onClick={() => void handleSave(tool)}
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving…" : config.saveLabel}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleClearCredentials(tool)}
                            disabled={isClearing}
                          >
                            {isClearing ? "Clearing…" : `Clear ${tool}`}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Card className="border border-border bg-panel/80 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Credential notes</CardTitle>
                    <CardDescription>
                      Save only the credential file content itself. This service
                      writes it into the mounted Docker volume so the host
                      container can use subscription logins without interactive
                      CLI auth.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-half">
                    <Button
                      variant="destructive"
                      onClick={() => void handleClearCredentials("all")}
                      disabled={clearingCredentials === "all"}
                    >
                      {clearingCredentials === "all"
                        ? "Clearing…"
                        : "Clear all saved credentials"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "workspaces" && (
              <Card className="border border-border bg-panel/80">
                <CardHeader>
                  <CardTitle className="text-lg">Workspaces</CardTitle>
                  <CardDescription>
                    Delete workspaces through the normal host lifecycle so
                    database state, background cleanup, and optional branch
                    deletion stay in sync.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-double">
                  {workspaceMessage && (
                    <Alert
                      variant={
                        workspaceMessage.kind === "error"
                          ? "destructive"
                          : "success"
                      }
                    >
                      <AlertDescription>
                        {workspaceMessage.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  {workspaceUsageError && (
                    <Alert variant="destructive">
                      <AlertDescription>{workspaceUsageError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() =>
                        void Promise.all([
                          refreshWorkspaces(),
                          refreshWorkspaceUsage(),
                        ])
                      }
                    >
                      Refresh
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Name</TableHeaderCell>
                          <TableHeaderCell>Branch</TableHeaderCell>
                          <TableHeaderCell>State</TableHeaderCell>
                          <TableHeaderCell>Usage</TableHeaderCell>
                          <TableHeaderCell>Delete branch</TableHeaderCell>
                          <TableHeaderCell className="text-right">
                            Action
                          </TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(workspacesLoading || workspaceUsageLoading) && (
                          <TableLoading colSpan={6} />
                        )}
                        {!workspacesLoading &&
                          !workspaceUsageLoading &&
                          workspaces.length === 0 && (
                            <TableEmpty colSpan={6}>
                              No workspaces found.
                            </TableEmpty>
                          )}
                        {!workspacesLoading &&
                          !workspaceUsageLoading &&
                          workspaces.map((workspace) => {
                            const usage = workspaceUsageById.get(workspace.id);
                            const existingRepoWorktrees =
                              usage?.repo_worktrees.filter(
                                (repo) => repo.exists,
                              ) ?? [];

                            return (
                              <TableRow key={workspace.id}>
                                <TableCell>
                                  <div className="flex flex-col gap-[0.2rem]">
                                    <span className="font-medium text-high">
                                      {workspace.name || workspace.branch}
                                    </span>
                                    <span className="text-xs text-low">
                                      {workspace.id}
                                    </span>
                                    {usage?.workspace_dir && (
                                      <span className="truncate text-xs text-low">
                                        {usage.workspace_dir}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs">
                                    {workspace.branch}
                                  </code>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-half">
                                    {workspace.archived && (
                                      <Badge variant="outline">archived</Badge>
                                    )}
                                    {workspace.pinned && (
                                      <Badge variant="outline">pinned</Badge>
                                    )}
                                    {workspace.worktree_deleted && (
                                      <Badge variant="outline">
                                        worktree deleted
                                      </Badge>
                                    )}
                                    {!workspace.archived &&
                                      !workspace.worktree_deleted && (
                                        <Badge variant="outline">active</Badge>
                                      )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {!usage ? (
                                    <span className="text-sm text-low">—</span>
                                  ) : (
                                    <div className="flex flex-col gap-[0.2rem]">
                                      <span className="font-medium text-high">
                                        {formatBytes(usage.total_bytes)}
                                      </span>
                                      <span className="text-xs text-low">
                                        {usage.exists
                                          ? `${existingRepoWorktrees.length}/${usage.repo_worktrees.length} repo worktrees present`
                                          : "workspace dir missing"}
                                      </span>
                                      {usage.repo_worktrees.length > 0 && (
                                        <div className="mt-[0.15rem] flex flex-col gap-[0.15rem]">
                                          {usage.repo_worktrees.map((repo) => (
                                            <span
                                              key={repo.repo_id}
                                              className="text-xs text-low"
                                            >
                                              <span className="font-medium text-high">
                                                {repo.repo_name}
                                              </span>{" "}
                                              {repo.exists
                                                ? formatBytes(repo.bytes)
                                                : "missing"}
                                              {repo.error
                                                ? ` (${repo.error})`
                                                : ""}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {usage.error && (
                                        <span className="text-xs text-danger">
                                          {usage.error}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-half">
                                    <Checkbox
                                      checked={
                                        workspaceDeleteBranch[workspace.id] ??
                                        false
                                      }
                                      onCheckedChange={(checked) =>
                                        setWorkspaceDeleteBranch(
                                          (previous) => ({
                                            ...previous,
                                            [workspace.id]: checked,
                                          }),
                                        )
                                      }
                                    />
                                    <span className="text-sm text-low">
                                      also delete branch
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      void handleDeleteWorkspace(workspace)
                                    }
                                    disabled={
                                      deletingWorkspaceId === workspace.id
                                    }
                                  >
                                    {deletingWorkspaceId === workspace.id
                                      ? "Deleting…"
                                      : "Delete"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "branches" && (
              <Card className="border border-border bg-panel/80">
                <CardHeader>
                  <CardTitle className="text-lg">Branches</CardTitle>
                  <CardDescription>
                    Delete only local, non-current branches. Remote refs stay
                    visible for context but are not deletable in v1.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-double">
                  {branchesMessage && (
                    <Alert
                      variant={
                        branchesMessage.kind === "error"
                          ? "destructive"
                          : "success"
                      }
                    >
                      <AlertDescription>
                        {branchesMessage.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-half sm:max-w-[20rem]">
                    <Label htmlFor="repo-selector">Repository</Label>
                    <select
                      id="repo-selector"
                      className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
                      value={selectedRepoId}
                      onChange={(event) =>
                        setSelectedRepoId(event.target.value)
                      }
                      disabled={reposLoading || repos.length === 0}
                    >
                      {repos.length === 0 && (
                        <option value="">No repositories</option>
                      )}
                      {repos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.display_name || repo.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Branch</TableHeaderCell>
                          <TableHeaderCell>Badges</TableHeaderCell>
                          <TableHeaderCell>Last commit</TableHeaderCell>
                          <TableHeaderCell className="text-right">
                            Action
                          </TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(reposLoading || branchesLoading) && (
                          <TableLoading colSpan={4} />
                        )}
                        {!reposLoading &&
                          !branchesLoading &&
                          !selectedRepoId && (
                            <TableEmpty colSpan={4}>
                              Select a repository to manage branches.
                            </TableEmpty>
                          )}
                        {!reposLoading &&
                          !branchesLoading &&
                          selectedRepoId &&
                          branches.length === 0 && (
                            <TableEmpty colSpan={4}>
                              No branches found.
                            </TableEmpty>
                          )}
                        {!reposLoading &&
                          !branchesLoading &&
                          branches.map((branch) => {
                            const cannotDelete =
                              branch.is_current ||
                              branch.is_remote ||
                              deletingBranchName === branch.name;

                            return (
                              <TableRow key={branch.name}>
                                <TableCell>
                                  <div className="flex flex-col gap-[0.2rem]">
                                    <span className="font-medium text-high">
                                      {branch.name}
                                    </span>
                                    {selectedRepo && (
                                      <span className="text-xs text-low">
                                        {selectedRepo.display_name ||
                                          selectedRepo.name}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-half">
                                    {branch.is_current && (
                                      <Badge variant="outline">current</Badge>
                                    )}
                                    {branch.is_remote && (
                                      <Badge variant="outline">remote</Badge>
                                    )}
                                    {!branch.is_current &&
                                      !branch.is_remote && (
                                        <Badge variant="outline">local</Badge>
                                      )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-low">
                                  {formatDate(branch.last_commit_date)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={cannotDelete}
                                    onClick={() =>
                                      void handleDeleteBranch(branch)
                                    }
                                  >
                                    {deletingBranchName === branch.name
                                      ? "Deleting…"
                                      : "Delete"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "cleanup" && (
              <div className="grid gap-double lg:grid-cols-2">
                <Card className="border border-border bg-panel/80">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Clean orphan worktrees
                    </CardTitle>
                    <CardDescription>
                      Trigger orphan workspace cleanup immediately and run{" "}
                      <code>git worktree prune</code> across registered repos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-double">
                    <p className="text-sm text-low">
                      This is the safe cleanup path. It should only remove
                      orphaned worktree directories and stale Git worktree
                      metadata.
                    </p>
                    <Button
                      onClick={() => void handleCleanOrphans()}
                      disabled={cleanupBusy !== null}
                    >
                      {cleanupBusy === "orphans"
                        ? "Cleaning…"
                        : "Clean orphan worktrees"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-panel/80">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Clean persisted host data
                    </CardTitle>
                    <CardDescription>
                      Delete mounted host data plus saved Claude/Codex
                      credentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-double">
                    <p className="text-sm text-low">
                      This is stronger than orphan cleanup. It wipes the
                      persisted host state and usually requires a host restart
                      or redeploy before the stack is usable again.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => void handleCleanData()}
                      disabled={cleanupBusy !== null}
                    >
                      {cleanupBusy === "data"
                        ? "Deleting…"
                        : "Clean persisted host data"}
                    </Button>
                  </CardContent>
                </Card>

                {cleanupMessage && (
                  <Alert
                    className="lg:col-span-2"
                    variant={
                      cleanupMessage.kind === "error"
                        ? "destructive"
                        : "success"
                    }
                  >
                    <AlertDescription>{cleanupMessage.text}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
