import { Button } from "@vibe/ui/components/Button";
import { useTheme } from "@/shared/hooks/useTheme";
import { ThemeMode } from "shared/types";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isLightTheme = theme === ThemeMode.LIGHT;

  return (
    <div className="flex items-center gap-half rounded-lg border border-border bg-panel/80 p-half">
      <span className="text-xs uppercase tracking-[0.12em] text-low">
        Theme
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          setTheme(isLightTheme ? ThemeMode.DARK : ThemeMode.LIGHT)
        }
      >
        {isLightTheme ? "Use dark theme" : "Use light theme"}
      </Button>
    </div>
  );
}
