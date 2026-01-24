# 📋 Spécifications Techniques Frontend
## Système de Qualification Alimentaire Temps Réel

**Version:** 1.0  
**Date:** Octobre 2025  
**Type:** Application Web Scientifique & Technique  
**Backend:** TimescaleDB + IA + Capteurs (TOF + AS7341)

---

## 🎯 1. Vue d'ensemble du projet

### 1.1 Objectif
Développer une interface web technique et scientifique pour un système de qualification alimentaire en temps réel, intégrant :
- Capteur Time-of-Flight (TOF) pour analyse morphologique 3D
- Capteur multispectral AS7341 (11 canaux : 8 visibles + NIR + flicker)
- Moteur d'intelligence artificielle pour classification qualité
- Base de données temporelle TimescaleDB
- **Backend Django REST** avec Django Channels pour temps réel

### 1.2 Utilisateurs cibles
- **Opérateurs de production** : surveillance temps réel
- **Techniciens qualité** : analyses approfondies
- **Data scientists** : entraînement et optimisation IA
- **Administrateurs système** : maintenance et monitoring

### 1.3 Contraintes techniques
- **Temps réel** : latence < 200ms pour affichage données
- **Données haute fréquence** : 10-50 mesures/seconde
- **Disponibilité** : 99.5% uptime minimum
- **Sécurité** : Keycloak SSO, RBAC (Role-Based Access Control)
- **Multi-organisation** : isolation complète des données par site
- **Compatibilité** : Chrome 90+, Firefox 88+, Edge 90+
- **Responsive** : Desktop (prioritaire) + Tablette

---

## 🏗️ 2. Architecture technique

### 2.1 Stack technologique

#### Core Framework
```
- React 18+ avec TypeScript 5+
- Vite (build tool, HMR performant)
- React Router v6 (navigation)
- Keycloak-js (client SSO/OAuth2/OIDC)
```

#### State Management
```
- Zustand (global state léger)
- TanStack Query v5 (cache API + synchronisation serveur)
- Context API (thème, auth)
```

#### UI & Styling
```
- TailwindCSS 3+ (utility-first)
- shadcn/ui (composants base accessibles)
- CSS Modules (composants spécifiques)
- Framer Motion (animations fluides)
```

#### Visualisation de données
```
- Recharts (graphiques temps réel, légers)
- Plotly.js (spectrogrammes scientifiques avancés)
- Three.js + React Three Fiber (visualisation 3D TOF)
- D3.js (manipulations données complexes si nécessaire)
```

#### Communication temps réel
```

```

#### Backend fastapi - Intégration
```

- python-keycloak pour authentification SSO
- TimescaleDB via psycopg2
- Celery (tâches asynchrones : génération rapports, entraînement IA)
- Redis (cache + message broker Channels)
```

#### Tooling
```
- ESLint + Prettier (qualité code)
- Husky + lint-staged (pre-commit hooks)
- Jest + React Testing Library (tests unitaires)
- Playwright (tests E2E)
- Storybook (documentation composants)
```

### 2.2 Authentification & Autorisation (Keycloak)

#### Architecture Keycloak

**Configuration Keycloak** :
```
Realm: FoodQuality
Clients:
  - foodquality-frontend (Public, PKCE enabled)
  - foodquality-api (Confidential, Service account)

Roles système:
  - super_admin       (accès total, multi-org)
  - org_admin         (admin d'une organisation)
  - quality_manager   (gestion qualité + IA)
  - operator          (production, lecture seule IA)
  - maintenance       (système, firmware)
  - data_analyst      (historique, export, lecture seule)
  - viewer            (lecture seule globale)

Attributes utilisateur:
  - organization_id   (UUID de l'organisation)
  - site

### 2.5 Intégration Backend Django

#### Architecture Django REST Framework

**Structure backend Django** :
```
backend/
├── config/                      # Settings Django
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── asgi.py                 # Pour Django Channels
│   └── wsgi.py
├── apps/
│   ├── authentication/          # Auth Keycloak
│   ├── organizations/           # Gestion multi-org
│   ├── sensors/                 # TOF + AS7341
│   ├── ai/                      # Modèles IA, inférence
│   ├── analyses/                # Historique analyses
│   ├── reports/                 # Génération rapports
│   ├── system/                  # Health, firmware
│   └── websocket/              # Consumers Channels
├── requirements.txt
└── manage.py
```

**Packages Django clés** :
```python
# requirements.txt
Django==4.2.7
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.0
python-keycloak==3.9.0
psycopg2-binary==2.9.9          # PostgreSQL + TimescaleDB
django-cors-headers==4.3.1
channels==4.0.0                  # WebSocket
channels-redis==4.1.0
daphne==4.0.0                    # ASGI server
celery==5.3.4                    # Tâches async
redis==5.0.1
reportlab==4.0.7                 # Génération PDF
pandas==2.1.3                    # Manipulation données
numpy==1.26.2
scikit-learn==1.3.2              # Utilitaires IA
```

#### Authentification Keycloak avec Django

**Middleware personnalisé** :
```python
# apps/authentication/middleware.py
from django.contrib.auth.models import AnonymousUser
from keycloak import KeycloakOpenID
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions

class KeycloakAuthentication(BaseAuthentication):
    """Authentification via token Keycloak"""
    
    def __init__(self):
        self.keycloak_openid = KeycloakOpenID(
            server_url=settings.KEYCLOAK_SERVER_URL,
            client_id=settings.KEYCLOAK_CLIENT_ID,
            realm_name=settings.KEYCLOAK_REALM,
            client_secret_key=settings.KEYCLOAK_CLIENT_SECRET
        )
    
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            # Valider et décoder token
            user_info = self.keycloak_openid.introspect(token)
            
            if not user_info.get('active'):
                raise exceptions.AuthenticationFailed('Token inactif')
            
            # Extraire organization_id du token
            org_id = user_info.get('organization_id')
            roles = user_info.get('realm_access', {}).get('roles', [])
            
            # Créer ou récupérer user Django
            user = self.get_or_create_user(user_info)
            
            # Stocker contexte dans request
            request.organization_id = org_id
            request.user_roles = roles
            
            return (user, token)
            
        except Exception as e:
            raise exceptions.AuthenticationFailed(f'Authentification échouée: {str(e)}')
    
    def get_or_create_user(self, user_info):
        from apps.authentication.models import User
        
        user, created = User.objects.get_or_create(
            keycloak_id=user_info['sub'],
            defaults={
                'email': user_info.get('email'),
                'username': user_info.get('preferred_username'),
                'first_name': user_info.get('given_name', ''),
                'last_name': user_info.get('family_name', ''),
            }
        )
        return user
```

**Settings DRF** :
```python
# config/settings/base.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.authentication.middleware.KeycloakAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.OrderingFilter',
        'rest_framework.filters.SearchFilter',
    ],
}

# Keycloak
KEYCLOAK_SERVER_URL = env('KEYCLOAK_SERVER_URL')
KEYCLOAK_REALM = env('KEYCLOAK_REALM', default='FoodQuality')
KEYCLOAK_CLIENT_ID = env('KEYCLOAK_CLIENT_ID')
KEYCLOAK_CLIENT_SECRET = env('KEYCLOAK_CLIENT_SECRET')

# CORS (pour React frontend)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://app.foodquality.local",
]
CORS_ALLOW_CREDENTIALS = True
```

#### Permissions personnalisées Django

```python
# apps/authentication/permissions.py
from rest_framework import permissions

class HasRole(permissions.BasePermission):
    """Vérifier si user a un rôle spécifique"""
    
    def __init__(self, *roles):
        self.allowed_roles = roles
    
    def has_permission(self, request, view):
        user_roles = getattr(request, 'user_roles', [])
        return any(role in user_roles for role in self.allowed_roles)

class IsOrgAdmin(permissions.BasePermission):
    """Vérifier si user est admin de son org"""
    
    def has_permission(self, request, view):
        return 'org_admin' in getattr(request, 'user_roles', [])

class CanAccessOrganization(permissions.BasePermission):
    """Vérifier accès à une organisation spécifique"""
    
    def has_object_permission(self, request, view, obj):
        request_org_id = getattr(request, 'organization_id', None)
        
        # Super admin peut tout voir
        if 'super_admin' in getattr(request, 'user_roles', []):
            return True
        
        # Vérifier que l'objet appartient à l'org de l'user
        return str(obj.organization_id) == request_org_id

# Utilisation dans views
class AnalysisViewSet(viewsets.ModelViewSet):
    queryset = Analysis.objects.all()
    serializer_class = AnalysisSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasRole('super_admin', 'org_admin', 'quality_manager', 'operator')
    ]
    
    def get_queryset(self):
        """Filtrer par organisation"""
        queryset = super().get_queryset()
        
        # Super admin voit tout
        if 'super_admin' in self.request.user_roles:
            return queryset
        
        # Autres users: uniquement leur org
        return queryset.filter(
            organization_id=self.request.organization_id
        )
