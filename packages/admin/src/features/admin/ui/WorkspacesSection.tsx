import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Badge } from "@vibe/ui/components/Badge";
import { Button } from "@vibe/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { Checkbox } from "@vibe/ui/components/Checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableLoading,
  TableRow,
} from "@vibe/ui/components/Table";
import { formatBytes } from "@admin/features/admin/model/presentation";
import type {
  ToolMessage,
  Workspace,
  WorkspaceUsageItem,
} from "@admin/features/admin/model/types";

export type WorkspacesSectionProps = {
  workspaces: Workspace[];
  workspacesLoading: boolean;
  workspaceMessage: ToolMessage;
  workspaceUsageLoading: boolean;
  workspaceUsageError: string | null;
  workspaceUsageById: Map<string, WorkspaceUsageItem>;
  workspaceDeleteBranch: Record<string, boolean>;
  deletingWorkspaceId: string | null;
  onWorkspaceDeleteBranchChange: (
    workspaceId: string,
    checked: boolean,
  ) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  onRefresh: () => void;
};

export function WorkspacesSection({
  workspaces,
  workspacesLoading,
  workspaceMessage,
  workspaceUsageLoading,
  workspaceUsageError,
  workspaceUsageById,
  workspaceDeleteBranch,
  deletingWorkspaceId,
  onWorkspaceDeleteBranchChange,
  onDeleteWorkspace,
  onRefresh,
}: WorkspacesSectionProps) {
  return (
    <Card className="border border-border bg-panel/80">
      <CardHeader>
        <CardTitle className="text-lg">Workspaces</CardTitle>
        <CardDescription>
          Delete workspaces through the normal host lifecycle so database state,
          background cleanup, and optional branch deletion stay in sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-double">
        {workspaceMessage && (
          <Alert
            variant={
              workspaceMessage.kind === "error" ? "destructive" : "success"
            }
          >
            <AlertDescription>{workspaceMessage.text}</AlertDescription>
          </Alert>
        )}

        {workspaceUsageError && (
          <Alert variant="destructive">
            <AlertDescription>{workspaceUsageError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onRefresh}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Branch</TableHeaderCell>
                <TableHeaderCell>State</TableHeaderCell>
                <TableHeaderCell>Usage</TableHeaderCell>
                <TableHeaderCell>Delete branch</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(workspacesLoading || workspaceUsageLoading) && (
                <TableLoading colSpan={6} />
              )}
              {!workspacesLoading &&
                !workspaceUsageLoading &&
                workspaces.length === 0 && (
                  <TableEmpty colSpan={6}>No workspaces found.</TableEmpty>
                )}
              {!workspacesLoading &&
                !workspaceUsageLoading &&
                workspaces.map((workspace) => {
                  const usage = workspaceUsageById.get(workspace.id);
                  const existingRepoWorktrees =
                    usage?.repo_worktrees.filter((repo) => repo.exists) ?? [];

                  return (
                    <TableRow key={workspace.id}>
                      <TableCell>
                        <div className="flex flex-col gap-[0.2rem]">
                          <span className="font-medium text-high">
                            {workspace.name || workspace.branch}
                          </span>
                          <span className="text-xs text-low">
                            {workspace.id}
                          </span>
                          {usage?.workspace_dir && (
                            <span className="truncate text-xs text-low">
                              {usage.workspace_dir}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{workspace.branch}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-half">
                          {workspace.archived && (
                            <Badge variant="outline">archived</Badge>
                          )}
                          {workspace.pinned && (
                            <Badge variant="outline">pinned</Badge>
                          )}
                          {workspace.worktree_deleted && (
                            <Badge variant="outline">worktree deleted</Badge>
                          )}
                          {!workspace.archived &&
                            !workspace.worktree_deleted && (
                              <Badge variant="outline">active</Badge>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {!usage ? (
                          <span className="text-sm text-low">—</span>
                        ) : (
                          <div className="flex flex-col gap-[0.2rem]">
                            <span className="font-medium text-high">
                              {formatBytes(usage.total_bytes)}
                            </span>
                            <span className="text-xs text-low">
                              {usage.exists
                                ? `${existingRepoWorktrees.length}/${usage.repo_worktrees.length} repo worktrees present`
                                : "workspace dir missing"}
                            </span>
                            {usage.repo_worktrees.length > 0 && (
                              <div className="mt-[0.15rem] flex flex-col gap-[0.15rem]">
                                {usage.repo_worktrees.map((repo) => (
                                  <span
                                    key={repo.repo_id}
                                    className="text-xs text-low"
                                  >
                                    <span className="font-medium text-high">
                                      {repo.repo_name}
                                    </span>{" "}
                                    {repo.exists
                                      ? formatBytes(repo.bytes)
                                      : "missing"}
                                    {repo.error ? ` (${repo.error})` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            {usage.error && (
                              <span className="text-xs text-danger">
                                {usage.error}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-half">
                          <Checkbox
                            checked={
                              workspaceDeleteBranch[workspace.id] ?? false
                            }
                            onCheckedChange={(checked) =>
                              onWorkspaceDeleteBranchChange(
                                workspace.id,
                                checked,
                              )
                            }
                          />
                          <span className="text-sm text-low">
                            also delete branch
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDeleteWorkspace(workspace)}
                          disabled={deletingWorkspaceId === workspace.id}
                        >
                          {deletingWorkspaceId === workspace.id
                            ? "Deleting…"
                            : "Delete"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
