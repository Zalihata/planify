# Planify — Diagnostic de planification

Outil de diagnostic personnalisé pour identifier son profil de planificateur·rice, clarifier ses priorités et recevoir des recommandations concrètes.

**Stack :** HTML/CSS/JS vanilla · Vercel (API serverless) · Claude API · Notion API

---

## Structure du projet

```
planify/
├── api/
│   ├── proxy.js       ← Proxy Claude API (Anthropic)
│   └── notion.js      ← Proxy Notion API
├── public/
│   └── index.html     ← Application diagnostic (standalone)
├── .env.example       ← Template des variables d'environnement
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## Mise en place (première fois)

### Prérequis
- Compte [GitHub](https://github.com) ✓
- Compte [Vercel](https://vercel.com) (gratuit) ✓
- Clé API [Anthropic](https://console.anthropic.com) ✓
- Token [Notion](https://www.notion.so/my-integrations) (pour les fonctions Notion uniquement)

### 1. Créer le repo GitHub

```bash
# Depuis le dossier du projet
git init
git add .
git commit -m "Initial commit — Planify diagnostic"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/planify.git
git push -u origin main
```

### 2. Déployer sur Vercel

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Cliquer **"Import Git Repository"**
3. Sélectionner le repo `planify`
4. Laisser les paramètres par défaut (Vercel détecte automatiquement la structure)
5. Cliquer **"Deploy"**

### 3. Configurer les variables d'environnement

Dans le dashboard Vercel → ton projet → **Settings → Environment Variables** :

| Variable | Valeur | Environnement |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview, Development |
| `NOTION_TOKEN` | `ntn_...` | Production, Preview, Development |
| `ALLOWED_ORIGIN` | `https://ton-domaine.com` | Production uniquement |

Après avoir ajouté les variables → **Deployments → Redeploy** pour les prendre en compte.

### 4. Développement local (optionnel)

```bash
# Installer les dépendances
npm install

# Copier le template d'env
cp .env.example .env.local
# → Éditer .env.local avec tes vraies clés

# Lancer en local (simule Vercel)
npm run dev
# → http://localhost:3000
```

---

## Roadmap

### Phase 1 — Diagnostic ✅
- [x] Questionnaire 6 étapes bilingue FR/EN
- [x] Profil généré par Claude (maturité, priorités RICE, recommandations)
- [x] Export imprimable
- [x] Proxy Claude sécurisé

### Phase 2 — Workspace Notion (à venir)
- [ ] Création automatique du workspace Notion à partir du profil
- [ ] Bases de données configurées (Tâches, Check-in, Projets, Rétrospectives)
- [ ] Vues et formules préconfigurées

### Phase 3 — Planning dynamique (à venir)
- [ ] Briefing quotidien adapté à l'énergie
- [ ] Garde-fou contre la surcharge
- [ ] Check-in / check-out journalier
- [ ] Rétrospectives hebdomadaires automatisées

---

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Oui | Clé API Anthropic pour Claude |
| `NOTION_TOKEN` | Phase 2+ | Token d'intégration Notion |
| `ALLOWED_ORIGIN` | Non | Origine CORS autorisée (défaut: `*`) |

---

## Déploiement continu

Une fois le repo connecté à Vercel, chaque `git push` sur `main` déclenche automatiquement un nouveau déploiement. Les branches créent des URLs de preview.

```bash
# Déployer une mise à jour
git add .
git commit -m "Description des changements"
git push
# → Vercel déploie automatiquement
```

---

## Personnalisation

**Changer le proxy Claude :** modifier `CLAUDE_PROXY` dans `public/index.html` (ligne ~615)

**Ajouter ton domaine :** Vercel → Settings → Domains → Add Domain

**Mettre à jour la CTA :** dans `public/index.html`, chercher `cta-notion` et remplacer l'alerte par le lien de ton site / formation.

---

*Projet développé avec [Claude](https://claude.ai)*
