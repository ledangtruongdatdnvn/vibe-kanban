import type { ReactNode } from "react";
import { cn } from "@vibe/ui/lib/cn";
import { Button } from "@vibe/ui/components/Button";
import { useTheme } from "@/shared/hooks/useTheme";
import { ThemeMode } from "shared/types";

type ShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
  onLogout?: () => void;
};

export function Shell({
  children,
  maxWidthClassName = "max-w-full",
  onLogout,
}: ShellProps) {
  const { theme, setTheme } = useTheme();
  const isLightTheme = theme === ThemeMode.LIGHT;

  return (
    <main className="min-h-screen bg-primary px-double py-double sm:px-[2rem] sm:py-[2.5rem]">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-double",
          maxWidthClassName,
        )}
      >
        <div className="flex items-center justify-end gap-half">
          <Button
            onClick={() =>
              setTheme(isLightTheme ? ThemeMode.DARK : ThemeMode.LIGHT)
            }
          >
            {isLightTheme ? "Use dark theme" : "Use light theme"}
          </Button>
          {onLogout && <Button onClick={onLogout}>Log out</Button>}
        </div>
        {children}
      </div>
    </main>
  );
}
