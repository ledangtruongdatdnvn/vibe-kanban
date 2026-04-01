import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import { Button } from "@vibe/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { PrimaryButton } from "@vibe/ui/components/PrimaryButton";
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
      <Card className="flex h-full flex-col border border-border bg-panel/80">
        <CardHeader>
          <CardTitle className="text-lg">Clean orphan worktrees</CardTitle>
          <CardDescription>
            Trigger orphan workspace cleanup immediately and run{" "}
            <code>git worktree prune</code> across registered repos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-double">
          <p className="text-sm text-low">
            This is the safe cleanup path. It should only remove orphaned
            worktree directories and stale Git worktree metadata.
          </p>
          <PrimaryButton
            className="mt-auto h-10 min-h-0 w-full justify-center"
            onClick={onCleanOrphans}
            disabled={cleanupBusy !== null}
            actionIcon={cleanupBusy === "orphans" ? "spinner" : undefined}
          >
            {cleanupBusy === "orphans" ? "Cleaning…" : "Clean orphan worktrees"}
          </PrimaryButton>
        </CardContent>
      </Card>

      <Card className="flex h-full flex-col border border-border bg-panel/80">
        <CardHeader>
          <CardTitle className="text-lg">Clean persisted host data</CardTitle>
          <CardDescription>
            Delete mounted host data plus saved Claude/Codex credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-double">
          <p className="text-sm text-low">
            This is stronger than orphan cleanup. It wipes the persisted host
            state and usually requires a host restart or redeploy before the
            stack is usable again.
          </p>
          <Button
            className="mt-auto h-10 w-full"
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
