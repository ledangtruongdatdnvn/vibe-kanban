import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Button } from "@vibe/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import type { ToolMessage } from "@host-admin/features/host-admin/model/hostAdminTypes";

export type HostAdminCleanupSectionProps = {
  cleanupMessage: ToolMessage;
  cleanupBusy: null | "orphans" | "data";
  onCleanOrphans: () => void;
  onCleanData: () => void;
};

export function HostAdminCleanupSection({
  cleanupMessage,
  cleanupBusy,
  onCleanOrphans,
  onCleanData,
}: HostAdminCleanupSectionProps) {
  return (
    <div className="grid gap-double lg:grid-cols-2">
      <Card className="border border-border bg-panel/80">
        <CardHeader>
          <CardTitle className="text-lg">Clean orphan worktrees</CardTitle>
          <CardDescription>
            Trigger orphan workspace cleanup immediately and run{" "}
            <code>git worktree prune</code> across registered repos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-double">
          <p className="text-sm text-low">
            This is the safe cleanup path. It should only remove orphaned
            worktree directories and stale Git worktree metadata.
          </p>
          <Button onClick={onCleanOrphans} disabled={cleanupBusy !== null}>
            {cleanupBusy === "orphans" ? "Cleaning…" : "Clean orphan worktrees"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border bg-panel/80">
        <CardHeader>
          <CardTitle className="text-lg">Clean persisted host data</CardTitle>
          <CardDescription>
            Delete mounted host data plus saved Claude/Codex credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-double">
          <p className="text-sm text-low">
            This is stronger than orphan cleanup. It wipes the persisted host
            state and usually requires a host restart or redeploy before the
            stack is usable again.
          </p>
          <Button
            variant="destructive"
            onClick={onCleanData}
            disabled={cleanupBusy !== null}
          >
            {cleanupBusy === "data" ? "Deleting…" : "Clean persisted host data"}
          </Button>
        </CardContent>
      </Card>

      {cleanupMessage && (
        <Alert
          className="lg:col-span-2"
          variant={cleanupMessage.kind === "error" ? "destructive" : "success"}
        >
          <AlertDescription>{cleanupMessage.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
