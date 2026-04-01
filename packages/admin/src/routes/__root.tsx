import { createContext, useEffect, useState } from "react";
import {
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { Alert, AlertDescription } from "@vibe/ui/components/Alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vibe/ui/components/Card";
import { fetchSession, login, logout } from "@admin/features/admin/model/api";
import { TABS } from "@admin/features/admin/model/presentation";
import type {
  SessionResponse,
  Tab,
  ToolMessage,
} from "@admin/features/admin/model/types";
import { LoginCard } from "@admin/features/admin/ui/LoginCard";
import { SectionNav } from "@admin/features/admin/ui/SectionNav";
import { Shell } from "@admin/features/admin/ui/Shell";

export const AdminContext = createContext<{ onLogout: () => void }>(
  null as unknown as { onLogout: () => void },
);

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

function pathToTab(pathname: string): Tab {
  if (pathname.startsWith("/workspaces")) return "workspaces";
  if (pathname.startsWith("/branches")) return "branches";
  if (pathname.startsWith("/terminal")) return "terminal";
  if (pathname.startsWith("/cleanup")) return "cleanup";
  return "credentials";
}

function RootLayout() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loginSecret, setLoginSecret] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState<ToolMessage>(null);

  const location = useRouterState({ select: (s) => s.location });
  const activeTab = pathToTab(location.pathname);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const nextSession = await fetchSession();
        if (!cancelled) {
          setSession(nextSession);
          setSessionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSessionError(
            error instanceof Error ? error.message : "Failed to load session.",
          );
        }
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSession = async () => {
    const nextSession = await fetchSession();
    setSession(nextSession);
    setSessionError(null);
    return nextSession;
  };

  const handleLogin = async () => {
    if (!loginSecret.trim()) {
      setLoginMessage({ kind: "error", text: "Enter the admin secret first." });
      return;
    }

    setLoginBusy(true);
    setLoginMessage(null);

    try {
      await login(loginSecret);
      setLoginSecret("");
      await refreshSession();
      setLoginMessage({ kind: "success", text: "Authenticated." });
    } catch (error) {
      setLoginMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Login failed.",
      });
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setSession({
      authenticated: false,
      configured: session?.configured ?? true,
    });
  };

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
          description="Configure HOST_ADMIN_SECRET before exposing this service."
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
          onLoginSecretChange={setLoginSecret}
          onLogin={() => {
            void handleLogin();
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
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
              tabs={TABS}
              onTabChange={() => {}}
            />
          </CardContent>
        </Card>

        <div className="min-w-0 flex flex-col gap-double">
          <AdminContext.Provider value={{ onLogout: handleLogout }}>
            <Outlet />
          </AdminContext.Provider>
        </div>
      </div>
    </Shell>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