```

#### WebSocket avec Django Channels

**Consumer pour temps réel** :
```python
# apps/websocket/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class DashboardConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer pour dashboard temps réel"""
    
    async def connect(self):
        # Récupérer user et org depuis token
        self.user = self.scope['user']
        self.org_id = self.scope['organization_id']
        
        # Rejoindre groupe spécifique à l'organisation
        self.room_group_name = f'dashboard_{self.org_id}'
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Envoyer données initiales
        initial_data = await self.get_initial_dashboard_data()
        await self.send(text_data=json.dumps({
            'type': 'initial_data',
            'data': initial_data
        }))
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Recevoir messages du client"""
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'subscribe_sensor':
            # S'abonner à un capteur spécifique
            sensor_id = data.get('sensor_id')
            await self.subscribe_to_sensor(sensor_id)
    
    async def sensor_update(self, event):
        """Envoyer update capteur au client"""
        await self.send(text_data=json.dumps({
            'type': 'sensor_update',
            'data': event['data']
        }))
    
    async def analysis_complete(self, event):
        """Notification analyse terminée"""
        await self.send(text_data=json.dumps({
            'type': 'analysis_complete',
            'data': event['data']
        }))
    
    @database_sync_to_async
    def get_initial_dashboard_data(self):
        from apps.analyses.models import Analysis
        
        recent = Analysis.objects.filter(
            organization_id=self.org_id
        ).order_by('-timestamp')[:10]
        
        return {
            'recent_analyses': [
                {
                    'id': str(a.id),
                    'classification': a.classification,
                    'confidence': a.confidence,
                    'timestamp': a.timestamp.isoformat()
                }
                for a in recent
            ]
        }

# Routing WebSocket
# apps/websocket/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/dashboard/

```
src/
├── assets/              # Images, icônes, fonts
├── components/          
│   ├── common/          # Boutons, inputs, modals
│   ├── charts/          # Wrappers graphiques réutilisables
│   ├── sensors/         # Composants capteurs spécifiques
│   ├── layouts/         # Header, Sidebar, Footer
│   ├── auth/            # Composants Keycloak, ProtectedRoute
│   └── organizations/   # Sélecteur org, gestion multi-site
├── pages/               # Pages principales
│   ├── Auth/
│   ├── Dashboard/
│   ├── Sensors/
│   ├── AI/
│   ├── History/
│   ├── System/
│   ├── Admin/           # Gestion users, organisations
│   └── Unauthorized/
├── hooks/               # Custom hooks (useAuth, usePermissions, useOrg)
├── services/            
│   ├── api.ts           # Axios config, interceptors
│   ├── websocket.ts     # WebSocket client
│   └── keycloak.ts      # Keycloak init & utils
├── stores/              # Zustand stores
│   ├── authStore.ts
│   ├── organizationStore.ts
│   └── dataStore.ts
├── types/               # TypeScript definitions
│   ├── auth.types.ts
│   ├── organization.types.ts
│   └── sensor.types.ts
├── utils/               # Helpers, formatters
├── constants/           # Config, enums, permissions matrix
└── styles/              # Global styles, themes
```

---

### 2.6 Architecture des dossiers

```
src/
├── assets/              # Images, icônes, fonts
├── components/          
│   ├── common/          # Boutons, inputs, modals
│   ├── charts/          # Wrappers graphiques réutilisables
│   ├── sensors/         # Composants capteurs spécifiques
│   ├── layouts/         # Header, Sidebar, Footer
│   ├── auth/            # Composants Keycloak, ProtectedRoute
│   ├── organizations/   # Sélecteur org, gestion multi-site
│   └── reports/         # Composants génération rapports
├── pages/               # Pages principales
│   ├── Auth/
│   ├── Dashboard/
│   ├── Sensors/
│   ├── AI/
│   ├── History/
│   ├── Reports/         # Génération de rapports
│   ├── System/
│   ├── Admin/           # Gestion users, organisations
│   └── Unauthorized/
├── hooks/               # Custom hooks (useAuth, usePermissions, useOrg)
├── services/            
│   ├── api.ts           # Axios config, interceptors
│   ├── websocket.ts     # WebSocket client (Django Channels)
│   └── keycloak.ts      # Keycloak init & utils
├── stores/              # Zustand stores
│   ├── authStore.ts
│   ├── organizationStore.ts
│   └── dataStore.ts
├── types/               # TypeScript definitions
│   ├── auth.types.ts
│   ├── organization.types.ts
│   ├── sensor.types.ts
│   └── report.types.ts
├── utils/               # Helpers, formatters
├── constants/           # Config, enums, permissions matrix
└── styles/              # Global styles, themes
```

---

## 📄 3. Spécifications détaillées des pages

### 3.1 Authentification (`/login`)

#### Fonctionnalités
- **SSO via Keycloak** : redirection automatique vers Keycloak
- Support **multi-méthodes** :
  - Username/Password
  - LDAP/Active Directory
  - Social Login (Google, Microsoft) si configuré
  - MFA (TOTP, SMS) si activé
- **Remember me** : refresh token longue durée (30 jours)
- **Lien "Mot de passe oublié"** : géré par Keycloak
- **Sélection organisation** : si user a accès à plusieurs orgs

#### Flow d'authentification détaillé

```
┌─────────────────────────────────────────────────┐
│ 1. User visite /dashboard (non connecté)       │
│    └─> ProtectedRoute détecte absence token    │
│    └─> Redirect vers /login                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 2. Page /login affiche bouton "Se connecter"   │
│    User clique                                  │
│    └─> keycloak.login() appelé                 │
│    └─> Redirect vers Keycloak                  │
│        https://auth.domain.com/realms/Food...   │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 3. Page Keycloak (branding personnalisable)    │
│    • Formulaire login                           │
│    • Validation credentials                     │
│    • MFA si activé                              │
│    • Consent si nécessaire                      │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 4. Callback /auth/callback?code=XXX            │
│    Frontend échange code contre tokens (PKCE)  │
│    └─> Access Token (JWT, 5 min)               │
│    └─> Refresh Token (30 jours)                │
│    └─> ID Token (user info)                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 5. Décodage JWT & extraction données           │
│    • Roles: ['org_admin', 'quality_manager']   │
│    • Organization IDs: ['uuid-lyon', 'uuid...']│
│    • User info: name, email, etc.              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 6. Si user a plusieurs orgs:                   │
│    └─> Afficher modal sélection organisation   │
│    Sinon:                                       │
│    └─> Auto-sélection unique org               │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 7. Initialisation app                          │
│    • Store auth (user, roles, tokens)          │
│    • Store org (currentOrg)                    │
│    • Fetch settings org                        │
│    • Init WebSocket avec token                 │
│    └─> Redirect vers /dashboard                │
└─────────────────────────────────────────────────┘
```

#### UI/UX

**Page login minimaliste** :
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [Logo FoodQuality]                 │
│                                                 │
│     Système de Qualification Alimentaire       │
│            Temps Réel                           │
│                                                 │
│     ┌─────────────────────────────────┐        │
│     │   [🔐 Se connecter via SSO]    │        │
│     └─────────────────────────────────┘        │
│                                                 │
│     Première connexion ? Contactez votre       │
│     administrateur pour créer un compte        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Modal sélection organisation** (si multi-org) :
```
┌─────────────────────────────────────────────────┐
│ Sélectionnez votre organisation                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚪ 📍 Usine Lyon                               │
│     Production • 24 utilisateurs                │
│                                                 │
│  ⚪ 📍 Site Bordeaux                            │
│     Production • 18 utilisateurs                │
│                                                 │
│  ⚪ 📍 Lab Paris                                │
│     R&D • 6 utilisateurs                        │
│                                                 │
│  □ Se souvenir de mon choix                     │
│                                                 │
│     [Annuler]              [Continuer]          │
└─────────────────────────────────────────────────┘
```

#### Gestion de session

**Token refresh automatique** :
```typescript
// Hook useTokenRefresh
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      // Refresh si expire dans < 70 secondes
      const refreshed = await keycloak.updateToken(70);
      
      if (refreshed) {
        console.log('Token refreshed');
        // Mettre à jour store avec nouveau token
        authStore.setToken(keycloak.token);
      }
    } catch (error) {
      console.error('Failed to refresh token', error);
      // Si refresh échoue, forcer re-login
      keycloak.login();
    }
  }, 60000); // Check toutes les minutes
  
  return () => clearInterval(interval);
}, []);
```

**Logout** :
```typescript
const handleLogout = async () => {
  // Nettoyage local
  authStore.reset();
  organizationStore.reset();
  wsClient.disconnect();
  
  // Logout Keycloak (invalide token serveur)
  await keycloak.logout({
    redirectUri: window.location.origin + '/login'
  });
};
```

**Session timeout** :
```typescript
// Détection inactivité (optionnel)
let inactivityTimer;

const resetInactivityTimer = () => {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Après 30 min d'inactivité
    showModal({
      title: 'Session expirée',
      message: 'Votre session a expiré suite à une inactivité prolongée.',
      onConfirm: () => keycloak.login()
    });
  }, 30 * 60 * 1000);
};

// Reset sur activité user
window.addEventListener('mousemove', resetInactivityTimer);
window.addEventListener('keypress', resetInactivityTimer);
```

#### Accessibilité
- **Navigation clavier** : bouton SSO focusable via Tab
- **Screen reader** : labels ARIA explicites
- **Contraste** : bouton principal avec ratio 4.5:1 minimum
- **Messages d'erreur** : annoncés par screen readers

#### Sécurité
- **PKCE** : Proof Key for Code Exchange activé
- **State parameter** : protection CSRF
- **Nonce** : protection replay attacks
- **Silent refresh** : iframe cachée pour refresh sans interruption
- **Secure cookies** : si tokens stockés en cookie (optionnel)

---

### 3.2 Dashboard Principal (`/dashboard`)

#### Objectif
Vue d'ensemble temps réel de l'état du système et de la production.

#### Sections

**A. Header KPIs** (4 cards horizontales)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Produits    │ Conformité  │ Taux rejet  │ Uptime      │
│ analysés/h  │ 94.5%       │ 5.5%        │ 99.8%       │
│ 847 ↑12%    │ 🟢          │ 🟡          │ 🟢          │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**B. Visualisation temps réel centrale** (50% largeur)
- Stream vidéo ou image du produit analysé
- Overlay : résultat IA en temps réel (label + confiance)
- Bounding box si détection d'anomalie localisée

**C. Graphiques live** (2 colonnes)
- **Gauche** : 
  - Courbe qualité spectrale (10 dernières minutes)
  - Distribution des classifications (pie chart)
- **Droite** :
  - Profil 3D TOF du dernier scan
  - Historique des scores IA (line chart temps réel)

**D. Alertes & Notifications** (sidebar droite)
- Liste des 5 dernières alertes avec timestamp
- Code couleur : critique (rouge), warning (orange), info (bleu)
- Action rapide : "Voir détails", "Marquer comme résolu"

**E. Timeline de production** (footer)
- Barre horizontale : derniers 50 produits analysés
- Code couleur selon conformité
- Clic → détails du scan

#### Interactions
- **Refresh auto** : toutes les 2 secondes
- **Pause stream** : bouton pour figer l'affichage
- **Filtres rapides** : "Dernière heure", "Quart actuel", "Aujourd'hui"
- **Export snapshot** : télécharger état actuel en PDF

#### Données WebSocket
```typescript
interface DashboardUpdate {
  timestamp: number;
  product: {
    id: string;
    classification: string;
    confidence: number;
    qualityScore: number;
  };
  sensors: {
    tof: { distance: number, volume: number };
    as7341: number[]; // 11 canaux
  };
  alerts: Alert[];
}
```

---

### 3.3 Module Capteurs

#### 3.3.1 Page TOF (`/sensors/tof`)

**Objectif** : Analyse morphologique 3D en temps réel

**Layout** :
```
┌────────────────────────────────────────────────────┐
│ Header : TOF VL53L5CX | Status: 🟢 Active         │
├─────────────────┬──────────────────────────────────┤
│                 │                                  │
│  Vue 3D live    │  Métriques temps réel            │
│  (Three.js)     │  • Distance: 245 mm              │
│                 │  • Volume estimé: 127 cm³        │
│  Point cloud    │  • Aire surface: 45 cm²          │
│  avec heatmap   │  • Résolution: 8x8 zones         │
│  de distance    │                                  │
│                 │  Graphique historique distance   │
│                 │  (scrollable, 500 derniers pts)  │
│                 │                                  │
├─────────────────┴──────────────────────────────────┤
│ Contrôles & Calibration                            │
│ [Calibrer] [Exporter données] [Réglages avancés]  │
└────────────────────────────────────────────────────┘
```

**Fonctionnalités avancées** :
- **Modes de visualisation** : 
  - Point cloud 3D rotatif
  - Heatmap 2D (top view)
  - Profil en coupe (side view)
- **Calibration** : assistant step-by-step
- **Seuils d'alerte** : configurables (distance min/max)
- **Enregistrement séquence** : capture 10s de données pour debug

**Données** :
```typescript
interface TOFData {
  timestamp: number;
  matrix: number[][]; // 8x8 distances en mm
  ambient: number;
  signalRate: number[];
  rangeStatus: number[];
}
```

#### 3.3.2 Page AS7341 (`/sensors/as7341`)

**Objectif** : Analyse spectrale multi-canaux

**Layout** :
```
┌────────────────────────────────────────────────────┐
│ Header : AS7341 Spectral | Status: 🟢 Active      │
├────────────────────────────────────────────────────┤
│                                                    │
│  Spectrogramme live (Plotly)                       │
│  ┌──────────────────────────────────────────────┐ │
│  │   Intensité                                   │ │
│  │      ▲                                        │ │
│  │      │     ╱╲                                 │ │
│  │      │    ╱  ╲      ╱╲                        │ │
│  │      │   ╱    ╲    ╱  ╲                       │ │
│  │      │  ╱      ╲  ╱    ╲                      │ │
│  │      └─────────────────────────> λ (nm)       │ │
│  │       415  445  480  515  555  590  630  680  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
├────────────────┬───────────────────────────────────┤
│ Canaux         │  Référence vs Actuel              │
│ F1 (415nm): ██ │  Overlay comparaison avec         │
│ F2 (445nm): ██ │  signature spectrale de           │
│ F3 (480nm): ██ │  référence pour détection         │
│ F4 (515nm): ██ │  d'anomalies (oxydation, etc.)    │
│ F5 (555nm): ██ │                                   │
│ F6 (590nm): ██ │  Écart RMS: 4.2%                  │
│ F7 (630nm): ██ │  Alerte si > 10%                  │
│ F8 (680nm): ██ │                                   │
│ NIR (910nm): █ │                                   │
│ Clear:      ██ │                                   │
│ Flicker:    ── │                                   │
└────────────────┴───────────────────────────────────┘
```

**Fonctionnalités** :
- **Modes d'intégration** : 50ms, 100ms, 500ms (ajustable)
- **Bibliothèque de signatures** : enregistrer/comparer profils spectraux
- **Détection automatique** : alertes si écart > seuil configurable
- **Export données** : CSV avec timestamps
- **Graphique waterfall** : évolution spectrale sur 60s

**Données** :
```typescript
interface AS7341Data {
  timestamp: number;
  channels: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    NIR: number;
    Clear: number;
  };
  flicker: number;
  integrationTime: number;
}
```

---

### 3.4 Module IA

#### 3.4.1 Dashboard IA (`/ai/monitor`)

**Objectif** : Monitoring de l'inférence en temps réel

**Sections** :

**A. Statut du modèle actif**
```
┌────────────────────────────────────────┐
│ Modèle: FoodQuality_v2.3.1             │
│ Architecture: ResNet-50 + Transformer  │
│ Inférences/s: 12.4                     │
│ Latence moy: 47ms                      │
│ Précision (validation): 96.2%          │
└────────────────────────────────────────┘
```

**B. Inférences temps réel** (table)
| Timestamp | Image | Prédiction | Confiance | TOF | Spectral | Statut |
|-----------|-------|------------|-----------|-----|----------|--------|
| 14:32:51 | 🖼️ | Pomme saine | 98.5% | ✓ | ✓ | 🟢 |
| 14:32:50 | 🖼️ | Banane mûre | 87.2% | ✓ | ✓ | 🟢 |
| 14:32:49 | 🖼️ | Orange altérée | 92.1% | ✓ | ⚠️ | 🟡 |

**C. Distribution des prédictions** (pie chart dynamique)

**D. Matrice de confusion** (si ground truth disponible)

**E. Graphiques de performance**
- Latence d'inférence (rolling window 1h)
- Distribution des scores de confiance
- Taux de prédictions par classe

#### 3.4.2 Entraînement IA (`/ai/training`)

**Objectif** : Gérer datasets, entraînements et versions de modèles

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Onglets: [Datasets] [Entraînements] [Modèles]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [TAB: Datasets]                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ Liste des datasets                            │ │
│  │ • FoodQuality_Train_v3 (12,450 samples)       │ │
│  │   └─ Classes: 15 | Période: 2024-10-2025-01  │ │
│  │ • FoodQuality_Validation (3,200 samples)      │ │
│  │ • FoodQuality_Test (1,500 samples)            │ │
│  │                                               │ │
│  │ [+ Créer dataset depuis TimescaleDB]          │ │
│  │ Période: [___] à [___]                        │ │
│  │ Classes: [Toutes ▼]                           │ │
│  │ Filtres: TOF ✓ | AS7341 ✓ | Labels manuels ✓ │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [TAB: Entraînements]                               │
│  ┌───────────────────────────────────────────────┐ │
│  │ Nouvel entraînement                           │ │
│  │ Architecture: [ResNet-50 ▼]                   │ │
│  │ Dataset train: [FoodQuality_Train_v3 ▼]       │ │
│  │ Dataset val: [FoodQuality_Validation ▼]       │ │
│  │ Hyperparamètres:                              │ │
│  │   • Learning rate: [0.001]                    │ │
│  │   • Batch size: [32]                          │ │
│  │   • Epochs: [50]                              │ │
│  │   • Augmentation: ✓                           │ │
│  │                                               │ │
│  │ [Lancer entraînement]                         │ │
│  │                                               │ │
│  │ Historique des entraînements:                 │ │
│  │ Training_20251008_143055 - En cours (epoch 12)│ │
│  │   └─ Loss: 0.342 | Val accuracy: 94.1%       │ │
│  │   └─ [Voir TensorBoard] [Arrêter]            │ │
│  │ Training_20251005_092314 - Terminé ✓          │ │
│  │   └─ Best val accuracy: 96.2% (epoch 43)     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [TAB: Modèles]                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Modèles déployables                           │ │
│  │                                               │ │
│  │ • FoodQuality_v2.3.1 [ACTIF]                  │ │
│  │   ├─ Précision: 96.2%                         │ │
│  │   ├─ F1-Score: 0.954                          │ │
│  │   ├─ Latence: 47ms                            │ │
│  │   └─ [Télécharger] [Métriques détaillées]    │ │
│  │                                               │ │
│  │ • FoodQuality_v2.3.0                          │ │
│  │   ├─ Précision: 95.8%                         │ │
│  │   └─ [Activer] [Comparer] [Supprimer]        │ │
│  │                                               │ │
│  │ A/B Testing:                                  │ │
│  │ [Activer split 80/20 entre v2.3.1 et v2.3.0] │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités clés** :
- **Création datasets intelligente** : requêtes TimescaleDB avec filtres avancés
- **Monitoring entraînement live** : intégration TensorBoard ou graphiques custom
- **Comparaison modèles** : métriques côte à côte, matrice de confusion
- **A/B Testing** : déploiement progressif (canary deployment)
- **MLOps** : versioning automatique, rollback rapide

---

### 3.5 Historique & Analytics (`/history`)

**Objectif** : Explorer et analyser les données historiques

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Filtres avancés                                     │
│ Période: [01/10/25 ▼] - [08/10/25 ▼]              │
│ Classes: [Toutes ▼] Confiance: [> 80% ▼]          │
│ Capteurs: TOF ✓ AS7341 ✓ | Statut: [Tous ▼]       │
│ [Appliquer] [Réinitialiser] [Sauver comme preset] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Résultats: 15,847 analyses                         │
│                                                     │
│  Graphiques analytiques (2x2 grid)                 │
│  ┌─────────────────┬─────────────────────────────┐ │
│  │ Évolution       │ Distribution classes        │ │
│  │ conformité      │ (pie chart)                 │ │
│  │ (line chart)    │                             │ │
│  ├─────────────────┼─────────────────────────────┤ │
│  │ Heatmap         │ Top anomalies détectées     │ │
│  │ horaire         │ (bar chart)                 │ │
│  └─────────────────┴─────────────────────────────┘ │
│                                                     │
│  Timeline interactive                               │
│  ═══════════════════════════════════════════════   │
│  ▮▯▮▮▮▯▮▮▮▮▯▮▮▮▮▮▮▯▮▮▮▮▮▮▯▮▮▮▮▮▮▮▮▮▮▮▮▯▮▮▮▮▮▮   │
│  └─ Zoom, brush pour sélection, clic pour détails  │
│                                                     │
│  Table détaillée (virtualisée, 100 lignes visibles)│
│  [ID] [Timestamp] [Classe] [Conf.] [TOF] [Spec.] […│
│  ───────────────────────────────────────────────── │
│  [Export CSV] [Export PDF rapport] [Partager URL] │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Recherche full-text** : par ID, classe, notes
- **Filtres combinables** : AND/OR logic
- **Presets de filtres** : "Dernières 24h", "Semaine passée", "Anomalies uniquement"
- **Export massif** : CSV, JSON, Excel
- **Génération rapports PDF** : template professionnel avec graphiques
- **Annotations** : ajouter notes sur analyses spécifiques
- **Comparaison** : sélectionner 2+ analyses et les comparer côte à côte

**Optimisations** :
- **Virtualisation** : react-window pour tables longues
- **Pagination côté serveur** : charger par chunks de 100
- **Debounce** : recherche avec délai 300ms

---

### 3.6 Génération de Rapports (`/reports`)

**Objectif** : Créer, personnaliser et exporter des rapports automatisés pour analyse qualité et conformité

**Accès** : super_admin, org_admin, quality_manager, data_analyst

#### Layout principal

```
┌─────────────────────────────────────────────────────┐
│ Génération de Rapports                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Onglets: [📊 Nouveau] [📁 Mes rapports] [⏰ Planifiés] [📚 Templates] │
│                                                     │
│  [TAB: Nouveau Rapport]                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1️⃣ Type de rapport                          │   │
│  │ ⚪ Rapport de production                     │   │
│  │    └─ Analyses, conformité, rejets          │   │
│  │ ⚪ Rapport qualité détaillé                  │   │
│  │    └─ Spectres, TOF, tendances              │   │
│  │ ⚪ Performance capteurs                      │   │
│  │    └─ Santé hardware, calibration           │   │
│  │ ⚪ Performance IA                            │   │
│  │    └─ Métriques modèle, inférences          │   │
│  │ ⚪ Rapport d'audit                           │   │
│  │    └─ Logs, actions utilisateurs            │   │
│  │ ⚪ Rapport personnalisé                      │   │
│  │    └─ Sélection manuelle sections           │   │
│  │                                             │   │
│  │ 2️⃣ Période                                  │   │
│  │ ◉ Période fixe                              │   │
│  │   Du: [01/10/2025] Au: [08/10/2025]        │   │
│  │ ⚪ Dernier(s): [7 ▼] [jours ▼]             │   │
│  │ ⚪ Quart de travail: [Matin ▼] [Hier ▼]    │   │
│  │                                             │   │
│  │ 3️⃣ Organisation(s)                          │   │
│  │ ☑ Usine Lyon                                │   │
│  │ ☑ Site Bordeaux                             │   │
│  │ ☐ Lab Paris                                 │   │
│  │ [Sélectionner tout] [Comparer sites]        │   │
│  │                                             │   │
│  │ 4️⃣ Filtres additionnels (optionnel)        │   │
│  │ Classes produits: [Toutes ▼]                │   │
│  │ Plage confiance IA: [80% - 100%]           │   │
│  │ Statut: [Conforme] [Non-conforme] [Tous]   │   │
│  │                                             │   │
│  │ 5️⃣ Sections à inclure (personnalisé)       │   │
│  │ ☑ Résumé exécutif                           │   │
│  │ ☑ KPIs principaux                           │   │
│  │ ☑ Graphiques évolution                      │   │
│  │ ☑ Analyse statistique                       │   │
│  │ ☑ Détails anomalies                         │   │
│  │ ☑ Recommandations                           │   │
│  │ ☐ Données brutes (annexe)                   │   │
│  │ ☐ Signatures spectrales                     │   │
│  │                                             │   │
│  │ 6️⃣ Format d'export                          │   │
│  │ ◉ PDF (recommandé)                          │   │
│  │ ⚪ Excel (.xlsx) avec onglets               │   │
│  │ ⚪ PowerPoint (.pptx) présentation          │   │
│  │ ⚪ CSV (données uniquement)                 │   │
│  │                                             │   │
│  │ Options PDF:                                │   │
│  │ ☑ Inclure logo organisation                 │   │
│  │ ☑ Page de garde                             │   │
│  │ ☑ Table des matières                        │   │
│  │ ☑ Numérotation pages                        │   │
│  │ Template: [Standard ▼] [Custom disponibles] │   │
│  │                                             │   │
│  │ 7️⃣ Actions                                  │   │
│  │ Titre: [Rapport Qualité S41-2025_________] │   │
│  │ [Aperçu] [Générer maintenant] [Planifier]  │   │
│  │                                             │   │
│  │ ⏱️ Temps estimé: ~45 secondes               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### TAB: Mes rapports

```
┌─────────────────────────────────────────────────────┐
│ Mes Rapports (47 rapports)                          │
│ Recherche: [🔍 _____] Tri: [Plus récent ▼]        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Liste des rapports générés                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 Rapport Qualité S41-2025                 │   │
│  │    Production • 01-08/10/2025 • Usine Lyon  │   │
│  │    Généré le: 08/10/2025 14:32              │   │
│  │    Généré par: Marie Dupont                 │   │
│  │    Taille: 2.4 MB • 24 pages                │   │
│  │    [👁️ Prévisualiser] [⬇️ Télécharger]      │   │
│  │    [📧 Partager] [🗑️ Supprimer]             │   │
│  │                                             │   │
│  │    Tags: #hebdomadaire #production          │   │
│  │    Commentaire: RAS, bonne conformité       │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📊 Performance Capteurs - Septembre         │   │
│  │    Technique • 01-30/09/2025 • Multi-sites  │   │
│  │    Généré le: 01/10/2025 09:15              │   │
│  │    [👁️] [⬇️] [📧] [📋 Dupliquer] [🗑️]     │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📈 Analyse IA - Q3 2025                     │   │
│  │    IA • 01/07-30/09/2025 • Tous sites       │   │
│  │    Généré le: 30/09/2025 18:45              │   │
│  │    [👁️] [⬇️] [📧] [🗑️]                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Export archives] [Paramètres de rétention]       │
└─────────────────────────────────────────────────────┘
```

#### TAB: Rapports planifiés

```
┌─────────────────────────────────────────────────────┐
│ Rapports Planifiés (5 actifs)                       │
│ [+ Nouveau rapport planifié]                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟢 Rapport Hebdomadaire Production          │   │
│  │    Type: Production • Format: PDF           │   │
│  │    Fréquence: Tous les lundis à 08:00       │   │
│  │    Organisation: Usine Lyon                 │   │
│  │    Destinataires:                           │   │
│  │      • marie.dupont@mail.com                │   │
│  │      • jean.martin@mail.com                 │   │
│  │    Prochain: Lundi 14/10/2025 08:00         │   │
│  │    [Modifier] [Désactiver] [Exécuter maintenant] │
│  ├─────────────────────────────────────────────┤   │
│  │ 🟢 Rapport Mensuel Direction                │   │
│  │    Type: Personnalisé • Format: PowerPoint  │   │
│  │    Fréquence: 1er du mois à 06:00           │   │
│  │    Multi-sites (comparatif)                 │   │
│  │    Prochain: 01/11/2025 06:00               │   │
│  │    [Modifier] [Désactiver]                  │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 🔴 Rapport Audit Trimestriel (désactivé)   │   │
│  │    Type: Audit • Format: PDF                │   │
│  │    Fréquence: Fin de trimestre              │   │
│  │    [Modifier] [Activer] [Supprimer]         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### TAB: Templates

```
┌─────────────────────────────────────────────────────┐
│ Bibliothèque de Templates                           │
│ [+ Créer template personnalisé]                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Templates standards                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📋 Production Standard                       │   │
│  │    Sections: KPIs, Conformité, Rejets       │   │
│  │    Utilisé: 142 fois                        │   │
│  │    [Utiliser] [Aperçu] [Dupliquer]          │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📊 Qualité Détaillée                        │   │
│  │    Sections: Spectres, TOF, Tendances       │   │
│  │    Utilisé: 87 fois                         │   │
│  │    [Utiliser] [Aperçu] [Dupliquer]          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Mes templates personnalisés (3)                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 Rapport Direction Lyon                   │   │
│  │    Créé le: 15/09/2025 • Modifié: 02/10/25 │   │
│  │    [Utiliser] [Modifier] [Supprimer]        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### Fonctionnalités avancées

**1. Aperçu en temps réel**
- Modal avec preview du rapport
- Navigation entre sections
- Possibilité d'ajuster avant génération finale

**2. Génération asynchrone**
```typescript
// Flow génération rapport
interface ReportGenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;           // 0-100
  estimatedTime: number;      // secondes
  resultUrl?: string;         // URL de téléchargement
  error?: string;
}

// 1. User lance génération
const response = await api.post('/api/reports/generate', reportConfig);
// { job_id: 'uuid-xxxx', status: 'queued' }

// 2. Polling status ou WebSocket
const jobId = response.data.job_id;
const interval = setInterval(async () => {
  const status = await api.get(`/api/reports/jobs/${jobId}`);
  
  if (status.data.status === 'completed') {
    clearInterval(interval);
    // Afficher lien téléchargement
    showNotification('Rapport prêt !', { 
      downloadUrl: status.data.result_url 
    });
  }
}, 2000);

// Alternative WebSocket
ws.on(`report:${jobId}`, (data) => {
  updateProgress(data.progress);
  if (data.status === 'completed') {
    showDownloadLink(data.result_url);
  }
});
```

**3. Backend Django - Génération rapports**

```python
# views.py (DRF)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .tasks import generate_report_task
from .models import Report, ReportJob
from .serializers import ReportConfigSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_report(request):
    """Créer une tâche Celery pour génération asynchrone"""
    serializer = ReportConfigSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # Créer job
    job = ReportJob.objects.create(
        user=request.user,
        organization=request.user.organization,
        config=serializer.validated_data,
        status='queued'
    )
    
    # Lancer tâche Celery
    task = generate_report_task.delay(job.id)
    
    return Response({
        'job_id': str(job.id),
        'status': 'queued',
        'task_id': task.id
    }, status=202)

# tasks.py (Celery)
from celery import shared_task
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
# ... autres imports

@shared_task(bind=True)
def generate_report_task(self, job_id):
    """Génération rapport en background"""
    job = ReportJob.objects.get(id=job_id)
    
    try:
        job.status = 'processing'
        job.save()
        
        # Récupérer données depuis TimescaleDB
        data = fetch_report_data(job.config)
        
        # Générer PDF avec ReportLab ou WeasyPrint
        pdf_buffer = generate_pdf(data, job.config)
        
        # Sauvegarder fichier
        filename = f"report_{job.id}.pdf"
        job.result_file.save(filename, ContentFile(pdf_buffer.getvalue()))
        
        job.status = 'completed'
        job.progress = 100
        job.save()
        
        # Notification WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_{job.user.id}',
            {
                'type': 'report_completed',
                'job_id': str(job.id),
                'download_url': job.result_file.url
            }
        )
        
    except Exception as e:
        job.status = 'failed'
        job.error = str(e)
        job.save()
        raise
```

**4. Types de rapports prédéfinis**

| Type | Sections principales | Durée génération |
|------|---------------------|------------------|
| **Production** | KPIs, Conformité, Timeline, Top rejets | ~30s |
| **Qualité Détaillée** | Spectres, TOF 3D, Statistiques, Anomalies | ~60s |
| **Performance Capteurs** | Santé hardware, Calibration, Dérives | ~20s |
| **Performance IA** | Métriques modèle, Confusion matrix, Latence | ~40s |
| **Audit** | Logs actions, Changements config, Accès | ~25s |
| **Comparatif Multi-sites** | Benchmark sites, Classements, Écarts | ~90s |

**5. Personnalisation template (éditeur visuel)**

```
┌─────────────────────────────────────────────────────┐
│ Éditeur de Template                                 │
├─────────────────────────────────────────────────────┤
│ Glisser-déposer sections:                           │
│                                                     │
│ Disponibles:          │  Rapport (ordre):           │
│ ┌──────────────┐      │  1. [≡] Résumé exécutif    │
│ │ 📊 Graphiques│      │  2. [≡] KPIs principaux    │
│ │ 📈 KPIs      │  =>  │  3. [≡] Graphique temps    │
│ │ 📋 Tables    │      │  4. [≡] Table anomalies    │
│ │ 🔬 Spectres  │      │  5. [≡] Recommandations    │
│ │ 🎯 Heatmap   │      │                             │
│ └──────────────┘      │  [+ Ajouter section]        │
│                       │                             │
│ Styles:               │  Aperçu:                    │
│ Police: [Inter ▼]     │  [Miniature PDF]            │
│ Couleur: [🎨 #3b82f6]│                             │
│ Logo: [📁 Upload]     │                             │
│                                                     │
│ [Annuler] [Enregistrer comme template]              │
└─────────────────────────────────────────────────────┘
```

**6. Partage de rapports**

```typescript
interface ReportShare {
  reportId: string;
  recipients: string[];        // emails
  message?: string;
  expiresAt?: Date;            // lien temporaire
  requireAuth: boolean;        // authentification requise
}

// Modal partage
const ShareReportModal = ({ reportId }) => {
  return (
    <Modal>
      <h3>Partager le rapport</h3>
      <Input 
        type="email" 
        placeholder="Email destinataire"
        multiple
      />
      <Textarea placeholder="Message (optionnel)" />
      <Checkbox label="Expirer après 7 jours" />
      <Checkbox label="Nécessite authentification" defaultChecked />
      <Button onClick={handleShare}>Envoyer par email</Button>
      <Button onClick={generatePublicLink}>
        Générer lien de partage
      </Button>
    </Modal>
  );
};
```

**7. Archive et rétention**

- **Archivage automatique** : rapports > 90 jours vers stockage froid (S3 Glacier, etc.)
- **Politique de rétention** : configurable par org (365 jours par défaut)
- **Compression** : ZIP pour rapports multiples
- **Signature numérique** : intégrité des rapports critiques (audit)

#### API Endpoints Django

```python
# urls.py
urlpatterns = [
    # Génération
    path('api/reports/generate/', views.generate_report),
    path('api/reports/jobs/<uuid:job_id>/', views.get_job_status),
    
    # CRUD rapports
    path('api/reports/', views.list_reports),
    path('api/reports/<uuid:report_id>/', views.get_report),
    path('api/reports/<uuid:report_id>/download/', views.download_report),
    path('api/reports/<uuid:report_id>/share/', views.share_report),
    
    # Planification
    path('api/reports/scheduled/', views.list_scheduled_reports),
    path('api/reports/scheduled/<uuid:schedule_id>/', views.update_schedule),
    
    # Templates
    path('api/reports/templates/', views.list_templates),
    path('api/reports/templates/<uuid:template_id>/', views.get_template),
]
```

#### Types TypeScript

```typescript
interface ReportConfig {
  type: 'production' | 'quality' | 'sensors' | 'ai' | 'audit' | 'custom';
  title: string;
  period: {
    start: Date;
    end: Date;
  } | {
    relative: 'last_7_days' | 'last_month' | 'current_quarter';
  };
  organizations: string[];      // UUIDs
  filters?: {
    productClasses?: string[];
    confidenceMin?: number;
    status?: 'conforming' | 'non_conforming' | 'all';
  };
  sections: ReportSection[];
  format: 'pdf' | 'xlsx' | 'pptx' | 'csv';
  options?: {
    includeLogo?: boolean;
    includeCover?: boolean;
    includeToC?: boolean;
    template?: string;          // UUID du template
  };
}

interface ReportSection {
  type: 'executive_summary' | 'kpis' | 'charts' | 'statistics' | 
        'anomalies' | 'recommendations' | 'raw_data' | 'spectra';
  config?: Record<string, any>;
}

interface ScheduledReport {
  id: string;
  reportConfig: ReportConfig;
  frequency: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;               // HH:MM
    dayOfWeek?: number;         // 1-7 (lundi-dimanche)
    dayOfMonth?: number;        // 1-31
  };
  recipients: string[];
  isActive: boolean;
  nextRun: Date;
  createdBy: string;
}
```

---

### 3.7 Système & Maintenance

#### 3.7.1 Santé du système (`/system/health`)

**Objectif** : Monitoring hardware et software

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Vue d'ensemble - Statut: 🟢 Opérationnel           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Capteurs                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ TOF VL53L5CX                                │   │
│  │ Status: 🟢 | Température: 42°C | FPS: 15   │   │
│  │ Dernier calibrage: Il y a 3 jours          │   │
│  │ [Tester] [Recalibrer]                       │   │
│  │                                             │   │
│  │ AS7341 Spectral                             │   │
│  │ Status: 🟢 | Température: 38°C              │   │
│  │ Qualité signal: Excellent (SNR: 42dB)      │   │
│  │ [Tester] [Réglages]                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Système                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ • CPU: 45% ████████░░░░░░░░░               │   │
│  │ • RAM: 2.1GB / 4GB ███████░░░░░░░          │   │
│  │ • Disque: 12GB / 32GB ██████░░░░░░░        │   │
│  │ • Température CPU: 58°C                     │   │
│  │ • Uptime: 14j 7h 23m                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Réseau & Backend                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ • API Backend: 🟢 (latence: 23ms)          │   │
│  │ • TimescaleDB: 🟢 (9,847,234 enregistr.)   │   │
│  │ • WebSocket: 🟢 (12 clients connectés)     │   │
│  │ • Moteur IA: 🟢 (GPU usage: 67%)           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Logs système (live, 50 dernières lignes)          │
│  ┌─────────────────────────────────────────────┐   │
│  │ [INFO] 14:42:15 - Analyse #15847 terminée  │   │
│  │ [WARN] 14:42:10 - Signal AS7341 faible     │   │
│  │ [INFO] 14:42:05 - Analyse #15846 terminée  │   │
│  │ ...                                         │   │
│  └─────────────────────────────────────────────┘   │
│  Filtres: [Tous ▼] [Rechercher...]                 │
│  [Télécharger logs complets] [Archiver anciens]    │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Tests diagnostics** : boutons pour tester chaque capteur individuellement
- **Graphiques historiques** : CPU/RAM/Temp sur 24h
- **Alertes configurables** : seuils pour temp, CPU, espace disque
- **Logs en temps réel** : WebSocket stream, filtres par niveau (INFO, WARN, ERROR)
- **Export logs** : téléchargement avec date range

#### 3.7.2 Firmware OTA (`/system/firmware`)

**Objectif** : Gestion des mises à jour firmware

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Gestion du Firmware OTA                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Version actuelle                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firmware: v3.2.1                            │   │
│  │ Date de déploiement: 2025-09-28             │   │
│  │ Statut: ✓ Stable                            │   │
│  │ Changelog: [Voir détails]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Nouvelle mise à jour disponible                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firmware: v3.3.0                            │   │
│  │ Taille: 2.4 MB                              │   │
│  │ Release notes:                              │   │
│  │ • Amélioration stabilité capteur TOF        │   │
│  │ • Optimisation consommation AS7341          │   │
│  │ • Correctif bug #234                        │   │
│  │                                             │   │
│  │ Upload manuel:                              │   │
│  │ [Choisir fichier .bin] [Uploader]           │   │
│  │                                             │   │
│  │ ⚠️ Attention: arrêt système 2-3 minutes    │   │
│  │                                             │   │
│  │ Options:                                    │   │
│  │ □ Sauvegarder config actuelle               │   │
│  │ ✓ Rollback auto si échec                    │   │
│  │ ✓ Vérifier MD5 checksum                     │   │
│  │                                             │   │
│  │ Planifier: [Maintenant ▼]                   │   │
│  │ [Déployer firmware v3.3.0]                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Historique des déploiements                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ v3.2.1 - 2025-09-28 - Succès ✓             │   │
│  │ v3.2.0 - 2025-08-15 - Succès ✓             │   │
│  │ v3.1.5 - 2025-07-03 - Rollback (erreur)    │   │
│  │ v3.1.4 - 2025-06-22 - Succès ✓             │   │
│  │ [Voir tous]                                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Upload sécurisé** : validation format, checksum MD5
- **Planification** : déploiement immédiat ou programmé
- **Progress bar** : upload + flashing en temps réel
- **Rollback automatique** : si device ne répond pas après 5 min
- **Historique versioning** : traçabilité complète
- **Backup config** : sauvegarder paramètres avant MAJ

---

### 3.8 Notifications & Support (`/notifications`, `/support`)

#### Notifications
- **Centre de notifications** : dropdown dans header
- **Types** : Système, Alertes qualité, IA, Maintenance
- **Actions** : Marquer comme lu, Archiver, Aller à la source
- **Préférences** : activer/désactiver par catégorie
- **Push notifications** : si supporté par navigateur

#### Support / Bug report
**Formulaire structuré** :
```
Titre: [_________________]
Type: [Bug ▼] [Feature request] [Question]
Priorité: [Basse ▼] [Moyenne] [Haute] [Critique]
Description: [____________]
Reproduire: [____________]
Logs auto-attachés: ✓
Screenshot: [Upload]
[Envoyer]
```

---

### 3.9 Administration (`/admin`)

**Accès réservé** : super_admin, org_admin (pour leur org uniquement)

#### 3.9.1 Gestion des utilisateurs (`/admin/users`)

**Objectif** : CRUD utilisateurs et attribution rôles

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Gestion des Utilisateurs                            │
│ Organisation: [Usine Lyon ▼] (org_admin uniquement) │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [+ Inviter utilisateur]  [Import CSV]              │
│                                                     │
│ Recherche: [🔍 Nom, email...] Rôle: [Tous ▼]      │
│                                                     │
│  Liste des utilisateurs (24)                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Avatar │ Nom & Email │ Rôles │ Statut │ …   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Marie Dupont          │ 🟢 Actif │   │   │
│  │       │ marie.dupont@mail.com │          │   │   │
│  │       │ Rôles: quality_manager │         │   │   │
│  │       │ Dernière connexion: Il y a 2h   │   │   │
│  │       │ [Modifier] [Désactiver] [Logs]  │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Jean Martin           │ 🟢 Actif │   │   │
│  │       │ jean.martin@mail.com  │          │   │   │
│  │       │ Rôles: operator       │          │   │   │
│  │       │ [Modifier] [Désactiver]         │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Sophie Bernard        │ 🔴 Inactif│  │   │
│  │       │ sophie.b@mail.com     │          │   │   │
│  │       │ Rôles: data_analyst   │          │   │   │
│  │       │ [Modifier] [Réactiver]          │   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Pagination: ← 1 2 3 4 →                           │
└─────────────────────────────────────────────────────┘
```

**Modal "Inviter utilisateur"** :
```typescript
interface InviteUserForm {
  email: string;              // Requis
  firstName: string;
  lastName: string;
  roles: string[];            // Multi-select
  organizations: string[];    // Si super_admin
  sendInviteEmail: boolean;   // ✓ par défaut
}

// Workflow:
// 1. Admin remplit formulaire
// 2. Backend crée user dans Keycloak (avec temporary password)
// 3. Email invitation envoyé avec lien reset password
// 4. User clique lien, définit son password, se connecte
```

**Modal "Modifier utilisateur"** :
- Changer rôles (avec confirmation si retrait privilèges)
- Ajouter/retirer organisations
- Activer/désactiver compte
- Forcer reset password

**Permissions** :
- **org_admin** : gère uniquement les users de son org
- **super_admin** : gère tous les users, toutes les orgs

#### 3.9.2 Gestion des organisations (détails)

Voir section 2.3 pour layout complet.

**Features additionnelles** :
- **Statistiques par org** : nb analyses, conformité, uptime
- **Quotas** : limite d'analyses/jour (si nécessaire)
- **API keys** : générer clés API pour intégrations externes
- **Webhooks** : configurer URLs de notification externes
- **White-labeling** : logo custom, couleurs (feature avancée)

#### 3.9.3 Logs d'audit (`/admin/audit`)

**Objectif** : Traçabilité des actions sensibles

**Events trackés** :
```typescript
enum AuditEventType {
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_CREATED = 'user.created',
  USER_ROLE_CHANGED = 'user.role_changed',
  ORG_CREATED = 'org.created',
  ORG_SETTINGS_UPDATED = 'org.settings_updated',
  FIRMWARE_DEPLOYED = 'firmware.deployed',
  AI_MODEL_DEPLOYED = 'ai.model_deployed',
  DATA_EXPORTED = 'data.exported',
  SENSOR_CALIBRATED = 'sensor.calibrated',
}

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  organizationId: string;
  eventType: AuditEventType;
  details: Record<string, any>;  // JSON avec contexte
  ipAddress: string;
  userAgent: string;
}
```

**Interface** :
```
┌─────────────────────────────────────────────────────┐
│ Logs d'Audit                                        │
├─────────────────────────────────────────────────────┤
│ Période: [Dernières 24h ▼]  Type: [Tous ▼]        │
│ Organisation: [Toutes ▼]  User: [Tous ▼]          │
│ [Appliquer filtres]  [Export CSV]                  │
│                                                     │
│  Table des logs (virtualisée)                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Time│User│Org│Event│Details│IP│         │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:32│Marie│Lyon│firmware.deployed│       │   │   │
│  │     │     │    │v3.3.0→v3.3.1 ✓│xxx.xxx│   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:28│Jean │Lyon│user.role_changed│       │   │   │
│  │     │     │    │operator→quality_manager│   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:15│Sophie│Bor│data.exported│           │   │   │
│  │     │      │   │15847 rows, CSV│xxx.xxx │   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Rétention: 2 ans selon ISO 27001                  │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 4. Design System

### 4.1 Palette de couleurs

#### Mode sombre (défaut)
```css
--bg-primary: #0a0e1a;        /* Fond principal */
--bg-secondary: #141824;      /* Cards, panels */
--bg-tertiary: #1e2433;       /* Hover states */

--text-primary: #e4e7ec;      /* Texte principal */
--text-secondary: #9da3ae;    /* Texte secondaire */
--text-muted: #6b7280;        /* Labels */

--accent-blue: #3b82f6;       /* Liens, info */
--accent-green: #10b981;      /* Succès, conformité */
--accent-yellow: #f59e0b;     /* Warnings */
--accent-red: #ef4444;        /* Erreurs, alertes */
--accent-purple: #8b5cf6;     /* IA, spectral */

--border: #2d3748;            /* Bordures */
--shadow: rgba(0, 0, 0, 0.3); /* Ombres */
```

#### Mode clair (optionnel)
```css
--bg-primary: #f9fafb;
--bg-secondary: #ffffff;
--text-primary: #111827;
--accent-blue: #2563eb;
/* ... */
```

### 4.2 Typographie

```css
/* Famille */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Tailles */
--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */

/* Poids */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 4.3 Espacements & Layout

```css
--spacing-unit: 0.25rem; /* 4px */

--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */

--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-full: 9999px;
```

### 4.4 Composants UI de base

#### Boutons
```
[Primary]   - Accent blue, bold
[Secondary] - Border white, transparent bg
[Danger]    - Accent red
[Success]   - Accent green
[Ghost]     - Transparent, hover bg-tertiary

États: default | hover | active | disabled | loading
```

#### Cards
```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: 0 1px 3px var(--shadow);
}

.card-header {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-4);
}
```

#### Badges (status)
```
🟢 Active   - green bg
🟡 Warning  - yellow bg
🔴 Critical - red bg
🔵 Info     - blue bg
⚪ Inactive - gray bg
```

#### Inputs & Forms
```
- Border: 1px, focus: 2px accent-blue
- Height: 40px (base), 32px (small), 48px (large)
- Validation: border red + message sous input
- Labels: font-medium, text-sm, mb-2
```

---

## 🔧 5. Exigences techniques

### 5.1 Performance

#### Temps de chargement
- **Initial load** : < 3 secondes (3G)
- **Changement page** : < 500ms
- **Mise à jour temps réel** : < 200ms

#### Optimisations
- **Code splitting** : lazy loading des pages
- **Tree shaking** : éliminer code non utilisé
- **Image optimization** : WebP, lazy loading
- **Memoization** : React.memo, useMemo, useCallback
- **Virtual scrolling** : tables > 100 lignes

### 5.2 Sécurité

- **Authentification** : JWT avec refresh token
- **HTTPS uniquement** : force SSL
- **CSP headers** : Content Security Policy
- **XSS protection** : sanitize user inputs
- **CSRF tokens** : pour mutations
- **Rate limiting** : protéger API
- **Logs audit** : tracer actions critiques

### 5.3 Accessibilité (WCAG 2.1 AA)

- **Contraste** : minimum 4.5:1 (texte normal)
- **Navigation clavier** : tous éléments accessibles via Tab
- **ARIA labels** : sur tous composants interactifs
- **Focus visible** : outline clair
- **Messages d'erreur** : associés aux champs (aria-describedby)
- **Alternative text** : sur images/graphiques

### 5.4 Responsive design

**Breakpoints** :
```
sm: 640px   (tablette portrait)
md: 768px   (tablette landscape)
lg: 1024px  (desktop)
xl: 1280px  (desktop large)
2xl: 1536px (ultra-wide)
```

**Priorité** : Desktop first (1920x1080), puis tablette (1024x768)

### 5.5 Tests

#### Tests unitaires (Jest + RTL)
- **Couverture** : > 70% du code
- **Composants** : tous testés avec snapshots
- **Hooks custom** : tests dédiés
- **Utils** : 100% couverture

#### Tests E2E (Playwright)
- **User flows critiques** :
  - Login → Dashboard → Analyse produit
  - Création dataset → Entraînement IA
  - Export données historique
  - Upload firmware OTA
- **Tests cross-browser** : Chrome, Firefox, Edge

#### Tests d'intégration
- **API mocking** : MSW (Mock Service Worker)
- **WebSocket mocking** : mock socket.io

---

## 📦 6. Livrables attendus

### Phase 1 : Foundation (3-4 semaines)
- ✅ Setup projet (Vite + React + TS + Tailwind)
- ✅ Architecture dossiers
- ✅ Design system (composants de base)
- ✅ **Intégration Keycloak SSO**
  - Configuration client frontend
  - ProtectedRoute component
  - Hooks useAuth, usePermissions
  - Gestion tokens & refresh
- ✅ **Gestion multi-organisation**
  - Store organizationStore
  - Sélecteur d'organisation (Header)
  - Context isolation
- ✅ Layout principal (Sidebar, Header avec sélecteur org)
- ✅ Routing avec protection par rôles

### Phase 2 : Core Features (4-5 semaines)
- ✅ Dashboard temps réel (WebSocket Django Channels)
- ✅ Pages capteurs (TOF + AS7341)
- ✅ Module IA - Monitoring
- ✅ Historique & filtres (avec isolation par org)
- ✅ **Matrice de permissions**
  - Affichage conditionnel selon rôles
  - Restrictions API selon org_id
- ✅ **Intégration backend Django**
  - Endpoints DRF configurés
  - WebSocket Channels fonctionnel
  - Tests API E2E

### Phase 3 : Advanced Features (5-6 semaines)
- ✅ Entraînement IA
- ✅ **Module Rapports complet**
  - Génération rapports (PDF, Excel, PPTX)
  - Templates personnalisables
  - Planification automatique (Celery)
  - Partage et archivage
- ✅ Système & santé
- ✅ Firmware OTA
- ✅ Notifications
- ✅ **Module Administration**
  - Gestion utilisateurs
  - Gestion organisations (super_admin)
  - Logs d'audit
  - Invitation users via Keycloak

### Phase 4 : Polish & Testing (2-3 semaines)
- ✅ Tests E2E complets (avec scénarios multi-org)
- ✅ Tests permissions & RBAC
- ✅ Optimisations performance
- ✅ Documentation (Storybook)
- ✅ Déploiement CI/CD
- ✅ **Tests sécurité**
  - Validation isolation données
  - Tests CSRF/XSS
  - Audit Keycloak config

### Documentation
- **README.md** : setup, architecture, conventions
- **CONTRIBUTING.md** : guidelines pour devs
- **API_INTEGRATION.md** : specs API backend + contrats Keycloak
- **DJANGO_SETUP.md** : configuration backend Django, Channels, Celery
- **KEYCLOAK_SETUP.md** : configuration realm, roles, clients
- **DEPLOYMENT.md** : procédure de déploiement (frontend + backend + Keycloak)
- **PERMISSIONS_MATRIX.md** : tableau complet rôles/permissions
- **REPORTS_GUIDE.md** : guide création templates et rapports personnalisés
- **Storybook** : documentation composants interactifs
- **MULTIORG_GUIDE.md** : guide gestion multi-organisation

### Checklist de sécurité pré-production
- [ ] Keycloak configuré avec HTTPS uniquement
- [ ] Django SECRET_KEY sécurisée (> 50 caractères)
- [ ] Django DEBUG=False en production
- [ ] ALLOWED_HOSTS correctement configuré
- [ ] CORS configuré strictement (pas de wildcard)
- [ ] Django CSRF protection activée
- [ ] Refresh tokens stockés en httpOnly cookies (si applicable)
- [ ] Rate limiting activé sur API (django-ratelimit)
- [ ] CSP headers configurés
- [ ] Audit de toutes les permissions RBAC
- [ ] Tests d'isolation multi-org validés
- [ ] Logs d'audit fonctionnels
- [ ] Celery workers sécurisés (pas de code arbitraire)
- [ ] Redis protégé par password
- [ ] Backup/restore procedure documentée
- [ ] Plan de rollback firmware/IA testé
- [ ] SQL injection tests (ORM Django protège mais vérifier raw queries)
- [ ] Static files servis via CDN/nginx (pas Django en prod)

---

## 🚀 7. Points d'attention & Best practices

### Gestion d'état
- **Données temps réel** : WebSocket → Zustand store
- **Cache API** : TanStack Query (staleTime, refetchInterval)
- **Optimistic updates** : UX fluide sur mutations

### Gestion des erreurs
- **Boundaries** : React Error Boundary par section
- **Toast notifications** : pour erreurs non-critiques
- **Modal erreur** : pour erreurs bloquantes
- **Retry logic** : sur échecs réseau

### WebSocket best practices
- **Reconnexion auto** : exponentiel backoff
- **Heartbeat** : ping/pong toutes les 30s
- **Buffer messages** : pendant déconnexion
- **Cleanup** : close socket on unmount

### Performance monitoring
- **Web Vitals** : LCP, FID, CLS
- **Custom metrics** : temps inférence IA, lag WebSocket
- **Error tracking** : Sentry ou équivalent

---

## 📞 8. Contact & Support

**Questions techniques** :  
[Insérer contact tech lead]

**Accès services** :

**Backend Django** :
- DEV: `http://localhost:8000`
- STAGING: `https://api-staging.foodquality.local`
- PROD: `https://api.foodquality.local`
- Documentation: `/api/docs/` (drf-spectacular/Swagger)
- Django Admin: `/admin/` (gestion DB directe)

**Django Channels (WebSocket)** :
- DEV: `ws://localhost:8000/ws/`
- STAGING: `wss://api-staging.foodquality.local/ws/`
- PROD: `wss://api.foodquality.local/ws/`

**Keycloak (SSO)** :
- DEV: `http://localhost:8080`
- STAGING: `https://auth-staging.foodquality.local`
- PROD: `https://auth.foodquality.local`
- Admin Console: `/admin`
- Realm: `FoodQuality`

**Redis (Cache + Celery + Channels)** :
- DEV: `redis://localhost:6379/0`
- PROD: Cluster Redis (géré par infra)

**Celery (Tâches asynchrones)** :
- Worker: génération rapports, entraînement IA
- Beat: planification rapports automatiques
- Flower (monitoring): `http://localhost:5555`

**TimescaleDB** :
- Accès via Django ORM uniquement (pas d'accès direct frontend)

**Environnements Frontend** :  
- DEV: `http://localhost:5173`
- STAGING: `https://staging.foodquality.local`
- PROD: `https://app.foodquality.local`

---

## 🔐 9. Configuration des variables d'environnement

**Fichier `.env.development`** :
```bash
# Keycloak
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=FoodQuality
VITE_KEYCLOAK_CLIENT_ID=foodquality-frontend

# API Backend Django
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws

# Features flags
VITE_ENABLE_MULTIORG=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_WHITE_LABEL=false
VITE_ENABLE_REPORTS=true

# Monitoring (optionnel)
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

**Fichier `.env.production`** :
```bash
# Keycloak
VITE_KEYCLOAK_URL=https://auth.foodquality.local
VITE_KEYCLOAK_REALM=FoodQuality
VITE_KEYCLOAK_CLIENT_ID=foodquality-frontend

# API Backend Django
VITE_API_URL=https://api.foodquality.local
VITE_WS_URL=wss://api.foodquality.local/ws

# Features
VITE_ENABLE_MULTIORG=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_WHITE_LABEL=true
VITE_ENABLE_REPORTS=true

# Monitoring
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_ANALYTICS_ID=G-XXXXXXXXXX
```

**Usage dans le code** :
```typescript
// src/config/env.ts
export const config = {
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL,
    wsUrl: import.meta.env.VITE_WS_URL,
  },
  features: {
    multiOrg: import.meta.env.VITE_ENABLE_MULTIORG === 'true',
    auditLogs: import.meta.env.VITE_ENABLE_AUDIT_LOGS === 'true',
    whiteLabel: import.meta.env.VITE_ENABLE_WHITE_LABEL === 'true',
  },
};
```

---

## 📚 10. Ressources complémentaires

**Documentation** :
- Keycloak: https://www.keycloak.org/docs/latest/
- React: https://react.dev/
- TailwindCSS: https://tailwindcss.com/docs
- Recharts: https://recharts.org/
- Three.js: https://threejs.org/docs/
- TanStack Query: https://tanstack.com/query/

**Outils recommandés** :
- **VS Code** avec extensions :
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript + JavaScript
- **Postman/Insomnia** : tester API backend
- **React DevTools** : debugging
- **Redux DevTools** : si utilisation Redux (sinon Zustand DevTools)

---

**Document version 1.2 - Octobre 2025**  
*Dernière mise à jour : Intégration backend Django + Module de génération de rapports*

**Changelog** :
- v1.2 : Ajout module génération de rapports, intégration Django REST Framework + Channels
- v1.1 : Intégration Keycloak SSO + Gestion Multi-Organisation
- v1.0 : Version initiale, consumers.DashboardConsumer.as_asgi()),
    re_path(r'ws/sensors/(?P<sensor_type>\w+)/

```
src/
├── assets/              # Images, icônes, fonts
├── components/          
│   ├── common/          # Boutons, inputs, modals
│   ├── charts/          # Wrappers graphiques réutilisables
│   ├── sensors/         # Composants capteurs spécifiques
│   ├── layouts/         # Header, Sidebar, Footer
│   ├── auth/            # Composants Keycloak, ProtectedRoute
│   └── organizations/   # Sélecteur org, gestion multi-site
├── pages/               # Pages principales
│   ├── Auth/
│   ├── Dashboard/
│   ├── Sensors/
│   ├── AI/
│   ├── History/
│   ├── System/
│   ├── Admin/           # Gestion users, organisations
│   └── Unauthorized/
├── hooks/               # Custom hooks (useAuth, usePermissions, useOrg)
├── services/            
│   ├── api.ts           # Axios config, interceptors
│   ├── websocket.ts     # WebSocket client
│   └── keycloak.ts      # Keycloak init & utils
├── stores/              # Zustand stores
│   ├── authStore.ts
│   ├── organizationStore.ts
│   └── dataStore.ts
├── types/               # TypeScript definitions
│   ├── auth.types.ts
│   ├── organization.types.ts
│   └── sensor.types.ts
├── utils/               # Helpers, formatters
├── constants/           # Config, enums, permissions matrix
└── styles/              # Global styles, themes
```

---

## 📄 3. Spécifications détaillées des pages

### 3.1 Authentification (`/login`)

#### Fonctionnalités
- **SSO via Keycloak** : redirection automatique vers Keycloak
- Support **multi-méthodes** :
  - Username/Password
  - LDAP/Active Directory
  - Social Login (Google, Microsoft) si configuré
  - MFA (TOTP, SMS) si activé
- **Remember me** : refresh token longue durée (30 jours)
- **Lien "Mot de passe oublié"** : géré par Keycloak
- **Sélection organisation** : si user a accès à plusieurs orgs

#### Flow d'authentification détaillé

```
┌─────────────────────────────────────────────────┐
│ 1. User visite /dashboard (non connecté)       │
│    └─> ProtectedRoute détecte absence token    │
│    └─> Redirect vers /login                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 2. Page /login affiche bouton "Se connecter"   │
│    User clique                                  │
│    └─> keycloak.login() appelé                 │
│    └─> Redirect vers Keycloak                  │
│        https://auth.domain.com/realms/Food...   │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 3. Page Keycloak (branding personnalisable)    │
│    • Formulaire login                           │
│    • Validation credentials                     │
│    • MFA si activé                              │
│    • Consent si nécessaire                      │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 4. Callback /auth/callback?code=XXX            │
│    Frontend échange code contre tokens (PKCE)  │
│    └─> Access Token (JWT, 5 min)               │
│    └─> Refresh Token (30 jours)                │
│    └─> ID Token (user info)                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 5. Décodage JWT & extraction données           │
│    • Roles: ['org_admin', 'quality_manager']   │
│    • Organization IDs: ['uuid-lyon', 'uuid...']│
│    • User info: name, email, etc.              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 6. Si user a plusieurs orgs:                   │
│    └─> Afficher modal sélection organisation   │
│    Sinon:                                       │
│    └─> Auto-sélection unique org               │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 7. Initialisation app                          │
│    • Store auth (user, roles, tokens)          │
│    • Store org (currentOrg)                    │
│    • Fetch settings org                        │
│    • Init WebSocket avec token                 │
│    └─> Redirect vers /dashboard                │
└─────────────────────────────────────────────────┘
```

#### UI/UX

**Page login minimaliste** :
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [Logo FoodQuality]                 │
│                                                 │
│     Système de Qualification Alimentaire       │
│            Temps Réel                           │
│                                                 │
│     ┌─────────────────────────────────┐        │
│     │   [🔐 Se connecter via SSO]    │        │
│     └─────────────────────────────────┘        │
│                                                 │
│     Première connexion ? Contactez votre       │
│     administrateur pour créer un compte        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Modal sélection organisation** (si multi-org) :
```
┌─────────────────────────────────────────────────┐
│ Sélectionnez votre organisation                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚪ 📍 Usine Lyon                               │
│     Production • 24 utilisateurs                │
│                                                 │
│  ⚪ 📍 Site Bordeaux                            │
│     Production • 18 utilisateurs                │
│                                                 │
│  ⚪ 📍 Lab Paris                                │
│     R&D • 6 utilisateurs                        │
│                                                 │
│  □ Se souvenir de mon choix                     │
│                                                 │
│     [Annuler]              [Continuer]          │
└─────────────────────────────────────────────────┘
```

#### Gestion de session

**Token refresh automatique** :
```typescript
// Hook useTokenRefresh
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      // Refresh si expire dans < 70 secondes
      const refreshed = await keycloak.updateToken(70);
      
      if (refreshed) {
        console.log('Token refreshed');
        // Mettre à jour store avec nouveau token
        authStore.setToken(keycloak.token);
      }
    } catch (error) {
      console.error('Failed to refresh token', error);
      // Si refresh échoue, forcer re-login
      keycloak.login();
    }
  }, 60000); // Check toutes les minutes
  
  return () => clearInterval(interval);
}, []);
```

**Logout** :
```typescript
const handleLogout = async () => {
  // Nettoyage local
  authStore.reset();
  organizationStore.reset();
  wsClient.disconnect();
  
  // Logout Keycloak (invalide token serveur)
  await keycloak.logout({
    redirectUri: window.location.origin + '/login'
  });
};
```

**Session timeout** :
```typescript
// Détection inactivité (optionnel)
let inactivityTimer;

const resetInactivityTimer = () => {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Après 30 min d'inactivité
    showModal({
      title: 'Session expirée',
      message: 'Votre session a expiré suite à une inactivité prolongée.',
      onConfirm: () => keycloak.login()
    });
  }, 30 * 60 * 1000);
};

// Reset sur activité user
window.addEventListener('mousemove', resetInactivityTimer);
window.addEventListener('keypress', resetInactivityTimer);
```

#### Accessibilité
- **Navigation clavier** : bouton SSO focusable via Tab
- **Screen reader** : labels ARIA explicites
- **Contraste** : bouton principal avec ratio 4.5:1 minimum
- **Messages d'erreur** : annoncés par screen readers

#### Sécurité
- **PKCE** : Proof Key for Code Exchange activé
- **State parameter** : protection CSRF
- **Nonce** : protection replay attacks
- **Silent refresh** : iframe cachée pour refresh sans interruption
- **Secure cookies** : si tokens stockés en cookie (optionnel)

---

### 3.2 Dashboard Principal (`/dashboard`)

#### Objectif
Vue d'ensemble temps réel de l'état du système et de la production.

#### Sections

**A. Header KPIs** (4 cards horizontales)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Produits    │ Conformité  │ Taux rejet  │ Uptime      │
│ analysés/h  │ 94.5%       │ 5.5%        │ 99.8%       │
│ 847 ↑12%    │ 🟢          │ 🟡          │ 🟢          │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**B. Visualisation temps réel centrale** (50% largeur)
- Stream vidéo ou image du produit analysé
- Overlay : résultat IA en temps réel (label + confiance)
- Bounding box si détection d'anomalie localisée

**C. Graphiques live** (2 colonnes)
- **Gauche** : 
  - Courbe qualité spectrale (10 dernières minutes)
  - Distribution des classifications (pie chart)
- **Droite** :
  - Profil 3D TOF du dernier scan
  - Historique des scores IA (line chart temps réel)

**D. Alertes & Notifications** (sidebar droite)
- Liste des 5 dernières alertes avec timestamp
- Code couleur : critique (rouge), warning (orange), info (bleu)
- Action rapide : "Voir détails", "Marquer comme résolu"

**E. Timeline de production** (footer)
- Barre horizontale : derniers 50 produits analysés
- Code couleur selon conformité
- Clic → détails du scan

#### Interactions
- **Refresh auto** : toutes les 2 secondes
- **Pause stream** : bouton pour figer l'affichage
- **Filtres rapides** : "Dernière heure", "Quart actuel", "Aujourd'hui"
- **Export snapshot** : télécharger état actuel en PDF

#### Données WebSocket
```typescript
interface DashboardUpdate {
  timestamp: number;
  product: {
    id: string;
    classification: string;
    confidence: number;
    qualityScore: number;
  };
  sensors: {
    tof: { distance: number, volume: number };
    as7341: number[]; // 11 canaux
  };
  alerts: Alert[];
}
```

---

### 3.3 Module Capteurs

#### 3.3.1 Page TOF (`/sensors/tof`)

**Objectif** : Analyse morphologique 3D en temps réel

**Layout** :
```
┌────────────────────────────────────────────────────┐
│ Header : TOF VL53L5CX | Status: 🟢 Active         │
├─────────────────┬──────────────────────────────────┤
│                 │                                  │
│  Vue 3D live    │  Métriques temps réel            │
│  (Three.js)     │  • Distance: 245 mm              │
│                 │  • Volume estimé: 127 cm³        │
│  Point cloud    │  • Aire surface: 45 cm²          │
│  avec heatmap   │  • Résolution: 8x8 zones         │
│  de distance    │                                  │
│                 │  Graphique historique distance   │
│                 │  (scrollable, 500 derniers pts)  │
│                 │                                  │
├─────────────────┴──────────────────────────────────┤
│ Contrôles & Calibration                            │
│ [Calibrer] [Exporter données] [Réglages avancés]  │
└────────────────────────────────────────────────────┘
```

**Fonctionnalités avancées** :
- **Modes de visualisation** : 
  - Point cloud 3D rotatif
  - Heatmap 2D (top view)
  - Profil en coupe (side view)
- **Calibration** : assistant step-by-step
- **Seuils d'alerte** : configurables (distance min/max)
- **Enregistrement séquence** : capture 10s de données pour debug

**Données** :
```typescript
interface TOFData {
  timestamp: number;
  matrix: number[][]; // 8x8 distances en mm
  ambient: number;
  signalRate: number[];
  rangeStatus: number[];
}
```

#### 3.3.2 Page AS7341 (`/sensors/as7341`)

**Objectif** : Analyse spectrale multi-canaux

**Layout** :
```
┌────────────────────────────────────────────────────┐
│ Header : AS7341 Spectral | Status: 🟢 Active      │
├────────────────────────────────────────────────────┤
│                                                    │
│  Spectrogramme live (Plotly)                       │
│  ┌──────────────────────────────────────────────┐ │
│  │   Intensité                                   │ │
│  │      ▲                                        │ │
│  │      │     ╱╲                                 │ │
│  │      │    ╱  ╲      ╱╲                        │ │
│  │      │   ╱    ╲    ╱  ╲                       │ │
│  │      │  ╱      ╲  ╱    ╲                      │ │
│  │      └─────────────────────────> λ (nm)       │ │
│  │       415  445  480  515  555  590  630  680  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
├────────────────┬───────────────────────────────────┤
│ Canaux         │  Référence vs Actuel              │
│ F1 (415nm): ██ │  Overlay comparaison avec         │
│ F2 (445nm): ██ │  signature spectrale de           │
│ F3 (480nm): ██ │  référence pour détection         │
│ F4 (515nm): ██ │  d'anomalies (oxydation, etc.)    │
│ F5 (555nm): ██ │                                   │
│ F6 (590nm): ██ │  Écart RMS: 4.2%                  │
│ F7 (630nm): ██ │  Alerte si > 10%                  │
│ F8 (680nm): ██ │                                   │
│ NIR (910nm): █ │                                   │
│ Clear:      ██ │                                   │
│ Flicker:    ── │                                   │
└────────────────┴───────────────────────────────────┘
```

**Fonctionnalités** :
- **Modes d'intégration** : 50ms, 100ms, 500ms (ajustable)
- **Bibliothèque de signatures** : enregistrer/comparer profils spectraux
- **Détection automatique** : alertes si écart > seuil configurable
- **Export données** : CSV avec timestamps
- **Graphique waterfall** : évolution spectrale sur 60s

**Données** :
```typescript
interface AS7341Data {
  timestamp: number;
  channels: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    NIR: number;
    Clear: number;
  };
  flicker: number;
  integrationTime: number;
}
```

---

### 3.4 Module IA

#### 3.4.1 Dashboard IA (`/ai/monitor`)

**Objectif** : Monitoring de l'inférence en temps réel

**Sections** :

**A. Statut du modèle actif**
```
┌────────────────────────────────────────┐
│ Modèle: FoodQuality_v2.3.1             │
│ Architecture: ResNet-50 + Transformer  │
│ Inférences/s: 12.4                     │
│ Latence moy: 47ms                      │
│ Précision (validation): 96.2%          │
└────────────────────────────────────────┘
```

**B. Inférences temps réel** (table)
| Timestamp | Image | Prédiction | Confiance | TOF | Spectral | Statut |
|-----------|-------|------------|-----------|-----|----------|--------|
| 14:32:51 | 🖼️ | Pomme saine | 98.5% | ✓ | ✓ | 🟢 |
| 14:32:50 | 🖼️ | Banane mûre | 87.2% | ✓ | ✓ | 🟢 |
| 14:32:49 | 🖼️ | Orange altérée | 92.1% | ✓ | ⚠️ | 🟡 |

**C. Distribution des prédictions** (pie chart dynamique)

**D. Matrice de confusion** (si ground truth disponible)

**E. Graphiques de performance**
- Latence d'inférence (rolling window 1h)
- Distribution des scores de confiance
- Taux de prédictions par classe

#### 3.4.2 Entraînement IA (`/ai/training`)

**Objectif** : Gérer datasets, entraînements et versions de modèles

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Onglets: [Datasets] [Entraînements] [Modèles]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [TAB: Datasets]                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ Liste des datasets                            │ │
│  │ • FoodQuality_Train_v3 (12,450 samples)       │ │
│  │   └─ Classes: 15 | Période: 2024-10-2025-01  │ │
│  │ • FoodQuality_Validation (3,200 samples)      │ │
│  │ • FoodQuality_Test (1,500 samples)            │ │
│  │                                               │ │
│  │ [+ Créer dataset depuis TimescaleDB]          │ │
│  │ Période: [___] à [___]                        │ │
│  │ Classes: [Toutes ▼]                           │ │
│  │ Filtres: TOF ✓ | AS7341 ✓ | Labels manuels ✓ │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [TAB: Entraînements]                               │
│  ┌───────────────────────────────────────────────┐ │
│  │ Nouvel entraînement                           │ │
│  │ Architecture: [ResNet-50 ▼]                   │ │
│  │ Dataset train: [FoodQuality_Train_v3 ▼]       │ │
│  │ Dataset val: [FoodQuality_Validation ▼]       │ │
│  │ Hyperparamètres:                              │ │
│  │   • Learning rate: [0.001]                    │ │
│  │   • Batch size: [32]                          │ │
│  │   • Epochs: [50]                              │ │
│  │   • Augmentation: ✓                           │ │
│  │                                               │ │
│  │ [Lancer entraînement]                         │ │
│  │                                               │ │
│  │ Historique des entraînements:                 │ │
│  │ Training_20251008_143055 - En cours (epoch 12)│ │
│  │   └─ Loss: 0.342 | Val accuracy: 94.1%       │ │
│  │   └─ [Voir TensorBoard] [Arrêter]            │ │
│  │ Training_20251005_092314 - Terminé ✓          │ │
│  │   └─ Best val accuracy: 96.2% (epoch 43)     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [TAB: Modèles]                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Modèles déployables                           │ │
│  │                                               │ │
│  │ • FoodQuality_v2.3.1 [ACTIF]                  │ │
│  │   ├─ Précision: 96.2%                         │ │
│  │   ├─ F1-Score: 0.954                          │ │
│  │   ├─ Latence: 47ms                            │ │
│  │   └─ [Télécharger] [Métriques détaillées]    │ │
│  │                                               │ │
│  │ • FoodQuality_v2.3.0                          │ │
│  │   ├─ Précision: 95.8%                         │ │
│  │   └─ [Activer] [Comparer] [Supprimer]        │ │
│  │                                               │ │
│  │ A/B Testing:                                  │ │
│  │ [Activer split 80/20 entre v2.3.1 et v2.3.0] │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités clés** :
- **Création datasets intelligente** : requêtes TimescaleDB avec filtres avancés
- **Monitoring entraînement live** : intégration TensorBoard ou graphiques custom
- **Comparaison modèles** : métriques côte à côte, matrice de confusion
- **A/B Testing** : déploiement progressif (canary deployment)
- **MLOps** : versioning automatique, rollback rapide

---

### 3.5 Historique & Analytics (`/history`)

**Objectif** : Explorer et analyser les données historiques

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Filtres avancés                                     │
│ Période: [01/10/25 ▼] - [08/10/25 ▼]              │
│ Classes: [Toutes ▼] Confiance: [> 80% ▼]          │
│ Capteurs: TOF ✓ AS7341 ✓ | Statut: [Tous ▼]       │
│ [Appliquer] [Réinitialiser] [Sauver comme preset] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Résultats: 15,847 analyses                         │
│                                                     │
│  Graphiques analytiques (2x2 grid)                 │
│  ┌─────────────────┬─────────────────────────────┐ │
│  │ Évolution       │ Distribution classes        │ │
│  │ conformité      │ (pie chart)                 │ │
│  │ (line chart)    │                             │ │
│  ├─────────────────┼─────────────────────────────┤ │
│  │ Heatmap         │ Top anomalies détectées     │ │
│  │ horaire         │ (bar chart)                 │ │
│  └─────────────────┴─────────────────────────────┘ │
│                                                     │
│  Timeline interactive                               │
│  ═══════════════════════════════════════════════   │
│  ▮▯▮▮▮▯▮▮▮▮▯▮▮▮▮▮▮▯▮▮▮▮▮▮▯▮▮▮▮▮▮▮▮▮▮▮▮▯▮▮▮▮▮▮   │
│  └─ Zoom, brush pour sélection, clic pour détails  │
│                                                     │
│  Table détaillée (virtualisée, 100 lignes visibles)│
│  [ID] [Timestamp] [Classe] [Conf.] [TOF] [Spec.] […│
│  ───────────────────────────────────────────────── │
│  [Export CSV] [Export PDF rapport] [Partager URL] │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Recherche full-text** : par ID, classe, notes
- **Filtres combinables** : AND/OR logic
- **Presets de filtres** : "Dernières 24h", "Semaine passée", "Anomalies uniquement"
- **Export massif** : CSV, JSON, Excel
- **Génération rapports PDF** : template professionnel avec graphiques
- **Annotations** : ajouter notes sur analyses spécifiques
- **Comparaison** : sélectionner 2+ analyses et les comparer côte à côte

**Optimisations** :
- **Virtualisation** : react-window pour tables longues
- **Pagination côté serveur** : charger par chunks de 100
- **Debounce** : recherche avec délai 300ms

---

### 3.6 Génération de Rapports (`/reports`)

**Objectif** : Créer, personnaliser et exporter des rapports automatisés pour analyse qualité et conformité

**Accès** : super_admin, org_admin, quality_manager, data_analyst

#### Layout principal

```
┌─────────────────────────────────────────────────────┐
│ Génération de Rapports                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Onglets: [📊 Nouveau] [📁 Mes rapports] [⏰ Planifiés] [📚 Templates] │
│                                                     │
│  [TAB: Nouveau Rapport]                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1️⃣ Type de rapport                          │   │
│  │ ⚪ Rapport de production                     │   │
│  │    └─ Analyses, conformité, rejets          │   │
│  │ ⚪ Rapport qualité détaillé                  │   │
│  │    └─ Spectres, TOF, tendances              │   │
│  │ ⚪ Performance capteurs                      │   │
│  │    └─ Santé hardware, calibration           │   │
│  │ ⚪ Performance IA                            │   │
│  │    └─ Métriques modèle, inférences          │   │
│  │ ⚪ Rapport d'audit                           │   │
│  │    └─ Logs, actions utilisateurs            │   │
│  │ ⚪ Rapport personnalisé                      │   │
│  │    └─ Sélection manuelle sections           │   │
│  │                                             │   │
│  │ 2️⃣ Période                                  │   │
│  │ ◉ Période fixe                              │   │
│  │   Du: [01/10/2025] Au: [08/10/2025]        │   │
│  │ ⚪ Dernier(s): [7 ▼] [jours ▼]             │   │
│  │ ⚪ Quart de travail: [Matin ▼] [Hier ▼]    │   │
│  │                                             │   │
│  │ 3️⃣ Organisation(s)                          │   │
│  │ ☑ Usine Lyon                                │   │
│  │ ☑ Site Bordeaux                             │   │
│  │ ☐ Lab Paris                                 │   │
│  │ [Sélectionner tout] [Comparer sites]        │   │
│  │                                             │   │
│  │ 4️⃣ Filtres additionnels (optionnel)        │   │
│  │ Classes produits: [Toutes ▼]                │   │
│  │ Plage confiance IA: [80% - 100%]           │   │
│  │ Statut: [Conforme] [Non-conforme] [Tous]   │   │
│  │                                             │   │
│  │ 5️⃣ Sections à inclure (personnalisé)       │   │
│  │ ☑ Résumé exécutif                           │   │
│  │ ☑ KPIs principaux                           │   │
│  │ ☑ Graphiques évolution                      │   │
│  │ ☑ Analyse statistique                       │   │
│  │ ☑ Détails anomalies                         │   │
│  │ ☑ Recommandations                           │   │
│  │ ☐ Données brutes (annexe)                   │   │
│  │ ☐ Signatures spectrales                     │   │
│  │                                             │   │
│  │ 6️⃣ Format d'export                          │   │
│  │ ◉ PDF (recommandé)                          │   │
│  │ ⚪ Excel (.xlsx) avec onglets               │   │
│  │ ⚪ PowerPoint (.pptx) présentation          │   │
│  │ ⚪ CSV (données uniquement)                 │   │
│  │                                             │   │
│  │ Options PDF:                                │   │
│  │ ☑ Inclure logo organisation                 │   │
│  │ ☑ Page de garde                             │   │
│  │ ☑ Table des matières                        │   │
│  │ ☑ Numérotation pages                        │   │
│  │ Template: [Standard ▼] [Custom disponibles] │   │
│  │                                             │   │
│  │ 7️⃣ Actions                                  │   │
│  │ Titre: [Rapport Qualité S41-2025_________] │   │
│  │ [Aperçu] [Générer maintenant] [Planifier]  │   │
│  │                                             │   │
│  │ ⏱️ Temps estimé: ~45 secondes               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### TAB: Mes rapports

```
┌─────────────────────────────────────────────────────┐
│ Mes Rapports (47 rapports)                          │
│ Recherche: [🔍 _____] Tri: [Plus récent ▼]        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Liste des rapports générés                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 Rapport Qualité S41-2025                 │   │
│  │    Production • 01-08/10/2025 • Usine Lyon  │   │
│  │    Généré le: 08/10/2025 14:32              │   │
│  │    Généré par: Marie Dupont                 │   │
│  │    Taille: 2.4 MB • 24 pages                │   │
│  │    [👁️ Prévisualiser] [⬇️ Télécharger]      │   │
│  │    [📧 Partager] [🗑️ Supprimer]             │   │
│  │                                             │   │
│  │    Tags: #hebdomadaire #production          │   │
│  │    Commentaire: RAS, bonne conformité       │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📊 Performance Capteurs - Septembre         │   │
│  │    Technique • 01-30/09/2025 • Multi-sites  │   │
│  │    Généré le: 01/10/2025 09:15              │   │
│  │    [👁️] [⬇️] [📧] [📋 Dupliquer] [🗑️]     │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📈 Analyse IA - Q3 2025                     │   │
│  │    IA • 01/07-30/09/2025 • Tous sites       │   │
│  │    Généré le: 30/09/2025 18:45              │   │
│  │    [👁️] [⬇️] [📧] [🗑️]                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Export archives] [Paramètres de rétention]       │
└─────────────────────────────────────────────────────┘
```

#### TAB: Rapports planifiés

```
┌─────────────────────────────────────────────────────┐
│ Rapports Planifiés (5 actifs)                       │
│ [+ Nouveau rapport planifié]                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟢 Rapport Hebdomadaire Production          │   │
│  │    Type: Production • Format: PDF           │   │
│  │    Fréquence: Tous les lundis à 08:00       │   │
│  │    Organisation: Usine Lyon                 │   │
│  │    Destinataires:                           │   │
│  │      • marie.dupont@mail.com                │   │
│  │      • jean.martin@mail.com                 │   │
│  │    Prochain: Lundi 14/10/2025 08:00         │   │
│  │    [Modifier] [Désactiver] [Exécuter maintenant] │
│  ├─────────────────────────────────────────────┤   │
│  │ 🟢 Rapport Mensuel Direction                │   │
│  │    Type: Personnalisé • Format: PowerPoint  │   │
│  │    Fréquence: 1er du mois à 06:00           │   │
│  │    Multi-sites (comparatif)                 │   │
│  │    Prochain: 01/11/2025 06:00               │   │
│  │    [Modifier] [Désactiver]                  │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 🔴 Rapport Audit Trimestriel (désactivé)   │   │
│  │    Type: Audit • Format: PDF                │   │
│  │    Fréquence: Fin de trimestre              │   │
│  │    [Modifier] [Activer] [Supprimer]         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### TAB: Templates

```
┌─────────────────────────────────────────────────────┐
│ Bibliothèque de Templates                           │
│ [+ Créer template personnalisé]                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Templates standards                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📋 Production Standard                       │   │
│  │    Sections: KPIs, Conformité, Rejets       │   │
│  │    Utilisé: 142 fois                        │   │
│  │    [Utiliser] [Aperçu] [Dupliquer]          │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📊 Qualité Détaillée                        │   │
│  │    Sections: Spectres, TOF, Tendances       │   │
│  │    Utilisé: 87 fois                         │   │
│  │    [Utiliser] [Aperçu] [Dupliquer]          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Mes templates personnalisés (3)                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 Rapport Direction Lyon                   │   │
│  │    Créé le: 15/09/2025 • Modifié: 02/10/25 │   │
│  │    [Utiliser] [Modifier] [Supprimer]        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### Fonctionnalités avancées

**1. Aperçu en temps réel**
- Modal avec preview du rapport
- Navigation entre sections
- Possibilité d'ajuster avant génération finale

**2. Génération asynchrone**
```typescript
// Flow génération rapport
interface ReportGenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;           // 0-100
  estimatedTime: number;      // secondes
  resultUrl?: string;         // URL de téléchargement
  error?: string;
}

// 1. User lance génération
const response = await api.post('/api/reports/generate', reportConfig);
// { job_id: 'uuid-xxxx', status: 'queued' }

// 2. Polling status ou WebSocket
const jobId = response.data.job_id;
const interval = setInterval(async () => {
  const status = await api.get(`/api/reports/jobs/${jobId}`);
  
  if (status.data.status === 'completed') {
    clearInterval(interval);
    // Afficher lien téléchargement
    showNotification('Rapport prêt !', { 
      downloadUrl: status.data.result_url 
    });
  }
}, 2000);

// Alternative WebSocket
ws.on(`report:${jobId}`, (data) => {
  updateProgress(data.progress);
  if (data.status === 'completed') {
    showDownloadLink(data.result_url);
  }
});
```

**3. Backend Django - Génération rapports**

```python
# views.py (DRF)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .tasks import generate_report_task
from .models import Report, ReportJob
from .serializers import ReportConfigSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_report(request):
    """Créer une tâche Celery pour génération asynchrone"""
    serializer = ReportConfigSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # Créer job
    job = ReportJob.objects.create(
        user=request.user,
        organization=request.user.organization,
        config=serializer.validated_data,
        status='queued'
    )
    
    # Lancer tâche Celery
    task = generate_report_task.delay(job.id)
    
    return Response({
        'job_id': str(job.id),
        'status': 'queued',
        'task_id': task.id
    }, status=202)

# tasks.py (Celery)
from celery import shared_task
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
# ... autres imports

@shared_task(bind=True)
def generate_report_task(self, job_id):
    """Génération rapport en background"""
    job = ReportJob.objects.get(id=job_id)
    
    try:
        job.status = 'processing'
        job.save()
        
        # Récupérer données depuis TimescaleDB
        data = fetch_report_data(job.config)
        
        # Générer PDF avec ReportLab ou WeasyPrint
        pdf_buffer = generate_pdf(data, job.config)
        
        # Sauvegarder fichier
        filename = f"report_{job.id}.pdf"
        job.result_file.save(filename, ContentFile(pdf_buffer.getvalue()))
        
        job.status = 'completed'
        job.progress = 100
        job.save()
        
        # Notification WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_{job.user.id}',
            {
                'type': 'report_completed',
                'job_id': str(job.id),
                'download_url': job.result_file.url
            }
        )
        
    except Exception as e:
        job.status = 'failed'
        job.error = str(e)
        job.save()
        raise
```

**4. Types de rapports prédéfinis**

| Type | Sections principales | Durée génération |
|------|---------------------|------------------|
| **Production** | KPIs, Conformité, Timeline, Top rejets | ~30s |
| **Qualité Détaillée** | Spectres, TOF 3D, Statistiques, Anomalies | ~60s |
| **Performance Capteurs** | Santé hardware, Calibration, Dérives | ~20s |
| **Performance IA** | Métriques modèle, Confusion matrix, Latence | ~40s |
| **Audit** | Logs actions, Changements config, Accès | ~25s |
| **Comparatif Multi-sites** | Benchmark sites, Classements, Écarts | ~90s |

**5. Personnalisation template (éditeur visuel)**

```
┌─────────────────────────────────────────────────────┐
│ Éditeur de Template                                 │
├─────────────────────────────────────────────────────┤
│ Glisser-déposer sections:                           │
│                                                     │
│ Disponibles:          │  Rapport (ordre):           │
│ ┌──────────────┐      │  1. [≡] Résumé exécutif    │
│ │ 📊 Graphiques│      │  2. [≡] KPIs principaux    │
│ │ 📈 KPIs      │  =>  │  3. [≡] Graphique temps    │
│ │ 📋 Tables    │      │  4. [≡] Table anomalies    │
│ │ 🔬 Spectres  │      │  5. [≡] Recommandations    │
│ │ 🎯 Heatmap   │      │                             │
│ └──────────────┘      │  [+ Ajouter section]        │
│                       │                             │
│ Styles:               │  Aperçu:                    │
│ Police: [Inter ▼]     │  [Miniature PDF]            │
│ Couleur: [🎨 #3b82f6]│                             │
│ Logo: [📁 Upload]     │                             │
│                                                     │
│ [Annuler] [Enregistrer comme template]              │
└─────────────────────────────────────────────────────┘
```

**6. Partage de rapports**

```typescript
interface ReportShare {
  reportId: string;
  recipients: string[];        // emails
  message?: string;
  expiresAt?: Date;            // lien temporaire
  requireAuth: boolean;        // authentification requise
}

// Modal partage
const ShareReportModal = ({ reportId }) => {
  return (
    <Modal>
      <h3>Partager le rapport</h3>
      <Input 
        type="email" 
        placeholder="Email destinataire"
        multiple
      />
      <Textarea placeholder="Message (optionnel)" />
      <Checkbox label="Expirer après 7 jours" />
      <Checkbox label="Nécessite authentification" defaultChecked />
      <Button onClick={handleShare}>Envoyer par email</Button>
      <Button onClick={generatePublicLink}>
        Générer lien de partage
      </Button>
    </Modal>
  );
};
```

**7. Archive et rétention**

- **Archivage automatique** : rapports > 90 jours vers stockage froid (S3 Glacier, etc.)
- **Politique de rétention** : configurable par org (365 jours par défaut)
- **Compression** : ZIP pour rapports multiples
- **Signature numérique** : intégrité des rapports critiques (audit)

#### API Endpoints Django

```python
# urls.py
urlpatterns = [
    # Génération
    path('api/reports/generate/', views.generate_report),
    path('api/reports/jobs/<uuid:job_id>/', views.get_job_status),
    
    # CRUD rapports
    path('api/reports/', views.list_reports),
    path('api/reports/<uuid:report_id>/', views.get_report),
    path('api/reports/<uuid:report_id>/download/', views.download_report),
    path('api/reports/<uuid:report_id>/share/', views.share_report),
    
    # Planification
    path('api/reports/scheduled/', views.list_scheduled_reports),
    path('api/reports/scheduled/<uuid:schedule_id>/', views.update_schedule),
    
    # Templates
    path('api/reports/templates/', views.list_templates),
    path('api/reports/templates/<uuid:template_id>/', views.get_template),
]
```

#### Types TypeScript

```typescript
interface ReportConfig {
  type: 'production' | 'quality' | 'sensors' | 'ai' | 'audit' | 'custom';
  title: string;
  period: {
    start: Date;
    end: Date;
  } | {
    relative: 'last_7_days' | 'last_month' | 'current_quarter';
  };
  organizations: string[];      // UUIDs
  filters?: {
    productClasses?: string[];
    confidenceMin?: number;
    status?: 'conforming' | 'non_conforming' | 'all';
  };
  sections: ReportSection[];
  format: 'pdf' | 'xlsx' | 'pptx' | 'csv';
  options?: {
    includeLogo?: boolean;
    includeCover?: boolean;
    includeToC?: boolean;
    template?: string;          // UUID du template
  };
}

interface ReportSection {
  type: 'executive_summary' | 'kpis' | 'charts' | 'statistics' | 
        'anomalies' | 'recommendations' | 'raw_data' | 'spectra';
  config?: Record<string, any>;
}

interface ScheduledReport {
  id: string;
  reportConfig: ReportConfig;
  frequency: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;               // HH:MM
    dayOfWeek?: number;         // 1-7 (lundi-dimanche)
    dayOfMonth?: number;        // 1-31
  };
  recipients: string[];
  isActive: boolean;
  nextRun: Date;
  createdBy: string;
}
```

---

### 3.7 Système & Maintenance

#### 3.7.1 Santé du système (`/system/health`)

**Objectif** : Monitoring hardware et software

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Vue d'ensemble - Statut: 🟢 Opérationnel           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Capteurs                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ TOF VL53L5CX                                │   │
│  │ Status: 🟢 | Température: 42°C | FPS: 15   │   │
│  │ Dernier calibrage: Il y a 3 jours          │   │
│  │ [Tester] [Recalibrer]                       │   │
│  │                                             │   │
│  │ AS7341 Spectral                             │   │
│  │ Status: 🟢 | Température: 38°C              │   │
│  │ Qualité signal: Excellent (SNR: 42dB)      │   │
│  │ [Tester] [Réglages]                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Système                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ • CPU: 45% ████████░░░░░░░░░               │   │
│  │ • RAM: 2.1GB / 4GB ███████░░░░░░░          │   │
│  │ • Disque: 12GB / 32GB ██████░░░░░░░        │   │
│  │ • Température CPU: 58°C                     │   │
│  │ • Uptime: 14j 7h 23m                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Réseau & Backend                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ • API Backend: 🟢 (latence: 23ms)          │   │
│  │ • TimescaleDB: 🟢 (9,847,234 enregistr.)   │   │
│  │ • WebSocket: 🟢 (12 clients connectés)     │   │
│  │ • Moteur IA: 🟢 (GPU usage: 67%)           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Logs système (live, 50 dernières lignes)          │
│  ┌─────────────────────────────────────────────┐   │
│  │ [INFO] 14:42:15 - Analyse #15847 terminée  │   │
│  │ [WARN] 14:42:10 - Signal AS7341 faible     │   │
│  │ [INFO] 14:42:05 - Analyse #15846 terminée  │   │
│  │ ...                                         │   │
│  └─────────────────────────────────────────────┘   │
│  Filtres: [Tous ▼] [Rechercher...]                 │
│  [Télécharger logs complets] [Archiver anciens]    │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Tests diagnostics** : boutons pour tester chaque capteur individuellement
- **Graphiques historiques** : CPU/RAM/Temp sur 24h
- **Alertes configurables** : seuils pour temp, CPU, espace disque
- **Logs en temps réel** : WebSocket stream, filtres par niveau (INFO, WARN, ERROR)
- **Export logs** : téléchargement avec date range

#### 3.7.2 Firmware OTA (`/system/firmware`)

**Objectif** : Gestion des mises à jour firmware

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Gestion du Firmware OTA                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Version actuelle                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firmware: v3.2.1                            │   │
│  │ Date de déploiement: 2025-09-28             │   │
│  │ Statut: ✓ Stable                            │   │
│  │ Changelog: [Voir détails]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Nouvelle mise à jour disponible                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firmware: v3.3.0                            │   │
│  │ Taille: 2.4 MB                              │   │
│  │ Release notes:                              │   │
│  │ • Amélioration stabilité capteur TOF        │   │
│  │ • Optimisation consommation AS7341          │   │
│  │ • Correctif bug #234                        │   │
│  │                                             │   │
│  │ Upload manuel:                              │   │
│  │ [Choisir fichier .bin] [Uploader]           │   │
│  │                                             │   │
│  │ ⚠️ Attention: arrêt système 2-3 minutes    │   │
│  │                                             │   │
│  │ Options:                                    │   │
│  │ □ Sauvegarder config actuelle               │   │
│  │ ✓ Rollback auto si échec                    │   │
│  │ ✓ Vérifier MD5 checksum                     │   │
│  │                                             │   │
│  │ Planifier: [Maintenant ▼]                   │   │
│  │ [Déployer firmware v3.3.0]                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Historique des déploiements                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ v3.2.1 - 2025-09-28 - Succès ✓             │   │
│  │ v3.2.0 - 2025-08-15 - Succès ✓             │   │
│  │ v3.1.5 - 2025-07-03 - Rollback (erreur)    │   │
│  │ v3.1.4 - 2025-06-22 - Succès ✓             │   │
│  │ [Voir tous]                                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Upload sécurisé** : validation format, checksum MD5
- **Planification** : déploiement immédiat ou programmé
- **Progress bar** : upload + flashing en temps réel
- **Rollback automatique** : si device ne répond pas après 5 min
- **Historique versioning** : traçabilité complète
- **Backup config** : sauvegarder paramètres avant MAJ

---

### 3.8 Notifications & Support (`/notifications`, `/support`)

#### Notifications
- **Centre de notifications** : dropdown dans header
- **Types** : Système, Alertes qualité, IA, Maintenance
- **Actions** : Marquer comme lu, Archiver, Aller à la source
- **Préférences** : activer/désactiver par catégorie
- **Push notifications** : si supporté par navigateur

#### Support / Bug report
**Formulaire structuré** :
```
Titre: [_________________]
Type: [Bug ▼] [Feature request] [Question]
Priorité: [Basse ▼] [Moyenne] [Haute] [Critique]
Description: [____________]
Reproduire: [____________]
Logs auto-attachés: ✓
Screenshot: [Upload]
[Envoyer]
```

---

### 3.9 Administration (`/admin`)

**Accès réservé** : super_admin, org_admin (pour leur org uniquement)

#### 3.9.1 Gestion des utilisateurs (`/admin/users`)

**Objectif** : CRUD utilisateurs et attribution rôles

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Gestion des Utilisateurs                            │
│ Organisation: [Usine Lyon ▼] (org_admin uniquement) │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [+ Inviter utilisateur]  [Import CSV]              │
│                                                     │
│ Recherche: [🔍 Nom, email...] Rôle: [Tous ▼]      │
│                                                     │
│  Liste des utilisateurs (24)                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Avatar │ Nom & Email │ Rôles │ Statut │ …   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Marie Dupont          │ 🟢 Actif │   │   │
│  │       │ marie.dupont@mail.com │          │   │   │
│  │       │ Rôles: quality_manager │         │   │   │
│  │       │ Dernière connexion: Il y a 2h   │   │   │
│  │       │ [Modifier] [Désactiver] [Logs]  │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Jean Martin           │ 🟢 Actif │   │   │
│  │       │ jean.martin@mail.com  │          │   │   │
│  │       │ Rôles: operator       │          │   │   │
│  │       │ [Modifier] [Désactiver]         │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Sophie Bernard        │ 🔴 Inactif│  │   │
│  │       │ sophie.b@mail.com     │          │   │   │
│  │       │ Rôles: data_analyst   │          │   │   │
│  │       │ [Modifier] [Réactiver]          │   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Pagination: ← 1 2 3 4 →                           │
└─────────────────────────────────────────────────────┘
```

**Modal "Inviter utilisateur"** :
```typescript
interface InviteUserForm {
  email: string;              // Requis
  firstName: string;
  lastName: string;
  roles: string[];            // Multi-select
  organizations: string[];    // Si super_admin
  sendInviteEmail: boolean;   // ✓ par défaut
}

// Workflow:
// 1. Admin remplit formulaire
// 2. Backend crée user dans Keycloak (avec temporary password)
// 3. Email invitation envoyé avec lien reset password
// 4. User clique lien, définit son password, se connecte
```

**Modal "Modifier utilisateur"** :
- Changer rôles (avec confirmation si retrait privilèges)
- Ajouter/retirer organisations
- Activer/désactiver compte
- Forcer reset password

**Permissions** :
- **org_admin** : gère uniquement les users de son org
- **super_admin** : gère tous les users, toutes les orgs

#### 3.9.2 Gestion des organisations (détails)

Voir section 2.3 pour layout complet.

**Features additionnelles** :
- **Statistiques par org** : nb analyses, conformité, uptime
- **Quotas** : limite d'analyses/jour (si nécessaire)
- **API keys** : générer clés API pour intégrations externes
- **Webhooks** : configurer URLs de notification externes
- **White-labeling** : logo custom, couleurs (feature avancée)

#### 3.9.3 Logs d'audit (`/admin/audit`)

**Objectif** : Traçabilité des actions sensibles

**Events trackés** :
```typescript
enum AuditEventType {
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_CREATED = 'user.created',
  USER_ROLE_CHANGED = 'user.role_changed',
  ORG_CREATED = 'org.created',
  ORG_SETTINGS_UPDATED = 'org.settings_updated',
  FIRMWARE_DEPLOYED = 'firmware.deployed',
  AI_MODEL_DEPLOYED = 'ai.model_deployed',
  DATA_EXPORTED = 'data.exported',
  SENSOR_CALIBRATED = 'sensor.calibrated',
}

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  organizationId: string;
  eventType: AuditEventType;
  details: Record<string, any>;  // JSON avec contexte
  ipAddress: string;
  userAgent: string;
}
```

**Interface** :
```
┌─────────────────────────────────────────────────────┐
│ Logs d'Audit                                        │
├─────────────────────────────────────────────────────┤
│ Période: [Dernières 24h ▼]  Type: [Tous ▼]        │
│ Organisation: [Toutes ▼]  User: [Tous ▼]          │
│ [Appliquer filtres]  [Export CSV]                  │
│                                                     │
│  Table des logs (virtualisée)                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Time│User│Org│Event│Details│IP│         │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:32│Marie│Lyon│firmware.deployed│       │   │   │
│  │     │     │    │v3.3.0→v3.3.1 ✓│xxx.xxx│   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:28│Jean │Lyon│user.role_changed│       │   │   │
│  │     │     │    │operator→quality_manager│   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:15│Sophie│Bor│data.exported│           │   │   │
│  │     │      │   │15847 rows, CSV│xxx.xxx │   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Rétention: 2 ans selon ISO 27001                  │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 4. Design System

### 4.1 Palette de couleurs

#### Mode sombre (défaut)
```css
--bg-primary: #0a0e1a;        /* Fond principal */
--bg-secondary: #141824;      /* Cards, panels */
--bg-tertiary: #1e2433;       /* Hover states */

--text-primary: #e4e7ec;      /* Texte principal */
--text-secondary: #9da3ae;    /* Texte secondaire */
--text-muted: #6b7280;        /* Labels */

--accent-blue: #3b82f6;       /* Liens, info */
--accent-green: #10b981;      /* Succès, conformité */
--accent-yellow: #f59e0b;     /* Warnings */
--accent-red: #ef4444;        /* Erreurs, alertes */
--accent-purple: #8b5cf6;     /* IA, spectral */

--border: #2d3748;            /* Bordures */
--shadow: rgba(0, 0, 0, 0.3); /* Ombres */
```

#### Mode clair (optionnel)
```css
--bg-primary: #f9fafb;
--bg-secondary: #ffffff;
--text-primary: #111827;
--accent-blue: #2563eb;
/* ... */
```

### 4.2 Typographie

```css
/* Famille */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Tailles */
--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */

/* Poids */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 4.3 Espacements & Layout

```css
--spacing-unit: 0.25rem; /* 4px */

--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */

--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-full: 9999px;
```

### 4.4 Composants UI de base

#### Boutons
```
[Primary]   - Accent blue, bold
[Secondary] - Border white, transparent bg
[Danger]    - Accent red
[Success]   - Accent green
[Ghost]     - Transparent, hover bg-tertiary

États: default | hover | active | disabled | loading
```

#### Cards
```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: 0 1px 3px var(--shadow);
}

.card-header {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-4);
}
```

#### Badges (status)
```
🟢 Active   - green bg
🟡 Warning  - yellow bg
🔴 Critical - red bg
🔵 Info     - blue bg
⚪ Inactive - gray bg
```

#### Inputs & Forms
```
- Border: 1px, focus: 2px accent-blue
- Height: 40px (base), 32px (small), 48px (large)
- Validation: border red + message sous input
- Labels: font-medium, text-sm, mb-2
```

---

## 🔧 5. Exigences techniques

### 5.1 Performance

#### Temps de chargement
- **Initial load** : < 3 secondes (3G)
- **Changement page** : < 500ms
- **Mise à jour temps réel** : < 200ms

#### Optimisations
- **Code splitting** : lazy loading des pages
- **Tree shaking** : éliminer code non utilisé
- **Image optimization** : WebP, lazy loading
- **Memoization** : React.memo, useMemo, useCallback
- **Virtual scrolling** : tables > 100 lignes

### 5.2 Sécurité

- **Authentification** : JWT avec refresh token
- **HTTPS uniquement** : force SSL
- **CSP headers** : Content Security Policy
- **XSS protection** : sanitize user inputs
- **CSRF tokens** : pour mutations
- **Rate limiting** : protéger API
- **Logs audit** : tracer actions critiques

### 5.3 Accessibilité (WCAG 2.1 AA)

- **Contraste** : minimum 4.5:1 (texte normal)
- **Navigation clavier** : tous éléments accessibles via Tab
- **ARIA labels** : sur tous composants interactifs
- **Focus visible** : outline clair
- **Messages d'erreur** : associés aux champs (aria-describedby)
- **Alternative text** : sur images/graphiques

### 5.4 Responsive design

**Breakpoints** :
```
sm: 640px   (tablette portrait)
md: 768px   (tablette landscape)
lg: 1024px  (desktop)
xl: 1280px  (desktop large)
2xl: 1536px (ultra-wide)
```

**Priorité** : Desktop first (1920x1080), puis tablette (1024x768)

### 5.5 Tests

#### Tests unitaires (Jest + RTL)
- **Couverture** : > 70% du code
- **Composants** : tous testés avec snapshots
- **Hooks custom** : tests dédiés
- **Utils** : 100% couverture

#### Tests E2E (Playwright)
- **User flows critiques** :
  - Login → Dashboard → Analyse produit
  - Création dataset → Entraînement IA
  - Export données historique
  - Upload firmware OTA
- **Tests cross-browser** : Chrome, Firefox, Edge

#### Tests d'intégration
- **API mocking** : MSW (Mock Service Worker)
- **WebSocket mocking** : mock socket.io

---

## 📦 6. Livrables attendus

### Phase 1 : Foundation (3-4 semaines)
- ✅ Setup projet (Vite + React + TS + Tailwind)
- ✅ Architecture dossiers
- ✅ Design system (composants de base)
- ✅ **Intégration Keycloak SSO**
  - Configuration client frontend
  - ProtectedRoute component
  - Hooks useAuth, usePermissions
  - Gestion tokens & refresh
- ✅ **Gestion multi-organisation**
  - Store organizationStore
  - Sélecteur d'organisation (Header)
  - Context isolation
- ✅ Layout principal (Sidebar, Header avec sélecteur org)
- ✅ Routing avec protection par rôles

### Phase 2 : Core Features (4-5 semaines)
- ✅ Dashboard temps réel (WebSocket)
- ✅ Pages capteurs (TOF + AS7341)
- ✅ Module IA - Monitoring
- ✅ Historique & filtres (avec isolation par org)
- ✅ **Matrice de permissions**
  - Affichage conditionnel selon rôles
  - Restrictions API selon org_id

### Phase 3 : Advanced Features (4-5 semaines)
- ✅ Entraînement IA
- ✅ Système & santé
- ✅ Firmware OTA
- ✅ Notifications
- ✅ **Module Administration**
  - Gestion utilisateurs
  - Gestion organisations (super_admin)
  - Logs d'audit
  - Invitation users via Keycloak

### Phase 4 : Polish & Testing (2-3 semaines)
- ✅ Tests E2E complets (avec scénarios multi-org)
- ✅ Tests permissions & RBAC
- ✅ Optimisations performance
- ✅ Documentation (Storybook)
- ✅ Déploiement CI/CD
- ✅ **Tests sécurité**
  - Validation isolation données
  - Tests CSRF/XSS
  - Audit Keycloak config

### Documentation
- **README.md** : setup, architecture, conventions
- **CONTRIBUTING.md** : guidelines pour devs
- **API_INTEGRATION.md** : specs API backend + contrats Keycloak
- **KEYCLOAK_SETUP.md** : configuration realm, roles, clients
- **DEPLOYMENT.md** : procédure de déploiement (frontend + Keycloak)
- **PERMISSIONS_MATRIX.md** : tableau complet rôles/permissions
- **Storybook** : documentation composants interactifs
- **MULTIORG_GUIDE.md** : guide gestion multi-organisation

### Checklist de sécurité pré-production
- [ ] Keycloak configuré avec HTTPS uniquement
- [ ] Refresh tokens stockés en httpOnly cookies (si applicable)
- [ ] Rate limiting activé sur API
- [ ] CSP headers configurés
- [ ] Audit de toutes les permissions RBAC
- [ ] Tests d'isolation multi-org validés
- [ ] Logs d'audit fonctionnels
- [ ] Backup/restore procedure documentée
- [ ] Plan de rollback firmware/IA testé

---

## 🚀 7. Points d'attention & Best practices

### Gestion d'état
- **Données temps réel** : WebSocket → Zustand store
- **Cache API** : TanStack Query (staleTime, refetchInterval)
- **Optimistic updates** : UX fluide sur mutations

### Gestion des erreurs
- **Boundaries** : React Error Boundary par section
- **Toast notifications** : pour erreurs non-critiques
- **Modal erreur** : pour erreurs bloquantes
- **Retry logic** : sur échecs réseau

### WebSocket best practices
- **Reconnexion auto** : exponentiel backoff
- **Heartbeat** : ping/pong toutes les 30s
- **Buffer messages** : pendant déconnexion
- **Cleanup** : close socket on unmount

### Performance monitoring
- **Web Vitals** : LCP, FID, CLS
- **Custom metrics** : temps inférence IA, lag WebSocket
- **Error tracking** : Sentry ou équivalent

---

## 📞 8. Contact & Support

**Questions techniques** :  
[Insérer contact tech lead]

**Accès services** :

**Backend API** :
- DEV: `http://localhost:3000`
- STAGING: `https://api-staging.foodquality.local`
- PROD: `https://api.foodquality.local`
- Documentation: `/docs` (Swagger/OpenAPI)

**Keycloak (SSO)** :
- DEV: `http://localhost:8080`
- STAGING: `https://auth-staging.foodquality.local`
- PROD: `https://auth.foodquality.local`
- Admin Console: `/admin`
- Realm: `FoodQuality`

**WebSocket** :
- DEV: `ws://localhost:3000/ws`
- STAGING: `wss://api-staging.foodquality.local/ws`
- PROD: `wss://api.foodquality.local/ws`

**TimescaleDB** :
- Accès via API uniquement (pas d'accès direct frontend)

**Environnements Frontend** :  
- DEV: `http://localhost:5173`
- STAGING: `https://staging.foodquality.local`
- PROD: `https://app.foodquality.local`

---

## 🔐 9. Configuration des variables d'environnement

**Fichier `.env.development`** :
```bash
# Keycloak
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=FoodQuality
VITE_KEYCLOAK_CLIENT_ID=foodquality-frontend

# API Backend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws

# Features flags
VITE_ENABLE_MULTIORG=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_WHITE_LABEL=false

# Monitoring (optionnel)
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

**Fichier `.env.production`** :
```bash
# Keycloak
VITE_KEYCLOAK_URL=https://auth.foodquality.local
VITE_KEYCLOAK_REALM=FoodQuality
VITE_KEYCLOAK_CLIENT_ID=foodquality-frontend

# API Backend
VITE_API_URL=https://api.foodquality.local
VITE_WS_URL=wss://api.foodquality.local/ws

# Features
VITE_ENABLE_MULTIORG=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_WHITE_LABEL=true

# Monitoring
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_ANALYTICS_ID=G-XXXXXXXXXX
```

**Usage dans le code** :
```typescript
// src/config/env.ts
export const config = {
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL,
    wsUrl: import.meta.env.VITE_WS_URL,
  },
  features: {
    multiOrg: import.meta.env.VITE_ENABLE_MULTIORG === 'true',
    auditLogs: import.meta.env.VITE_ENABLE_AUDIT_LOGS === 'true',
    whiteLabel: import.meta.env.VITE_ENABLE_WHITE_LABEL === 'true',
  },
};
```

---

## 📚 10. Ressources complémentaires

**Documentation** :
- Keycloak: https://www.keycloak.org/docs/latest/
- React: https://react.dev/
- TailwindCSS: https://tailwindcss.com/docs
- Recharts: https://recharts.org/
- Three.js: https://threejs.org/docs/
- TanStack Query: https://tanstack.com/query/

**Outils recommandés** :
- **VS Code** avec extensions :
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript + JavaScript
- **Postman/Insomnia** : tester API backend
- **React DevTools** : debugging
- **Redux DevTools** : si utilisation Redux (sinon Zustand DevTools)

---

**Document version 1.1 - Octobre 2025**  
*Mise à jour : Intégration Keycloak SSO + Gestion Multi-Organisation*, consumers.SensorConsumer.as_asgi()),
]
```

**Middleware auth WebSocket** :
```python
# apps/websocket/middleware.py
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from urllib.parse import parse_qs
from keycloak import KeycloakOpenID

class TokenAuthMiddleware(BaseMiddleware):
    """Authentifier WebSocket via token dans query params"""
    
    async def __call__(self, scope, receive, send):
        # Extraire token du query string
        query_string = parse_qs(scope['query_string'].decode())
        token = query_string.get('token', [None])[0]
        
        if token:
            user_info = await self.authenticate_token(token)
            if user_info:
                scope['user'] = await self.get_user(user_info)
                scope['organization_id'] = user_info.get('organization_id')
                scope['user_roles'] = user_info.get('realm_access', {}).get('roles', [])
            else:
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)
    
    @database_sync_to_async
    def authenticate_token(self, token):
        keycloak_openid = KeycloakOpenID(...)
        try:
            return keycloak_openid.introspect(token)
        except:
            return None
```

**Configuration ASGI** :
```python
# config/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from apps.websocket.middleware import TokenAuthMiddleware
from apps.websocket import routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": TokenAuthMiddleware(
        URLRouter(
            routing.websocket_urlpatterns
        )
    ),
})
```

#### Envoi de données via WebSocket (depuis views/signals)

```python
# apps/sensors/views.py
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

class SensorDataView(APIView):
    """Recevoir données capteur et broadcaster aux clients WebSocket"""
    
    def post(self, request):
        sensor_data = request.data
        org_id = sensor_data.get('organization_id')
        
        # Sauvegarder en DB
        SensorReading.objects.create(**sensor_data)
        
        # Broadcaster via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'dashboard_{org_id}',
            {
                'type': 'sensor_update',
                'data': sensor_data
            }
        )
        
        return Response({'status': 'ok'}, status=201)
```

#### Frontend - Connexion WebSocket

```typescript
// services/websocket.ts
import { config } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(organizationId: string) {
    const token = useAuthStore.getState().token;
    const wsUrl = `${config.api.wsUrl}/dashboard/?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connecté');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket fermé');
      this.attemptReconnect();
    };
  }
  
  private handleMessage(data: any) {
    const { type, data: payload } = data;
    
    switch (type) {
      case 'sensor_update':
        // Mettre à jour store avec nouvelles données
        useDashboardStore.getState().updateSensorData(payload);
        break;
      case 'analysis_complete':
        // Ajouter nouvelle analyse
        useDashboardStore.getState().addAnalysis(payload);
        break;
      case 'alert':
        // Afficher notification
        toast.warning(payload.message);
        break;
    }
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        const orgId = useOrganizationStore.getState().currentOrg?.id;
        if (orgId) {
          this.connect(orgId);
        }
      }, delay);
    }
  }
  
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
```

---

## 📄 3. Spécifications détaillées des pages

```
src/
├── assets/              # Images, icônes, fonts
├── components/          
│   ├── common/          # Boutons, inputs, modals
│   ├── charts/          # Wrappers graphiques réutilisables
│   ├── sensors/         # Composants capteurs spécifiques
│   ├── layouts/         # Header, Sidebar, Footer
│   ├── auth/            # Composants Keycloak, ProtectedRoute
│   └── organizations/   # Sélecteur org, gestion multi-site
├── pages/               # Pages principales
│   ├── Auth/
│   ├── Dashboard/
│   ├── Sensors/
│   ├── AI/
│   ├── History/
│   ├── System/
│   ├── Admin/           # Gestion users, organisations
│   └── Unauthorized/
├── hooks/               # Custom hooks (useAuth, usePermissions, useOrg)
├── services/            
│   ├── api.ts           # Axios config, interceptors
│   ├── websocket.ts     # WebSocket client
│   └── keycloak.ts      # Keycloak init & utils
├── stores/              # Zustand stores
│   ├── authStore.ts
│   ├── organizationStore.ts
│   └── dataStore.ts
├── types/               # TypeScript definitions
│   ├── auth.types.ts
│   ├── organization.types.ts
│   └── sensor.types.ts
├── utils/               # Helpers, formatters
├── constants/           # Config, enums, permissions matrix
└── styles/              # Global styles, themes
```

---

## 📄 3. Spécifications détaillées des pages

### 3.1 Authentification (`/login`)

#### Fonctionnalités
- **SSO via Keycloak** : redirection automatique vers Keycloak
- Support **multi-méthodes** :
  - Username/Password
  - LDAP/Active Directory
  - Social Login (Google, Microsoft) si configuré
  - MFA (TOTP, SMS) si activé
- **Remember me** : refresh token longue durée (30 jours)
- **Lien "Mot de passe oublié"** : géré par Keycloak
- **Sélection organisation** : si user a accès à plusieurs orgs

#### Flow d'authentification détaillé

```
┌─────────────────────────────────────────────────┐
│ 1. User visite /dashboard (non connecté)       │
│    └─> ProtectedRoute détecte absence token    │
│    └─> Redirect vers /login                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 2. Page /login affiche bouton "Se connecter"   │
│    User clique                                  │
│    └─> keycloak.login() appelé                 │
│    └─> Redirect vers Keycloak                  │
│        https://auth.domain.com/realms/Food...   │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 3. Page Keycloak (branding personnalisable)    │
│    • Formulaire login                           │
│    • Validation credentials                     │
│    • MFA si activé                              │
│    • Consent si nécessaire                      │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 4. Callback /auth/callback?code=XXX            │
│    Frontend échange code contre tokens (PKCE)  │
│    └─> Access Token (JWT, 5 min)               │
│    └─> Refresh Token (30 jours)                │
│    └─> ID Token (user info)                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 5. Décodage JWT & extraction données           │
│    • Roles: ['org_admin', 'quality_manager']   │
│    • Organization IDs: ['uuid-lyon', 'uuid...']│
│    • User info: name, email, etc.              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 6. Si user a plusieurs orgs:                   │
│    └─> Afficher modal sélection organisation   │
│    Sinon:                                       │
│    └─> Auto-sélection unique org               │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ 7. Initialisation app                          │
│    • Store auth (user, roles, tokens)          │
│    • Store org (currentOrg)                    │
│    • Fetch settings org                        │
│    • Init WebSocket avec token                 │
│    └─> Redirect vers /dashboard                │
└─────────────────────────────────────────────────┘
```

#### UI/UX

**Page login minimaliste** :
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [Logo FoodQuality]                 │
│                                                 │
│     Système de Qualification Alimentaire       │
│            Temps Réel                           │
│                                                 │
│     ┌─────────────────────────────────┐        │
│     │   [🔐 Se connecter via SSO]    │        │
│     └─────────────────────────────────┘        │
│                                                 │
│     Première connexion ? Contactez votre       │
│     administrateur pour créer un compte        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Modal sélection organisation** (si multi-org) :
```
┌─────────────────────────────────────────────────┐
│ Sélectionnez votre organisation                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚪ 📍 Usine Lyon                               │
│     Production • 24 utilisateurs                │
│                                                 │
│  ⚪ 📍 Site Bordeaux                            │
│     Production • 18 utilisateurs                │
│                                                 │
│  ⚪ 📍 Lab Paris                                │
│     R&D • 6 utilisateurs                        │
│                                                 │
│  □ Se souvenir de mon choix                     │
│                                                 │
│     [Annuler]              [Continuer]          │
└─────────────────────────────────────────────────┘
```

#### Gestion de session

**Token refresh automatique** :
```typescript
// Hook useTokenRefresh
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      // Refresh si expire dans < 70 secondes
      const refreshed = await keycloak.updateToken(70);
      
      if (refreshed) {
        console.log('Token refreshed');
        // Mettre à jour store avec nouveau token
        authStore.setToken(keycloak.token);
      }
    } catch (error) {
      console.error('Failed to refresh token', error);
      // Si refresh échoue, forcer re-login
      keycloak.login();
    }
  }, 60000); // Check toutes les minutes
  
  return () => clearInterval(interval);
}, []);
```

**Logout** :
```typescript
const handleLogout = async () => {
  // Nettoyage local
  authStore.reset();
  organizationStore.reset();
  wsClient.disconnect();
  
  // Logout Keycloak (invalide token serveur)
  await keycloak.logout({
    redirectUri: window.location.origin + '/login'
  });
};
```

**Session timeout** :
```typescript
// Détection inactivité (optionnel)
let inactivityTimer;

const resetInactivityTimer = () => {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Après 30 min d'inactivité
    showModal({
      title: 'Session expirée',
      message: 'Votre session a expiré suite à une inactivité prolongée.',
      onConfirm: () => keycloak.login()
    });
  }, 30 * 60 * 1000);
};

// Reset sur activité user
window.addEventListener('mousemove', resetInactivityTimer);
window.addEventListener('keypress', resetInactivityTimer);
```

#### Accessibilité
- **Navigation clavier** : bouton SSO focusable via Tab
- **Screen reader** : labels ARIA explicites
- **Contraste** : bouton principal avec ratio 4.5:1 minimum
- **Messages d'erreur** : annoncés par screen readers

#### Sécurité
- **PKCE** : Proof Key for Code Exchange activé
- **State parameter** : protection CSRF
- **Nonce** : protection replay attacks
- **Silent refresh** : iframe cachée pour refresh sans interruption
- **Secure cookies** : si tokens stockés en cookie (optionnel)

---

### 3.2 Dashboard Principal (`/dashboard`)

#### Objectif
Vue d'ensemble temps réel de l'état du système et de la production.

#### Sections

**A. Header KPIs** (4 cards horizontales)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Produits    │ Conformité  │ Taux rejet  │ Uptime      │
│ analysés/h  │ 94.5%       │ 5.5%        │ 99.8%       │
│ 847 ↑12%    │ 🟢          │ 🟡          │ 🟢          │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**B. Visualisation temps réel centrale** (50% largeur)
- Stream vidéo ou image du produit analysé
- Overlay : résultat IA en temps réel (label + confiance)
- Bounding box si détection d'anomalie localisée

**C. Graphiques live** (2 colonnes)
- **Gauche** : 
  - Courbe qualité spectrale (10 dernières minutes)
  - Distribution des classifications (pie chart)
- **Droite** :
  - Profil 3D TOF du dernier scan
  - Historique des scores IA (line chart temps réel)

**D. Alertes & Notifications** (sidebar droite)
- Liste des 5 dernières alertes avec timestamp
- Code couleur : critique (rouge), warning (orange), info (bleu)
- Action rapide : "Voir détails", "Marquer comme résolu"

**E. Timeline de production** (footer)
- Barre horizontale : derniers 50 produits analysés
- Code couleur selon conformité
- Clic → détails du scan

#### Interactions
- **Refresh auto** : toutes les 2 secondes
- **Pause stream** : bouton pour figer l'affichage
- **Filtres rapides** : "Dernière heure", "Quart actuel", "Aujourd'hui"
- **Export snapshot** : télécharger état actuel en PDF

#### Données WebSocket
```typescript
interface DashboardUpdate {
  timestamp: number;
  product: {
    id: string;
    classification: string;
    confidence: number;
    qualityScore: number;
  };
  sensors: {
    tof: { distance: number, volume: number };
    as7341: number[]; // 11 canaux
  };
  alerts: Alert[];
}
```

---

### 3.3 Module Capteurs

#### 3.3.1 Page TOF (`/sensors/tof`)

**Objectif** : Analyse morphologique 3D en temps réel

**Layout** :
```
┌────────────────────────────────────────────────────┐
│ Header : TOF VL53L5CX | Status: 🟢 Active         │
├─────────────────┬──────────────────────────────────┤
│                 │                                  │
│  Vue 3D live    │  Métriques temps réel            │
│  (Three.js)     │  • Distance: 245 mm              │
│                 │  • Volume estimé: 127 cm³        │
│  Point cloud    │  • Aire surface: 45 cm²          │
│  avec heatmap   │  • Résolution: 8x8 zones         │
│  de distance    │                                  │
│                 │  Graphique historique distance   │
│                 │  (scrollable, 500 derniers pts)  │
│                 │                                  │
├─────────────────┴──────────────────────────────────┤
│ Contrôles & Calibration                            │
│ [Calibrer] [Exporter données] [Réglages avancés]  │
└────────────────────────────────────────────────────┘
```

**Fonctionnalités avancées** :
- **Modes de visualisation** : 
  - Point cloud 3D rotatif
  - Heatmap 2D (top view)
  - Profil en coupe (side view)
- **Calibration** : assistant step-by-step
- **Seuils d'alerte** : configurables (distance min/max)
- **Enregistrement séquence** : capture 10s de données pour debug

**Données** :
```typescript
interface TOFData {
  timestamp: number;
  matrix: number[][]; // 8x8 distances en mm
  ambient: number;
  signalRate: number[];
  rangeStatus: number[];
}
```

#### 3.3.2 Page AS7341 (`/sensors/as7341`)

**Objectif** : Analyse spectrale multi-canaux

**Layout** :
```
┌────────────────────────────────────────────────────┐
│ Header : AS7341 Spectral | Status: 🟢 Active      │
├────────────────────────────────────────────────────┤
│                                                    │
│  Spectrogramme live (Plotly)                       │
│  ┌──────────────────────────────────────────────┐ │
│  │   Intensité                                   │ │
│  │      ▲                                        │ │
│  │      │     ╱╲                                 │ │
│  │      │    ╱  ╲      ╱╲                        │ │
│  │      │   ╱    ╲    ╱  ╲                       │ │
│  │      │  ╱      ╲  ╱    ╲                      │ │
│  │      └─────────────────────────> λ (nm)       │ │
│  │       415  445  480  515  555  590  630  680  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
├────────────────┬───────────────────────────────────┤
│ Canaux         │  Référence vs Actuel              │
│ F1 (415nm): ██ │  Overlay comparaison avec         │
│ F2 (445nm): ██ │  signature spectrale de           │
│ F3 (480nm): ██ │  référence pour détection         │
│ F4 (515nm): ██ │  d'anomalies (oxydation, etc.)    │
│ F5 (555nm): ██ │                                   │
│ F6 (590nm): ██ │  Écart RMS: 4.2%                  │
│ F7 (630nm): ██ │  Alerte si > 10%                  │
│ F8 (680nm): ██ │                                   │
│ NIR (910nm): █ │                                   │
│ Clear:      ██ │                                   │
│ Flicker:    ── │                                   │
└────────────────┴───────────────────────────────────┘
```

**Fonctionnalités** :
- **Modes d'intégration** : 50ms, 100ms, 500ms (ajustable)
- **Bibliothèque de signatures** : enregistrer/comparer profils spectraux
- **Détection automatique** : alertes si écart > seuil configurable
- **Export données** : CSV avec timestamps
- **Graphique waterfall** : évolution spectrale sur 60s

**Données** :
```typescript
interface AS7341Data {
  timestamp: number;
  channels: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    NIR: number;
    Clear: number;
  };
  flicker: number;
  integrationTime: number;
}
```

---

### 3.4 Module IA

#### 3.4.1 Dashboard IA (`/ai/monitor`)

**Objectif** : Monitoring de l'inférence en temps réel

**Sections** :

**A. Statut du modèle actif**
```
┌────────────────────────────────────────┐
│ Modèle: FoodQuality_v2.3.1             │
│ Architecture: ResNet-50 + Transformer  │
│ Inférences/s: 12.4                     │
│ Latence moy: 47ms                      │
│ Précision (validation): 96.2%          │
└────────────────────────────────────────┘
```

**B. Inférences temps réel** (table)
| Timestamp | Image | Prédiction | Confiance | TOF | Spectral | Statut |
|-----------|-------|------------|-----------|-----|----------|--------|
| 14:32:51 | 🖼️ | Pomme saine | 98.5% | ✓ | ✓ | 🟢 |
| 14:32:50 | 🖼️ | Banane mûre | 87.2% | ✓ | ✓ | 🟢 |
| 14:32:49 | 🖼️ | Orange altérée | 92.1% | ✓ | ⚠️ | 🟡 |

**C. Distribution des prédictions** (pie chart dynamique)

**D. Matrice de confusion** (si ground truth disponible)

**E. Graphiques de performance**
- Latence d'inférence (rolling window 1h)
- Distribution des scores de confiance
- Taux de prédictions par classe

#### 3.4.2 Entraînement IA (`/ai/training`)

**Objectif** : Gérer datasets, entraînements et versions de modèles

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Onglets: [Datasets] [Entraînements] [Modèles]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [TAB: Datasets]                                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ Liste des datasets                            │ │
│  │ • FoodQuality_Train_v3 (12,450 samples)       │ │
│  │   └─ Classes: 15 | Période: 2024-10-2025-01  │ │
│  │ • FoodQuality_Validation (3,200 samples)      │ │
│  │ • FoodQuality_Test (1,500 samples)            │ │
│  │                                               │ │
│  │ [+ Créer dataset depuis TimescaleDB]          │ │
│  │ Période: [___] à [___]                        │ │
│  │ Classes: [Toutes ▼]                           │ │
│  │ Filtres: TOF ✓ | AS7341 ✓ | Labels manuels ✓ │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [TAB: Entraînements]                               │
│  ┌───────────────────────────────────────────────┐ │
│  │ Nouvel entraînement                           │ │
│  │ Architecture: [ResNet-50 ▼]                   │ │
│  │ Dataset train: [FoodQuality_Train_v3 ▼]       │ │
│  │ Dataset val: [FoodQuality_Validation ▼]       │ │
│  │ Hyperparamètres:                              │ │
│  │   • Learning rate: [0.001]                    │ │
│  │   • Batch size: [32]                          │ │
│  │   • Epochs: [50]                              │ │
│  │   • Augmentation: ✓                           │ │
│  │                                               │ │
│  │ [Lancer entraînement]                         │ │
│  │                                               │ │
│  │ Historique des entraînements:                 │ │
│  │ Training_20251008_143055 - En cours (epoch 12)│ │
│  │   └─ Loss: 0.342 | Val accuracy: 94.1%       │ │
│  │   └─ [Voir TensorBoard] [Arrêter]            │ │
│  │ Training_20251005_092314 - Terminé ✓          │ │
│  │   └─ Best val accuracy: 96.2% (epoch 43)     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [TAB: Modèles]                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Modèles déployables                           │ │
│  │                                               │ │
│  │ • FoodQuality_v2.3.1 [ACTIF]                  │ │
│  │   ├─ Précision: 96.2%                         │ │
│  │   ├─ F1-Score: 0.954                          │ │
│  │   ├─ Latence: 47ms                            │ │
│  │   └─ [Télécharger] [Métriques détaillées]    │ │
│  │                                               │ │
│  │ • FoodQuality_v2.3.0                          │ │
│  │   ├─ Précision: 95.8%                         │ │
│  │   └─ [Activer] [Comparer] [Supprimer]        │ │
│  │                                               │ │
│  │ A/B Testing:                                  │ │
│  │ [Activer split 80/20 entre v2.3.1 et v2.3.0] │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités clés** :
- **Création datasets intelligente** : requêtes TimescaleDB avec filtres avancés
- **Monitoring entraînement live** : intégration TensorBoard ou graphiques custom
- **Comparaison modèles** : métriques côte à côte, matrice de confusion
- **A/B Testing** : déploiement progressif (canary deployment)
- **MLOps** : versioning automatique, rollback rapide

---

### 3.5 Historique & Analytics (`/history`)

**Objectif** : Explorer et analyser les données historiques

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Filtres avancés                                     │
│ Période: [01/10/25 ▼] - [08/10/25 ▼]              │
│ Classes: [Toutes ▼] Confiance: [> 80% ▼]          │
│ Capteurs: TOF ✓ AS7341 ✓ | Statut: [Tous ▼]       │
│ [Appliquer] [Réinitialiser] [Sauver comme preset] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Résultats: 15,847 analyses                         │
│                                                     │
│  Graphiques analytiques (2x2 grid)                 │
│  ┌─────────────────┬─────────────────────────────┐ │
│  │ Évolution       │ Distribution classes        │ │
│  │ conformité      │ (pie chart)                 │ │
│  │ (line chart)    │                             │ │
│  ├─────────────────┼─────────────────────────────┤ │
│  │ Heatmap         │ Top anomalies détectées     │ │
│  │ horaire         │ (bar chart)                 │ │
│  └─────────────────┴─────────────────────────────┘ │
│                                                     │
│  Timeline interactive                               │
│  ═══════════════════════════════════════════════   │
│  ▮▯▮▮▮▯▮▮▮▮▯▮▮▮▮▮▮▯▮▮▮▮▮▮▯▮▮▮▮▮▮▮▮▮▮▮▮▯▮▮▮▮▮▮   │
│  └─ Zoom, brush pour sélection, clic pour détails  │
│                                                     │
│  Table détaillée (virtualisée, 100 lignes visibles)│
│  [ID] [Timestamp] [Classe] [Conf.] [TOF] [Spec.] […│
│  ───────────────────────────────────────────────── │
│  [Export CSV] [Export PDF rapport] [Partager URL] │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Recherche full-text** : par ID, classe, notes
- **Filtres combinables** : AND/OR logic
- **Presets de filtres** : "Dernières 24h", "Semaine passée", "Anomalies uniquement"
- **Export massif** : CSV, JSON, Excel
- **Génération rapports PDF** : template professionnel avec graphiques
- **Annotations** : ajouter notes sur analyses spécifiques
- **Comparaison** : sélectionner 2+ analyses et les comparer côte à côte

**Optimisations** :
- **Virtualisation** : react-window pour tables longues
- **Pagination côté serveur** : charger par chunks de 100
- **Debounce** : recherche avec délai 300ms

---

### 3.6 Génération de Rapports (`/reports`)

**Objectif** : Créer, personnaliser et exporter des rapports automatisés pour analyse qualité et conformité

**Accès** : super_admin, org_admin, quality_manager, data_analyst

#### Layout principal

```
┌─────────────────────────────────────────────────────┐
│ Génération de Rapports                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Onglets: [📊 Nouveau] [📁 Mes rapports] [⏰ Planifiés] [📚 Templates] │
│                                                     │
│  [TAB: Nouveau Rapport]                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1️⃣ Type de rapport                          │   │
│  │ ⚪ Rapport de production                     │   │
│  │    └─ Analyses, conformité, rejets          │   │
│  │ ⚪ Rapport qualité détaillé                  │   │
│  │    └─ Spectres, TOF, tendances              │   │
│  │ ⚪ Performance capteurs                      │   │
│  │    └─ Santé hardware, calibration           │   │
│  │ ⚪ Performance IA                            │   │
│  │    └─ Métriques modèle, inférences          │   │
│  │ ⚪ Rapport d'audit                           │   │
│  │    └─ Logs, actions utilisateurs            │   │
│  │ ⚪ Rapport personnalisé                      │   │
│  │    └─ Sélection manuelle sections           │   │
│  │                                             │   │
│  │ 2️⃣ Période                                  │   │
│  │ ◉ Période fixe                              │   │
│  │   Du: [01/10/2025] Au: [08/10/2025]        │   │
│  │ ⚪ Dernier(s): [7 ▼] [jours ▼]             │   │
│  │ ⚪ Quart de travail: [Matin ▼] [Hier ▼]    │   │
│  │                                             │   │
│  │ 3️⃣ Organisation(s)                          │   │
│  │ ☑ Usine Lyon                                │   │
│  │ ☑ Site Bordeaux                             │   │
│  │ ☐ Lab Paris                                 │   │
│  │ [Sélectionner tout] [Comparer sites]        │   │
│  │                                             │   │
│  │ 4️⃣ Filtres additionnels (optionnel)        │   │
│  │ Classes produits: [Toutes ▼]                │   │
│  │ Plage confiance IA: [80% - 100%]           │   │
│  │ Statut: [Conforme] [Non-conforme] [Tous]   │   │
│  │                                             │   │
│  │ 5️⃣ Sections à inclure (personnalisé)       │   │
│  │ ☑ Résumé exécutif                           │   │
│  │ ☑ KPIs principaux                           │   │
│  │ ☑ Graphiques évolution                      │   │
│  │ ☑ Analyse statistique                       │   │
│  │ ☑ Détails anomalies                         │   │
│  │ ☑ Recommandations                           │   │
│  │ ☐ Données brutes (annexe)                   │   │
│  │ ☐ Signatures spectrales                     │   │
│  │                                             │   │
│  │ 6️⃣ Format d'export                          │   │
│  │ ◉ PDF (recommandé)                          │   │
│  │ ⚪ Excel (.xlsx) avec onglets               │   │
│  │ ⚪ PowerPoint (.pptx) présentation          │   │
│  │ ⚪ CSV (données uniquement)                 │   │
│  │                                             │   │
│  │ Options PDF:                                │   │
│  │ ☑ Inclure logo organisation                 │   │
│  │ ☑ Page de garde                             │   │
│  │ ☑ Table des matières                        │   │
│  │ ☑ Numérotation pages                        │   │
│  │ Template: [Standard ▼] [Custom disponibles] │   │
│  │                                             │   │
│  │ 7️⃣ Actions                                  │   │
│  │ Titre: [Rapport Qualité S41-2025_________] │   │
│  │ [Aperçu] [Générer maintenant] [Planifier]  │   │
│  │                                             │   │
│  │ ⏱️ Temps estimé: ~45 secondes               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### TAB: Mes rapports

```
┌─────────────────────────────────────────────────────┐
│ Mes Rapports (47 rapports)                          │
│ Recherche: [🔍 _____] Tri: [Plus récent ▼]        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Liste des rapports générés                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 Rapport Qualité S41-2025                 │   │
│  │    Production • 01-08/10/2025 • Usine Lyon  │   │
│  │    Généré le: 08/10/2025 14:32              │   │
│  │    Généré par: Marie Dupont                 │   │
│  │    Taille: 2.4 MB • 24 pages                │   │
│  │    [👁️ Prévisualiser] [⬇️ Télécharger]      │   │
│  │    [📧 Partager] [🗑️ Supprimer]             │   │
│  │                                             │   │
│  │    Tags: #hebdomadaire #production          │   │
│  │    Commentaire: RAS, bonne conformité       │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📊 Performance Capteurs - Septembre         │   │
│  │    Technique • 01-30/09/2025 • Multi-sites  │   │
│  │    Généré le: 01/10/2025 09:15              │   │
│  │    [👁️] [⬇️] [📧] [📋 Dupliquer] [🗑️]     │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📈 Analyse IA - Q3 2025                     │   │
│  │    IA • 01/07-30/09/2025 • Tous sites       │   │
│  │    Généré le: 30/09/2025 18:45              │   │
│  │    [👁️] [⬇️] [📧] [🗑️]                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Export archives] [Paramètres de rétention]       │
└─────────────────────────────────────────────────────┘
```

#### TAB: Rapports planifiés

```
┌─────────────────────────────────────────────────────┐
│ Rapports Planifiés (5 actifs)                       │
│ [+ Nouveau rapport planifié]                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟢 Rapport Hebdomadaire Production          │   │
│  │    Type: Production • Format: PDF           │   │
│  │    Fréquence: Tous les lundis à 08:00       │   │
│  │    Organisation: Usine Lyon                 │   │
│  │    Destinataires:                           │   │
│  │      • marie.dupont@mail.com                │   │
│  │      • jean.martin@mail.com                 │   │
│  │    Prochain: Lundi 14/10/2025 08:00         │   │
│  │    [Modifier] [Désactiver] [Exécuter maintenant] │
│  ├─────────────────────────────────────────────┤   │
│  │ 🟢 Rapport Mensuel Direction                │   │
│  │    Type: Personnalisé • Format: PowerPoint  │   │
│  │    Fréquence: 1er du mois à 06:00           │   │
│  │    Multi-sites (comparatif)                 │   │
│  │    Prochain: 01/11/2025 06:00               │   │
│  │    [Modifier] [Désactiver]                  │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 🔴 Rapport Audit Trimestriel (désactivé)   │   │
│  │    Type: Audit • Format: PDF                │   │
│  │    Fréquence: Fin de trimestre              │   │
│  │    [Modifier] [Activer] [Supprimer]         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### TAB: Templates

```
┌─────────────────────────────────────────────────────┐
│ Bibliothèque de Templates                           │
│ [+ Créer template personnalisé]                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Templates standards                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📋 Production Standard                       │   │
│  │    Sections: KPIs, Conformité, Rejets       │   │
│  │    Utilisé: 142 fois                        │   │
│  │    [Utiliser] [Aperçu] [Dupliquer]          │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 📊 Qualité Détaillée                        │   │
│  │    Sections: Spectres, TOF, Tendances       │   │
│  │    Utilisé: 87 fois                         │   │
│  │    [Utiliser] [Aperçu] [Dupliquer]          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Mes templates personnalisés (3)                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📄 Rapport Direction Lyon                   │   │
│  │    Créé le: 15/09/2025 • Modifié: 02/10/25 │   │
│  │    [Utiliser] [Modifier] [Supprimer]        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### Fonctionnalités avancées

**1. Aperçu en temps réel**
- Modal avec preview du rapport
- Navigation entre sections
- Possibilité d'ajuster avant génération finale

**2. Génération asynchrone**
```typescript
// Flow génération rapport
interface ReportGenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;           // 0-100
  estimatedTime: number;      // secondes
  resultUrl?: string;         // URL de téléchargement
  error?: string;
}

// 1. User lance génération
const response = await api.post('/api/reports/generate', reportConfig);
// { job_id: 'uuid-xxxx', status: 'queued' }

// 2. Polling status ou WebSocket
const jobId = response.data.job_id;
const interval = setInterval(async () => {
  const status = await api.get(`/api/reports/jobs/${jobId}`);
  
  if (status.data.status === 'completed') {
    clearInterval(interval);
    // Afficher lien téléchargement
    showNotification('Rapport prêt !', { 
      downloadUrl: status.data.result_url 
    });
  }
}, 2000);

// Alternative WebSocket
ws.on(`report:${jobId}`, (data) => {
  updateProgress(data.progress);
  if (data.status === 'completed') {
    showDownloadLink(data.result_url);
  }
});
```

**3. Backend Django - Génération rapports**

```python
# views.py (DRF)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .tasks import generate_report_task
from .models import Report, ReportJob
from .serializers import ReportConfigSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_report(request):
    """Créer une tâche Celery pour génération asynchrone"""
    serializer = ReportConfigSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # Créer job
    job = ReportJob.objects.create(
        user=request.user,
        organization=request.user.organization,
        config=serializer.validated_data,
        status='queued'
    )
    
    # Lancer tâche Celery
    task = generate_report_task.delay(job.id)
    
    return Response({
        'job_id': str(job.id),
        'status': 'queued',
        'task_id': task.id
    }, status=202)

# tasks.py (Celery)
from celery import shared_task
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
# ... autres imports

@shared_task(bind=True)
def generate_report_task(self, job_id):
    """Génération rapport en background"""
    job = ReportJob.objects.get(id=job_id)
    
    try:
        job.status = 'processing'
        job.save()
        
        # Récupérer données depuis TimescaleDB
        data = fetch_report_data(job.config)
        
        # Générer PDF avec ReportLab ou WeasyPrint
        pdf_buffer = generate_pdf(data, job.config)
        
        # Sauvegarder fichier
        filename = f"report_{job.id}.pdf"
        job.result_file.save(filename, ContentFile(pdf_buffer.getvalue()))
        
        job.status = 'completed'
        job.progress = 100
        job.save()
        
        # Notification WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_{job.user.id}',
            {
                'type': 'report_completed',
                'job_id': str(job.id),
                'download_url': job.result_file.url
            }
        )
        
    except Exception as e:
        job.status = 'failed'
        job.error = str(e)
        job.save()
        raise
```

**4. Types de rapports prédéfinis**

| Type | Sections principales | Durée génération |
|------|---------------------|------------------|
| **Production** | KPIs, Conformité, Timeline, Top rejets | ~30s |
| **Qualité Détaillée** | Spectres, TOF 3D, Statistiques, Anomalies | ~60s |
| **Performance Capteurs** | Santé hardware, Calibration, Dérives | ~20s |
| **Performance IA** | Métriques modèle, Confusion matrix, Latence | ~40s |
| **Audit** | Logs actions, Changements config, Accès | ~25s |
| **Comparatif Multi-sites** | Benchmark sites, Classements, Écarts | ~90s |

**5. Personnalisation template (éditeur visuel)**

```
┌─────────────────────────────────────────────────────┐
│ Éditeur de Template                                 │
├─────────────────────────────────────────────────────┤
│ Glisser-déposer sections:                           │
│                                                     │
│ Disponibles:          │  Rapport (ordre):           │
│ ┌──────────────┐      │  1. [≡] Résumé exécutif    │
│ │ 📊 Graphiques│      │  2. [≡] KPIs principaux    │
│ │ 📈 KPIs      │  =>  │  3. [≡] Graphique temps    │
│ │ 📋 Tables    │      │  4. [≡] Table anomalies    │
│ │ 🔬 Spectres  │      │  5. [≡] Recommandations    │
│ │ 🎯 Heatmap   │      │                             │
│ └──────────────┘      │  [+ Ajouter section]        │
│                       │                             │
│ Styles:               │  Aperçu:                    │
│ Police: [Inter ▼]     │  [Miniature PDF]            │
│ Couleur: [🎨 #3b82f6]│                             │
│ Logo: [📁 Upload]     │                             │
│                                                     │
│ [Annuler] [Enregistrer comme template]              │
└─────────────────────────────────────────────────────┘
```

**6. Partage de rapports**

```typescript
interface ReportShare {
  reportId: string;
  recipients: string[];        // emails
  message?: string;
  expiresAt?: Date;            // lien temporaire
  requireAuth: boolean;        // authentification requise
}

// Modal partage
const ShareReportModal = ({ reportId }) => {
  return (
    <Modal>
      <h3>Partager le rapport</h3>
      <Input 
        type="email" 
        placeholder="Email destinataire"
        multiple
      />
      <Textarea placeholder="Message (optionnel)" />
      <Checkbox label="Expirer après 7 jours" />
      <Checkbox label="Nécessite authentification" defaultChecked />
      <Button onClick={handleShare}>Envoyer par email</Button>
      <Button onClick={generatePublicLink}>
        Générer lien de partage
      </Button>
    </Modal>
  );
};
```

**7. Archive et rétention**

- **Archivage automatique** : rapports > 90 jours vers stockage froid (S3 Glacier, etc.)
- **Politique de rétention** : configurable par org (365 jours par défaut)
- **Compression** : ZIP pour rapports multiples
- **Signature numérique** : intégrité des rapports critiques (audit)

#### API Endpoints Django

```python
# urls.py
urlpatterns = [
    # Génération
    path('api/reports/generate/', views.generate_report),
    path('api/reports/jobs/<uuid:job_id>/', views.get_job_status),
    
    # CRUD rapports
    path('api/reports/', views.list_reports),
    path('api/reports/<uuid:report_id>/', views.get_report),
    path('api/reports/<uuid:report_id>/download/', views.download_report),
    path('api/reports/<uuid:report_id>/share/', views.share_report),
    
    # Planification
    path('api/reports/scheduled/', views.list_scheduled_reports),
    path('api/reports/scheduled/<uuid:schedule_id>/', views.update_schedule),
    
    # Templates
    path('api/reports/templates/', views.list_templates),
    path('api/reports/templates/<uuid:template_id>/', views.get_template),
]
```

#### Types TypeScript

```typescript
interface ReportConfig {
  type: 'production' | 'quality' | 'sensors' | 'ai' | 'audit' | 'custom';
  title: string;
  period: {
    start: Date;
    end: Date;
  } | {
    relative: 'last_7_days' | 'last_month' | 'current_quarter';
  };
  organizations: string[];      // UUIDs
  filters?: {
    productClasses?: string[];
    confidenceMin?: number;
    status?: 'conforming' | 'non_conforming' | 'all';
  };
  sections: ReportSection[];
  format: 'pdf' | 'xlsx' | 'pptx' | 'csv';
  options?: {
    includeLogo?: boolean;
    includeCover?: boolean;
    includeToC?: boolean;
    template?: string;          // UUID du template
  };
}

interface ReportSection {
  type: 'executive_summary' | 'kpis' | 'charts' | 'statistics' | 
        'anomalies' | 'recommendations' | 'raw_data' | 'spectra';
  config?: Record<string, any>;
}

interface ScheduledReport {
  id: string;
  reportConfig: ReportConfig;
  frequency: {
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;               // HH:MM
    dayOfWeek?: number;         // 1-7 (lundi-dimanche)
    dayOfMonth?: number;        // 1-31
  };
  recipients: string[];
  isActive: boolean;
  nextRun: Date;
  createdBy: string;
}
```

---

### 3.7 Système & Maintenance

#### 3.7.1 Santé du système (`/system/health`)

**Objectif** : Monitoring hardware et software

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Vue d'ensemble - Statut: 🟢 Opérationnel           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Capteurs                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ TOF VL53L5CX                                │   │
│  │ Status: 🟢 | Température: 42°C | FPS: 15   │   │
│  │ Dernier calibrage: Il y a 3 jours          │   │
│  │ [Tester] [Recalibrer]                       │   │
│  │                                             │   │
│  │ AS7341 Spectral                             │   │
│  │ Status: 🟢 | Température: 38°C              │   │
│  │ Qualité signal: Excellent (SNR: 42dB)      │   │
│  │ [Tester] [Réglages]                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Système                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ • CPU: 45% ████████░░░░░░░░░               │   │
│  │ • RAM: 2.1GB / 4GB ███████░░░░░░░          │   │
│  │ • Disque: 12GB / 32GB ██████░░░░░░░        │   │
│  │ • Température CPU: 58°C                     │   │
│  │ • Uptime: 14j 7h 23m                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Réseau & Backend                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ • API Backend: 🟢 (latence: 23ms)          │   │
│  │ • TimescaleDB: 🟢 (9,847,234 enregistr.)   │   │
│  │ • WebSocket: 🟢 (12 clients connectés)     │   │
│  │ • Moteur IA: 🟢 (GPU usage: 67%)           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Logs système (live, 50 dernières lignes)          │
│  ┌─────────────────────────────────────────────┐   │
│  │ [INFO] 14:42:15 - Analyse #15847 terminée  │   │
│  │ [WARN] 14:42:10 - Signal AS7341 faible     │   │
│  │ [INFO] 14:42:05 - Analyse #15846 terminée  │   │
│  │ ...                                         │   │
│  └─────────────────────────────────────────────┘   │
│  Filtres: [Tous ▼] [Rechercher...]                 │
│  [Télécharger logs complets] [Archiver anciens]    │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Tests diagnostics** : boutons pour tester chaque capteur individuellement
- **Graphiques historiques** : CPU/RAM/Temp sur 24h
- **Alertes configurables** : seuils pour temp, CPU, espace disque
- **Logs en temps réel** : WebSocket stream, filtres par niveau (INFO, WARN, ERROR)
- **Export logs** : téléchargement avec date range

#### 3.7.2 Firmware OTA (`/system/firmware`)

**Objectif** : Gestion des mises à jour firmware

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Gestion du Firmware OTA                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Version actuelle                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firmware: v3.2.1                            │   │
│  │ Date de déploiement: 2025-09-28             │   │
│  │ Statut: ✓ Stable                            │   │
│  │ Changelog: [Voir détails]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Nouvelle mise à jour disponible                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firmware: v3.3.0                            │   │
│  │ Taille: 2.4 MB                              │   │
│  │ Release notes:                              │   │
│  │ • Amélioration stabilité capteur TOF        │   │
│  │ • Optimisation consommation AS7341          │   │
│  │ • Correctif bug #234                        │   │
│  │                                             │   │
│  │ Upload manuel:                              │   │
│  │ [Choisir fichier .bin] [Uploader]           │   │
│  │                                             │   │
│  │ ⚠️ Attention: arrêt système 2-3 minutes    │   │
│  │                                             │   │
│  │ Options:                                    │   │
│  │ □ Sauvegarder config actuelle               │   │
│  │ ✓ Rollback auto si échec                    │   │
│  │ ✓ Vérifier MD5 checksum                     │   │
│  │                                             │   │
│  │ Planifier: [Maintenant ▼]                   │   │
│  │ [Déployer firmware v3.3.0]                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Historique des déploiements                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ v3.2.1 - 2025-09-28 - Succès ✓             │   │
│  │ v3.2.0 - 2025-08-15 - Succès ✓             │   │
│  │ v3.1.5 - 2025-07-03 - Rollback (erreur)    │   │
│  │ v3.1.4 - 2025-06-22 - Succès ✓             │   │
│  │ [Voir tous]                                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- **Upload sécurisé** : validation format, checksum MD5
- **Planification** : déploiement immédiat ou programmé
- **Progress bar** : upload + flashing en temps réel
- **Rollback automatique** : si device ne répond pas après 5 min
- **Historique versioning** : traçabilité complète
- **Backup config** : sauvegarder paramètres avant MAJ

---

### 3.8 Notifications & Support (`/notifications`, `/support`)

#### Notifications
- **Centre de notifications** : dropdown dans header
- **Types** : Système, Alertes qualité, IA, Maintenance
- **Actions** : Marquer comme lu, Archiver, Aller à la source
- **Préférences** : activer/désactiver par catégorie
- **Push notifications** : si supporté par navigateur

#### Support / Bug report
**Formulaire structuré** :
```
Titre: [_________________]
Type: [Bug ▼] [Feature request] [Question]
Priorité: [Basse ▼] [Moyenne] [Haute] [Critique]
Description: [____________]
Reproduire: [____________]
Logs auto-attachés: ✓
Screenshot: [Upload]
[Envoyer]
```

---

### 3.9 Administration (`/admin`)

**Accès réservé** : super_admin, org_admin (pour leur org uniquement)

#### 3.9.1 Gestion des utilisateurs (`/admin/users`)

**Objectif** : CRUD utilisateurs et attribution rôles

**Layout** :
```
┌─────────────────────────────────────────────────────┐
│ Gestion des Utilisateurs                            │
│ Organisation: [Usine Lyon ▼] (org_admin uniquement) │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [+ Inviter utilisateur]  [Import CSV]              │
│                                                     │
│ Recherche: [🔍 Nom, email...] Rôle: [Tous ▼]      │
│                                                     │
│  Liste des utilisateurs (24)                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Avatar │ Nom & Email │ Rôles │ Statut │ …   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Marie Dupont          │ 🟢 Actif │   │   │
│  │       │ marie.dupont@mail.com │          │   │   │
│  │       │ Rôles: quality_manager │         │   │   │
│  │       │ Dernière connexion: Il y a 2h   │   │   │
│  │       │ [Modifier] [Désactiver] [Logs]  │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Jean Martin           │ 🟢 Actif │   │   │
│  │       │ jean.martin@mail.com  │          │   │   │
│  │       │ Rôles: operator       │          │   │   │
│  │       │ [Modifier] [Désactiver]         │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │  👤   │ Sophie Bernard        │ 🔴 Inactif│  │   │
│  │       │ sophie.b@mail.com     │          │   │   │
│  │       │ Rôles: data_analyst   │          │   │   │
│  │       │ [Modifier] [Réactiver]          │   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Pagination: ← 1 2 3 4 →                           │
└─────────────────────────────────────────────────────┘
```

**Modal "Inviter utilisateur"** :
```typescript
interface InviteUserForm {
  email: string;              // Requis
  firstName: string;
  lastName: string;
  roles: string[];            // Multi-select
  organizations: string[];    // Si super_admin
  sendInviteEmail: boolean;   // ✓ par défaut
}

// Workflow:
// 1. Admin remplit formulaire
// 2. Backend crée user dans Keycloak (avec temporary password)
// 3. Email invitation envoyé avec lien reset password
// 4. User clique lien, définit son password, se connecte
```

**Modal "Modifier utilisateur"** :
- Changer rôles (avec confirmation si retrait privilèges)
- Ajouter/retirer organisations
- Activer/désactiver compte
- Forcer reset password

**Permissions** :
- **org_admin** : gère uniquement les users de son org
- **super_admin** : gère tous les users, toutes les orgs

#### 3.9.2 Gestion des organisations (détails)

Voir section 2.3 pour layout complet.

**Features additionnelles** :
- **Statistiques par org** : nb analyses, conformité, uptime
- **Quotas** : limite d'analyses/jour (si nécessaire)
- **API keys** : générer clés API pour intégrations externes
- **Webhooks** : configurer URLs de notification externes
- **White-labeling** : logo custom, couleurs (feature avancée)

#### 3.9.3 Logs d'audit (`/admin/audit`)

**Objectif** : Traçabilité des actions sensibles

**Events trackés** :
```typescript
enum AuditEventType {
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_CREATED = 'user.created',
  USER_ROLE_CHANGED = 'user.role_changed',
  ORG_CREATED = 'org.created',
  ORG_SETTINGS_UPDATED = 'org.settings_updated',
  FIRMWARE_DEPLOYED = 'firmware.deployed',
  AI_MODEL_DEPLOYED = 'ai.model_deployed',
  DATA_EXPORTED = 'data.exported',
  SENSOR_CALIBRATED = 'sensor.calibrated',
}

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  organizationId: string;
  eventType: AuditEventType;
  details: Record<string, any>;  // JSON avec contexte
  ipAddress: string;
  userAgent: string;
}
```

**Interface** :
```
┌─────────────────────────────────────────────────────┐
│ Logs d'Audit                                        │
├─────────────────────────────────────────────────────┤
│ Période: [Dernières 24h ▼]  Type: [Tous ▼]        │
│ Organisation: [Toutes ▼]  User: [Tous ▼]          │
│ [Appliquer filtres]  [Export CSV]                  │
│                                                     │
│  Table des logs (virtualisée)                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Time│User│Org│Event│Details│IP│         │   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:32│Marie│Lyon│firmware.deployed│       │   │   │
│  │     │     │    │v3.3.0→v3.3.1 ✓│xxx.xxx│   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:28│Jean │Lyon│user.role_changed│       │   │   │
│  │     │     │    │operator→quality_manager│   │   │
│  ├─────────────────────────────────────────────┤   │
│  │14:15│Sophie│Bor│data.exported│           │   │   │
│  │     │      │   │15847 rows, CSV│xxx.xxx │   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Rétention: 2 ans selon ISO 27001                  │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 4. Design System

### 4.1 Palette de couleurs

#### Mode sombre (défaut)
```css
--bg-primary: #0a0e1a;        /* Fond principal */
--bg-secondary: #141824;      /* Cards, panels */
--bg-tertiary: #1e2433;       /* Hover states */

--text-primary: #e4e7ec;      /* Texte principal */
--text-secondary: #9da3ae;    /* Texte secondaire */
--text-muted: #6b7280;        /* Labels */

--accent-blue: #3b82f6;       /* Liens, info */
--accent-green: #10b981;      /* Succès, conformité */
--accent-yellow: #f59e0b;     /* Warnings */
--accent-red: #ef4444;        /* Erreurs, alertes */
--accent-purple: #8b5cf6;     /* IA, spectral */

--border: #2d3748;            /* Bordures */
--shadow: rgba(0, 0, 0, 0.3); /* Ombres */
```

#### Mode clair (optionnel)
```css
--bg-primary: #f9fafb;
--bg-secondary: #ffffff;
--text-primary: #111827;
--accent-blue: #2563eb;
/* ... */
```

### 4.2 Typographie

```css
/* Famille */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Tailles */
--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */

/* Poids */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 4.3 Espacements & Layout

```css
--spacing-unit: 0.25rem; /* 4px */

--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */

--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-full: 9999px;
```

### 4.4 Composants UI de base

#### Boutons
```
[Primary]   - Accent blue, bold
[Secondary] - Border white, transparent bg
[Danger]    - Accent red
[Success]   - Accent green
[Ghost]     - Transparent, hover bg-tertiary

États: default | hover | active | disabled | loading
```

#### Cards
```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: 0 1px 3px var(--shadow);
}

.card-header {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-4);
}
```

#### Badges (status)
```
🟢 Active   - green bg
🟡 Warning  - yellow bg
🔴 Critical - red bg
🔵 Info     - blue bg
⚪ Inactive - gray bg
```

#### Inputs & Forms
```
- Border: 1px, focus: 2px accent-blue
- Height: 40px (base), 32px (small), 48px (large)
- Validation: border red + message sous input
- Labels: font-medium, text-sm, mb-2
```

---

## 🔧 5. Exigences techniques

### 5.1 Performance

#### Temps de chargement
- **Initial load** : < 3 secondes (3G)
- **Changement page** : < 500ms
- **Mise à jour temps réel** : < 200ms

#### Optimisations
- **Code splitting** : lazy loading des pages
- **Tree shaking** : éliminer code non utilisé
- **Image optimization** : WebP, lazy loading
- **Memoization** : React.memo, useMemo, useCallback
- **Virtual scrolling** : tables > 100 lignes

### 5.2 Sécurité

- **Authentification** : JWT avec refresh token
- **HTTPS uniquement** : force SSL
- **CSP headers** : Content Security Policy
- **XSS protection** : sanitize user inputs
- **CSRF tokens** : pour mutations
- **Rate limiting** : protéger API
- **Logs audit** : tracer actions critiques

### 5.3 Accessibilité (WCAG 2.1 AA)

- **Contraste** : minimum 4.5:1 (texte normal)
- **Navigation clavier** : tous éléments accessibles via Tab
- **ARIA labels** : sur tous composants interactifs
- **Focus visible** : outline clair
- **Messages d'erreur** : associés aux champs (aria-describedby)
- **Alternative text** : sur images/graphiques

### 5.4 Responsive design

**Breakpoints** :
```
sm: 640px   (tablette portrait)
md: 768px   (tablette landscape)
lg: 1024px  (desktop)
xl: 1280px  (desktop large)
2xl: 1536px (ultra-wide)
```

**Priorité** : Desktop first (1920x1080), puis tablette (1024x768)

### 5.5 Tests

#### Tests unitaires (Jest + RTL)
- **Couverture** : > 70% du code
- **Composants** : tous testés avec snapshots
- **Hooks custom** : tests dédiés
- **Utils** : 100% couverture

#### Tests E2E (Playwright)
- **User flows critiques** :
  - Login → Dashboard → Analyse produit
  - Création dataset → Entraînement IA
  - Export données historique
  - Upload firmware OTA
- **Tests cross-browser** : Chrome, Firefox, Edge

#### Tests d'intégration
- **API mocking** : MSW (Mock Service Worker)
- **WebSocket mocking** : mock socket.io

---

## 📦 6. Livrables attendus

### Phase 1 : Foundation (3-4 semaines)
- ✅ Setup projet (Vite + React + TS + Tailwind)
- ✅ Architecture dossiers
- ✅ Design system (composants de base)
- ✅ **Intégration Keycloak SSO**
  - Configuration client frontend
  - ProtectedRoute component
  - Hooks useAuth, usePermissions
  - Gestion tokens & refresh
- ✅ **Gestion multi-organisation**
  - Store organizationStore
  - Sélecteur d'organisation (Header)
  - Context isolation
- ✅ Layout principal (Sidebar, Header avec sélecteur org)
- ✅ Routing avec protection par rôles

### Phase 2 : Core Features (4-5 semaines)
- ✅ Dashboard temps réel (WebSocket)
- ✅ Pages capteurs (TOF + AS7341)
- ✅ Module IA - Monitoring
- ✅ Historique & filtres (avec isolation par org)
- ✅ **Matrice de permissions**
  - Affichage conditionnel selon rôles
  - Restrictions API selon org_id

### Phase 3 : Advanced Features (4-5 semaines)
- ✅ Entraînement IA
- ✅ Système & santé
- ✅ Firmware OTA
- ✅ Notifications
- ✅ **Module Administration**
  - Gestion utilisateurs
  - Gestion organisations (super_admin)
  - Logs d'audit
  - Invitation users via Keycloak

### Phase 4 : Polish & Testing (2-3 semaines)
- ✅ Tests E2E complets (avec scénarios multi-org)
- ✅ Tests permissions & RBAC
- ✅ Optimisations performance
- ✅ Documentation (Storybook)
- ✅ Déploiement CI/CD
- ✅ **Tests sécurité**
  - Validation isolation données
  - Tests CSRF/XSS
  - Audit Keycloak config

### Documentation
- **README.md** : setup, architecture, conventions
- **CONTRIBUTING.md** : guidelines pour devs
- **API_INTEGRATION.md** : specs API backend + contrats Keycloak
- **KEYCLOAK_SETUP.md** : configuration realm, roles, clients
- **DEPLOYMENT.md** : procédure de déploiement (frontend + Keycloak)
- **PERMISSIONS_MATRIX.md** : tableau complet rôles/permissions
- **Storybook** : documentation composants interactifs
- **MULTIORG_GUIDE.md** : guide gestion multi-organisation

### Checklist de sécurité pré-production
- [ ] Keycloak configuré avec HTTPS uniquement
- [ ] Refresh tokens stockés en httpOnly cookies (si applicable)
- [ ] Rate limiting activé sur API
- [ ] CSP headers configurés
- [ ] Audit de toutes les permissions RBAC
- [ ] Tests d'isolation multi-org validés
- [ ] Logs d'audit fonctionnels
- [ ] Backup/restore procedure documentée
- [ ] Plan de rollback firmware/IA testé

---

## 🚀 7. Points d'attention & Best practices

### Gestion d'état
- **Données temps réel** : WebSocket → Zustand store
- **Cache API** : TanStack Query (staleTime, refetchInterval)
- **Optimistic updates** : UX fluide sur mutations

### Gestion des erreurs
- **Boundaries** : React Error Boundary par section
- **Toast notifications** : pour erreurs non-critiques
- **Modal erreur** : pour erreurs bloquantes
- **Retry logic** : sur échecs réseau

### WebSocket best practices
- **Reconnexion auto** : exponentiel backoff
- **Heartbeat** : ping/pong toutes les 30s
- **Buffer messages** : pendant déconnexion
- **Cleanup** : close socket on unmount

### Performance monitoring
- **Web Vitals** : LCP, FID, CLS
- **Custom metrics** : temps inférence IA, lag WebSocket
- **Error tracking** : Sentry ou équivalent

---

## 📞 8. Contact & Support

**Questions techniques** :  
[Insérer contact tech lead]

**Accès services** :

**Backend API** :
- DEV: `http://localhost:3000`
- STAGING: `https://api-staging.foodquality.local`
- PROD: `https://api.foodquality.local`
- Documentation: `/docs` (Swagger/OpenAPI)

**Keycloak (SSO)** :
- DEV: `http://localhost:8080`
- STAGING: `https://auth-staging.foodquality.local`
- PROD: `https://auth.foodquality.local`
- Admin Console: `/admin`
- Realm: `FoodQuality`

**WebSocket** :
- DEV: `ws://localhost:3000/ws`
- STAGING: `wss://api-staging.foodquality.local/ws`
- PROD: `wss://api.foodquality.local/ws`

**TimescaleDB** :
- Accès via API uniquement (pas d'accès direct frontend)

**Environnements Frontend** :  
- DEV: `http://localhost:5173`
- STAGING: `https://staging.foodquality.local`
- PROD: `https://app.foodquality.local`

---

## 🔐 9. Configuration des variables d'environnement

**Fichier `.env.development`** :
```bash
# Keycloak
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=FoodQuality
VITE_KEYCLOAK_CLIENT_ID=foodquality-frontend

# API Backend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws

# Features flags
VITE_ENABLE_MULTIORG=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_WHITE_LABEL=false

# Monitoring (optionnel)
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

**Fichier `.env.production`** :
```bash
# Keycloak
VITE_KEYCLOAK_URL=https://auth.foodquality.local
VITE_KEYCLOAK_REALM=FoodQuality
VITE_KEYCLOAK_CLIENT_ID=foodquality-frontend

# API Backend
VITE_API_URL=https://api.foodquality.local
VITE_WS_URL=wss://api.foodquality.local/ws

# Features
VITE_ENABLE_MULTIORG=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_WHITE_LABEL=true

# Monitoring
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_ANALYTICS_ID=G-XXXXXXXXXX
```

**Usage dans le code** :
```typescript
// src/config/env.ts
export const config = {
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL,
    wsUrl: import.meta.env.VITE_WS_URL,
  },
  features: {
    multiOrg: import.meta.env.VITE_ENABLE_MULTIORG === 'true',
    auditLogs: import.meta.env.VITE_ENABLE_AUDIT_LOGS === 'true',
    whiteLabel: import.meta.env.VITE_ENABLE_WHITE_LABEL === 'true',
  },
};
```

---

## 📚 10. Ressources complémentaires

**Documentation** :
- Keycloak: https://www.keycloak.org/docs/latest/
- React: https://react.dev/
- TailwindCSS: https://tailwindcss.com/docs
- Recharts: https://recharts.org/
- Three.js: https://threejs.org/docs/
- TanStack Query: https://tanstack.com/query/

**Outils recommandés** :
- **VS Code** avec extensions :
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript + JavaScript
- **Postman/Insomnia** : tester API backend
- **React DevTools** : debugging
- **Redux DevTools** : si utilisation Redux (sinon Zustand DevTools)

---

**Document version 1.1 - Octobre 2025**  
*Mise à jour : Intégration Keycloak SSO + Gestion Multi-Organisation*