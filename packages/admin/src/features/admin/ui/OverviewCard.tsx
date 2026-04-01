type OverviewCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function OverviewCard({ label, value, detail }: OverviewCardProps) {
  return (
    <div className="rounded-lg border border-border bg-primary/60 px-double py-base">
      <div className="text-xs uppercase tracking-[0.12em] text-low">
        {label}
      </div>
      <div className="mt-half text-xl font-semibold text-high">{value}</div>
      <div className="mt-half text-sm text-low">{detail}</div>
    </div>
  );
}
