# Serveur multijoueur (Rust)

Ce module fournit un serveur autoritaire pour Voxicraft WebXR.

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

- `voxicraft-server-linux-x86_64`
- `voxicraft-server-windows-x86_64`

Le meme workflow publie aussi les builds dans GitHub Packages (GHCR) :

- `ghcr.io/<owner>/voxicraft-server-linux:<sha>`
- `ghcr.io/<owner>/voxicraft-server-windows:<sha>`

Tags de branche maintenus :

- `ghcr.io/<owner>/voxicraft-server-linux:main-latest`
- `ghcr.io/<owner>/voxicraft-server-linux:staging-latest`
- `ghcr.io/<owner>/voxicraft-server-windows:main-latest`
- `ghcr.io/<owner>/voxicraft-server-windows:staging-latest`

Variables d'environnement supportees :

- `SERVER_HOST` (defaut `0.0.0.0`)
- `SERVER_PORT` (defaut `3001`)
- `WORLD_SEED` (defaut `12345`)
- `CORS_CLIENT_DOMAIN` (defaut `https://central.voxicraft.fr`)
- `AUTH_CENTRAL_BASE_URL` (defaut `https://central.voxicraft.fr`)
- `USE_HTTPS` (defaut `false`) : active le service HTTPS si la valeur vaut `1`, `true`, `yes` ou `on`
- `SSL_CERT_PATH` (defaut `certs/localhost.pem`) : chemin du certificat SSL
- `SSL_KEY_PATH` (defaut `certs/localhost-key.pem`) : chemin de la cle privee SSL

Le serveur charge automatiquement le fichier `.env` s'il est present.

Quand `USE_HTTPS` est actif, le serveur genere automatiquement un certificat auto-signe si les fichiers `SSL_CERT_PATH` et `SSL_KEY_PATH` n'existent pas encore.

## Logs

Le serveur ecrit les logs dans un fichier journalier a la racine du projet :

- `voxicraft-yyyymmdd.log` (exemple `voxicraft-20260610.log`)

## Endpoints

- `GET /health` : verification basique (utilisee par central.voxicraft.fr)
- `GET /healthz` : alias de compatibilite
- `GET /state` : snapshot JSON du serveur (lobbies, joueurs, chunks charges, version monde)
- `GET /ws` : endpoint WebSocket principal

Proxy authentification (vers `AUTH_CENTRAL_BASE_URL`) :

- `POST /auth/register` et `POST /api/auth/register`
- `POST /auth/login` et `POST /api/auth/login`
- `GET /auth/discord/url` et `GET /api/auth/discord/url`
- `GET /auth/discord/callback` et `GET /api/auth/discord/callback`

Le serveur relaie le code HTTP et le corps de reponse du serveur central.

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
