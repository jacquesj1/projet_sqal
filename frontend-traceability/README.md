# Frontend Traçabilité - Interface Publique Consommateurs

## 🎯 Vue d'ensemble

Interface web publique Next.js 14 permettant aux consommateurs de vérifier la traçabilité et l'origine des produits Euralis via QR code ou saisie manuelle. Design mobile-first optimisé pour l'expérience utilisateur.

## ⚡ Technologies

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.6
- **Styling:** Tailwind CSS 3.4
- **Animations:** Framer Motion
- **QR Scanner:** react-qr-scanner + qr-scanner
- **State:** React Query
- **Performance:** Bundle Analyzer, Image Optimization
- **Port:** 3003

## 🚀 Installation

```bash
# Installation dépendances
npm install

# Développement
npm run dev

# Build production
npm run build
npm start

# Analyse du bundle
npm run analyze

# Linting
npm run lint

# Tests
npm run test
```

## 📱 Pages

### Interface Publique (Sans authentification)

- `/` - **Landing page** avec scanner QR intégré
- `/trace/[traceId]` - **Page traçabilité** complète avec données blockchain

## 🎨 Fonctionnalités

### Landing Page
- **Hero Section** - Présentation attrayante avec CTA
- **Scanner QR** - Caméra intégrée avec détection automatique
- **Saisie manuelle** - Alternative pour entrer l'ID manuellement
- **Features** - Avantages de la traçabilité blockchain
- **How it works** - Processus en 4 étapes
- **About Euralis** - Présentation de l'entreprise

### Page Traçabilité
- **Header produit** - Informations principales avec badges qualité
- **Métriques qualité** - Score et analyses détaillées
- **Timeline** - Parcours complet du produit
- **Info gaveur** - Présentation de l'éleveur
- **Vérification blockchain** - Preuve cryptographique
- **Partage social** - Liens et export PDF

## 🔧 Configuration

### Variables d'environnement

```bash
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Métadonnées
NEXT_PUBLIC_APP_NAME=Traçabilité Euralis
NEXT_PUBLIC_APP_VERSION=2.1.0

# Blockchain Explorer (optionnel)
NEXT_PUBLIC_BLOCKCHAIN_EXPLORER=http://localhost:8081
```

### Optimisations Performance

- **Image Optimization** - Next.js Image avec WebP/AVIF
- **Code Splitting** - Chargement dynamique des composants
- **Lazy Loading** - Components et médias
- **Bundle Analysis** - Surveillance de la taille
- **Compression** - Gzip automatique
- **Cache Headers** - Optimisation CDN

## 📦 Structure

```
src/
├── app/                    # App Router Next.js
│   ├── page.tsx           # Landing page avec scanner
│   ├── trace/[traceId]/   # Page traçabilité dynamique
│   ├── layout.tsx         # Layout global
│   └── globals.css        # Styles avec animations
├── components/            # Composants React
│   ├── home/             # Composants landing page
│   │   ├── hero-section.tsx
│   │   ├── features-section.tsx
│   │   ├── how-it-works-section.tsx
│   │   ├── about-section.tsx
│   │   └── manual-input.tsx
│   ├── trace/            # Composants traçabilité
│   │   ├── traceability-header.tsx
│   │   ├── product-info.tsx
│   │   ├── quality-metrics.tsx
│   │   ├── traceability-timeline.tsx
│   │   ├── gaveur-info.tsx
│   │   ├── blockchain-verification.tsx
│   │   └── share-button.tsx
│   ├── scanner/          # Scanner QR optimisé
│   │   └── qr-scanner.tsx
│   ├── layout/           # Layout components
│   │   ├── header.tsx
│   │   └── footer.tsx
│   ├── ui/              # UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── loading-spinner.tsx
│   │   ├── error-message.tsx
│   │   └── tabs.tsx
│   └── providers/        # Context providers
│       └── providers.tsx
├── lib/                  # Utilitaires
│   ├── api/client.ts     # Client API Axios
│   └── utils.ts          # Helpers et formatters
├── hooks/               # Hooks personnalisés
│   └── use-api.ts       # Hook API
└── types/              # Types TypeScript
    └── index.ts
```

## 🎨 Design System

