import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Badge } from "@vibe/ui/components/Badge";
import { Button } from "@vibe/ui/components/Button";
import { Label } from "@vibe/ui/components/Label";
import { Textarea } from "@vibe/ui/components/Textarea";
import { cn } from "@vibe/ui/lib/cn";

type Tool = "claude" | "codex";

type ToolMessage = {
  kind: "success" | "error";
  text: string;
} | null;

type StatusResponse = Record<Tool, string>;

type SaveResponse = {
  error?: string;
  message?: string;
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

async function fetchStatus(): Promise<StatusResponse> {
  const response = await fetch("/status");
  if (!response.ok) {
    throw new Error(`Failed to load status (${response.status})`);
  }

  return response.json() as Promise<StatusResponse>;
}

async function saveCredentials(
  tool: Tool,
  credentials: string,
): Promise<{ ok: boolean; data: SaveResponse }> {
  const response = await fetch("/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, credentials }),
  });

  const data = (await response.json()) as SaveResponse;

  return {
    ok: response.ok,
    data,
  };
}

function statusBadgeText(status: string) {
  if (status === "loading…") {
    return "loading…";
  }

  return status.startsWith("saved") ? "saved ✓" : "not set";
}

function isSavedStatus(status: string) {
  return status.startsWith("saved");
}

function AuthHelperPage() {
  const [statusByTool, setStatusByTool] =
    useState<Record<Tool, string>>(INITIAL_STATUS);
  const [valueByTool, setValueByTool] =
    useState<Record<Tool, string>>(INITIAL_VALUE);
  const [messageByTool, setMessageByTool] =
    useState<Record<Tool, ToolMessage>>(INITIAL_MESSAGE);
  const [savingByTool, setSavingByTool] =
    useState<Record<Tool, boolean>>(INITIAL_SAVING);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const data = await fetchStatus();
        if (cancelled) {
          return;
        }

        setStatusByTool({
          claude: data.claude || "unknown",
          codex: data.codex || "unknown",
        });
      } catch {
        if (cancelled) {
          return;
        }

        setStatusByTool({
          claude: "unknown",
          codex: "unknown",
        });
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = async () => {
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
      const { ok, data } = await saveCredentials(tool, raw);

      if (ok) {
        setToolMessage(tool, {
          kind: "success",
          text: `✓ ${data.message}`,
        });
        setToolValue(tool, "");
        await refreshStatus();
      } else {
        setToolMessage(tool, {
          kind: "error",
          text: data.error || "Server error",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";

      setToolMessage(tool, {
        kind: "error",
        text: `Network error: ${message}`,
      });
    } finally {
      setToolSaving(tool, false);
    }
  };

  return (
    <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
      <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-double">
        <header className="flex flex-col gap-half">
          <h1 className="text-xl font-semibold text-high">
            vibe-kanban · AI credentials
          </h1>
          <p className="text-base text-low">
            Paste your local credentials files to authenticate the HOST
            container.
          </p>
        </header>

        {TOOL_ORDER.map((tool) => {
          const config = TOOL_CONFIG[tool];
          const status = statusByTool[tool];
          const isSaved = isSavedStatus(status);
          const message = messageByTool[tool];

          return (
            <section
              key={tool}
              className="rounded-lg border border-border bg-secondary p-double shadow-sm"
            >
              <div className="flex flex-col gap-base">
                <div className="flex items-center gap-base">
                  <h2 className="text-lg font-semibold text-high">
                    {config.title}
                  </h2>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "border text-sm",
                      isSaved
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-border bg-panel text-low",
                    )}
                  >
                    {statusBadgeText(status)}
                  </Badge>
                </div>

                <div className="text-base leading-relaxed text-low">
                  <p>{config.description}</p>
                  <code className="mt-half inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-panel px-base py-half font-ibm-plex-mono text-sm text-normal">
                    {config.command}
                  </code>
                  {config.hint ? (
                    <p className="mt-half">{config.hint}</p>
                  ) : null}
                </div>

                <p className="text-sm text-low">{status}</p>

                <div className="flex flex-col gap-half">
                  <Label
                    className="text-base font-medium text-high"
                    htmlFor={`${tool}-credentials`}
                  >
                    Credentials JSON
                  </Label>
                  <Textarea
                    id={`${tool}-credentials`}
                    value={valueByTool[tool]}
                    onChange={(event) => setToolValue(tool, event.target.value)}
                    placeholder={config.placeholder}
                    spellCheck={false}
                    className="min-h-[9rem] rounded-md border-border bg-panel font-ibm-plex-mono text-sm text-normal placeholder:text-low focus-visible:ring-1 focus-visible:ring-brand"
                  />
                </div>

                <div className="flex flex-col items-start gap-base">
                  <Button
                    type="button"
                    onClick={() => void handleSave(tool)}
                    disabled={savingByTool[tool]}
                    className="border-brand bg-brand text-on-brand hover:bg-brand-hover"
                  >
                    {savingByTool[tool] ? "Saving…" : config.saveLabel}
                  </Button>

                  {message ? (
                    <Alert
                      variant={
                        message.kind === "success" ? "success" : "destructive"
                      }
                      className="rounded-md border"
                    >
                      <AlertDescription>{message.text}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}

        <footer className="text-sm text-low">
          Accessible only on 127.0.0.1 — do not expose this port publicly.
        </footer>
      </div>
    </main>
  );
}

export { AuthHelperPage };
