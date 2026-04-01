import type {
  HostAdminTabMeta,
  Tool,
  ToolConfig,
  ToolMessage,
} from "@host-admin/features/host-admin/model/hostAdminTypes";

export const TOOL_ORDER: Tool[] = ["claude", "codex"];

export const TABS: HostAdminTabMeta[] = [
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
    id: "terminal",
    label: "Terminal",
    summary: "Repo shell access",
    description: "Open an authenticated terminal in a repo root for git ops.",
  },
  {
    id: "cleanup",
    label: "Cleanup",
    summary: "Prune or wipe persisted state",
    description: "Run safe orphan cleanup or wipe mounted host data.",
  },
];

export const TOOL_CONFIG: Record<Tool, ToolConfig> = {
  claude: {
    title: "Claude Code (Anthropic)",
    description: "On your local machine, run:",
    command: 'security find-generic-password -s "Claude Code-credentials" -w',
    hint: "If this fails, sign in once with claude auth login on your machine first.",
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

export const INITIAL_STATUS: Record<Tool, string> = {
  claude: "loading…",
  codex: "loading…",
};

export const INITIAL_VALUE: Record<Tool, string> = {
  claude: "",
  codex: "",
};

export const INITIAL_MESSAGE: Record<Tool, ToolMessage> = {
  claude: null,
  codex: null,
};

export const INITIAL_SAVING: Record<Tool, boolean> = {
  claude: false,
  codex: false,
};

export function statusBadgeText(status: string) {
  if (status === "loading…") {
    return "loading…";
  }

  return status.startsWith("saved") ? "saved" : "not set";
}

export function isSavedStatus(status: string) {
  return status.startsWith("saved");
}

export function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatBytes(bytes: number) {
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
