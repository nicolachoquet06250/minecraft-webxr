use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

pub const DEFAULT_MODS_DIR: &str = "mods";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModSide {
    Client,
    Server,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub side: ModSide,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub server: Option<ServerModManifest>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client: Option<ClientModManifest>,
    #[serde(default)]
    pub permissions: ModPermissions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerModManifest {
    pub runtime: ServerModRuntime,
    pub entry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerModRuntime {
    Wasm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientModManifest {
    pub runtime: ClientModRuntime,
    pub entry: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assets: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientModRuntime {
    Javascript,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModPermissions {
    #[serde(default)]
    pub server: Vec<String>,
    #[serde(default)]
    pub client: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClientModsManifestResponse {
    pub mods: Vec<ClientVisibleModManifest>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClientVisibleModManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub side: ModSide,
    pub client: ClientVisibleModEntry,
    #[serde(default)]
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClientVisibleModEntry {
    pub runtime: ClientModRuntime,
    pub entry: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assets: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LoadedModMetadata {
    pub root_path: PathBuf,
    pub manifest: ModManifest,
}

#[derive(Debug, Clone)]
pub struct ModRegistry {
    mods_dir: PathBuf,
    loaded_mods: Vec<LoadedModMetadata>,
}

impl ModRegistry {
    pub fn scan(mods_dir: impl Into<PathBuf>) -> Self {
        let mods_dir = mods_dir.into();
        let mut registry = Self {
            mods_dir,
            loaded_mods: Vec::new(),
        };

        registry.reload();
        registry
    }

    pub fn reload(&mut self) {
        self.loaded_mods.clear();

        let entries = match fs::read_dir(&self.mods_dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                info!(mods_dir = %self.mods_dir.display(), "mods directory not found, no mods loaded");
                return;
            }
            Err(error) => {
                warn!(mods_dir = %self.mods_dir.display(), %error, "failed to read mods directory");
                return;
            }
        };

        for entry in entries.flatten() {
            let mod_path = entry.path();

            if !mod_path.is_dir() {
                continue;
            }

            match read_manifest(&mod_path) {
                Ok(manifest) => {
                    info!(mod_id = %manifest.id, version = %manifest.version, "mod manifest loaded");
                    self.loaded_mods.push(LoadedModMetadata {
                        root_path: mod_path,
                        manifest,
                    });
                }
                Err(error) => warn!(mod_path = %mod_path.display(), %error, "invalid mod ignored"),
            }
        }
    }

    pub fn client_manifest(&self) -> ClientModsManifestResponse {
        let mods = self.loaded_mods
            .iter()
            .filter_map(client_visible_manifest)
            .collect();

        ClientModsManifestResponse { mods }
    }

    pub fn resolve_client_file(&self, request_path: &str) -> Option<PathBuf> {
        let mut path_parts = request_path.split('/').filter(|part| !part.is_empty());
        let mod_id = path_parts.next()?;
        let relative_path = path_parts.collect::<Vec<_>>().join("/");

        if relative_path.is_empty() || !is_safe_relative_path(&relative_path) {
            return None;
        }

        let loaded_mod = self.loaded_mods
            .iter()
            .find(|loaded_mod| loaded_mod.manifest.id == mod_id)?;
        let client = loaded_mod.manifest.client.as_ref()?;

        if !is_client_file_allowed(client, &relative_path) {
            warn!(mod_id = %loaded_mod.manifest.id, requested_path = %relative_path, "client mod file rejected by manifest allow-list");
            return None;
        }

        let file_path = loaded_mod.root_path.join(relative_path);

        if file_path.is_file() {
            Some(file_path)
        } else {
            None
        }
    }

    pub fn server_wasm_entries(&self) -> Vec<(String, PathBuf)> {
        self.loaded_mods
            .iter()
            .filter_map(|loaded_mod| {
                let server = loaded_mod.manifest.server.as_ref()?;

                match server.runtime {
                    ServerModRuntime::Wasm => Some((
                        loaded_mod.manifest.id.clone(),
                        loaded_mod.root_path.join(&server.entry),
                    )),
                }
            })
            .collect()
    }
}

fn read_manifest(mod_path: &Path) -> Result<ModManifest, String> {
    let manifest_path = mod_path.join("mod.json");
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Impossible de lire {}: {error}", manifest_path.display()))?;
    let manifest = serde_json::from_str::<ModManifest>(&manifest_content)
        .map_err(|error| format!("Manifest JSON invalide {}: {error}", manifest_path.display()))?;

    validate_manifest(mod_path, manifest)
}

fn validate_manifest(mod_path: &Path, manifest: ModManifest) -> Result<ModManifest, String> {
    if manifest.id.trim().is_empty() {
        return Err("Le champ id est obligatoire".to_string());
    }

    if manifest.id.contains('/') || manifest.id.contains('\\') || manifest.id.contains("..") {
        return Err(format!("Id de mod invalide: {}", manifest.id));
    }

    if manifest.name.trim().is_empty() {
        return Err(format!("Le mod {} doit avoir un nom", manifest.id));
    }

    if manifest.version.trim().is_empty() {
        return Err(format!("Le mod {} doit avoir une version", manifest.id));
    }

    if matches!(manifest.side, ModSide::Client | ModSide::Both) && manifest.client.is_none() {
        return Err(format!("Le mod {} déclare une partie client sans bloc client", manifest.id));
    }

    if matches!(manifest.side, ModSide::Server | ModSide::Both) && manifest.server.is_none() {
        return Err(format!("Le mod {} déclare une partie serveur sans bloc server", manifest.id));
    }

    if let Some(client) = &manifest.client {
        validate_relative_existing_file(mod_path, &client.entry, "client.entry")?;

        if let Some(types) = &client.types {
            validate_relative_existing_file(mod_path, types, "client.types")?;
        }

        if let Some(assets) = &client.assets {
            validate_safe_relative_path(assets, "client.assets")?;
            validate_relative_existing_dir(mod_path, assets, "client.assets")?;
        }
    }

    if let Some(server) = &manifest.server {
        validate_relative_existing_file(mod_path, &server.entry, "server.entry")?;
    }

    Ok(manifest)
}

fn client_visible_manifest(loaded_mod: &LoadedModMetadata) -> Option<ClientVisibleModManifest> {
    let client = loaded_mod.manifest.client.as_ref()?;
    let base_url = format!("/mods/{}", loaded_mod.manifest.id);

    Some(ClientVisibleModManifest {
        id: loaded_mod.manifest.id.clone(),
        name: loaded_mod.manifest.name.clone(),
        version: loaded_mod.manifest.version.clone(),
        side: loaded_mod.manifest.side.clone(),
        client: ClientVisibleModEntry {
            runtime: client.runtime.clone(),
            entry: format!("{base_url}/{}", client.entry.trim_start_matches('/')),
            types: client.types.as_ref().map(|types| format!("{base_url}/{}", types.trim_start_matches('/'))),
            assets: client.assets.as_ref().map(|assets| format!("{base_url}/{}", assets.trim_matches('/'))),
        },
        permissions: loaded_mod.manifest.permissions.client.clone(),
    })
}

fn is_client_file_allowed(client: &ClientModManifest, relative_path: &str) -> bool {
    if paths_are_equal(relative_path, &client.entry) {
        return true;
    }

    if client
        .types
        .as_deref()
        .is_some_and(|types| paths_are_equal(relative_path, types))
    {
        return true;
    }

    client
        .assets
        .as_deref()
        .is_some_and(|assets| path_is_inside_dir(relative_path, assets))
}

fn paths_are_equal(left: &str, right: &str) -> bool {
    Path::new(left) == Path::new(right.trim_matches('/'))
}

fn path_is_inside_dir(path: &str, dir: &str) -> bool {
    let normalized_dir = dir.trim_matches('/');

    !normalized_dir.is_empty()
        && Path::new(path).starts_with(Path::new(normalized_dir))
        && Path::new(path) != Path::new(normalized_dir)
}

fn validate_relative_existing_file(mod_path: &Path, relative_path: &str, field: &str) -> Result<(), String> {
    validate_safe_relative_path(relative_path, field)?;

    let file_path = mod_path.join(relative_path);

    if !file_path.is_file() {
        return Err(format!("{field} pointe vers un fichier introuvable: {}", file_path.display()));
    }

    Ok(())
}

fn validate_relative_existing_dir(mod_path: &Path, relative_path: &str, field: &str) -> Result<(), String> {
    let dir_path = mod_path.join(relative_path);

    if !dir_path.is_dir() {
        return Err(format!("{field} pointe vers un dossier introuvable: {}", dir_path.display()));
    }

    Ok(())
}

fn validate_safe_relative_path(relative_path: &str, field: &str) -> Result<(), String> {
    if relative_path.trim().is_empty() {
        return Err(format!("{field} ne peut pas être vide"));
    }

    if !is_safe_relative_path(relative_path) {
        return Err(format!("{field} doit être un chemin relatif sûr"));
    }

    Ok(())
}

fn is_safe_relative_path(relative_path: &str) -> bool {
    let path = Path::new(relative_path);

    if path.is_absolute() {
        return false;
    }

    path.components().all(|component| matches!(component, Component::Normal(_)))
}