### Couleurs
- **Primary:** Vert Euralis (#37a474)
- **Quality:** Vert/Jaune/Rouge selon score
- **Trace:** Palette de gris moderne

### Animations
- **Fade in/Slide up** - Entrée des sections
- **Bounce gentle** - Éléments interactifs
- **Scan line** - Effet scanner QR
- **Pulse slow** - Indicateurs de statut

### Responsive
- **Mobile First** - Design optimisé smartphone
- **Breakpoints** - sm:640px, md:768px, lg:1024px
- **Touch Friendly** - Boutons et zones tactiles

## 📱 Scanner QR

### Fonctionnalités
- **Multi-caméra** - Basculement avant/arrière
- **Flash/Torche** - Éclairage intégré
- **Overlay visuel** - Guides de cadrage
- **Détection auto** - Scan automatique
- **Gestion erreurs** - Messages utilisateur

### Formats supportés
- **URL complète** - https://trace.euralis.fr/trace/ABC123
- **ID direct** - ABC123DEF456 (8-32 caractères)
- **QR standards** - Compatibilité universelle

## 🔒 Sécurité

### Publique mais Sécurisée
- **Lecture seule** - Aucune écriture possible
- **Validation input** - Vérification des IDs
- **Rate limiting** - Protection contre les abus
- **Headers sécurité** - XSS, CSRF, clickjacking
- **HTTPS ready** - SSL/TLS compatible

## 📊 Analytics

### Métriques trackées
- **Scans QR** - Volume et succès
- **Pages traçabilité** - Consultations
- **Erreurs 404** - IDs invalides
- **Performance** - Temps de chargement
- **Géolocalisation** - Régions d'usage

## 🐳 Docker

```bash
# Build image optimisée
docker build -t frontend-traceability .

# Run container
docker run -p 3003:3003   -e NEXT_PUBLIC_API_URL=http://backend:8000   -e NODE_ENV=production   frontend-traceability

# Health check
curl http://localhost:3003/api/health
```

### Optimisations Docker
- **Multi-stage** - Image légère
- **Alpine Linux** - Base minimale
- **User non-root** - Sécurité
- **Health check** - Monitoring
- **Build cache** - CI/CD rapide

## 📈 Performance

### Métriques cibles
- **First Paint:** <1s
- **LCP:** <2.5s  
- **FID:** <100ms
- **CLS:** <0.1
- **Bundle:** <500KB

### Optimisations
- **Tree shaking** - Code mort supprimé
- **Preloading** - Ressources critiques
- **Service Worker** - Cache intelligent
- **WebP/AVIF** - Images modernes
- **Lazy loading** - Composants et images

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests avec coverage
npm run test:coverage

# Tests E2E (optionnel)
npm run test:e2e
```

### Stratégie de test
- **Unit:** Components isolés
- **Integration:** Flux utilisateur
- **Visual:** Snapshots UI
- **Performance:** Bundle size
- **Accessibility:** WCAG 2.1

## 📝 API Endpoints Utilisés

### Public (Sans auth)
- `GET /api/public/traceability/{id}` - Données traçabilité
- `GET /api/public/traceability/{id}/report` - Export PDF
- `GET /api/health` - Health check

## 🔄 Flux Utilisateur

### Scan QR Code
1. Landing page → Scanner
2. Autorisation caméra
3. Détection QR code
4. Extraction ID traçabilité
5. Redirection `/trace/{id}`
6. Chargement données API
7. Affichage traçabilité

### Saisie Manuelle  
1. Landing page → Saisie manuelle
2. Input ID (validation)
3. Redirection `/trace/{id}`
4. Chargement données API
5. Affichage traçabilité

### Partage
1. Page traçabilité
2. Bouton partage/copie
3. Native Web Share API ou clipboard
4. Lien partagé: `https://trace.euralis.fr/trace/{id}`

## 🌍 Multilingue (Futur)

### Préparation i18n
- **next-intl** - Déjà installé
- **Fichiers locale** - Structure prête
- **Routes localisées** - /fr/, /en/
- **Détection auto** - Navigator language

## 📞 Support

- **Équipe:** A Deep Adventure
- **Email:** support@adeepventure.com
- **Documentation:** Wiki interne
- **Status:** https://status.euralis.fr

## 🚀 Déploiement

### Production
- **Kubernetes** - Helm charts inclus
- **CDN** - Assets statiques
- **Monitoring** - Health checks
- **Scaling** - Auto-scaling HPA

### Environnements
- **Dev:** http://localhost:3003
- **Staging:** https://trace-staging.euralis.fr  
- **Prod:** https://trace.euralis.fr

---

**Version:** 2.1.0  
**Dernière MAJ:** 2025-01-19  
**Status:** Production Ready ✅  
**Utilisateurs cibles:** Grand public consommateurs