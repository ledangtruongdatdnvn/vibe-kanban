use std::{
    env,
    path::{Path, PathBuf},
};

use db::models::repo::{Repo as RepoModel, SearchMatchType, SearchResult, UpdateRepo};
use git::{GitService, GitServiceError};
use sqlx::SqlitePool;
use thiserror::Error;
use url::Url;
use utils::path::expand_tilde;
use uuid::Uuid;

use super::file_search::{FileSearchCache, SearchQuery};

const DEFAULT_HOST_REPOS_DIR: &str = "/home/node/repos";
const GITHUB_HOST: &str = "github.com";

#[derive(Debug, Error)]
pub enum RepoError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("Path does not exist: {0}")]
    PathNotFound(PathBuf),
    #[error("Path is not a directory: {0}")]
    PathNotDirectory(PathBuf),
    #[error("Path is not a git repository: {0}")]
    NotGitRepository(PathBuf),
    #[error("Repository not found")]
    NotFound,
    #[error("Directory already exists: {0}")]
    DirectoryAlreadyExists(PathBuf),
    #[error("Git error: {0}")]
    Git(#[from] GitServiceError),
    #[error("Invalid folder name: {0}")]
    InvalidFolderName(String),
    #[error("Invalid GitHub repository reference: {0}")]
    InvalidGitHubRepository(String),
    #[error(
        "Existing repository remote does not match requested repository. Expected {expected}, found {found}"
    )]
    RemoteMismatch { expected: String, found: String },
}

pub type Result<T> = std::result::Result<T, RepoError>;

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedGitHubRepoReference {
    repo_full_name: String,
    clone_url: String,
    repo_name: String,
}

#[derive(Clone, Default)]
pub struct RepoService;

impl RepoService {
    pub fn new() -> Self {
        Self
    }

    fn validate_git_repo_path(&self, path: &Path) -> Result<()> {
        if !path.exists() {
            return Err(RepoError::PathNotFound(path.to_path_buf()));
        }

        if !path.is_dir() {
            return Err(RepoError::PathNotDirectory(path.to_path_buf()));
        }

        if !path.join(".git").exists() {
            return Err(RepoError::NotGitRepository(path.to_path_buf()));
        }

        Ok(())
    }

    pub fn normalize_path(&self, path: &str) -> std::io::Result<PathBuf> {
        std::path::absolute(expand_tilde(path))
    }

    fn validate_folder_name(&self, folder_name: &str) -> Result<()> {
        if folder_name.is_empty()
            || folder_name.contains('/')
            || folder_name.contains('\\')
            || folder_name == "."
            || folder_name == ".."
        {
            return Err(RepoError::InvalidFolderName(folder_name.to_string()));
        }

        Ok(())
    }

    fn managed_repos_root(&self) -> Result<PathBuf> {
        let raw = env::var("HOST_REPOS_DIR").unwrap_or_else(|_| DEFAULT_HOST_REPOS_DIR.to_string());
        self.normalize_path(&raw).map_err(RepoError::Io)
    }

    pub fn resolve_github_repo_full_name(&self, input: &str) -> Result<String> {
        Ok(self.parse_github_repo_reference(input)?.repo_full_name)
    }

    fn parse_github_repo_reference(&self, input: &str) -> Result<ParsedGitHubRepoReference> {
        let value = input.trim();
        if value.is_empty() {
            return Err(RepoError::InvalidGitHubRepository(
                "Repository cannot be empty.".to_string(),
            ));
        }

        let (owner, repo_name) = if let Some(rest) = value.strip_prefix("git@") {
            let (host, path) = rest
                .split_once(':')
                .ok_or_else(|| RepoError::InvalidGitHubRepository(value.to_string()))?;
            if !host.eq_ignore_ascii_case(GITHUB_HOST) {
                return Err(RepoError::InvalidGitHubRepository(value.to_string()));
            }
            parse_owner_repo(path)
                .ok_or_else(|| RepoError::InvalidGitHubRepository(value.to_string()))?
        } else if value.contains("://") {
            let url = Url::parse(value)
                .map_err(|_| RepoError::InvalidGitHubRepository(value.to_string()))?;
            let host = url
                .host_str()
                .ok_or_else(|| RepoError::InvalidGitHubRepository(value.to_string()))?;
            if !host.eq_ignore_ascii_case(GITHUB_HOST) {
                return Err(RepoError::InvalidGitHubRepository(value.to_string()));
            }
            parse_owner_repo(url.path())
                .ok_or_else(|| RepoError::InvalidGitHubRepository(value.to_string()))?
        } else {
            let shorthand = value
                .strip_prefix(&format!("{GITHUB_HOST}/"))
                .unwrap_or(value);
            parse_owner_repo(shorthand)
                .ok_or_else(|| RepoError::InvalidGitHubRepository(value.to_string()))?
        };

        Ok(ParsedGitHubRepoReference {
            clone_url: format!("https://{GITHUB_HOST}/{owner}/{repo_name}.git"),
            repo_full_name: format!("{owner}/{repo_name}"),
            repo_name,
        })
    }

