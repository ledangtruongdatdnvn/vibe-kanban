import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Badge } from "@vibe/ui/components/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { TABS, formatBytes } from "@admin/features/admin/model/presentation";
import type {
  Repo,
  SessionResponse,
  Tab,
  ToolMessage,
  WorkspaceUsageSummary,
} from "@admin/features/admin/model/types";
import {
  BranchesSection,
  type BranchesSectionProps,
} from "@admin/features/admin/ui/BranchesSection";
import {
  CleanupSection,
  type CleanupSectionProps,
} from "@admin/features/admin/ui/CleanupSection";
import {
  CredentialsSection,
  type CredentialsSectionProps,
} from "@admin/features/admin/ui/CredentialsSection";
import { LoginCard } from "@admin/features/admin/ui/LoginCard";
import { OverviewCard } from "@admin/features/admin/ui/OverviewCard";
import { SectionNav } from "@admin/features/admin/ui/SectionNav";
import { Shell } from "@admin/features/admin/ui/Shell";
import {
  TerminalSection,
  type TerminalSectionProps,
} from "@admin/features/admin/ui/TerminalSection";
import {
  WorkspacesSection,
  type WorkspacesSectionProps,
} from "@admin/features/admin/ui/WorkspacesSection";

type PageViewProps = {
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
  credentialsSection: CredentialsSectionProps;
  workspacesSection: WorkspacesSectionProps;
  branchesSection: BranchesSectionProps;
  terminalSection: TerminalSectionProps;
  cleanupSection: CleanupSectionProps;
  onLoginSecretChange: (value: string) => void;
  onLogin: () => void;
  onTabChange: (tab: Tab) => void;
};

function StateCard({
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

export function PageView({
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
  terminalSection,
  cleanupSection,
  onLoginSecretChange,
  onLogin,
  onTabChange,
}: PageViewProps) {
  if (sessionError) {
    return (
      <Shell maxWidthClassName="max-w-[36rem]">
        <Alert variant="destructive">
          <AlertDescription>{sessionError}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell maxWidthClassName="max-w-[36rem]">
        <StateCard title="Host Admin" description="Loading session…" />
      </Shell>
    );
  }

  if (!session.configured) {
    return (
      <Shell maxWidthClassName="max-w-[36rem]">
        <StateCard
          title="Host Admin"
          description="Configure ADMIN_SECRET before exposing this service."
        />
      </Shell>
    );
  }

  if (!session.authenticated) {
    return (
      <Shell maxWidthClassName="max-w-[30rem]">
        <header className="flex flex-col gap-half">
          <h1 className="text-xl font-semibold text-high">Host Admin</h1>
          <p className="text-base text-low">
            Temporary admin console for credentials, workspace cleanup, branch
            maintenance, and repo shell access.
          </p>
        </header>

        <LoginCard
          loginSecret={loginSecret}
          loginBusy={loginBusy}
          loginMessage={loginMessage}
          onLoginSecretChange={onLoginSecretChange}
          onLogin={onLogin}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="overflow-hidden border border-border bg-panel/95 backdrop-blur-sm">
        <CardContent className="grid gap-double !p-double lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <div className="flex flex-col gap-base">
            <div className="flex flex-wrap items-center gap-half">
              <h1 className="text-2xl font-semibold text-high">Host Admin</h1>
              <Badge variant="outline">start when needed</Badge>
              <Badge variant="outline">turn off when done</Badge>
            </div>
            <p className="max-w-[48rem] text-base leading-relaxed text-low">
              Manage saved credentials, workspace lifecycle cleanup, safe branch
              deletion, and authenticated repo terminals through the same host
              backend the app already uses. This stays separate from the main
              product flow, but now uses the same component language and panel
              rhythm as the rest of the app.
            </p>
            <div className="flex flex-wrap gap-half text-sm text-low">
              <Badge variant="secondary">Shared-secret login</Badge>
              <Badge variant="secondary">Cookie session</Badge>
              <Badge variant="secondary">Proxy to host on safe actions</Badge>
              <Badge variant="secondary">Repo terminal passthrough</Badge>
            </div>
          </div>

          <div className="grid gap-half sm:grid-cols-2">
            <OverviewCard
              label="Saved credentials"
              value={`${savedCredentialsCount}/2`}
              detail="Claude and Codex volumes"
            />
            <OverviewCard
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
            <OverviewCard
              label="Registered repos"
              value={String(reposCount)}
              detail="Repos available for branch cleanup"
            />
            <OverviewCard
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
            <SectionNav
              activeTab={activeTab}
              onTabChange={onTabChange}
              tabs={TABS}
            />
          </CardContent>
        </Card>

        <div className="min-w-0 flex flex-col gap-double">
          {activeTab === "credentials" && (
            <CredentialsSection {...credentialsSection} />
          )}
          {activeTab === "workspaces" && (
            <WorkspacesSection {...workspacesSection} />
          )}
          {activeTab === "branches" && <BranchesSection {...branchesSection} />}
          {activeTab === "terminal" && <TerminalSection {...terminalSection} />}
          {activeTab === "cleanup" && <CleanupSection {...cleanupSection} />}
        </div>
      </div>
    </Shell>
  );
}
