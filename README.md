# Solidarité Plus — Next.js + MongoDB Atlas

Application de gestion de la tontine **Solidarité Plus**.

## Stockage

**MongoDB Atlas** via `MONGODB_URI` (recommandé / production).  
Sans URI, fallback fichiers locaux `data/` (dev uniquement).

## Installation

```bash
npm install
cp .env.example .env.local
```

### Brancher MongoDB Atlas (Free M0)

1. Créez un compte sur [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Build a Database** → Free M0
3. **Database Access** → Create user (user + password)
4. **Network Access** → Add IP Address  
   - pour tester vite : `0.0.0.0/0` (toute IP)  
   - en prod : restreindre
5. **Connect** → Drivers → copiez l’URI  
   Remplacez `<password>` par le vrai mot de passe
6. Dans `.env.local` :

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=solidarite_plus
```

7. Lancer :

```bash
npm run dev
```

8. Vérifier : [http://localhost:3000/api/debug/storage](http://localhost:3000/api/debug/storage)  
   → `"mode": "mongodb"`

### Compte Super Admin

| Rôle | Téléphone | Mot de passe |
|------|-----------|--------------|
| Super admin | `+2290140942258` (ou `BOOTSTRAP_ADMIN_PHONE`) | `admin123!` (ou `BOOTSTRAP_ADMIN_PASSWORD`) |

La connexion se fait **uniquement par numéro de téléphone béninois** (`+229` + **exactement 10 chiffres**). Les autres comptes sont créés par le super admin.

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Développement |
| `npm run seed` | Import Excel → fichiers locaux |
| `npm run migrate:mongo` | Pousse `data/` vers MongoDB |
| `npm run purge:all` | Vide MongoDB (garde le super admin) |
| `npm run build` / `start` | Production |

## Déploiement Vercel / Netlify

Ajoutez les variables d’environnement :
- `MONGODB_URI`
- `MONGODB_DB`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Pas besoin de volume disque.

## Rôles

- `SUPER_ADMIN` — utilisateurs, paramètres, gestion
- `GESTIONNAIRE` — tontines + modules de gestion
- `MEMBRE` — progression (`memberId`)