    fn ensure_matching_remote(
        &self,
        git: &GitService,
        repo_path: &Path,
        expected_repo_full_name: &str,
    ) -> Result<()> {
        let remote = git.get_default_remote(repo_path)?;
        let remote_url = remote.url.clone();
        let actual = self
            .parse_github_repo_reference(&remote_url)
            .map(|parsed| parsed.repo_full_name)
            .map_err(|_| RepoError::RemoteMismatch {
                expected: expected_repo_full_name.to_string(),
                found: remote_url,
            })?;

        if actual != expected_repo_full_name {
            return Err(RepoError::RemoteMismatch {
                expected: expected_repo_full_name.to_string(),
                found: actual,
            });
        }

        Ok(())
    }

    async fn apply_import_defaults(
        &self,
        pool: &SqlitePool,
        git: &GitService,
        repo: RepoModel,
        display_name: Option<&str>,
    ) -> Result<RepoModel> {
        let normalized_display_name = display_name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let current_branch = git
            .get_current_branch(&repo.path)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        let mut update = UpdateRepo::default();
        let mut should_update = false;

        if let Some(display_name) = normalized_display_name
            && display_name != repo.display_name
        {
            update.display_name = Some(Some(display_name));
            should_update = true;
        }

        if let Some(current_branch) = current_branch
            && repo.default_target_branch.as_deref() != Some(current_branch.as_str())
        {
            update.default_target_branch = Some(Some(current_branch));
            should_update = true;
        }

        if !should_update {
            return Ok(repo);
        }

        RepoModel::update(pool, repo.id, &update)
            .await
            .map_err(|error| match error {
                db::models::repo::RepoError::Database(db_err) => RepoError::Database(db_err),
                db::models::repo::RepoError::NotFound => RepoError::NotFound,
            })
    }

    pub async fn register(
        &self,
        pool: &SqlitePool,
        path: &str,
        display_name: Option<&str>,
    ) -> Result<RepoModel> {
        let normalized_path = self.normalize_path(path)?;
        self.validate_git_repo_path(&normalized_path)?;

        let name = normalized_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string());

        let display_name = display_name.unwrap_or(&name);

