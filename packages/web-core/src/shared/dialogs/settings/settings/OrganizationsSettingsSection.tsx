import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SpinnerIcon,
  PlusIcon,
  UserPlusIcon,
  TrashIcon,
  SignInIcon,
  ArrowSquareOutIcon,
  InfoIcon,
  GithubLogoIcon,
  ArrowsClockwiseIcon,
  LinkBreakIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserOrganizations } from '@/shared/hooks/useUserOrganizations';
import { organizationKeys } from '@/shared/hooks/organizationKeys';
import { useOrganizationSelection } from '@/shared/hooks/useOrganizationSelection';
import { useOrganizationMembers } from '@/shared/hooks/useOrganizationMembers';
import { useOrganizationInvitations } from '@/shared/hooks/useOrganizationInvitations';
import { useOrganizationMutations } from '@/shared/hooks/useOrganizationMutations';
import { useAuth } from '@/shared/hooks/auth/useAuth';
import { OAuthDialog } from '@/shared/dialogs/global/OAuthDialog';
import {
  CreateOrganizationDialog,
  type CreateOrganizationResult,
} from '@/shared/dialogs/org/CreateOrganizationDialog';
import {
  InviteMemberDialog,
  type InviteMemberResult,
} from '@/shared/dialogs/org/InviteMemberDialog';
import { MemberListItem } from '@/shared/components/org/MemberListItem';
import { PendingInvitationItem } from '@/shared/components/org/PendingInvitationItem';
import type { MemberRole } from 'shared/types';
import { MemberRole as MemberRoleEnum } from 'shared/types';
import {
  ApiError,
  organizationsApi,
  type GitHubAppAvailableInstallationDetails,
  type GitHubAppRepositoryDetails,
} from '@/shared/lib/api';
import { cn } from '@/shared/lib/utils';
import { getRemoteApiUrl } from '@/shared/lib/remoteApi';
import { PrimaryButton } from '@vibe/ui/components/PrimaryButton';
import { Switch } from '@vibe/ui/components/Switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuTriggerButton,
} from '@vibe/ui/components/Dropdown';
import { SettingsCard, SettingsField } from './SettingsComponents';

interface OrganizationsSettingsSectionProps {
  initialState?: {
    organizationId?: string;
    githubApp?: 'installed';
    githubAppError?: string;
  };
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function describeRepositorySelection(selection?: string) {
  switch (selection) {
    case 'all':
      return 'All repositories';
    case 'selected':
      return 'Selected repositories';
    default:
      return selection || 'Unknown';
  }
}

function getGitHubAppErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 501) {
      return 'GitHub App is not configured on this server yet.';
    }

    if (error.statusCode === 404) {
      return 'GitHub App is not installed for this organization yet.';
    }
  }

  return error instanceof Error ? error.message : 'GitHub App request failed';
}

