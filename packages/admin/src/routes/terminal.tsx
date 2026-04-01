import { useContext, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader } from "@vibe/ui/components/Card";
import {
  fetchRepoGitAuthStatus,
  fetchRepos,
  importGitHubRepo,
} from "@admin/features/admin/model/api";
import { TABS } from "@admin/features/admin/model/presentation";
import type {
  GitHubRepoImportInput,
  Repo,
  RepoGitAuthStatus,
  ToolMessage,
} from "@admin/features/admin/model/types";
import { AdminContext } from "@admin/routes/__root";
import { PageHeader } from "@admin/features/admin/ui/PageHeader";
import { TerminalSection } from "@admin/features/admin/ui/TerminalSection";

function TerminalRoute() {
  const { onLogout } = useContext(AdminContext);
  const tabMeta = TABS.find((t) => t.id === "terminal")!;

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [repoGitAuthStatus, setRepoGitAuthStatus] =
    useState<RepoGitAuthStatus | null>(null);
  const [repoGitAuthLoading, setRepoGitAuthLoading] = useState(false);
  const [repoImportBusy, setRepoImportBusy] = useState(false);
  const [repoImportMessage, setRepoImportMessage] = useState<ToolMessage>(null);

  const selectedRepo = repos.find((repo) => repo.id === selectedRepoId) ?? null;

  const refreshRepos = async (preferredRepoId?: string) => {
    setReposLoading(true);
    try {
      const { data } = await fetchRepos();
      setRepos(data);
      setSelectedRepoId((prev) => {
        if (preferredRepoId && data.some((r) => r.id === preferredRepoId))
          return preferredRepoId;
        if (prev && data.some((r) => r.id === prev)) return prev;
        return data[0]?.id ?? "";
      });
    } catch {
      // silently fail
    } finally {
      setReposLoading(false);
    }
  };

  const refreshRepoGitAuth = async (repoId: string) => {
    setRepoGitAuthLoading(true);
    setRepoGitAuthStatus(null);
    try {
      const { data } = await fetchRepoGitAuthStatus(repoId);
      setRepoGitAuthStatus(data);
    } catch (error) {
      setRepoGitAuthStatus({
        remote_name: null,
        remote_url: null,
        https_remote_url: null,
        repo_full_name: null,
        provider: "unknown",
        auth_mode: "unavailable",
        ready: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load Git auth status.",
      });
    } finally {
      setRepoGitAuthLoading(false);
    }
  };

  useEffect(() => {
    void refreshRepos();
  }, []);

  useEffect(() => {
    if (!selectedRepoId) {
      setRepoGitAuthStatus(null);
      return;
    }
    void refreshRepoGitAuth(selectedRepoId);
  }, [selectedRepoId]);

  const handleImportGitHubRepo = async (
    input: GitHubRepoImportInput,
  ): Promise<boolean> => {
    setRepoImportBusy(true);
    setRepoImportMessage(null);
    try {
      const { data } = await importGitHubRepo(input);
      await refreshRepos(data.id);
      await refreshRepoGitAuth(data.id);
      setRepoImportMessage({
        kind: "success",
        text: `Repository "${data.display_name || data.name}" is ready in Host Admin.`,
      });
      return true;
    } catch (error) {
      setRepoImportMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to import the GitHub repository.",
      });
      return false;
    } finally {
      setRepoImportBusy(false);
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
      <TerminalSection
        repos={repos}
        reposLoading={reposLoading}
        selectedRepoId={selectedRepoId}
        selectedRepo={selectedRepo}
        gitAuthStatus={repoGitAuthStatus}
        gitAuthLoading={repoGitAuthLoading}
        repoImportBusy={repoImportBusy}
        repoImportMessage={repoImportMessage}
        onSelectedRepoChange={setSelectedRepoId}
        onImportGitHubRepo={handleImportGitHubRepo}
      />
    </>
  );
}

export const Route = createFileRoute("/terminal")({
  component: TerminalRoute,
});