        let repo = RepoModel::find_or_create(pool, &normalized_path, display_name).await?;
        Ok(repo)
    }

    pub async fn find_by_id(&self, pool: &SqlitePool, repo_id: Uuid) -> Result<Option<RepoModel>> {
        let repo = RepoModel::find_by_id(pool, repo_id).await?;
        Ok(repo)
    }

    pub async fn get_by_id(&self, pool: &SqlitePool, repo_id: Uuid) -> Result<RepoModel> {
        self.find_by_id(pool, repo_id)
            .await?
            .ok_or(RepoError::NotFound)
    }

    pub async fn init_repo(
        &self,
        pool: &SqlitePool,
        git: &GitService,
        parent_path: &str,
        folder_name: &str,
    ) -> Result<RepoModel> {
        self.validate_folder_name(folder_name)?;

        let normalized_parent = self.normalize_path(parent_path)?;
        if !normalized_parent.exists() {
            return Err(RepoError::PathNotFound(normalized_parent));
        }
        if !normalized_parent.is_dir() {
            return Err(RepoError::PathNotDirectory(normalized_parent));
        }

        let repo_path = normalized_parent.join(folder_name);
        if repo_path.exists() {
            return Err(RepoError::DirectoryAlreadyExists(repo_path));
        }

        git.initialize_repo_with_main_branch(&repo_path)?;

        let repo = RepoModel::find_or_create(pool, &repo_path, folder_name).await?;
        Ok(repo)
    }

    pub async fn import_github_repo(
        &self,
        pool: &SqlitePool,
        git: &GitService,
        repository: &str,
        folder_name: Option<&str>,
        display_name: Option<&str>,
        token: &str,
    ) -> Result<RepoModel> {
        let parsed = self.parse_github_repo_reference(repository)?;
        let normalized_folder_name = folder_name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| parsed.repo_name.clone());
        self.validate_folder_name(&normalized_folder_name)?;

        let repos_root = self.managed_repos_root()?;
        std::fs::create_dir_all(&repos_root)?;

        let repo_path = repos_root.join(&normalized_folder_name);
        if repo_path.exists() {
            if !repo_path.is_dir() {
                return Err(RepoError::PathNotDirectory(repo_path));
            }

            if !repo_path.join(".git").exists() {
                return Err(RepoError::DirectoryAlreadyExists(repo_path));
            }

            self.validate_git_repo_path(&repo_path)?;
            self.ensure_matching_remote(git, &repo_path, &parsed.repo_full_name)?;
        } else {
            GitService::clone_repository(&parsed.clone_url, &repo_path, Some(token))?;
        }

        let path = repo_path.to_string_lossy().to_string();
        let repo = self.register(pool, &path, display_name).await?;
        self.apply_import_defaults(pool, git, repo, display_name)
            .await
    }

    pub async fn search_files(
        &self,
        cache: &FileSearchCache,
        repositories: &[RepoModel],
        query: &SearchQuery,
    ) -> Result<Vec<SearchResult>> {
        let query_str = query.q.trim();
        if query_str.is_empty() || repositories.is_empty() {
            return Ok(vec![]);
        }

        // Search in parallel and prefix paths with repo name
        let search_futures: Vec<_> = repositories
            .iter()
            .map(|repo| {
                let repo_name = repo.name.clone();
                let repo_path = repo.path.clone();
                let mode = query.mode.clone();
                let query_str = query_str.to_string();
                async move {
                    let results = cache
                        .search_repo(&repo_path, &query_str, mode)
                        .await
                        .unwrap_or_else(|e| {
                            tracing::warn!("Search failed for repo {}: {}", repo_name, e);
                            vec![]
                        });
                    (repo_name, results)
                }
            })
            .collect();

        let repo_results = futures::future::join_all(search_futures).await;

        let mut all_results: Vec<SearchResult> = repo_results
            .into_iter()
            .flat_map(|(repo_name, results)| {
                results.into_iter().map(move |r| SearchResult {
                    path: format!("{}/{}", repo_name, r.path),
                    is_file: r.is_file,
                    match_type: r.match_type.clone(),
                    score: r.score,
                })
            })
            .collect();

        all_results.sort_by(|a, b| {
            let priority = |m: &SearchMatchType| match m {
                SearchMatchType::FileName => 0,
                SearchMatchType::DirectoryName => 1,
                SearchMatchType::FullPath => 2,
            };
            priority(&a.match_type)
                .cmp(&priority(&b.match_type))
                .then_with(|| b.score.cmp(&a.score)) // Higher scores first
        });

        all_results.truncate(10);
        Ok(all_results)
    }
}

fn trim_git_suffix(value: &str) -> &str {
    value.strip_suffix(".git").unwrap_or(value)
}

fn parse_owner_repo(value: &str) -> Option<(String, String)> {
    let path = trim_git_suffix(value.trim().trim_matches('/'));
    let mut parts = path.split('/');
    let owner = parts.next()?.trim();
    let repo_name = parts.next()?.trim();

    if owner.is_empty() || repo_name.is_empty() || parts.next().is_some() {
        return None;
    }

    Some((owner.to_string(), repo_name.to_string()))
}

#[cfg(test)]
mod tests {
    use super::RepoService;

    #[test]
    fn parses_owner_repo_shorthand() {
        let parsed = RepoService::new()
            .parse_github_repo_reference("openai/codex")
            .expect("expected repo reference to parse");

        assert_eq!(parsed.repo_full_name, "openai/codex");
        assert_eq!(parsed.repo_name, "codex");
        assert_eq!(parsed.clone_url, "https://github.com/openai/codex.git");
    }

    #[test]
    fn parses_https_and_ssh_github_urls() {
        let service = RepoService::new();

        let https = service
            .parse_github_repo_reference("https://github.com/openai/codex.git")
            .expect("expected https URL to parse");
        let ssh = service
            .parse_github_repo_reference("git@github.com:openai/codex.git")
            .expect("expected ssh URL to parse");

        assert_eq!(https.repo_full_name, "openai/codex");
        assert_eq!(ssh.repo_full_name, "openai/codex");
    }

    #[test]
    fn rejects_non_github_urls() {
        let error = RepoService::new()
            .parse_github_repo_reference("https://gitlab.com/openai/codex.git")
            .expect_err("expected non-GitHub URL to fail");

        assert!(
            error
                .to_string()
                .contains("Invalid GitHub repository reference")
        );
    }
}
