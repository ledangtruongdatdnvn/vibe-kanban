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
    <div className="flex flex-col gap-half">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "rounded-lg border px-base py-base text-left transition-colors",
            activeTab === tab.id
              ? "border-foreground bg-primary/70"
              : "border-border bg-transparent hover:bg-primary/40",
          )}
          onClick={() => onTabChange(tab.id)}
        >
          <div className="text-sm font-medium text-high">{tab.label}</div>
          <div className="mt-[0.15rem] text-xs text-low">{tab.summary}</div>
        </button>
      ))}
    </div>
  );
}
