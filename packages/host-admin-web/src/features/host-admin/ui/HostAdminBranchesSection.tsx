import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Badge } from "@vibe/ui/components/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { Label } from "@vibe/ui/components/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vibe/ui/components/Select";
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
import { Button } from "@vibe/ui/components/Button";
import { formatDate } from "@host-admin/features/host-admin/model/hostAdminPresentation";
import type {
  GitBranch,
  Repo,
  ToolMessage,
} from "@host-admin/features/host-admin/model/hostAdminTypes";

export type HostAdminBranchesSectionProps = {
  repos: Repo[];
  reposLoading: boolean;
  selectedRepoId: string;
  selectedRepo: Repo | null;
  branches: GitBranch[];
  branchesLoading: boolean;
  branchesMessage: ToolMessage;
  deletingBranchName: string | null;
  onSelectedRepoChange: (repoId: string) => void;
  onDeleteBranch: (branch: GitBranch) => void;
};

export function HostAdminBranchesSection({
  repos,
  reposLoading,
  selectedRepoId,
  selectedRepo,
  branches,
  branchesLoading,
  branchesMessage,
  deletingBranchName,
  onSelectedRepoChange,
  onDeleteBranch,
}: HostAdminBranchesSectionProps) {
  return (
    <Card className="border border-border bg-panel/80">
      <CardHeader>
        <CardTitle className="text-lg">Branches</CardTitle>
        <CardDescription>
          Delete only local, non-current branches. Remote refs stay visible for
          context but are not deletable in v1.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-double">
        {branchesMessage && (
          <Alert
            variant={
              branchesMessage.kind === "error" ? "destructive" : "success"
            }
          >
            <AlertDescription>{branchesMessage.text}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-half sm:max-w-[20rem]">
          <Label htmlFor="repo-selector">Repository</Label>
          <Select
            value={selectedRepoId || undefined}
            onValueChange={onSelectedRepoChange}
            disabled={reposLoading || repos.length === 0}
          >
            <SelectTrigger id="repo-selector" className="bg-panel">
              <SelectValue
                placeholder={
                  reposLoading
                    ? "Loading repositories…"
                    : repos.length === 0
                      ? "No repositories"
                      : "Select a repository"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {repos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.display_name || repo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Branch</TableHeaderCell>
                <TableHeaderCell>Badges</TableHeaderCell>
                <TableHeaderCell>Last commit</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(reposLoading || branchesLoading) && (
                <TableLoading colSpan={4} />
              )}
              {!reposLoading && !branchesLoading && !selectedRepoId && (
                <TableEmpty colSpan={4}>
                  Select a repository to manage branches.
                </TableEmpty>
              )}
              {!reposLoading &&
                !branchesLoading &&
                selectedRepoId &&
                branches.length === 0 && (
                  <TableEmpty colSpan={4}>No branches found.</TableEmpty>
                )}
              {!reposLoading &&
                !branchesLoading &&
                branches.map((branch) => {
                  const cannotDelete =
                    branch.is_current ||
                    branch.is_remote ||
                    deletingBranchName === branch.name;

                  return (
                    <TableRow key={branch.name}>
                      <TableCell>
                        <div className="flex flex-col gap-[0.2rem]">
                          <span className="font-medium text-high">
                            {branch.name}
                          </span>
                          {selectedRepo && (
                            <span className="text-xs text-low">
                              {selectedRepo.display_name || selectedRepo.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-half">
                          {branch.is_current && (
                            <Badge variant="outline">current</Badge>
                          )}
                          {branch.is_remote && (
                            <Badge variant="outline">remote</Badge>
                          )}
                          {!branch.is_current && !branch.is_remote && (
                            <Badge variant="outline">local</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-low">
                        {formatDate(branch.last_commit_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={cannotDelete}
                          onClick={() => onDeleteBranch(branch)}
                        >
                          {deletingBranchName === branch.name
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
