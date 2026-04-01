use std::{
    fs,
    path::{Path, PathBuf},
};

use db::models::repo::Repo;
use deployment::Deployment;
use git::GitRemote;
use serde::Serialize;
use services::services::remote_client::RemoteClientError;
use url::Url;

use crate::DeploymentImpl;

const GITHUB_HOST: &str = "github.com";

#[derive(Debug, Clone, Serialize)]
pub struct RepoGitAuthStatus {
    pub remote_name: Option<String>,
    pub remote_url: Option<String>,
    pub https_remote_url: Option<String>,
    pub repo_full_name: Option<String>,
    pub provider: String,
    pub auth_mode: String,
    pub ready: bool,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct RepoGitTerminalAuth {
    pub env: Vec<(String, String)>,
    pub notices: Vec<String>,
    pub status: RepoGitAuthStatus,
}

#[derive(Debug, Clone)]
struct ParsedGitRemote {
    remote_name: String,
    remote_url: String,
    host: String,
    repo_full_name: String,
    https_remote_url: String,
    uses_ssh: bool,
}

pub async fn resolve_repo_git_auth(
    deployment: &DeploymentImpl,
    repo: &Repo,
) -> RepoGitTerminalAuth {
    let remote = match deployment.git().get_default_remote(&repo.path) {
        Ok(remote) => remote,
        Err(_) => {
            return RepoGitTerminalAuth {
                env: Vec::new(),
                notices: vec![
                    "[host-admin] No default remote configured. Shell opened without injected Git network auth."
                        .to_string(),
                ],
                status: RepoGitAuthStatus {
                    remote_name: None,
                    remote_url: None,
                    https_remote_url: None,
                    repo_full_name: None,
                    provider: "none".to_string(),
                    auth_mode: "no_remote".to_string(),
                    ready: false,
                    message:
                        "No default remote configured. Shell opened without injected Git network auth."
                            .to_string(),
                },
            };
        }
    };

    let Some(parsed) = parse_git_remote(&remote) else {
        return RepoGitTerminalAuth {
            env: Vec::new(),
            notices: vec![
                "[host-admin] Default remote is not a supported GitHub repository URL. Shell opened without injected Git auth."
                    .to_string(),
            ],
            status: RepoGitAuthStatus {
                remote_name: Some(remote.name),
                remote_url: Some(remote.url),
                https_remote_url: None,
                repo_full_name: None,
                provider: "unsupported".to_string(),
                auth_mode: "unsupported".to_string(),
                ready: false,
                message:
                    "Default remote is not a supported GitHub repository URL. Shell opened without injected Git auth."
                        .to_string(),
            },
        };
    };

    let mut git_config_entries = build_https_rewrite_config_entries(&parsed);
    let mut env = Vec::new();

    if !parsed.host.eq_ignore_ascii_case(GITHUB_HOST) {
        let message = format!(
            "Only github.com remotes are auto-authenticated right now. Shell opened without injected Git auth for {}.",
            parsed.repo_full_name
        );
        env.extend(build_git_config_env(&git_config_entries));
        return RepoGitTerminalAuth {
            env,
            notices: vec![format!("[host-admin] {message}")],
            status: RepoGitAuthStatus {
                remote_name: Some(parsed.remote_name),
                remote_url: Some(parsed.remote_url),
                https_remote_url: Some(parsed.https_remote_url),
                repo_full_name: Some(parsed.repo_full_name),
                provider: "unsupported".to_string(),
                auth_mode: "unsupported".to_string(),
                ready: false,
                message,
            },
        };
    }

    match fetch_github_app_repo_access_token(deployment, &parsed.repo_full_name).await {
        Ok(token) => match ensure_git_askpass_script() {
            Ok(script_path) => {
                git_config_entries.extend(build_github_app_config_entries(&parsed));
                env.extend(build_git_config_env(&git_config_entries));
                env.extend(build_github_app_env(&script_path, &token.token));
                let message = format!(
                    "GitHub App HTTPS auth is active for {}. Reconnect the terminal to refresh the token when needed.",
                    parsed.repo_full_name
                );
                RepoGitTerminalAuth {
                    env,
                    notices: vec![format!(
                        "[host-admin] {message} SSH GitHub remotes are rewritten to HTTPS in this shell."
                    )],
                    status: RepoGitAuthStatus {
                        remote_name: Some(parsed.remote_name),
                        remote_url: Some(parsed.remote_url),
                        https_remote_url: Some(parsed.https_remote_url),
                        repo_full_name: Some(parsed.repo_full_name),
                        provider: "github".to_string(),
                        auth_mode: "github_app".to_string(),
                        ready: true,
                        message,
                    },
                }
            }
            Err(error) => {
                env.extend(build_git_config_env(&git_config_entries));
                let message = format!(
                    "GitHub App token is available for {}, but the askpass helper could not be prepared: {}",
                    parsed.repo_full_name, error
                );
                RepoGitTerminalAuth {
                    env,
                    notices: vec![format!("[host-admin] {message}")],
                    status: RepoGitAuthStatus {
                        remote_name: Some(parsed.remote_name),
                        remote_url: Some(parsed.remote_url),
                        https_remote_url: Some(parsed.https_remote_url),
                        repo_full_name: Some(parsed.repo_full_name),
                        provider: "github".to_string(),
                        auth_mode: "unavailable".to_string(),
                        ready: false,
                        message,
                    },
                }
            }
        },
        Err(error_message) => {
            env.extend(build_git_config_env(&git_config_entries));
            let message = format!(
                "{} GitHub remotes will still use HTTPS in this shell; public reads may work, authenticated operations require GitHub App access.",
                error_message
            );
            RepoGitTerminalAuth {
                env,
                notices: vec![format!("[host-admin] {message}")],
                status: RepoGitAuthStatus {
                    remote_name: Some(parsed.remote_name),
                    remote_url: Some(parsed.remote_url),
                    https_remote_url: Some(parsed.https_remote_url),
                    repo_full_name: Some(parsed.repo_full_name),
                    provider: "github".to_string(),
                    auth_mode: "https_no_auth".to_string(),
                    ready: false,
                    message,
                },
            }
        }
    }
}

fn parse_git_remote(remote: &GitRemote) -> Option<ParsedGitRemote> {
    if let Some(parsed) = parse_https_remote(remote) {
        return Some(parsed);
    }
    if let Some(parsed) = parse_ssh_remote(remote) {
        return Some(parsed);
    }
    None
}

fn parse_https_remote(remote: &GitRemote) -> Option<ParsedGitRemote> {
    let url = Url::parse(&remote.url).ok()?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return None,
    }

