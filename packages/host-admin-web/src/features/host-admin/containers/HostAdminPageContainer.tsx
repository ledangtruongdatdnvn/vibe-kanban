import { useEffect, useMemo, useState } from "react";
import {
  cleanOrphanWorktrees,
  cleanPersistedData,
  clearCredentials,
  deleteBranch,
  deleteWorkspace,
  fetchBranches,
  fetchRepos,
  fetchSession,
  fetchStatus,
  fetchWorkspaceUsage,
  fetchWorkspaces,
  login,
  logout,
  saveCredentials,
} from "@host-admin/features/host-admin/model/hostAdminApi";
import {
  INITIAL_MESSAGE,
  INITIAL_SAVING,
  INITIAL_STATUS,
  INITIAL_VALUE,
  TOOL_ORDER,
  isSavedStatus,
} from "@host-admin/features/host-admin/model/hostAdminPresentation";
import type {
  GitBranch,
  Repo,
  SessionResponse,
  Tab,
  Tool,
  ToolMessage,
  Workspace,
  WorkspaceUsageSummary,
} from "@host-admin/features/host-admin/model/hostAdminTypes";
import { HostAdminPageView } from "@host-admin/features/host-admin/views/HostAdminPageView";

export function HostAdminPageContainer() {
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
  const [selectedRepoId, setSelectedRepoId] = useState("");
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

  return (
    <HostAdminPageView
      session={session}
      sessionError={sessionError}
      loginSecret={loginSecret}
      loginBusy={loginBusy}
      loginMessage={loginMessage}
      activeTab={activeTab}
      savedCredentialsCount={savedCredentialsCount}
      workspacesCount={workspaces.length}
      workspaceUsage={workspaceUsage}
      workspaceUsageLoading={workspaceUsageLoading}
      reposCount={repos.length}
      selectedRepoId={selectedRepoId}
      selectedRepo={selectedRepo}
      localBranchCount={localBranchCount}
      credentialsSection={{
        statusByTool,
        valueByTool,
        messageByTool,
        savingByTool,
        clearingCredentials,
        onToolValueChange: setToolValue,
        onSave: (tool) => {
          void handleSave(tool);
        },
        onClearCredentials: (tool) => {
          void handleClearCredentials(tool);
        },
      }}
      workspacesSection={{
        workspaces,
        workspacesLoading,
        workspaceMessage,
        workspaceUsageLoading,
        workspaceUsageError,
        workspaceUsageById,
        workspaceDeleteBranch,
        deletingWorkspaceId,
        onWorkspaceDeleteBranchChange: (workspaceId, checked) => {
          setWorkspaceDeleteBranch((previous) => ({
            ...previous,
            [workspaceId]: checked,
          }));
        },
        onDeleteWorkspace: (workspace) => {
          void handleDeleteWorkspace(workspace);
        },
        onRefresh: () => {
          void Promise.all([refreshWorkspaces(), refreshWorkspaceUsage()]);
        },
      }}
      branchesSection={{
        repos,
        reposLoading,
        selectedRepoId,
        selectedRepo,
        branches,
        branchesLoading,
        branchesMessage,
        deletingBranchName,
        onSelectedRepoChange: setSelectedRepoId,
        onDeleteBranch: (branch) => {
          void handleDeleteBranch(branch);
        },
      }}
      terminalSection={{
        repos,
        reposLoading,
        selectedRepoId,
        selectedRepo,
        onSelectedRepoChange: setSelectedRepoId,
      }}
      cleanupSection={{
        cleanupMessage,
        cleanupBusy,
        onCleanOrphans: () => {
          void handleCleanOrphans();
        },
        onCleanData: () => {
          void handleCleanData();
        },
      }}
      onLoginSecretChange={setLoginSecret}
      onLogin={() => {
        void handleLogin();
      }}
      onTabChange={setActiveTab}
      onLogout={() => {
        void handleLogout();
      }}
    />
  );
}
