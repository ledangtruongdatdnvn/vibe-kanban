import type { ReactNode } from "react";
import { cn } from "@vibe/ui/lib/cn";
import { ThemeToggle } from "@admin/features/admin/ui/ThemeToggle";

type ShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
};

export function Shell({
  children,
  maxWidthClassName = "max-w-[76rem]",
}: ShellProps) {
  return (
    <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-double",
          maxWidthClassName,
        )}
      >
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </main>
  );
}
