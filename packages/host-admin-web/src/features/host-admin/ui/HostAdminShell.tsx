import type { ReactNode } from "react";
import { cn } from "@vibe/ui/lib/cn";
import { HostAdminThemeToggle } from "@host-admin/features/host-admin/ui/HostAdminThemeToggle";

type HostAdminShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
};

export function HostAdminShell({
  children,
  maxWidthClassName = "max-w-[76rem]",
}: HostAdminShellProps) {
  return (
    <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-double",
          maxWidthClassName,
        )}
      >
        <div className="flex justify-end">
          <HostAdminThemeToggle />
        </div>
        {children}
      </div>
    </main>
  );
}
