import { useContext, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader } from "@vibe/ui/components/Card";
import {
  cleanOrphanWorktrees,
  cleanPersistedData,
} from "@admin/features/admin/model/api";
import { TABS } from "@admin/features/admin/model/presentation";
import type { ToolMessage } from "@admin/features/admin/model/types";
import { AdminContext } from "@admin/routes/__root";
import { CleanupSection } from "@admin/features/admin/ui/CleanupSection";
import { PageHeader } from "@admin/features/admin/ui/PageHeader";

function CleanupRoute() {
  const { onLogout } = useContext(AdminContext);
  const tabMeta = TABS.find((t) => t.id === "cleanup")!;

  const [cleanupMessage, setCleanupMessage] = useState<ToolMessage>(null);
  const [cleanupBusy, setCleanupBusy] = useState<null | "orphans" | "data">(
    null,
  );

  const handleCleanOrphans = async () => {
    if (
      !window.confirm(
        "Run orphan workspace cleanup and git worktree prune across all registered repos?",
      )
    )
      return;
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
    if (
      !window.confirm(
        "Delete persisted host data and saved Claude/Codex credentials? The host service will need a restart or redeploy afterward.",
      )
    )
      return;
    setCleanupBusy("data");
    setCleanupMessage(null);
    try {
      const data = await cleanPersistedData();
      setCleanupMessage({
        kind: "success",
        text: data.message || "Persisted host data deleted.",
      });
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
    <>
      <Card className="border border-border bg-panel/95 backdrop-blur-sm">
        <CardHeader className="gap-base border-b border-border/70">
          <PageHeader
            title={tabMeta.label}
            summary={tabMeta.summary}
            description={tabMeta.description}
            onLogout={onLogout}
          />
        </CardHeader>
      </Card>
      <CleanupSection
        cleanupMessage={cleanupMessage}
        cleanupBusy={cleanupBusy}
        onCleanOrphans={() => {
          void handleCleanOrphans();
        }}
        onCleanData={() => {
          void handleCleanData();
        }}
      />
    </>
  );
}

export const Route = createFileRoute("/cleanup")({
  component: CleanupRoute,
});
