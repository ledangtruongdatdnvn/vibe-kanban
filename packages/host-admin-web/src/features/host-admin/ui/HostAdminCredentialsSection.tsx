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
import { Label } from "@vibe/ui/components/Label";
import { PrimaryButton } from "@vibe/ui/components/PrimaryButton";
import { Textarea } from "@vibe/ui/components/Textarea";
import {
  INITIAL_MESSAGE,
  TOOL_CONFIG,
  TOOL_ORDER,
  isSavedStatus,
  statusBadgeText,
} from "@host-admin/features/host-admin/model/hostAdminPresentation";
import type {
  Tool,
  ToolMessage,
} from "@host-admin/features/host-admin/model/hostAdminTypes";
import { HostAdminCopyButton } from "@host-admin/features/host-admin/ui/HostAdminCopyButton";

export type HostAdminCredentialsSectionProps = {
  statusByTool: Record<Tool, string>;
  valueByTool: Record<Tool, string>;
  messageByTool: Record<Tool, ToolMessage>;
  savingByTool: Record<Tool, boolean>;
  clearingCredentials: Tool | "all" | null;
  onToolValueChange: (tool: Tool, value: string) => void;
  onSave: (tool: Tool) => void;
  onClearCredentials: (tool: Tool | "all") => void;
};

export function HostAdminCredentialsSection({
  statusByTool,
  valueByTool,
  messageByTool = INITIAL_MESSAGE,
  savingByTool,
  clearingCredentials,
  onToolValueChange,
  onSave,
  onClearCredentials,
}: HostAdminCredentialsSectionProps) {
  return (
    <div className="grid gap-double lg:grid-cols-2">
      {TOOL_ORDER.map((tool) => {
        const config = TOOL_CONFIG[tool];
        const status = statusByTool[tool];
        const message = messageByTool[tool];
        const isSaving = savingByTool[tool];
        const isClearing =
          clearingCredentials === tool || clearingCredentials === "all";

        return (
          <Card
            key={tool}
            className="flex h-full flex-col border border-border bg-panel/80"
          >
            <CardHeader className="gap-double">
              <div className="flex items-center justify-between gap-half">
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <Badge variant={isSavedStatus(status) ? "default" : "outline"}>
                  {statusBadgeText(status)}
                </Badge>
              </div>
              <CardDescription className="grid min-h-[7.5rem] content-start gap-half">
                <p>{config.description}</p>
                <div className="flex items-start gap-half rounded border border-border bg-primary/20 px-half py-half">
                  <code className="flex-1 whitespace-pre-wrap break-all text-xs text-high">
                    {config.command}
                  </code>
                  <HostAdminCopyButton value={config.command} />
                </div>
                {config.hint && <p>{config.hint}</p>}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-double">
              <div className="flex flex-1 flex-col gap-half">
                <Label htmlFor={`credentials-${tool}`}>Credentials JSON</Label>
                <Textarea
                  className="min-h-[18rem] flex-1"
                  id={`credentials-${tool}`}
                  rows={10}
                  placeholder={config.placeholder}
                  value={valueByTool[tool]}
                  onChange={(event) =>
                    onToolValueChange(tool, event.target.value)
                  }
                />
              </div>

              {message && (
                <Alert
                  variant={message.kind === "error" ? "destructive" : "success"}
                >
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              <div className="mt-auto flex flex-wrap gap-half">
                <PrimaryButton
                  onClick={() => onSave(tool)}
                  disabled={isSaving}
                  actionIcon={isSaving ? "spinner" : undefined}
                >
                  {isSaving ? "Saving…" : config.saveLabel}
                </PrimaryButton>
                <Button
                  variant="outline"
                  onClick={() => onClearCredentials(tool)}
                  disabled={isClearing}
                >
                  {isClearing
                    ? "Clearing…"
                    : `Clear ${tool === "claude" ? "Claude" : "Codex"}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="border border-border bg-panel/80 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Credential notes</CardTitle>
          <CardDescription>
            Save only the credential file content itself. This service writes it
            into the mounted Docker volume so the host container can use
            subscription logins without interactive CLI auth.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-half">
          <Button
            variant="destructive"
            onClick={() => onClearCredentials("all")}
            disabled={clearingCredentials === "all"}
          >
            {clearingCredentials === "all"
              ? "Clearing…"
              : "Clear all saved credentials"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
