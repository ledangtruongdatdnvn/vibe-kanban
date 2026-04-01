import { cn } from "@vibe/ui/lib/cn";
import type {
  HostAdminTabMeta,
  Tab,
} from "@host-admin/features/host-admin/model/hostAdminTypes";

type HostAdminSectionNavProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  tabs: HostAdminTabMeta[];
};

export function HostAdminSectionNav({
  activeTab,
  onTabChange,
  tabs,
}: HostAdminSectionNavProps) {
  return (
    <div className="flex flex-col gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={activeTab === tab.id}
          className={cn(
            "w-full rounded-sm px-3 py-2 text-left transition-colors",
            activeTab === tab.id
              ? "bg-brand/10 text-brand"
              : "text-normal hover:bg-primary/10",
          )}
          onClick={() => onTabChange(tab.id)}
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
        </button>
      ))}
    </div>
  );
}
