import { useContext, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader } from "@vibe/ui/components/Card";
import {
  clearCredentials,
  fetchStatus,
  saveCredentials,
} from "@admin/features/admin/model/api";
import {
  INITIAL_MESSAGE,
  INITIAL_SAVING,
  INITIAL_STATUS,
  INITIAL_VALUE,
  TABS,
  TOOL_ORDER,
  isSavedStatus,
} from "@admin/features/admin/model/presentation";
import type { Tool, ToolMessage } from "@admin/features/admin/model/types";
import { AdminContext } from "@admin/routes/__root";
import { CredentialsSection } from "@admin/features/admin/ui/CredentialsSection";
import { PageHeader } from "@admin/features/admin/ui/PageHeader";

function CredentialsRoute() {
  const { onLogout, refreshOverview } = useContext(AdminContext);
  const tabMeta = TABS.find((t) => t.id === "credentials")!;

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

  const refreshCredentialStatus = async () => {
    try {
      const data = await fetchStatus();
      setStatusByTool({
        claude: data.claude || "unknown",
        codex: data.codex || "unknown",
      });
    } catch {
      setStatusByTool({ claude: "unknown", codex: "unknown" });
    }
  };

  useEffect(() => {
    void refreshCredentialStatus();
  }, []);

  const savedCredentialsCount = TOOL_ORDER.filter((tool) =>
    isSavedStatus(statusByTool[tool]),
  ).length;

  const setToolValue = (tool: Tool, value: string) => {
    setValueByTool((prev) => ({ ...prev, [tool]: value }));
  };

  const setToolMessage = (tool: Tool, message: ToolMessage) => {
    setMessageByTool((prev) => ({ ...prev, [tool]: message }));
  };

  const setToolSaving = (tool: Tool, saving: boolean) => {
    setSavingByTool((prev) => ({ ...prev, [tool]: saving }));
  };

  const handleSave = async (tool: Tool) => {
    const raw = valueByTool[tool].trim();
    if (!raw) {
      setToolMessage(tool, { kind: "error", text: "Nothing to save." });
      return;
    }
    try {
      JSON.parse(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error";
      setToolMessage(tool, { kind: "error", text: `Invalid JSON: ${message}` });
      return;
    }
    setToolMessage(tool, null);
    setToolSaving(tool, true);
    try {
      const data = await saveCredentials(tool, raw);
      setToolMessage(tool, { kind: "success", text: `✓ ${data.message}` });
      setToolValue(tool, "");
      await refreshCredentialStatus();
      refreshOverview();
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
    if (!window.confirm(`Delete ${label}?`)) return;
    setClearingCredentials(tool);
    const targetTools = tool === "all" ? TOOL_ORDER : [tool];
    try {
      const data = await clearCredentials(tool);
      for (const t of targetTools) {
        setToolMessage(t, { kind: "success", text: `✓ ${data.message}` });
        setToolValue(t, "");
      }
      await refreshCredentialStatus();
      refreshOverview();
    } catch (error) {
      for (const t of targetTools) {
        setToolMessage(t, {
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

  return (
    <>
      <Card className="border border-border bg-panel/95 backdrop-blur-sm">
        <CardHeader className="gap-base border-b border-border/70">
          <PageHeader
            title={tabMeta.label}
            summary={`${savedCredentialsCount}/2 saved · ${tabMeta.summary}`}
            description={tabMeta.description}
            onLogout={onLogout}
          />
        </CardHeader>
      </Card>
      <CredentialsSection
        statusByTool={statusByTool}
        valueByTool={valueByTool}
        messageByTool={messageByTool}
        savingByTool={savingByTool}
        clearingCredentials={clearingCredentials}
        onToolValueChange={setToolValue}
        onSave={(tool) => {
          void handleSave(tool);
        }}
        onClearCredentials={(tool) => {
          void handleClearCredentials(tool);
        }}
      />
    </>
  );
}

export const Route = createFileRoute("/credentials")({
  component: CredentialsRoute,
});
