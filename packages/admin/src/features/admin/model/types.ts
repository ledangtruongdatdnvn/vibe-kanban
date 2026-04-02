export type Tool = "claude" | "codex";
export type Tab =
  | "credentials"
  | "workspaces"
  | "branches"
  | "terminal"
  | "cleanup";

export type ToolMessage = {
  kind: "success" | "error";
  text: string;
} | null;

export type StatusResponse = Record<Tool, string>;

export type SessionResponse = {
  authenticated: boolean;
  configured: boolean;
};

export type ActionResponse = {
  error?: string;
  message?: string;
};

export type ApiEnvelope<T, E = { message?: string; workspaces?: string[] }> = {
  success: boolean;
  data: T | null;
  error_data: E | null;
  message: string | null;
};

export type Workspace = {
  id: string;
  branch: string;
  archived: boolean;
  pinned: boolean;
  name: string | null;
  created_at: string;
  updated_at: string;
  worktree_deleted: boolean;
};

export type Repo = {
  id: string;
  path: string;
  name: string;
  display_name: string | null;
  default_target_branch: string | null;
};

export type GitHubRepoImportInput = {
  repository: string;
  folderName?: string;
  displayName?: string;
};

export type GitBranch = {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit_date: string;
};

export type RepoGitAuthStatus = {
  remote_name: string | null;
  remote_url: string | null;
  https_remote_url: string | null;
  repo_full_name: string | null;
  provider: string;
  auth_mode: string;
  ready: boolean;
  message: string;
};

export type CleanupSummary = {
  orphan_cleanup_disabled: boolean;
  repos_checked: number;
  repos_pruned: number;
  repo_errors: string[];
};

export type WorkspaceUsageRepo = {
  repo_id: string;
  repo_name: string;
  worktree_path: string;
  bytes: number;
  exists: boolean;
  error: string | null;
};

export type WorkspaceUsageItem = {
  workspace_id: string;
  workspace_name: string | null;
  branch: string;
  workspace_dir: string | null;
  total_bytes: number;
  exists: boolean;
  error: string | null;
  repo_worktrees: WorkspaceUsageRepo[];
};

export type WorkspaceUsageSummary = {
  total_bytes: number;
  workspace_count: number;
  existing_workspace_count: number;
  items: WorkspaceUsageItem[];
};

export type ToolConfig = {
  command: string;
  description: string;
  hint?: string;
  placeholder: string;
  saveLabel: string;
  title: string;
};

export type TabMeta = {
  id: Tab;
  label: string;
  summary: string;
};
