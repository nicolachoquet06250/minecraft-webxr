# Central Join Ticket

Le protocole **Central Join Ticket** permet de rejoindre un serveur de jeu depuis le central sans repasser par le formulaire de login du serveur de jeu.

## Résumé

Quand le joueur clique sur **Rejoindre** depuis le central, le central génère un ticket court et ouvre le serveur de jeu avec :

```text
#central_join_ticket=<ticket>
```

Le front du serveur de jeu lit ce fragment d'URL, puis appelle le proxy d'authentification existant :

```http
POST /api/auth/login
Content-Type: application/json
```

Body :

```json
{
  "central_join_ticket": "<ticket>"
}
```

Le serveur de jeu proxy cette requête vers le central. Le central vérifie le ticket et renvoie la session habituelle :

```json
{
  "token": "<jwt>",
  "user": {
    "id": "<central_user_id>",
    "username": "Player",
    "email": "player@example.com"
  }
}
```

Le front stocke ensuite :

```text
auth_token
voxicraft:auth:user
```

## Sécurité

Le ticket est :

- temporaire ;
- à usage unique ;
- lié au domaine du serveur de jeu ;
- envoyé dans le fragment d'URL pour éviter l'exposition dans les logs HTTP ;
- validé uniquement par le central.

## Implémentation côté front

Le fichier `src/central-join-ticket.ts` :

1. lit `central_join_ticket` dans `window.location.hash` ;
2. appelle `POST /api/auth/login` avec `{ central_join_ticket }` ;
3. stocke la session retournée ;
4. nettoie le fragment d'URL.

Le module est chargé depuis `src/auth-client.ts`, qui est déjà importé au démarrage du jeu.

## Comportement attendu

- Si le joueur arrive depuis le central avec un ticket valide : connexion automatique.
- Si le joueur arrive directement sur le serveur de jeu : login classique.
- Si le ticket est expiré ou déjà consommé : le login automatique échoue et le joueur peut se connecter normalement.
