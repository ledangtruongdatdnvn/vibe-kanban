import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Badge } from "@vibe/ui/components/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import {
  TABS,
  formatBytes,
} from "@host-admin/features/host-admin/model/hostAdminPresentation";
import type {
  Repo,
  SessionResponse,
  Tab,
  ToolMessage,
  WorkspaceUsageSummary,
} from "@host-admin/features/host-admin/model/hostAdminTypes";
import {
  HostAdminBranchesSection,
  type HostAdminBranchesSectionProps,
} from "@host-admin/features/host-admin/ui/HostAdminBranchesSection";
import {
  HostAdminCleanupSection,
  type HostAdminCleanupSectionProps,
} from "@host-admin/features/host-admin/ui/HostAdminCleanupSection";
import {
  HostAdminCredentialsSection,
  type HostAdminCredentialsSectionProps,
} from "@host-admin/features/host-admin/ui/HostAdminCredentialsSection";
import { HostAdminLoginCard } from "@host-admin/features/host-admin/ui/HostAdminLoginCard";
import { HostAdminOverviewCard } from "@host-admin/features/host-admin/ui/HostAdminOverviewCard";
import { HostAdminPageHeader } from "@host-admin/features/host-admin/ui/HostAdminPageHeader";
import { HostAdminSectionNav } from "@host-admin/features/host-admin/ui/HostAdminSectionNav";
import { HostAdminShell } from "@host-admin/features/host-admin/ui/HostAdminShell";
import {
  HostAdminWorkspacesSection,
  type HostAdminWorkspacesSectionProps,
} from "@host-admin/features/host-admin/ui/HostAdminWorkspacesSection";

type HostAdminPageViewProps = {
  session: SessionResponse | null;
  sessionError: string | null;
  loginSecret: string;
  loginBusy: boolean;
  loginMessage: ToolMessage;
  activeTab: Tab;
  savedCredentialsCount: number;
  workspacesCount: number;
  workspaceUsage: WorkspaceUsageSummary | null;
  workspaceUsageLoading: boolean;
  reposCount: number;
  selectedRepoId: string;
  selectedRepo: Repo | null;
  localBranchCount: number;
  credentialsSection: HostAdminCredentialsSectionProps;
  workspacesSection: HostAdminWorkspacesSectionProps;
  branchesSection: HostAdminBranchesSectionProps;
  cleanupSection: HostAdminCleanupSectionProps;
  onLoginSecretChange: (value: string) => void;
  onLogin: () => void;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
};

function HostAdminStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function HostAdminPageView({
  session,
  sessionError,
  loginSecret,
  loginBusy,
  loginMessage,
  activeTab,
  savedCredentialsCount,
  workspacesCount,
  workspaceUsage,
  workspaceUsageLoading,
  reposCount,
  selectedRepoId,
  selectedRepo,
  localBranchCount,
  credentialsSection,
  workspacesSection,
  branchesSection,
  cleanupSection,
  onLoginSecretChange,
  onLogin,
  onTabChange,
  onLogout,
}: HostAdminPageViewProps) {
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  if (sessionError) {
    return (
      <HostAdminShell maxWidthClassName="max-w-[36rem]">
        <Alert variant="destructive">
          <AlertDescription>{sessionError}</AlertDescription>
        </Alert>
      </HostAdminShell>
    );
  }

  if (!session) {
    return (
      <HostAdminShell maxWidthClassName="max-w-[36rem]">
        <HostAdminStateCard title="Host Admin" description="Loading session…" />
      </HostAdminShell>
    );
  }

  if (!session.configured) {
    return (
      <HostAdminShell maxWidthClassName="max-w-[36rem]">
        <HostAdminStateCard
          title="Host Admin"
          description="Configure HOST_ADMIN_SECRET before exposing this service."
        />
      </HostAdminShell>
    );
  }

  if (!session.authenticated) {
    return (
      <HostAdminShell maxWidthClassName="max-w-[30rem]">
        <header className="flex flex-col gap-half">
          <h1 className="text-xl font-semibold text-high">Host Admin</h1>
          <p className="text-base text-low">
            Temporary admin console for credentials, workspace cleanup, and
            branch operations.
          </p>
        </header>

        <HostAdminLoginCard
          loginSecret={loginSecret}
          loginBusy={loginBusy}
          loginMessage={loginMessage}
          onLoginSecretChange={onLoginSecretChange}
          onLogin={onLogin}
        />
      </HostAdminShell>
    );
  }

  return (
    <HostAdminShell>
      <Card className="overflow-hidden border border-border bg-panel/95 backdrop-blur-sm">
        <CardContent className="grid gap-double p-double lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <div className="flex flex-col gap-base">
            <div className="flex flex-wrap items-center gap-half">
              <h1 className="text-2xl font-semibold text-high">Host Admin</h1>
              <Badge variant="outline">start when needed</Badge>
              <Badge variant="outline">turn off when done</Badge>
            </div>
            <p className="max-w-[48rem] text-base leading-relaxed text-low">
              Manage saved credentials, workspace lifecycle cleanup, and safe
              branch deletion through the same host backend the app already
              uses. This stays separate from the main product flow, but now uses
              the same component language and panel rhythm as the rest of the
              app.
            </p>
            <div className="flex flex-wrap gap-half text-sm text-low">
              <span className="rounded-full border border-border px-half py-[0.2rem]">
                Shared-secret login
              </span>
              <span className="rounded-full border border-border px-half py-[0.2rem]">
                Cookie session
              </span>
              <span className="rounded-full border border-border px-half py-[0.2rem]">
                Proxy to host on safe actions
              </span>
            </div>
          </div>

          <div className="grid gap-half sm:grid-cols-2">
            <HostAdminOverviewCard
              label="Saved credentials"
              value={`${savedCredentialsCount}/2`}
              detail="Claude and Codex volumes"
            />
            <HostAdminOverviewCard
              label="Worktree disk"
              value={
                workspaceUsageLoading && !workspaceUsage
                  ? "Loading…"
                  : formatBytes(workspaceUsage?.total_bytes ?? 0)
              }
              detail={
                workspaceUsage
                  ? `${workspaceUsage.existing_workspace_count}/${workspaceUsage.workspace_count} workspace dirs present`
                  : `${workspacesCount} tracked workspace records`
              }
            />
            <HostAdminOverviewCard
              label="Registered repos"
              value={String(reposCount)}
              detail="Repos available for branch cleanup"
            />
            <HostAdminOverviewCard
              label="Visible local branches"
              value={selectedRepoId ? String(localBranchCount) : "—"}
              detail={
                selectedRepo
                  ? selectedRepo.display_name || selectedRepo.name
                  : "Select a repo in Branches"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-double lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <Card className="border border-border bg-panel/95 backdrop-blur-sm lg:sticky lg:top-double">
          <CardHeader className="pb-base">
            <CardTitle className="text-base">Sections</CardTitle>
            <CardDescription>
              Use the rail like the app settings and workspace side panels.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HostAdminSectionNav
              activeTab={activeTab}
              onTabChange={onTabChange}
              tabs={TABS}
            />
          </CardContent>
        </Card>

        <div className="min-w-0 flex flex-col gap-double">
          <Card className="border border-border bg-panel/95 backdrop-blur-sm">
            <CardHeader className="gap-base border-b border-border/70">
              <HostAdminPageHeader
                title={activeTabMeta.label}
                summary={activeTabMeta.summary}
                description={activeTabMeta.description}
                onLogout={onLogout}
              />
            </CardHeader>
          </Card>

          {activeTab === "credentials" && (
            <HostAdminCredentialsSection {...credentialsSection} />
          )}
          {activeTab === "workspaces" && (
            <HostAdminWorkspacesSection {...workspacesSection} />
          )}
          {activeTab === "branches" && (
            <HostAdminBranchesSection {...branchesSection} />
          )}
          {activeTab === "cleanup" && (
            <HostAdminCleanupSection {...cleanupSection} />
          )}
        </div>
      </div>
    </HostAdminShell>
  );
}
