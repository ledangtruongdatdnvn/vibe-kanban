import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, type Icon } from '@phosphor-icons/react';
import { cn } from '../lib/cn';
import { Tooltip } from './Tooltip';

interface CopyButtonProps {
  onCopy: () => void | Promise<void>;
  disabled?: boolean;
  iconSize: string;
  icon?: Icon;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}

/**
 * Copy button with self-contained feedback state.
 * Shows a checkmark for 2 seconds after copying.
 */
export function CopyButton({
  onCopy,
  disabled = false,
  iconSize,
  icon: DefaultIcon = CopyIcon,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleClick = async () => {
    try {
      await onCopy();
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const IconComponent = copied ? CheckIcon : DefaultIcon;
  const tooltip = copied ? copiedLabel : copyLabel;
  const iconClassName = copied
    ? 'text-success hover:text-success group-hover:text-success'
    : undefined;

  const button = (
    <button
      type="button"
      className={cn(
        'group flex items-center justify-center transition-colors',
        'drop-shadow-[2px_2px_4px_rgba(121,121,121,0.25)]',
        'text-low hover:text-normal disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      aria-label={tooltip}
      onClick={() => {
        void handleClick();
      }}
      disabled={disabled}
    >
      <IconComponent className={cn(iconSize, iconClassName)} weight="bold" />
    </button>
  );

  return (
    <Tooltip content={tooltip} side="top">
      {button}
    </Tooltip>
  );
}
