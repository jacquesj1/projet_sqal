# GitOps — Déploiement automatique sur NAS (branche `demo`)

## Vue d'ensemble

```
dev  ──→  PR/merge  ──→  demo  ──→  GitHub Actions  ──→  NAS (via Tailscale SSH)
```

Chaque push sur la branche `demo` déclenche automatiquement un déploiement sur le NAS Synology.

---

## Composants

| Composant | Rôle |
|-----------|------|
| **Branche `demo`** | Snapshot stable de `dev` installée sur le NAS |
| **GitHub Actions** | Orchestre le déploiement automatique |
| **Tailscale** | VPN mesh — permet au runner GitHub d'atteindre le NAS sur le réseau local |
| **SSH** | Connexion sécurisée GitHub → NAS pour exécuter les commandes |

---

## Tailscale — Pourquoi et comment

### Problème
Le NAS est sur un réseau local privé (`192.168.1.103` / `DEEP_NAS`).
Les runners GitHub Actions tournent sur Internet → ils ne peuvent pas atteindre directement le NAS.

### Solution : Tailscale
Tailscale crée un **réseau privé virtuel mesh** (basé sur WireGuard) :
- Le NAS rejoint le réseau Tailscale → reçoit une IP stable `100.x.x.x`
- Le runner GitHub Actions rejoint le même réseau via une clé d'authentification
- Le runner peut alors SSH sur le NAS comme s'il était sur le LAN

```
Internet
   │
   ├── GitHub Actions runner  ──┐
   │                            │  Tailscale mesh (chiffré WireGuard)
   └── NAS Synology (DEEP_NAS) ─┘
              192.168.1.103
              100.x.x.x (Tailscale)
```

### Installation Tailscale sur Synology DSM

1. **DSM** → `Package Center` → chercher **Tailscale** → Installer
2. Ouvrir Tailscale → `Log in` avec ton compte [tailscale.com](https://tailscale.com)
3. Approuver la machine dans l'admin Tailscale : [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)
4. Noter l'**IP Tailscale** du NAS (colonne "Addresses", ex: `100.64.0.3`)

> Le NAS restera joignable à cette IP depuis n'importe quel appareil Tailscale, y compris les runners GitHub Actions.

---

## GitHub Secrets — Configuration

Dans le repo GitHub : **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valeur | Exemple |
|--------|--------|---------|
| `TAILSCALE_AUTHKEY` | Clé Tailscale reusable avec tag `ci` | `tskey-auth-xxxxx` |
| `NAS_SSH_HOST` | IP Tailscale du NAS | `100.64.0.3` |
| `NAS_SSH_PORT` | Port SSH du NAS | `22` |
| `NAS_SSH_USER` | Utilisateur SSH | `admin_jj` |
| `NAS_SSH_KEY` | Clé privée SSH (PEM complet) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `NAS_PROJECT_PATH` | Chemin du projet sur le NAS | `/volume1/DevProject/gaveurs/app/projet-euralis-gaveurs` |

### Créer la clé Tailscale

1. Aller sur [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys)
2. **Generate auth key**
3. Cocher : `Reusable` ✓ et `Ephemeral` ✓
4. Tags : ajouter `ci`
5. Copier la clé → la coller dans le secret `TAILSCALE_AUTHKEY`

### Créer la clé SSH dédiée CI

```bash
# Sur ta machine Windows (Git Bash ou WSL)
ssh-keygen -t ed25519 -C "github-actions-nas" -f ~/.ssh/github_nas -N ""

# Autoriser la clé sur le NAS
ssh-copy-id -i ~/.ssh/github_nas.pub admin_jj@DEEP_NAS

# Copier le contenu de la clé PRIVÉE → GitHub Secret NAS_SSH_KEY
cat ~/.ssh/github_nas
```

---

## Workflow de déploiement

Fichier : `.github/workflows/deploy-nas.yml`

### Déclencheurs
- **Push automatique** sur la branche `demo`
- **Manuel** : GitHub → Actions → "Deploy to NAS (demo)" → Run workflow

### Étapes exécutées
1. `tailscale/github-action` — runner rejoint le réseau Tailscale
2. SSH sur le NAS → `git fetch && git reset --hard origin/demo`
3. `docker compose up --build -d`
4. Health check sur `http://localhost:8000/health`
5. Affiche le statut des containers

### Voir les logs
GitHub → **Actions** → "Deploy to NAS (demo)" → cliquer sur le run

---

## Workflow quotidien

### Développer sur `dev`
```bash
git checkout dev
# ... développement ...
git add . && git commit -m "feat: ..."
git push origin dev
```

### Déployer sur le NAS
```bash
# Option 1 : via GitHub (recommandé, traçable)
git checkout demo
git merge dev
git push origin demo
# → GitHub Actions se déclenche automatiquement

# Option 2 : PR GitHub (pour review avant deploy)
# Créer une PR dev → demo sur github.com
```

### Rollback
En cas de problème :
1. GitHub → **Actions** → trouver le dernier run réussi → **Re-run jobs**
2. Ou : `git revert` sur `demo` + push

---

## Structure des branches

```
main      ← production future (protégée)
  └── dev ← développement actif
        └── demo ← NAS Synology (auto-deploy)
```

### Règle : ne jamais pusher directement sur `demo`
Toujours merger depuis `dev` pour garder la traçabilité.

---

## Fichiers de configuration NAS

| Fichier | Rôle |
|---------|------|
| `.env.nas` | Variables NAS locales (non committé en prod) |
| `docker-compose.yml` | Stack principale |
| `docker-compose.nas.override.yml` | Overrides NAS (URLs, CORS) — généré par `nas_deploy.ps1` |
| `scripts/nas/nas_deploy.ps1` | Script PowerShell déploiement manuel |
| `scripts/nas/nas_verify.ps1` | Vérification santé de la stack NAS |

---

## Troubleshooting

| Problème | Solution |
|----------|----------|
| Runner ne peut pas SSH | Vérifier que Tailscale tourne sur le NAS |
| `git reset` échoue | Vérifier que le NAS a accès à GitHub (pas de proxy bloquant) |
| Docker compose introuvable | Vérifier le PATH sur le NAS : `/usr/local/bin` |
| Health check échoue | Le backend met ~30s à démarrer, normal au premier lancement |
| Tailscale authkey expirée | Régénérer sur tailscale.com et mettre à jour le secret GitHub |
