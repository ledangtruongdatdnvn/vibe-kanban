import { Link } from "@tanstack/react-router";
import { cn } from "@vibe/ui/lib/cn";
import type { Tab, TabMeta } from "@admin/features/admin/model/types";

const TAB_PATHS: Record<Tab, string> = {
  credentials: "/credentials",
  workspaces: "/workspaces",
  branches: "/branches",
  terminal: "/terminal",
  cleanup: "/cleanup",
};

type SectionNavProps = {
  activeTab: Tab;
  tabs: TabMeta[];
};

export function SectionNav({ activeTab, tabs }: SectionNavProps) {
  return (
    <div className="flex flex-col gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={TAB_PATHS[tab.id]}
          aria-pressed={activeTab === tab.id}
          className={cn(
            "w-full rounded-sm px-3 py-2 text-left transition-colors",
            activeTab === tab.id
              ? "bg-brand/10 text-brand"
              : "text-normal hover:bg-primary/10",
          )}
        >
          <div
            className={cn(
              "text-sm font-medium",
              activeTab === tab.id ? "text-brand" : "text-high",
            )}
          >
            {tab.label}
          </div>
          <div className="mt-[0.15rem] text-xs text-low">{tab.summary}</div>
        </Link>
      ))}
    </div>
  );
}
