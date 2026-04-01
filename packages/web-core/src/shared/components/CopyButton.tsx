import { useTranslation } from 'react-i18next';
import type { Icon } from '@phosphor-icons/react';
import { CopyButton as UiCopyButton } from '@vibe/ui/components/CopyButton';

interface CopyButtonProps {
  onCopy: () => void;
  disabled: boolean;
  iconSize: string;
  /** Icon to show before copying */
  icon: Icon;
}

/**
 * Copy button with self-contained feedback state.
 * Shows a checkmark for 2 seconds after copying.
 */
export function CopyButton({
  onCopy,
  disabled,
  iconSize,
  icon: DefaultIcon,
}: CopyButtonProps) {
  const { t } = useTranslation('common');

  return (
    <UiCopyButton
      onCopy={onCopy}
      disabled={disabled}
      iconSize={iconSize}
      icon={DefaultIcon}
      copyLabel={t('actions.copyPath')}
      copiedLabel={t('actions.copied')}
    />
  );
}
