# Firebase Lobby Setup

> Status: Operational guide  
> Scope: Setup for the optional Firebase public lobby registry.

This project uses Firebase Realtime Database only as a public lobby registry.

Actual gameplay remains peer-to-peer over `PeerJS`.
Direct join by `HOST ID` still works even if Firebase is not configured.

## 1. Create a Firebase project

1. Open the Firebase console.
2. Create a project.
3. Add a Web app to the project.
4. Copy the Web app config values.

## 2. Enable Realtime Database

1. In Firebase console, open `Build -> Realtime Database`.
2. Create a database.
3. Choose the region closest to your players.
4. Start in test mode for the first prototype pass.

## 3. Fill local env

Put these values into [`.env.local`](../.env.local):

```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_DATABASE_URL="https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_APP_ID="..."
```

If these values are empty, the game still works, but only manual join by `HOST ID` will be available.

## 4. Apply prototype rules

For the first pass, you can use the example file:

- [firebase.database.rules.example.json](../firebase.database.rules.example.json)

Minimal prototype rules:

```json
{
  "rules": {
    "lobbies": {
      ".read": true,
      "$roomId": {
        ".write": true,
        ".validate": "newData.hasChildren(['shortCode', 'hostPeerId', 'status', 'createdAt', 'updatedAt', 'expiresAt'])"
      }
    }
  }
}
```

This is intentionally permissive and should be treated as prototype-only.

## 5. Run locally

```bash
npm run dev
```

Expected result:

- you can still host and join manually by `HOST ID`
- if Firebase env is valid, the lobby screen also shows public rooms
- hosted rooms publish a heartbeat and disappear from the public list after TTL expiry

## 6. Enable Firebase on GitHub Pages

If you want the public lobby list to work on `GitHub Pages`, add the same values in:

- `GitHub repository -> Settings -> Secrets and variables -> Actions`

Create either repository `Variables` or `Secrets` for:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

The Pages workflow is already wired to read them during `npm run build`.

## 7. Recommended next step

After the first successful connection:

- tighten Realtime Database rules
- consider anonymous auth for write control
- add room status and player count to the public list
