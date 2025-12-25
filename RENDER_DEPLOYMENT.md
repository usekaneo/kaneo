# 🚀 Guide de Déploiement Kaneo sur Render

Ce guide vous accompagne étape par étape pour déployer votre application Kaneo sur Render.

## 📋 Prérequis

- Un compte [Render](https://render.com) (gratuit)
- Votre code sur un dépôt GitHub ou GitLab

---

## 🔑 Votre Clé AUTH_SECRET

Voici votre clé secrète générée (GARDEZ-LA PRÉCIEUSEMENT) :

```
l3WddQs2OXrNY=iUaQ18hppqcHCofo9mSYEfKpl45LVol
```

> ⚠️ **IMPORTANT** : Ne partagez JAMAIS cette clé publiquement !

---

## 📦 Méthode 1 : Déploiement Automatique (Recommandé)

### Étape 1 : Pousser le Code sur GitHub

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### Étape 2 : Créer les Services sur Render

1. Allez sur [Render Dashboard](https://dashboard.render.com)
2. Cliquez sur **"New +"** → **"Blueprint"**
3. Connectez votre dépôt GitHub
4. Render détectera automatiquement le fichier `render.yaml`
5. Cliquez sur **"Apply"**

### Étape 3 : Configurer les Variables d'Environnement

Après le déploiement initial, vous devez configurer les URLs :

#### Pour le Backend (kaneo-api) :
1. Allez dans **kaneo-api** → **Environment**
2. Configurez :
   - `KANEO_API_URL` = `https://kaneo-api.onrender.com` (votre URL API)
   - `KANEO_CLIENT_URL` = `https://kaneo-web.onrender.com` (votre URL frontend)
   - `CORS_ORIGINS` = `https://kaneo-web.onrender.com`
   - `AUTH_SECRET` = `l3WddQs2OXrNY=iUaQ18hppqcHCofo9mSYEfKpl45LVol`

#### Pour le Frontend (kaneo-web) :
1. Allez dans **kaneo-web** → **Environment**
2. Configurez :
   - `VITE_API_URL` = `https://kaneo-api.onrender.com`
   - `VITE_CLIENT_URL` = `https://kaneo-web.onrender.com`

3. **Redéployez** le frontend après avoir ajouté la variable

---

## 📦 Méthode 2 : Déploiement Manuel

### Étape 1 : Créer la Base de Données

1. Dashboard Render → **"New +"** → **"PostgreSQL"**
2. Configurez :
   - **Name** : `kaneo-db`
   - **Database** : `kaneo`
   - **User** : `kaneo`
   - **Region** : Frankfurt (ou votre préférence)
   - **Plan** : Free
3. Cliquez **"Create Database"**
4. **Copiez** l'**Internal Database URL** (format : `postgres://kaneo:xxx@xxx/kaneo`)

### Étape 2 : Déployer le Backend (API)

1. Dashboard Render → **"New +"** → **"Web Service"**
2. Connectez votre dépôt GitHub
3. Configurez :
   - **Name** : `kaneo-api`
   - **Region** : Frankfurt
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** :
     ```
     npm install -g pnpm@10.15.1 && pnpm install --no-frozen-lockfile && pnpm --filter @kaneo/email build && pnpm --filter @kaneo/api build
     ```
   - **Start Command** :
     ```
     cd apps/api && node --enable-source-maps dist/index.js
     ```
   - **Plan** : Free

4. Ajoutez les **Variables d'Environnement** :

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | (URL PostgreSQL de l'étape 1) |
| `AUTH_SECRET` | `l3WddQs2OXrNY=iUaQ18hppqcHCofo9mSYEfKpl45LVol` |
| `KANEO_API_URL` | `https://kaneo-api.onrender.com` |
| `KANEO_CLIENT_URL` | `https://kaneo-web.onrender.com` |
| `CORS_ORIGINS` | `https://kaneo-web.onrender.com` |

5. Cliquez **"Create Web Service"**

### Étape 3 : Déployer le Frontend (Web)

1. Dashboard Render → **"New +"** → **"Static Site"**
2. Connectez le même dépôt GitHub
3. Configurez :
   - **Name** : `kaneo-web`
   - **Branch** : `main`
   - **Build Command** :
     ```
     npm install -g pnpm@10.15.1 && pnpm install --no-frozen-lockfile && pnpm --filter @kaneo/web build
     ```
   - **Publish Directory** : `apps/web/dist`

4. Ajoutez les **Variables d'Environnement** :

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://kaneo-api.onrender.com` |
| `VITE_CLIENT_URL` | `https://kaneo-web.onrender.com` |

5. Dans **Redirects/Rewrites**, ajoutez :
   - **Source** : `/*`
   - **Destination** : `/index.html`
   - **Action** : `Rewrite`

6. Cliquez **"Create Static Site"**

---

## ✅ Vérification du Déploiement

### 1. Vérifier l'API
Visitez : `https://kaneo-api.onrender.com/api/health`

Vous devez voir :
```json
{"status":"ok"}
```

### 2. Vérifier le Frontend
Visitez : `https://kaneo-web.onrender.com`

Vous devez voir la page de connexion Kaneo.

### 3. Créer un Compte
1. Cliquez sur **"S'inscrire"**
2. Créez votre premier compte administrateur
3. Commencez à utiliser Kaneo ! 🎉

---

## 🔧 Résolution des Problèmes

### Le frontend ne se connecte pas à l'API

1. Vérifiez que `VITE_API_URL` est correct (avec `https://`)
2. Vérifiez que `CORS_ORIGINS` sur l'API contient l'URL du frontend
3. **Redéployez** le frontend après avoir modifié les variables

### Erreur de base de données

1. Vérifiez que `DATABASE_URL` est correct
2. Attendez que la base de données soit en état "Available"
3. Les migrations s'exécutent automatiquement au démarrage

### Le déploiement est lent

Le plan gratuit de Render met les services en veille après 15 minutes d'inactivité. Le premier accès peut prendre 30-60 secondes pour "réveiller" le service.

---

## 📊 Récapitulatif des Variables d'Environnement

### Backend (kaneo-api)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NODE_ENV` | Environnement | `production` |
| `DATABASE_URL` | URL PostgreSQL | `postgres://kaneo:xxx@xxx/kaneo` |
| `AUTH_SECRET` | Clé d'authentification | (votre clé générée) |
| `KANEO_API_URL` | URL publique de l'API | `https://kaneo-api.onrender.com` |
| `KANEO_CLIENT_URL` | URL du frontend | `https://kaneo-web.onrender.com` |
| `CORS_ORIGINS` | URLs autorisées | `https://kaneo-web.onrender.com` |

### Frontend (kaneo-web)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL de l'API backend | `https://kaneo-api.onrender.com` |
| `VITE_CLIENT_URL` | URL du frontend | `https://kaneo-web.onrender.com` |

---

## 🎓 Prochaines Étapes

Une fois Kaneo déployé, vous pouvez :

1. **Personnaliser votre instance** dans les paramètres
2. **Inviter votre équipe** (par lien direct sans email)
3. **Créer vos premiers projets** et tableaux Kanban

---

## 📞 Support

- 📖 [Documentation Kaneo](https://kaneo.app/docs/core)
- 💬 [Discord Kaneo](https://discord.gg/rU4tSyhXXU)
- 🐛 [GitHub Issues](https://github.com/usekaneo/kaneo/issues)

---

**Bon déploiement ! 🚀**
