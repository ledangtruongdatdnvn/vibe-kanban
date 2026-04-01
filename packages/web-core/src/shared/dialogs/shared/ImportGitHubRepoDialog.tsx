import { useCallback, useState } from 'react';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { GithubLogoIcon, SpinnerIcon } from '@phosphor-icons/react';
import type { Repo } from 'shared/types';
import { Button } from '@vibe/ui/components/Button';
import { Input } from '@vibe/ui/components/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@vibe/ui/components/KeyboardDialog';
import { Label } from '@vibe/ui/components/Label';
import { defineModal } from '@/shared/lib/modals';

export interface ImportGitHubRepoDialogProps {
  onImportRepo: (params: {
    repository: string;
    folderName?: string;
    displayName?: string;
  }) => Promise<Repo>;
}

export type ImportGitHubRepoDialogResult =
  | {
      action: 'imported';
      repo: Repo;
    }
  | {
      action: 'canceled';
    };

const ImportGitHubRepoDialogImpl =
  NiceModal.create<ImportGitHubRepoDialogProps>(({ onImportRepo }) => {
    const modal = useModal();
    const [repository, setRepository] = useState('');
    const [folderName, setFolderName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImport = useCallback(async () => {
      const trimmedRepository = repository.trim();
      if (!trimmedRepository) {
        setError(
          'Enter a GitHub repository in owner/repo format or paste its URL.'
        );
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const repo = await onImportRepo({
          repository: trimmedRepository,
          folderName: folderName.trim() || undefined,
          displayName: displayName.trim() || undefined,
        });
        modal.resolve({ action: 'imported', repo });
        modal.hide();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to import the GitHub repository.'
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [displayName, folderName, modal, onImportRepo, repository]);

    const handleCancel = useCallback(() => {
      modal.resolve({ action: 'canceled' });
      modal.hide();
    }, [modal]);

    const canSubmit = repository.trim().length > 0;

    return (
      <Dialog open={modal.visible} onOpenChange={handleCancel}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-half">
              <GithubLogoIcon className="size-icon-sm" weight="fill" />
              <span>Import from GitHub</span>
            </DialogTitle>
            <DialogDescription>
              Clone a GitHub repository onto this host, register it locally, and
              use it in the current workspace draft.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="github-repository">Repository</Label>
              <Input
                id="github-repository"
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="github-folder-name">Folder name</Label>
              <Input
                id="github-folder-name"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Optional. Defaults to repo name"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="github-display-name">Display name</Label>
              <Input
                id="github-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional. Used in the UI"
                disabled={isSubmitting}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                'Import repository'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  });

export const ImportGitHubRepoDialog = defineModal<
  ImportGitHubRepoDialogProps,
  ImportGitHubRepoDialogResult
>(ImportGitHubRepoDialogImpl);