    let host = url.host_str()?.to_string();
    let path = trim_git_suffix(url.path().trim_matches('/'));
    let mut parts = path.split('/');
    let owner = parts.next()?.trim().to_string();
    let repo_name = parts.next()?.trim().to_string();
    if owner.is_empty() || repo_name.is_empty() || parts.next().is_some() {
        return None;
    }

    Some(ParsedGitRemote {
        remote_name: remote.name.clone(),
        remote_url: remote.url.clone(),
        host: host.clone(),
        repo_full_name: format!("{owner}/{repo_name}"),
        https_remote_url: format!("https://{host}/{owner}/{repo_name}.git"),
        uses_ssh: false,
    })
}

fn parse_ssh_remote(remote: &GitRemote) -> Option<ParsedGitRemote> {
    if let Ok(url) = Url::parse(&remote.url)
        && url.scheme() == "ssh"
    {
        let host = url.host_str()?.to_string();
        let path = trim_git_suffix(url.path().trim_matches('/'));
        let mut parts = path.split('/');
        let owner = parts.next()?.trim().to_string();
        let repo_name = parts.next()?.trim().to_string();
        if owner.is_empty() || repo_name.is_empty() || parts.next().is_some() {
            return None;
        }

        return Some(ParsedGitRemote {
            remote_name: remote.name.clone(),
            remote_url: remote.url.clone(),
            host: host.clone(),
            repo_full_name: format!("{owner}/{repo_name}"),
            https_remote_url: format!("https://{host}/{owner}/{repo_name}.git"),
            uses_ssh: true,
        });
    }

    let scp = remote.url.strip_prefix("git@")?;
    let (host, path) = scp.split_once(':')?;
    let path = trim_git_suffix(path.trim_matches('/'));
    let mut parts = path.split('/');
    let owner = parts.next()?.trim().to_string();
    let repo_name = parts.next()?.trim().to_string();
    if owner.is_empty() || repo_name.is_empty() || parts.next().is_some() {
        return None;
    }

    Some(ParsedGitRemote {
        remote_name: remote.name.clone(),
        remote_url: remote.url.clone(),
        host: host.to_string(),
        repo_full_name: format!("{owner}/{repo_name}"),
        https_remote_url: format!("https://{host}/{owner}/{repo_name}.git"),
        uses_ssh: true,
    })
}

