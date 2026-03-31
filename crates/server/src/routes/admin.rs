use std::path::{Path, PathBuf};

use axum::{
    Router,
    extract::State,
    response::Json as ResponseJson,
    routing::{get, post},
};
use db::models::{repo::Repo, workspace::Workspace, workspace_repo::WorkspaceRepo};
use deployment::Deployment;
use serde::Serialize;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Serialize)]
pub struct CleanupOrphanWorktreesSummary {
    pub orphan_cleanup_disabled: bool,
    pub repos_checked: usize,
    pub repos_pruned: usize,
    pub repo_errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct RepoWorktreeUsage {
    pub repo_id: Uuid,
    pub repo_name: String,
    pub worktree_path: String,
    pub bytes: u64,
    pub exists: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceUsageItem {
    pub workspace_id: Uuid,
    pub workspace_name: Option<String>,
    pub branch: String,
    pub workspace_dir: Option<String>,
    pub total_bytes: u64,
    pub exists: bool,
    pub error: Option<String>,
    pub repo_worktrees: Vec<RepoWorktreeUsage>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceUsageSummary {
    pub total_bytes: u64,
    pub workspace_count: usize,
    pub existing_workspace_count: usize,
    pub items: Vec<WorkspaceUsageItem>,
}

#[derive(Debug, Clone)]
struct RepoWorktreeUsageJob {
    repo_id: Uuid,
    repo_name: String,
    worktree_path: PathBuf,
}

#[derive(Debug, Clone)]
struct WorkspaceUsageJob {
    workspace_id: Uuid,
    workspace_name: Option<String>,
    branch: String,
    workspace_dir: Option<PathBuf>,
    repo_worktrees: Vec<RepoWorktreeUsageJob>,
}

fn directory_size(path: &Path) -> Result<u64, String> {
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|error| format!("{}: {}", path.display(), error))?;

    if metadata.is_file() || metadata.file_type().is_symlink() {
        return Ok(metadata.len());
    }

    if !metadata.is_dir() {
        return Ok(0);
    }

    let mut total = 0u64;
    let entries =
        std::fs::read_dir(path).map_err(|error| format!("{}: {}", path.display(), error))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("{}: {}", path.display(), error))?;
        total = total.saturating_add(directory_size(&entry.path())?);
    }

    Ok(total)
}

fn compute_workspace_usage(jobs: Vec<WorkspaceUsageJob>) -> WorkspaceUsageSummary {
    let mut items = Vec::with_capacity(jobs.len());
    let mut total_bytes = 0u64;
    let mut existing_workspace_count = 0usize;

    for job in jobs {
        let workspace_dir = job
            .workspace_dir
            .as_ref()
            .map(|path| path.display().to_string());
        let workspace_exists = job.workspace_dir.as_ref().is_some_and(|path| path.exists());
        if workspace_exists {
            existing_workspace_count += 1;
        }

        let mut repo_worktrees = Vec::with_capacity(job.repo_worktrees.len());
        let mut repo_sum = 0u64;

        for repo_job in job.repo_worktrees {
            let exists = repo_job.worktree_path.exists();
            let measurement = if exists {
                directory_size(&repo_job.worktree_path)
            } else {
                Ok(0)
            };

            let (bytes, error) = match measurement {
                Ok(bytes) => (bytes, None),
                Err(error) => (0, Some(error)),
            };
            repo_sum = repo_sum.saturating_add(bytes);

            repo_worktrees.push(RepoWorktreeUsage {
                repo_id: repo_job.repo_id,
                repo_name: repo_job.repo_name,
                worktree_path: repo_job.worktree_path.display().to_string(),
                bytes,
                exists,
                error,
            });
        }

        let workspace_measurement = job.workspace_dir.as_ref().map(|path| {
            if path.exists() {
                directory_size(path)
            } else {
                Ok(0)
            }
        });
        let (total_workspace_bytes, workspace_error) = match workspace_measurement {
            Some(Ok(bytes)) => (bytes, None),
            Some(Err(error)) => (repo_sum, Some(error)),
            None => (repo_sum, None),
        };

        total_bytes = total_bytes.saturating_add(total_workspace_bytes);
        items.push(WorkspaceUsageItem {
            workspace_id: job.workspace_id,
            workspace_name: job.workspace_name,
            branch: job.branch,
            workspace_dir,
            total_bytes: total_workspace_bytes,
            exists: workspace_exists,
            error: workspace_error,
            repo_worktrees,
        });
    }

    WorkspaceUsageSummary {
        total_bytes,
        workspace_count: items.len(),
        existing_workspace_count,
        items,
    }
}

pub async fn cleanup_orphan_worktrees(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<CleanupOrphanWorktreesSummary>>, ApiError> {
    let orphan_cleanup_disabled = std::env::var("DISABLE_WORKTREE_CLEANUP").is_ok();

    deployment
        .workspace_manager()
        .cleanup_orphan_workspaces()
        .await;

    let repos = Repo::list_all(&deployment.db().pool).await?;
    let mut repos_pruned = 0;
    let mut repo_errors = Vec::new();

    for repo in &repos {
        match deployment.git().prune_worktrees(&repo.path) {
            Ok(()) => {
                repos_pruned += 1;
            }
            Err(error) => {
                repo_errors.push(format!("{}: {}", repo.name, error));
            }
        }
    }

    Ok(ResponseJson(ApiResponse::success(
        CleanupOrphanWorktreesSummary {
            orphan_cleanup_disabled,
            repos_checked: repos.len(),
            repos_pruned,
            repo_errors,
        },
    )))
}

pub async fn workspace_usage(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<WorkspaceUsageSummary>>, ApiError> {
    let workspaces = Workspace::fetch_all(&deployment.db().pool).await?;
    let mut jobs = Vec::with_capacity(workspaces.len());

    for workspace in workspaces {
        let repos = WorkspaceRepo::find_repos_with_target_branch_for_workspace(
            &deployment.db().pool,
            workspace.id,
        )
        .await?;
        let workspace_dir = workspace.container_ref.as_ref().map(PathBuf::from);
        let repo_worktrees = repos
            .into_iter()
            .filter_map(|repo| {
                workspace_dir.as_ref().map(|workspace_dir| {
                    let repo_name = repo.repo.name;

                    RepoWorktreeUsageJob {
                        repo_id: repo.repo.id,
                        worktree_path: workspace_dir.join(&repo_name),
                        repo_name,
                    }
                })
            })
            .collect();

        jobs.push(WorkspaceUsageJob {
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            branch: workspace.branch,
            workspace_dir,
            repo_worktrees,
        });
    }

    let summary = tokio::task::spawn_blocking(move || compute_workspace_usage(jobs))
        .await
        .map_err(|error| ApiError::BadGateway(error.to_string()))?;

    Ok(ResponseJson(ApiResponse::success(summary)))
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/admin/workspace-usage", get(workspace_usage))
        .route(
            "/admin/cleanup/orphan-worktrees",
            post(cleanup_orphan_worktrees),
        )
}