export function OrganizationsSettingsSection({
  initialState,
}: OrganizationsSettingsSectionProps) {
  const { t } = useTranslation('organization');
  const { isSignedIn, isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOpeningBilling, setIsOpeningBilling] = useState(false);
  const [isOpeningGitHubInstall, setIsOpeningGitHubInstall] = useState(false);
  const [showExistingGitHubInstallations, setShowExistingGitHubInstallations] =
    useState(false);

  // Fetch all organizations
  const {
    data: orgsResponse,
    isLoading: orgsLoading,
    error: orgsError,
    refetch: refetchOrgs,
  } = useUserOrganizations();

  // Organization selection
  const { selectedOrgId, selectedOrg, handleOrgSelect } =
    useOrganizationSelection({
      organizations: orgsResponse,
      onSelectionChange: () => {
        setSuccess(null);
        setError(null);
      },
    });

  // Get current user's role and ID
  const currentUserRole = selectedOrg?.user_role;
  const isAdmin = currentUserRole === MemberRoleEnum.ADMIN;
  const isPersonalOrg = selectedOrg?.is_personal ?? false;
  const currentUserId = userId;
  const hasRemoteApi = Boolean(getRemoteApiUrl());
  const canUseGitHubApp =
    Boolean(selectedOrgId) &&
    Boolean(selectedOrg) &&
    !isPersonalOrg &&
    hasRemoteApi;

  useEffect(() => {
    if (
      initialState?.organizationId &&
      initialState.organizationId !== selectedOrgId
    ) {
      handleOrgSelect(initialState.organizationId);
    }
  }, [handleOrgSelect, initialState?.organizationId, selectedOrgId]);

  useEffect(() => {
    if (initialState?.githubApp === 'installed') {
      setError(null);
      setSuccess('GitHub App linked successfully');
      const timeout = window.setTimeout(() => setSuccess(null), 5000);
      return () => window.clearTimeout(timeout);
    }

    if (initialState?.githubAppError) {
      setSuccess(null);
      setError(initialState.githubAppError);
    }
  }, [initialState?.githubApp, initialState?.githubAppError]);

  useEffect(() => {
    setShowExistingGitHubInstallations(false);
  }, [selectedOrgId]);

  // Fetch members
  const { data: members = [], isLoading: loadingMembers } =
    useOrganizationMembers(selectedOrgId);

  // Fetch invitations (admin only)
  const { data: invitations = [], isLoading: loadingInvitations } =
    useOrganizationInvitations({
      organizationId: selectedOrgId || null,
      isAdmin,
      isPersonal: isPersonalOrg,
    });

  const {
    data: githubAppStatus,
    isLoading: loadingGitHubAppStatus,
    error: githubAppStatusError,
    refetch: refetchGitHubAppStatus,
  } = useQuery({
    queryKey: organizationKeys.githubAppStatus(selectedOrgId || ''),
    queryFn: () => organizationsApi.getGitHubAppStatus(selectedOrgId),
    enabled: canUseGitHubApp,
  });
  const githubAppInstallation = githubAppStatus?.installation ?? null;
  const githubRepositories = githubAppStatus?.repositories ?? [];
  const githubAppInstalled = Boolean(
    githubAppStatus?.installed && githubAppInstallation
  );

  const {
    data: availableGitHubInstallationsResponse,
    isLoading: loadingAvailableGitHubInstallations,
    error: availableGitHubInstallationsError,
    refetch: refetchAvailableGitHubInstallations,
  } = useQuery({
    queryKey: organizationKeys.githubAppAvailableInstallations(
      selectedOrgId || ''
    ),
    queryFn: () =>
      organizationsApi.listGitHubAppAvailableInstallations(selectedOrgId),
    enabled:
      canUseGitHubApp &&
      isAdmin &&
      !githubAppInstalled &&
      showExistingGitHubInstallations,
  });

  const syncGitHubAppRepositories = useMutation({
    mutationFn: (orgId: string) =>
      organizationsApi.syncGitHubAppRepositories(orgId),
    onSuccess: async (_repositories, orgId) => {
      await queryClient.invalidateQueries({
        queryKey: organizationKeys.githubAppStatus(orgId),
      });
      setSuccess('GitHub repositories synced successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getGitHubAppErrorMessage(err));
    },
  });

  const updateGitHubAppRepositoryReview = useMutation({
    mutationFn: ({
      orgId,
      repoId,
      enabled,
    }: {
      orgId: string;
      repoId: string;
      enabled: boolean;
    }) =>
      organizationsApi.updateGitHubAppRepositoryReviewEnabled(
        orgId,
        repoId,
        enabled
      ),
    onSuccess: async (repository, variables) => {
      await queryClient.invalidateQueries({
        queryKey: organizationKeys.githubAppStatus(variables.orgId),
      });
      setSuccess(
        `${repository.repo_full_name} review automation ${
          repository.review_enabled ? 'enabled' : 'disabled'
        }`
      );
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getGitHubAppErrorMessage(err));
    },
  });

  const updateAllGitHubAppRepositoriesReview = useMutation({
    mutationFn: ({ orgId, enabled }: { orgId: string; enabled: boolean }) =>
      organizationsApi.updateGitHubAppAllRepositoriesReviewEnabled(
        orgId,
        enabled
      ),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: organizationKeys.githubAppStatus(variables.orgId),
      });
      setSuccess(
        `${
          variables.enabled ? 'Enabled' : 'Disabled'
        } review automation for ${result.updated_count} repos`
      );
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getGitHubAppErrorMessage(err));
    },
  });

  const removeGitHubAppInstallation = useMutation({
    mutationFn: (orgId: string) =>
      organizationsApi.removeGitHubAppInstallation(orgId),
    onSuccess: async (_result, orgId) => {
      await queryClient.invalidateQueries({
        queryKey: organizationKeys.githubAppStatus(orgId),
      });
      setSuccess('GitHub App link removed');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getGitHubAppErrorMessage(err));
    },
  });

  const adoptGitHubAppInstallation = useMutation({
    mutationFn: ({
      orgId,
      githubInstallationId,
    }: {
      orgId: string;
      githubInstallationId: number;
    }) =>
      organizationsApi.adoptGitHubAppInstallation(orgId, githubInstallationId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: organizationKeys.githubAppStatus(variables.orgId),
        }),
        queryClient.invalidateQueries({
          queryKey: organizationKeys.githubAppAvailableInstallations(
            variables.orgId
          ),
        }),
      ]);
      setShowExistingGitHubInstallations(false);
      setSuccess('GitHub App linked successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(getGitHubAppErrorMessage(err));
    },
  });

  // Organization mutations
  const {
    removeMember,
    updateMemberRole,
    revokeInvitation,
    deleteOrganization,
  } = useOrganizationMutations({
    onRevokeSuccess: () => {
      setSuccess('Invitation revoked successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onRevokeError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Failed to revoke invitation'
      );
    },
    onRemoveSuccess: () => {
      setSuccess('Member removed successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onRemoveError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    },
    onRoleChangeSuccess: () => {
      setSuccess('Member role updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onRoleChangeError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Failed to update member role'
      );
    },
    onDeleteSuccess: async () => {
      setSuccess(t('settings.deleteSuccess'));
      setTimeout(() => setSuccess(null), 3000);
      await refetchOrgs();
      if (orgsResponse?.organizations) {
        const personalOrg = orgsResponse.organizations.find(
          (org) => org.is_personal
        );
        if (personalOrg) {
          handleOrgSelect(personalOrg.id);
        }
      }
    },
    onDeleteError: (err) => {
      setError(err instanceof Error ? err.message : t('settings.deleteError'));
    },
  });

  const handleCreateOrganization = async () => {
    try {
      const result: CreateOrganizationResult =
        await CreateOrganizationDialog.show();

      if (result.action === 'created' && result.organizationId) {
        handleOrgSelect(result.organizationId ?? '');
        setSuccess('Organization created successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const handleInviteMember = async () => {
    if (!selectedOrgId) return;

    try {
      const result: InviteMemberResult = await InviteMemberDialog.show({
        organizationId: selectedOrgId,
      });

      if (result.action === 'invited') {
        setSuccess('Member invited successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      // Dialog cancelled
    }
  };

  const handleRevokeInvitation = (invitationId: string) => {
    if (!selectedOrgId) return;
    setError(null);
    revokeInvitation.mutate({ orgId: selectedOrgId, invitationId });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedOrgId) return;

    const confirmed = window.confirm(t('confirmRemoveMember'));
    if (!confirmed) return;

    setError(null);
    removeMember.mutate({ orgId: selectedOrgId, userId });
  };

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    if (!selectedOrgId) return;
    setError(null);
    updateMemberRole.mutate({ orgId: selectedOrgId, userId, role: newRole });
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrgId || !selectedOrg) return;

    const confirmed = window.confirm(
      t('settings.confirmDelete', { orgName: selectedOrg.name })
    );
    if (!confirmed) return;

    setError(null);
    deleteOrganization.mutate(selectedOrgId);
  };

  const handleManageBilling = async () => {
    if (!selectedOrgId || isOpeningBilling) {
      return;
    }

    // Open tab immediately so browsers treat it as user-initiated.
    const stripeTab = window.open('', '_blank');
    setError(null);
    setIsOpeningBilling(true);

    try {
      const returnUrl = window.location.href;
      const billingStatus =
        await organizationsApi.getBillingStatus(selectedOrgId);

      const createCheckoutUrl = async () => {
        const { url: checkoutUrl } =
          await organizationsApi.createCheckoutSession(
            selectedOrgId,
            returnUrl,
            returnUrl
          );
        return checkoutUrl;
      };

      const url = await (async () => {
        if (billingStatus.status === 'requires_subscription') {
          return createCheckoutUrl();
        }

        try {
          const { url: portalUrl } = await organizationsApi.createPortalSession(
            selectedOrgId,
            returnUrl
          );
          return portalUrl;
        } catch (err) {
          if (
            err instanceof ApiError &&
            (err.statusCode === 402 || err.statusCode === 503)
          ) {
            return createCheckoutUrl();
          }

          throw err;
        }
      })();

      if (stripeTab) {
        stripeTab.opener = null;
        stripeTab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      stripeTab?.close();
      setError(err instanceof Error ? err.message : 'Failed to open billing');
    } finally {
      setIsOpeningBilling(false);
    }
  };

  const handleInstallGitHubApp = async () => {
    if (!selectedOrgId || !isAdmin || isOpeningGitHubInstall) {
      return;
    }

    const installTab = window.open('', '_blank');
    setError(null);
    setIsOpeningGitHubInstall(true);

    try {
      const { install_url } =
        await organizationsApi.getGitHubAppInstallUrl(selectedOrgId);

      if (installTab) {
        installTab.opener = null;
        installTab.location.href = install_url;
      } else {
        window.open(install_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      installTab?.close();
      setError(getGitHubAppErrorMessage(err));
    } finally {
      setIsOpeningGitHubInstall(false);
    }
  };

  const handleShowExistingGitHubInstallations = () => {
    setError(null);
    setShowExistingGitHubInstallations(true);
  };

  const handleAdoptGitHubInstallation = (
    installation: GitHubAppAvailableInstallationDetails
  ) => {
    if (!selectedOrgId) {
      return;
    }

    setError(null);
    adoptGitHubAppInstallation.mutate({
      orgId: selectedOrgId,
      githubInstallationId: installation.github_installation_id,
    });
  };

  const handleSyncGitHubRepositories = () => {
    if (!selectedOrgId) {
      return;
    }

    setError(null);
    syncGitHubAppRepositories.mutate(selectedOrgId);
  };

  const handleRemoveGitHubAppLink = () => {
    if (!selectedOrgId || !selectedOrg) {
      return;
    }

    const confirmed = window.confirm(
      `Remove the GitHub App link for ${selectedOrg.name}? This only disconnects Vibe Kanban and does not uninstall the app on GitHub.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    removeGitHubAppInstallation.mutate(selectedOrgId);
  };

  const handleRepositoryReviewToggle = (
    repository: GitHubAppRepositoryDetails,
    enabled: boolean
  ) => {
    if (!selectedOrgId) {
      return;
    }

    setError(null);
    updateGitHubAppRepositoryReview.mutate({
      orgId: selectedOrgId,
      repoId: repository.id,
      enabled,
    });
  };

  const handleBulkReviewToggle = (enabled: boolean) => {
    if (!selectedOrgId) {
      return;
    }

    setError(null);
    updateAllGitHubAppRepositoriesReview.mutate({
      orgId: selectedOrgId,
      enabled,
    });
  };

  const availableGitHubInstallations =
    availableGitHubInstallationsResponse?.installations ?? [];
  const githubAppSuspended = Boolean(githubAppInstallation?.suspended_at);
  const githubAppInstallationDetails = githubAppInstallation!;

  if (!isLoaded || orgsLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <SpinnerIcon
          className="size-icon-lg animate-spin text-brand"
          weight="bold"
        />
        <span className="text-normal">
          {t('settings.loadingOrganizations')}
        </span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-high">
            {t('loginRequired.title')}
          </h3>
          <p className="text-sm text-low mt-1">
            {t('loginRequired.description')}
          </p>
        </div>
        <PrimaryButton
          variant="secondary"
          value={t('loginRequired.action')}
          onClick={() => void OAuthDialog.show({})}
        >
          <SignInIcon className="size-icon-xs mr-1" weight="bold" />
        </PrimaryButton>
      </div>
    );
  }

  if (orgsError) {
    return (
      <div className="py-8">
        <div className="bg-error/10 border border-error/50 rounded-sm p-4 text-error">
          {orgsError instanceof Error
            ? orgsError.message
            : t('settings.loadError')}
        </div>
      </div>
    );
  }

  const organizations = orgsResponse?.organizations ?? [];
  const orgOptions = organizations.map((org) => ({
    value: org.id,
    label: org.name,
  }));

  return (
    <>
      {/* Status messages */}
      {error && (
        <div className="bg-error/10 border border-error/50 rounded-sm p-4 text-error">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-success/10 border border-success/50 rounded-sm p-4 text-success font-medium">
          {success}
        </div>
      )}

      {/* Organization selector */}
      <SettingsCard
        title={t('settings.title')}
        description={t('settings.description')}
        headerAction={
          <PrimaryButton
            variant="secondary"
            value={t('createDialog.createButton')}
            onClick={handleCreateOrganization}
          >
            <PlusIcon className="size-icon-xs mr-1" weight="bold" />
          </PrimaryButton>
        }
      >
        <SettingsField
          label={t('settings.selectLabel')}
          description={t('settings.selectHelper')}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <DropdownMenuTriggerButton
                label={
                  orgOptions.find((o) => o.value === selectedOrgId)?.label ||
                  t('settings.selectPlaceholder')
                }
                className="w-full justify-between"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
              {orgOptions.length > 0 ? (
                orgOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleOrgSelect(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  {t('settings.noOrganizations')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsField>
      </SettingsCard>

      {/* Pending Invitations (admin only) */}
      {selectedOrg &&
        isAdmin &&
        !isPersonalOrg &&
        (loadingInvitations || invitations.length > 0) && (
          <SettingsCard
            title={t('invitationList.title')}
            description={t('invitationList.description', {
              orgName: selectedOrg.name,
            })}
          >
            {loadingInvitations ? (
              <div className="flex items-center justify-center py-4 gap-2">
                <SpinnerIcon className="size-icon-sm animate-spin" />
                <span className="text-sm text-low">
                  {t('invitationList.loading')}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invitation) => (
                  <PendingInvitationItem
                    key={invitation.id}
                    invitation={invitation}
                    onRevoke={handleRevokeInvitation}
                    isRevoking={revokeInvitation.isPending}
                  />
                ))}
              </div>
            )}
          </SettingsCard>
        )}

      {/* Members */}
      {selectedOrg && (
        <SettingsCard
          title={t('memberList.title')}
          description={t('memberList.description', {
            orgName: selectedOrg.name,
          })}
          headerAction={
            isAdmin && !isPersonalOrg ? (
              <PrimaryButton
                variant="secondary"
                value={t('memberList.inviteButton')}
                onClick={handleInviteMember}
              >
                <UserPlusIcon className="size-icon-xs mr-1" weight="bold" />
              </PrimaryButton>
            ) : undefined
          }
        >
          {isPersonalOrg && (
            <div className="bg-info/10 border border-info/50 rounded-sm p-4 mb-4">
              <div className="flex items-start gap-3">
                <InfoIcon
                  className="size-icon-sm text-info flex-shrink-0 mt-0.5"
                  weight="bold"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-high">
                    {t('personalOrg.cannotInvite')}
                  </p>
                  <p className="text-sm text-low mt-1">
                    {t('personalOrg.createOrgPrompt')}
                  </p>
                  <PrimaryButton
                    variant="secondary"
                    value={t('personalOrg.createOrgButton')}
                    onClick={handleCreateOrganization}
                    className="mt-3"
                  >
                    <PlusIcon className="size-icon-xs mr-1" weight="bold" />
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}
          {loadingMembers ? (
            <div className="flex items-center justify-center py-4 gap-2">
              <SpinnerIcon className="size-icon-sm animate-spin" />
              <span className="text-sm text-low">
                {t('memberList.loading')}
              </span>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-sm text-low">
              {t('memberList.none')}
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <MemberListItem
                  key={member.user_id}
                  member={member}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onRemove={handleRemoveMember}
                  onRoleChange={handleRoleChange}
                  isRemoving={removeMember.isPending}
                  isRoleChanging={updateMemberRole.isPending}
                />
              ))}
            </div>
          )}
        </SettingsCard>
      )}

      {selectedOrg && !isPersonalOrg && hasRemoteApi && (
        <SettingsCard
          title="GitHub App"
          description="Link a GitHub App installation to import repositories and enable managed Git operations on hosts."
          headerAction={
            <div className="flex items-center gap-2">
              {githubAppInstalled && (
                <PrimaryButton
                  variant="tertiary"
                  value={
                    syncGitHubAppRepositories.isPending
                      ? 'Syncing...'
                      : 'Sync Repositories'
                  }
                  onClick={() => void handleSyncGitHubRepositories()}
                  disabled={
                    syncGitHubAppRepositories.isPending ||
                    loadingGitHubAppStatus
                  }
                >
                  {syncGitHubAppRepositories.isPending ? (
                    <SpinnerIcon className="size-icon-xs animate-spin" />
                  ) : (
                    <ArrowsClockwiseIcon
                      className="size-icon-xs"
                      weight="bold"
                    />
                  )}
                </PrimaryButton>
              )}
              {isAdmin &&
                (githubAppInstalled ? (
                  <PrimaryButton
                    variant="tertiary"
                    value="Remove Link"
                    onClick={() => void handleRemoveGitHubAppLink()}
                    disabled={removeGitHubAppInstallation.isPending}
                  >
                    {removeGitHubAppInstallation.isPending ? (
                      <SpinnerIcon className="size-icon-xs animate-spin" />
                    ) : (
                      <LinkBreakIcon className="size-icon-xs" weight="bold" />
                    )}
                  </PrimaryButton>
                ) : (
                  <>
                    <PrimaryButton
                      variant="tertiary"
                      value={
                        showExistingGitHubInstallations
                          ? 'Refresh Existing Links'
                          : 'Link Existing Installation'
                      }
                      onClick={() =>
                        showExistingGitHubInstallations
                          ? void refetchAvailableGitHubInstallations()
                          : handleShowExistingGitHubInstallations()
                      }
                      disabled={
                        loadingAvailableGitHubInstallations ||
                        adoptGitHubAppInstallation.isPending
                      }
                    >
                      {loadingAvailableGitHubInstallations ? (
                        <SpinnerIcon className="size-icon-xs animate-spin" />
                      ) : (
                        <ArrowsClockwiseIcon
                          className="size-icon-xs"
                          weight="bold"
                        />
                      )}
                    </PrimaryButton>
                    <PrimaryButton
                      variant="secondary"
                      value="Install GitHub App"
                      onClick={() => void handleInstallGitHubApp()}
                      disabled={isOpeningGitHubInstall}
                    >
                      {isOpeningGitHubInstall ? (
                        <SpinnerIcon className="size-icon-xs animate-spin" />
                      ) : (
                        <GithubLogoIcon
                          className="size-icon-xs"
                          weight="fill"
                        />
                      )}
                    </PrimaryButton>
                  </>
                ))}
            </div>
          }
        >
          {loadingGitHubAppStatus ? (
            <div className="flex items-center justify-center py-4 gap-2">
              <SpinnerIcon className="size-icon-sm animate-spin" />
              <span className="text-sm text-low">
                Loading GitHub App status...
              </span>
            </div>
          ) : githubAppStatusError ? (
            <div className="rounded-sm border border-error/50 bg-error/10 p-4 space-y-3">
              <p className="text-sm text-error">
                {getGitHubAppErrorMessage(githubAppStatusError)}
              </p>
              <PrimaryButton
                variant="tertiary"
                value="Retry"
                onClick={() => void refetchGitHubAppStatus()}
              >
                <ArrowsClockwiseIcon className="size-icon-xs" weight="bold" />
              </PrimaryButton>
            </div>
          ) : !githubAppInstalled ? (
            <div className="rounded-sm border border-dashed border-border bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <GithubLogoIcon
                  className="size-icon-sm text-low"
                  weight="fill"
                />
                <span className="text-sm font-medium text-high">
                  No GitHub App installation linked
                </span>
              </div>
              <p className="text-sm text-low">
                {isAdmin
                  ? 'Install the GitHub App on GitHub to import repositories and enable managed Git credentials for hosts.'
                  : 'Ask an organization admin to install the GitHub App before using GitHub-powered repository import.'}
              </p>
              {isAdmin && showExistingGitHubInstallations && (
                <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-high">
                      Existing GitHub installations
                    </p>
                    <span className="text-xs text-low">
                      Use this when the app is already installed on GitHub but
                      not linked in Vibe yet.
                    </span>
                  </div>

                  {loadingAvailableGitHubInstallations ? (
                    <div className="flex items-center gap-2 rounded-sm border border-border bg-panel p-3">
                      <SpinnerIcon className="size-icon-sm animate-spin" />
                      <span className="text-sm text-low">
                        Loading existing installations...
                      </span>
                    </div>
                  ) : availableGitHubInstallationsError ? (
                    <div className="rounded-sm border border-error/50 bg-error/10 p-3 text-sm text-error">
                      {getGitHubAppErrorMessage(
                        availableGitHubInstallationsError
                      )}
                    </div>
                  ) : availableGitHubInstallations.length === 0 ? (
                    <div className="rounded-sm border border-border bg-panel p-3 text-sm text-low">
                      No existing GitHub App installations were found for this
                      app yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableGitHubInstallations.map((installation) => {
                        const isLinkedElsewhere =
                          Boolean(installation.linked_organization_id) &&
                          !installation.linked_to_current_organization;
                        const isAdoptingThisInstallation =
                          adoptGitHubAppInstallation.isPending &&
                          adoptGitHubAppInstallation.variables
                            ?.githubInstallationId ===
                            installation.github_installation_id;

                        return (
                          <div
                            key={installation.github_installation_id}
                            className="flex flex-col gap-3 rounded-sm border border-border bg-panel p-3 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-high">
                                  {installation.github_account_login}
                                </span>
                                <span className="text-xs text-low">
                                  {installation.github_account_type}
                                </span>
                                {installation.suspended_at && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                                    <WarningCircleIcon
                                      className="size-icon-xs"
                                      weight="fill"
                                    />
                                    Suspended
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-low">
                                Installation #
                                {installation.github_installation_id} ·{' '}
                                {describeRepositorySelection(
                                  installation.repository_selection
                                )}
                              </p>
                              {isLinkedElsewhere && (
                                <p className="text-xs text-warning">
                                  Already linked to{' '}
                                  {installation.linked_organization_name ||
                                    'another Vibe organization'}
                                  .
                                </p>
                              )}
                            </div>
                            <PrimaryButton
                              variant={
                                isLinkedElsewhere ? 'tertiary' : 'secondary'
                              }
                              value={
                                isLinkedElsewhere
                                  ? 'Linked Elsewhere'
                                  : isAdoptingThisInstallation
                                    ? 'Linking...'
                                    : 'Link This Installation'
                              }
                              onClick={() =>
                                handleAdoptGitHubInstallation(installation)
                              }
                              disabled={
                                isLinkedElsewhere ||
                                adoptGitHubAppInstallation.isPending
                              }
                            >
                              {isAdoptingThisInstallation ? (
                                <SpinnerIcon className="size-icon-xs animate-spin" />
                              ) : (
                                <GithubLogoIcon
                                  className="size-icon-xs"
                                  weight="fill"
                                />
                              )}
                            </PrimaryButton>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                      githubAppSuspended
                        ? 'bg-warning/15 text-warning'
                        : 'bg-success/15 text-success'
                    )}
                  >
                    {githubAppSuspended ? (
                      <WarningCircleIcon
                        className="size-icon-xs"
                        weight="fill"
                      />
                    ) : (
                      <CheckCircleIcon className="size-icon-xs" weight="fill" />
                    )}
                    {githubAppSuspended ? 'Suspended' : 'Connected'}
                  </span>
                  <span className="text-sm text-low">
                    {githubAppInstallationDetails.github_account_login}
                  </span>
                </div>
                <span className="text-sm text-low">
                  {githubRepositories.length} repos cached
                </span>
              </div>

              {githubAppSuspended && (
                <div className="rounded-sm border border-warning/50 bg-warning/10 p-4">
                  <p className="text-sm font-medium text-high">
                    GitHub installation access is suspended
                  </p>
                  <p className="mt-1 text-sm text-low">
                    Resume the installation on GitHub, then sync repositories
                    again.
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-sm border border-border bg-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-low">
                    GitHub account
                  </p>
                  <p className="mt-1 text-sm font-medium text-high break-all">
                    {githubAppInstallationDetails.github_account_login}
                  </p>
                  <p className="mt-1 text-xs text-low">
                    {githubAppInstallationDetails.github_account_type}
                  </p>
                </div>
                <div className="rounded-sm border border-border bg-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-low">
                    Repository access
                  </p>
                  <p className="mt-1 text-sm font-medium text-high">
                    {describeRepositorySelection(
                      githubAppInstallationDetails.repository_selection
                    )}
                  </p>
                  <p className="mt-1 text-xs text-low">
                    Sync after changing repository grants on GitHub.
                  </p>
                </div>
                <div className="rounded-sm border border-border bg-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-low">
                    Linked at
                  </p>
                  <p className="mt-1 text-sm font-medium text-high">
                    {formatTimestamp(githubAppInstallationDetails.created_at)}
                  </p>
                </div>
                <div className="rounded-sm border border-border bg-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-low">
                    Suspended at
                  </p>
                  <p className="mt-1 text-sm font-medium text-high">
                    {formatTimestamp(githubAppInstallationDetails.suspended_at)}
                  </p>
                </div>
              </div>

              {isAdmin && githubRepositories.length > 0 && (
                <div className="flex flex-col gap-3 rounded-sm border border-border bg-secondary/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-high">
                      Pull request review automation
                    </p>
                    <p className="mt-1 text-sm text-low">
                      Toggle review defaults per repository or update them in
                      bulk.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PrimaryButton
                      variant="tertiary"
                      value="Enable All"
                      onClick={() => void handleBulkReviewToggle(true)}
                      disabled={updateAllGitHubAppRepositoriesReview.isPending}
                    >
                      {updateAllGitHubAppRepositoriesReview.isPending &&
                      updateAllGitHubAppRepositoriesReview.variables
                        ?.enabled === true ? (
                        <SpinnerIcon className="size-icon-xs animate-spin" />
                      ) : (
                        <CheckCircleIcon
                          className="size-icon-xs"
                          weight="fill"
                        />
                      )}
                    </PrimaryButton>
                    <PrimaryButton
                      variant="tertiary"
                      value="Disable All"
                      onClick={() => void handleBulkReviewToggle(false)}
                      disabled={updateAllGitHubAppRepositoriesReview.isPending}
                    >
                      {updateAllGitHubAppRepositoriesReview.isPending &&
                      updateAllGitHubAppRepositoriesReview.variables
                        ?.enabled === false ? (
                        <SpinnerIcon className="size-icon-xs animate-spin" />
                      ) : (
                        <WarningCircleIcon
                          className="size-icon-xs"
                          weight="fill"
                        />
                      )}
                    </PrimaryButton>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-high">
                      Repositories
                    </p>
                    <p className="text-sm text-low">
                      {githubAppInstallationDetails.repository_selection ===
                      'selected'
                        ? 'Grant more repositories on GitHub and sync again if a repo is missing here.'
                        : 'Repository access is controlled by the linked GitHub App installation.'}
                    </p>
                  </div>
                </div>

                {githubRepositories.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-border p-4 text-sm text-low">
                    No repositories are cached yet. Sync repositories to load
                    the latest GitHub grants for this organization.
                  </div>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {githubRepositories.map((repository) => {
                      const repoTogglePending =
                        updateGitHubAppRepositoryReview.isPending &&
                        updateGitHubAppRepositoryReview.variables?.repoId ===
                          repository.id;

                      return (
                        <div
                          key={repository.id}
                          className="flex flex-col gap-3 rounded-sm border border-border bg-panel p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-high">
                              {repository.repo_full_name}
                            </p>
                            <p className="mt-1 text-xs text-low">
                              GitHub repo ID {repository.github_repo_id}
                            </p>
                          </div>

                          {isAdmin ? (
                            <div className="flex items-center gap-3 sm:shrink-0">
                              <span className="text-xs text-low">
                                PR review
                              </span>
                              {repoTogglePending && (
                                <SpinnerIcon className="size-icon-xs animate-spin text-low" />
                              )}
                              <Switch
                                checked={repository.review_enabled}
                                onCheckedChange={(checked) =>
                                  void handleRepositoryReviewToggle(
                                    repository,
                                    checked
                                  )
                                }
                                disabled={
                                  repoTogglePending ||
                                  updateAllGitHubAppRepositoriesReview.isPending
                                }
                              />
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium sm:shrink-0',
                                repository.review_enabled
                                  ? 'bg-success/15 text-success'
                                  : 'bg-secondary text-low'
                              )}
                            >
                              {repository.review_enabled
                                ? 'Review enabled'
                                : 'Review disabled'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SettingsCard>
      )}

      {/* Billing CTA (admin only, non-personal orgs, when remote URL is configured) */}
      {selectedOrg && isAdmin && !isPersonalOrg && getRemoteApiUrl() && (
        <SettingsCard
          title={t('billing.title')}
          description={t('billing.description')}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-low">{t('billing.openInBrowser')}</p>
            <button
              type="button"
              onClick={() => void handleManageBilling()}
              disabled={isOpeningBilling}
              className={cn(
                'flex items-center gap-2 px-base py-half rounded-sm text-sm font-medium whitespace-nowrap shrink-0',
                'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/50',
                'transition-colors disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isOpeningBilling ? (
                <SpinnerIcon className="size-icon-xs animate-spin" />
              ) : (
                <ArrowSquareOutIcon className="size-icon-xs" weight="bold" />
              )}
              {t('billing.manageButton')}
            </button>
          </div>
        </SettingsCard>
      )}

      {/* Danger Zone */}
      {selectedOrg && isAdmin && !isPersonalOrg && (
        <SettingsCard
          title={t('settings.dangerZone')}
          description={t('settings.dangerZoneDescription')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-normal">
                {t('settings.deleteOrganization')}
              </p>
              <p className="text-sm text-low">
                {t('settings.deleteOrganizationDescription')}
              </p>
            </div>
            <button
              onClick={handleDeleteOrganization}
              disabled={deleteOrganization.isPending}
              className={cn(
                'flex items-center gap-2 px-base py-half rounded-sm text-sm font-medium whitespace-nowrap shrink-0',
                'bg-error/10 text-error hover:bg-error/20 border border-error/50',
                'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              )}
            >
              {deleteOrganization.isPending ? (
                <SpinnerIcon className="size-icon-xs animate-spin" />
              ) : (
                <TrashIcon className="size-icon-xs" weight="bold" />
              )}
              {t('common:buttons.delete')}
            </button>
          </div>
        </SettingsCard>
      )}
    </>
  );
}

// Alias for backwards compatibility
export { OrganizationsSettingsSection as OrganizationsSettingsSectionContent };
