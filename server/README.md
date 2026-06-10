# Serveur multijoueur (Rust)

Ce module fournit un serveur autoritaire pour Minecraft WebXR.

Objectifs de la premiere iteration :
- valider l'etat du monde cote serveur ;
- maintenir l'etat des lobbies joueurs ;
- relayer les messages temps reel entre joueurs via WebSocket ;
- conserver la memoire de l'etat map en RAM (chunks charges + mutations de blocs).

## Lancer le serveur

Depuis la racine du projet :

```bash
npm run dev:server
```

## Build serveur Linux et Windows

Depuis la racine du projet :

```bash
# Build Linux (binaire ELF)
npm run server:build:linux

# Build Windows (binaire .exe)
npm run server:build:windows
```

Un workflow GitHub Actions build egalement automatiquement le serveur sur Linux et Windows et publie les artefacts :

- `minecraft-server-linux-x86_64`
- `minecraft-server-windows-x86_64`

Le meme workflow publie aussi les builds dans GitHub Packages (GHCR) :

- `ghcr.io/<owner>/minecraft-webxr-server-linux:<sha>`
- `ghcr.io/<owner>/minecraft-webxr-server-windows:<sha>`

Tags de branche maintenus :

- `ghcr.io/<owner>/minecraft-webxr-server-linux:main-latest`
- `ghcr.io/<owner>/minecraft-webxr-server-linux:staging-latest`
- `ghcr.io/<owner>/minecraft-webxr-server-windows:main-latest`
- `ghcr.io/<owner>/minecraft-webxr-server-windows:staging-latest`

Variables d'environnement supportees :

- `SERVER_HOST` (defaut `0.0.0.0`)
- `SERVER_PORT` (defaut `3001`)
- `WORLD_SEED` (defaut `12345`)
- `CORS_CLIENT_DOMAIN` (optionnel, ex. `https://votre-domaine.fr`)

Le serveur charge automatiquement le fichier `.env` s'il est present.

## Logs

Le serveur ecrit les logs dans un fichier journalier a la racine du projet :

- `minecraft-xr-yyyymmdd.log` (exemple `minecraft-xr-20260610.log`)

## Endpoints

- `GET /healthz` : verification basique
- `GET /state` : snapshot JSON du serveur (lobbies, joueurs, chunks charges, version monde)
- `GET /ws` : endpoint WebSocket principal

## Protocole WebSocket JSON

Tous les messages utilisent un format enum serde :

```json
{
  "type": "nom_message",
  "payload": { ... }
}
```

### Messages client -> serveur

- `hello`
- `request_chunk`
- `set_block`
- `player_transform`
- `chat`
- `ping`

### Messages serveur -> client

- `welcome`
- `lobby_state`
- `player_joined`
- `player_left`
- `chunk_data`
- `block_updated`
- `player_transform`
- `chat`
- `pong`
- `error`

## Mode autoritaire

Le serveur applique la logique suivante :

1. un client doit envoyer `hello` en premier ;
2. les demandes de chunks sont servies depuis l'etat serveur ;
3. les updates de blocs sont validees en borne Y, appliquees en memoire, puis diffusees ;
4. les transformations joueur et messages de chat sont relayes au lobby ;
5. la version globale `world_version` incremente a chaque mutation autoritaire.

## Notes

- L'etat map est actuellement en memoire volatile (RAM).
- La persistence disque (snapshot/DB) pourra etre ajoutee dans une prochaine iteration.
- Le generateur de chunk serveur est deterministic mais simplifie pour ce premier jalon.
