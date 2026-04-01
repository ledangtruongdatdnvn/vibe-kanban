import { Badge } from "@vibe/ui/components/Badge";
import { Button } from "@vibe/ui/components/Button";

type HostAdminPageHeaderProps = {
  title: string;
  summary: string;
  description: string;
  onLogout: () => void;
};

export function HostAdminPageHeader({
  title,
  summary,
  description,
  onLogout,
}: HostAdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-base lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-half">
        <div className="flex items-center gap-half">
          <h2 className="text-xl text-high">{title}</h2>
          <Badge variant="outline">{summary}</Badge>
        </div>
        <p className="max-w-[42rem] text-sm leading-relaxed text-low">
          {description}
        </p>
      </div>

      <Button variant="outline" onClick={onLogout}>
        Log out
      </Button>
    </div>
  );
}
