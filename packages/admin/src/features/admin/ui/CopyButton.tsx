import { CopyButton as UiCopyButton } from "@vibe/ui/components/CopyButton";

type CopyButtonProps = {
  value: string;
};

export function CopyButton({ value }: CopyButtonProps) {
  const canCopy =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function";

  return (
    <UiCopyButton
      onCopy={() => navigator.clipboard.writeText(value)}
      disabled={!canCopy}
      iconSize="size-icon-sm"
      copyLabel="Copy command"
      copiedLabel="Copied"
      className="mt-[2px]"
    />
  );
}
