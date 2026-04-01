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
          <Card key={tool} className="border border-border bg-panel/80">
            <CardHeader className="gap-double">
              <div className="flex items-center justify-between gap-half">
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <Badge variant={isSavedStatus(status) ? "default" : "outline"}>
                  {statusBadgeText(status)}
                </Badge>
              </div>
              <CardDescription className="space-y-half">
                <p>{config.description}</p>
                <code className="block rounded border border-border px-half py-half text-xs">
                  {config.command}
                </code>
                {config.hint && <p>{config.hint}</p>}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-double">
              <div className="flex flex-col gap-half">
                <Label htmlFor={`credentials-${tool}`}>Credentials JSON</Label>
                <Textarea
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

              <div className="flex flex-wrap gap-half">
                <Button onClick={() => onSave(tool)} disabled={isSaving}>
                  {isSaving ? "Saving…" : config.saveLabel}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onClearCredentials(tool)}
                  disabled={isClearing}
                >
                  {isClearing ? "Clearing…" : `Clear ${tool}`}
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
