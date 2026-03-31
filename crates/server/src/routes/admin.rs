use axum::{Router, extract::State, response::Json as ResponseJson, routing::post};
use db::models::repo::Repo;
use deployment::Deployment;
use serde::Serialize;
use utils::response::ApiResponse;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Serialize)]
pub struct CleanupOrphanWorktreesSummary {
    pub orphan_cleanup_disabled: bool,
    pub repos_checked: usize,
    pub repos_pruned: usize,
    pub repo_errors: Vec<String>,
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

pub fn router() -> Router<DeploymentImpl> {
    Router::new().route(
        "/admin/cleanup/orphan-worktrees",
        post(cleanup_orphan_worktrees),
    )
}
