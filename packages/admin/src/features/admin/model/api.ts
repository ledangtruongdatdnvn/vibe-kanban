import type {
  ActionResponse,
  ApiEnvelope,
  CleanupSummary,
  GitBranch,
  GitHubRepoImportInput,
  Repo,
  RepoGitAuthStatus,
  SessionResponse,
  StatusResponse,
  Tool,
  Workspace,
  WorkspaceUsageSummary,
} from "@admin/features/admin/model/types";

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

async function requestEnvelopeAction(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<null>;

  if (!response.ok || !payload.success) {
    throw new Error(extractEnvelopeError(payload, response.status));
  }

  return payload;
}

export async function fetchSession() {
  return requestJson<SessionResponse>("/api/auth/session");
}

export async function login(secret: string) {
  return requestJson<ActionResponse>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret }),
  });
}

export async function logout() {
  return requestJson<ActionResponse>("/api/auth/logout", {
    method: "POST",
  });
}

export async function fetchStatus(): Promise<StatusResponse> {
  return requestJson<StatusResponse>("/api/credentials/status");
}

export async function saveCredentials(tool: Tool, credentials: string) {
  return requestJson<ActionResponse>("/api/credentials/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, credentials }),
  });
}

export async function clearCredentials(tool: Tool | "all") {
  return requestJson<ActionResponse>("/api/credentials/clear", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool }),
  });
}

export async function fetchWorkspaces() {
  return requestEnvelope<Workspace[]>("/api/workspaces");
}

export async function fetchWorkspaceUsage() {
  return requestEnvelope<WorkspaceUsageSummary>("/api/workspace-usage");
}

export async function deleteWorkspace(
  workspaceId: string,
  deleteBranches: boolean,
) {
  const params = new URLSearchParams();
  params.set("delete_remote", "true");

  if (deleteBranches) {
    params.set("delete_branches", "true");
  }

  return requestEnvelopeAction(
    `/api/workspaces/${workspaceId}?${params.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function verifyRemoteWorkspaceDeleted(workspaceId: string) {
  const response = await fetch(
    `/api/remote/workspaces/by-local-id/${workspaceId}`,
  );

  if (response.status === 404) {
    return true;
  }

  const payload = (await response.json()) as ApiEnvelope<Workspace>;

  if (!response.ok) {
    throw new Error(extractEnvelopeError(payload, response.status));
  }

  return false;
}

export async function fetchRepos() {
  return requestEnvelope<Repo[]>("/api/repos");
}

export async function importGitHubRepo(input: GitHubRepoImportInput) {
  return requestEnvelope<Repo>("/api/repos/import/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function fetchBranches(repoId: string) {
  return requestEnvelope<GitBranch[]>(`/api/repos/${repoId}/branches`);
}

export async function fetchRepoGitAuthStatus(repoId: string) {
  return requestEnvelope<RepoGitAuthStatus>(`/api/repos/${repoId}/git-auth`);
}

export async function deleteBranch(repoId: string, branchName: string) {
  return requestEnvelopeAction(
    `/api/repos/${repoId}/branches/${encodeURIComponent(branchName)}`,
    {
      method: "DELETE",
    },
  );
}

export async function cleanOrphanWorktrees() {
  return requestEnvelope<CleanupSummary>("/api/cleanup/orphan-worktrees", {
    method: "POST",
  });
}

export async function cleanPersistedData() {
  return requestJson<ActionResponse>("/api/cleanup/data", {
    method: "POST",
  });
}
