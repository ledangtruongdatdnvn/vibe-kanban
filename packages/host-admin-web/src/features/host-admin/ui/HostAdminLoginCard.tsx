import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { Input } from "@vibe/ui/components/Input";
import { Label } from "@vibe/ui/components/Label";
import { PrimaryButton } from "@vibe/ui/components/PrimaryButton";
import type { ToolMessage } from "@host-admin/features/host-admin/model/hostAdminTypes";

type HostAdminLoginCardProps = {
  loginSecret: string;
  loginBusy: boolean;
  loginMessage: ToolMessage;
  onLoginSecretChange: (value: string) => void;
  onLogin: () => void;
};

export function HostAdminLoginCard({
  loginSecret,
  loginBusy,
  loginMessage,
  onLoginSecretChange,
  onLogin,
}: HostAdminLoginCardProps) {
  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle>Admin login</CardTitle>
        <CardDescription>
          Sign in with the shared admin secret configured in{" "}
          <code>HOST_ADMIN_SECRET</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-double">
        <div className="flex flex-col gap-half">
          <Label htmlFor="admin-secret">Admin secret</Label>
          <Input
            id="admin-secret"
            type="password"
            value={loginSecret}
            onChange={(event) => onLoginSecretChange(event.target.value)}
            onCommandEnter={onLogin}
          />
        </div>

        {loginMessage && (
          <Alert
            variant={loginMessage.kind === "error" ? "destructive" : "success"}
          >
            <AlertDescription>{loginMessage.text}</AlertDescription>
          </Alert>
        )}

        <PrimaryButton
          className="w-full justify-center"
          onClick={onLogin}
          disabled={loginBusy}
          actionIcon={loginBusy ? "spinner" : undefined}
        >
          {loginBusy ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </CardContent>
    </Card>
  );
}