fn trim_git_suffix(value: &str) -> &str {
    value.strip_suffix(".git").unwrap_or(value)
}

fn build_https_rewrite_config_entries(parsed: &ParsedGitRemote) -> Vec<(String, String)> {
    if !parsed.uses_ssh {
        return Vec::new();
    }

    vec![
        (
            format!("url.https://{}/.insteadof", parsed.host),
            format!("git@{}:", parsed.host),
        ),
        (
            format!("url.https://{}/.insteadof", parsed.host),
            format!("ssh://git@{}/", parsed.host),
        ),
    ]
}

fn build_github_app_config_entries(parsed: &ParsedGitRemote) -> Vec<(String, String)> {
    vec![
        ("credential.helper".to_string(), String::new()),
        (
            format!("credential.https://{}.username", parsed.host),
            "x-access-token".to_string(),
        ),
    ]
}

fn build_git_config_env(entries: &[(String, String)]) -> Vec<(String, String)> {
    if entries.is_empty() {
        return Vec::new();
    }

    let mut env = Vec::with_capacity(entries.len() * 2 + 1);
    env.push(("GIT_CONFIG_COUNT".to_string(), entries.len().to_string()));
    for (index, (key, value)) in entries.iter().enumerate() {
        env.push((format!("GIT_CONFIG_KEY_{index}"), key.clone()));
        env.push((format!("GIT_CONFIG_VALUE_{index}"), value.clone()));
    }
    env
}

fn build_github_app_env(script_path: &Path, token: &str) -> Vec<(String, String)> {
    vec![
        ("GIT_TERMINAL_PROMPT".to_string(), "0".to_string()),
        (
            "GIT_ASKPASS".to_string(),
            script_path.to_string_lossy().to_string(),
        ),
        ("VK_GIT_USERNAME".to_string(), "x-access-token".to_string()),
        ("VK_GIT_PASSWORD".to_string(), token.to_string()),
    ]
}

fn ensure_git_askpass_script() -> Result<PathBuf, std::io::Error> {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/home/node"));
    let dir = home.join(".vibe-kanban").join("bin");
    fs::create_dir_all(&dir)?;

    let path = dir.join("git-askpass.sh");
    let contents = r#"#!/bin/sh
prompt="${1:-}"
case "$prompt" in
  *Username* ) printf '%s\n' "${VK_GIT_USERNAME:-x-access-token}" ;;
  *Password* ) printf '%s\n' "${VK_GIT_PASSWORD:-}" ;;
  * ) printf '\n' ;;
esac
"#;

    let needs_write = fs::read_to_string(&path)
        .map(|current| current != contents)
        .unwrap_or(true);
    if needs_write {
        fs::write(&path, contents)?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        fs::set_permissions(&path, fs::Permissions::from_mode(0o700))?;
    }

    Ok(path)
}

pub async fn fetch_github_app_repo_access_token(
    deployment: &DeploymentImpl,
    repo_full_name: &str,
) -> Result<api_types::GitHubAppRepoAccessTokenResponse, String> {
    let client = deployment
        .remote_client()
        .map_err(|_| "Remote cloud auth is not configured on this host.".to_string())?;

    client
        .get_github_app_repo_access_token(repo_full_name)
        .await
        .map_err(|error| match error {
            RemoteClientError::Auth => {
                "This host is not signed in to the cloud or lacks access to the GitHub App installation for this repo."
                    .to_string()
            }
            RemoteClientError::Http { status, body } => {
                let detail = extract_remote_error_message(&body);
                match status {
                    404 => detail.unwrap_or_else(|| {
                        "GitHub App is not installed for this repository.".to_string()
                    }),
                    501 => detail.unwrap_or_else(|| {
                        "GitHub App is not configured on the remote service.".to_string()
                    }),
                    _ => detail.unwrap_or_else(|| {
                        format!("Failed to resolve GitHub App auth (remote HTTP {status}).")
                    }),
                }
            }
            other => format!("Failed to resolve GitHub App auth: {other}"),
        })
}

fn extract_remote_error_message(body: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    value
        .get("error")
        .and_then(|value| value.as_str())
        .map(str::to_string)
}
