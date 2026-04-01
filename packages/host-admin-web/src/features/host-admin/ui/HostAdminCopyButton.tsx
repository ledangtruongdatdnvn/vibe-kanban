import { CopyButton } from "@vibe/ui/components/CopyButton";

type HostAdminCopyButtonProps = {
  value: string;
};

export function HostAdminCopyButton({ value }: HostAdminCopyButtonProps) {
  const canCopy =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function";

  return (
    <CopyButton
      onCopy={() => navigator.clipboard.writeText(value)}
      disabled={!canCopy}
      iconSize="size-icon-sm"
      copyLabel="Copy command"
      copiedLabel="Copied"
      className="mt-[2px]"
    />
  );
}
