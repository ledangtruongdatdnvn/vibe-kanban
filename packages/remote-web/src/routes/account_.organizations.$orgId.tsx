import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuthenticated } from "@remote/shared/lib/route-auth";

export const Route = createFileRoute("/account_/organizations/$orgId")({
  beforeLoad: async ({ location, params }) => {
    await requireAuthenticated(location);
    const searchParams = new URLSearchParams(location.searchStr);
    const githubApp = searchParams.get("github_app");
    const githubAppError = searchParams.get("github_app_error");

    throw redirect({
      to: "/",
      search: {
        legacyOrgSettingsOrgId: params.orgId,
        githubApp: githubApp === "installed" ? "installed" : undefined,
        githubAppError: githubAppError || undefined,
      },
    });
  },
});
