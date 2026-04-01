use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAppRepoAccessTokenRequest {
    pub repo_full_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAppRepoAccessTokenResponse {
    pub organization_id: Uuid,
    pub github_installation_id: i64,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}
