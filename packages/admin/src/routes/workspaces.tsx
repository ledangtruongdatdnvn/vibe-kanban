import { useContext, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader } from "@vibe/ui/components/Card";
import {
  deleteWorkspace,
  fetchWorkspaceUsage,
  fetchWorkspaces,
} from "@admin/features/admin/model/api";
import { TABS } from "@admin/features/admin/model/presentation";
import type { ToolMessage, Workspace } from "@admin/features/admin/model/types";
import { AdminContext } from "@admin/routes/__root";
import { PageHeader } from "@admin/features/admin/ui/PageHeader";
import { WorkspacesSection } from "@admin/features/admin/ui/WorkspacesSection";

function WorkspacesRoute() {
  const { onLogout, refreshOverview } = useContext(AdminContext);
  const tabMeta = TABS.find((t) => t.id === "workspaces")!;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<ToolMessage>(null);
  const [workspaceUsage, setWorkspaceUsage] = useState<
    import("@admin/features/admin/model/types").WorkspaceUsageSummary | null
  >(null);
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

  const workspaceUsageById = useMemo(
    () =>
      new Map(
        (workspaceUsage?.items ?? []).map((item) => [item.workspace_id, item]),
      ),
    [workspaceUsage],
  );

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

  useEffect(() => {
    void Promise.all([refreshWorkspaces(), refreshWorkspaceUsage()]);
  }, []);

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    const deleteBranches = workspaceDeleteBranch[workspace.id] ?? false;
    const workspaceLabel = workspace.name || workspace.branch;
    if (
      !window.confirm(
        deleteBranches
          ? `Delete workspace "${workspaceLabel}" and its branch?`
          : `Delete workspace "${workspaceLabel}"?`,
      )
    )
      return;

    setDeletingWorkspaceId(workspace.id);
    setWorkspaceMessage(null);
    try {
      await deleteWorkspace(workspace.id, deleteBranches);
      setWorkspaceMessage({
        kind: "success",
        text: `Workspace "${workspaceLabel}" queued for deletion.`,
      });
      await Promise.all([refreshWorkspaces(), refreshWorkspaceUsage()]);
      refreshOverview();
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
      <WorkspacesSection
        workspaces={workspaces}
        workspacesLoading={workspacesLoading}
        workspaceMessage={workspaceMessage}
        workspaceUsageLoading={workspaceUsageLoading}
        workspaceUsageError={workspaceUsageError}
        workspaceUsageById={workspaceUsageById}
        workspaceDeleteBranch={workspaceDeleteBranch}
        deletingWorkspaceId={deletingWorkspaceId}
        onWorkspaceDeleteBranchChange={(workspaceId, checked) => {
          setWorkspaceDeleteBranch((prev) => ({
            ...prev,
            [workspaceId]: checked,
          }));
        }}
        onDeleteWorkspace={(workspace) => {
          void handleDeleteWorkspace(workspace);
        }}
        onRefresh={() => {
          void Promise.all([refreshWorkspaces(), refreshWorkspaceUsage()]);
        }}
      />
    </>
  );
}

export const Route = createFileRoute("/workspaces")({
  component: WorkspacesRoute,
});
