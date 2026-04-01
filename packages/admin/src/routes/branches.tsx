import { useContext, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader } from "@vibe/ui/components/Card";
import {
  deleteBranch,
  fetchBranches,
  fetchRepoGitAuthStatus,
  fetchRepos,
} from "@admin/features/admin/model/api";
import { TABS } from "@admin/features/admin/model/presentation";
import type {
  GitBranch,
  Repo,
  ToolMessage,
} from "@admin/features/admin/model/types";
import { AdminContext } from "@admin/routes/__root";
import { BranchesSection } from "@admin/features/admin/ui/BranchesSection";
import { PageHeader } from "@admin/features/admin/ui/PageHeader";

function BranchesRoute() {
  const { onLogout } = useContext(AdminContext);
  const tabMeta = TABS.find((t) => t.id === "branches")!;

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesMessage, setBranchesMessage] = useState<ToolMessage>(null);
  const [deletingBranchName, setDeletingBranchName] = useState<string | null>(
    null,
  );

  const selectedRepo = repos.find((repo) => repo.id === selectedRepoId) ?? null;

  const refreshRepos = async () => {
    setReposLoading(true);
    try {
      const { data } = await fetchRepos();
      setRepos(data);
      setSelectedRepoId((prev) => {
        if (prev && data.some((r) => r.id === prev)) return prev;
        return data[0]?.id ?? "";
      });
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

  useEffect(() => {
    void refreshRepos();
  }, []);

  useEffect(() => {
    if (!selectedRepoId) {
      setBranches([]);
      return;
    }
    void Promise.all([
      refreshBranches(selectedRepoId),
      fetchRepoGitAuthStatus(selectedRepoId).catch(() => null),
    ]);
  }, [selectedRepoId]);

  const handleDeleteBranch = async (branch: GitBranch) => {
    if (!selectedRepoId) return;
    if (!window.confirm(`Delete branch "${branch.name}"?`)) return;

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
      <BranchesSection
        repos={repos}
        reposLoading={reposLoading}
        selectedRepoId={selectedRepoId}
        selectedRepo={selectedRepo}
        branches={branches}
        branchesLoading={branchesLoading}
        branchesMessage={branchesMessage}
        deletingBranchName={deletingBranchName}
        onSelectedRepoChange={setSelectedRepoId}
        onDeleteBranch={(branch) => {
          void handleDeleteBranch(branch);
        }}
      />
    </>
  );
}

export const Route = createFileRoute("/branches")({
  component: BranchesRoute,
});
