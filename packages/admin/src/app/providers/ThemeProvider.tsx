import { useEffect, useState, type ReactNode } from "react";
import { ThemeProviderContext } from "@/shared/hooks/useTheme";
import { ThemeMode } from "shared/types";

const STORAGE_KEY = "vibe-admin-theme";

type ThemeProviderProps = {
  children: ReactNode;
  initialTheme?: ThemeMode;
};

function sanitizeTheme(theme: ThemeMode) {
  return theme === ThemeMode.LIGHT ? ThemeMode.LIGHT : ThemeMode.DARK;
}

function getStoredTheme() {
  if (typeof window === "undefined") {
    return null;
  }

  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (savedTheme === ThemeMode.LIGHT || savedTheme === ThemeMode.DARK) {
    return savedTheme;
  }

  return null;
}

export function ThemeProvider({
  children,
  initialTheme = ThemeMode.DARK,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(
    () => getStoredTheme() ?? sanitizeTheme(initialTheme),
  );

  useEffect(() => {
    setThemeState(getStoredTheme() ?? sanitizeTheme(initialTheme));
  }, [initialTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const resolvedTheme = sanitizeTheme(theme);

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme.toLowerCase());
    window.localStorage.setItem(STORAGE_KEY, resolvedTheme);
  }, [theme]);

  return (
    <ThemeProviderContext.Provider
      value={{
        theme,
        setTheme: (nextTheme: ThemeMode) =>
          setThemeState(sanitizeTheme(nextTheme)),
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}
