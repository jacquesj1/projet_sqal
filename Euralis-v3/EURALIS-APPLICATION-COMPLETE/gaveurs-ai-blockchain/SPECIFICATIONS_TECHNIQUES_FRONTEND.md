# 📋 SPÉCIFICATIONS TECHNIQUES - Système Gaveurs V2.1 Frontend

## 🎯 OBJECTIF

Développer le frontend complet du **Système Gaveurs V2.1** en Next.js 14 avec TypeScript, React et Tailwind CSS.

**Backend déjà développé** : API REST FastAPI opérationnelle sur `http://localhost:8000`

---

## 📦 STACK TECHNIQUE

### Technologies Requises

```json
{
  "framework": "Next.js 14",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "state": "React Hooks (useState, useEffect, useContext)",
  "charts": "recharts",
  "icons": "lucide-react",
  "http": "fetch API native",
  "realtime": "WebSocket (native)"
}
```

### Dépendances à Installer

```bash
npm install recharts lucide-react
npm install -D @types/node @types/react @types/react-dom
```

---

## 🏗️ ARCHITECTURE GLOBALE

### Structure de Dossiers

```
frontend/
├── app/                              # Next.js 14 App Router
│   ├── layout.tsx                    # Layout racine
│   ├── page.tsx                      # Page d'accueil (dashboard)
│   ├── gavage/
│   │   └── page.tsx                  # Module saisie gavage
│   ├── analytics/
│   │   └── page.tsx                  # Dashboard analytics
│   ├── blockchain/
│   │   └── page.tsx                  # Blockchain explorer
│   ├── alertes/
│   │   └── page.tsx                  # Gestion alertes
│   └── canards/
│       ├── page.tsx                  # Liste canards
│       └── [id]/page.tsx             # Détail canard
│
├── components/                       # Composants réutilisables
│   ├── ui/                          # Composants UI de base
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   └── Modal.tsx
│   ├── layout/                      # Layout components
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── SaisieRapideGavage.tsx      # Saisie intelligente
│   ├── BlockchainExplorer.tsx      # Explorer blockchain
│   ├── DashboardAnalytics.tsx      # Dashboard analytics
│   ├── AlertesList.tsx             # Liste alertes
│   └── CanardCard.tsx              # Card canard
│
├── lib/                             # Utilities et helpers
│   ├── api.ts                       # Client API
│   ├── types.ts                     # Types TypeScript
│   ├── utils.ts                     # Fonctions utilitaires
│   └── constants.ts                 # Constantes
│
├── context/                         # React Context
│   ├── AuthContext.tsx             # Authentification (optionnel)
│   └── WebSocketContext.tsx        # WebSocket real-time
│
├── hooks/                           # Custom hooks
│   ├── useApi.ts                   # Hook API calls
│   ├── useWebSocket.ts             # Hook WebSocket
│   └── useVoiceInput.ts            # Hook saisie vocale
│
├── public/                          # Assets statiques
│   ├── images/
│   └── icons/
│
├── styles/
│   └── globals.css                 # Styles globaux Tailwind
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## 🔌 API ENDPOINTS DISPONIBLES

### Backend API Base URL

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

### Routes API par Catégorie

#### 1. GAVEURS

```typescript
GET    /api/gaveurs/                    // Liste tous les gaveurs
POST   /api/gaveurs/                    // Créer gaveur
GET    /api/gaveurs/{id}                // Détail gaveur
```

#### 2. CANARDS

```typescript
GET    /api/canards/gaveur/{gaveur_id}  // Canards d'un gaveur
POST   /api/canards/                    // Créer canard
GET    /api/canards/{id}                // Détail canard
PUT    /api/canards/{id}                // Modifier canard
```

#### 3. GAVAGE

```typescript
POST   /api/gavage/                     // Enregistrer gavage
GET    /api/gavage/canard/{canard_id}   // Historique gavage canard
GET    /api/gavage/gaveur/{gaveur_id}   // Gavages d'un gaveur
```

#### 4. INTELLIGENCE ARTIFICIELLE

```typescript
POST   /api/ml/discover-formula/{genetique}           // Découvrir formule
GET    /api/ml/predict-doses/{canard_id}              // Prédire doses optimales
POST   /api/ml/retrain/{genetique}                    // Réentraîner modèle
```

#### 5. CORRECTIONS AUTOMATIQUES

```typescript
GET    /api/corrections/canard/{canard_id}            // Corrections d'un canard
GET    /api/corrections/stats/{gaveur_id}             // Stats corrections gaveur
```

#### 6. BLOCKCHAIN

```typescript
POST   /api/blockchain/init                           // Initialiser blockchain
POST   /api/blockchain/canard/{canard_id}             // Ajouter événement
GET    /api/blockchain/canard/{canard_id}/history     // Historique blockchain
GET    /api/blockchain/canard/{canard_id}/certificat  // Certificat traçabilité
GET    /api/blockchain/verify                         // Vérifier intégrité
```

#### 7. ALERTES

```typescript
GET    /api/alertes/gaveur/{gaveur_id}                // Alertes gaveur
POST   /api/alertes/                                  // Créer alerte
POST   /api/alertes/check-all/{canard_id}             // Vérifier toutes alertes
GET    /api/alertes/dashboard/{gaveur_id}             // Dashboard alertes
POST   /api/alertes/{alerte_id}/acquitter             // Acquitter alerte
```

#### 8. ANALYTICS AVANCÉS

```typescript
GET    /api/analytics/metrics/{canard_id}             // Métriques performance
GET    /api/analytics/predict-prophet/{canard_id}     // Prévisions Prophet (jours=7)
GET    /api/analytics/compare-genetiques              // Comparaison génétiques
GET    /api/analytics/correlation-temperature/{id}    // Corrélation température
GET    /api/analytics/patterns/{gaveur_id}            // Patterns gavage
GET    /api/analytics/weekly-report/{gaveur_id}       // Rapport hebdomadaire
```

#### 9. ANOMALIES

```typescript
GET    /api/anomalies/detect/{canard_id}              // Détection anomalies ML
```

#### 10. AUTHENTIFICATION & UTILISATEURS

```typescript
POST   /api/auth/register                             // Inscription
POST   /api/auth/login                                // Connexion
POST   /api/auth/logout                               // Déconnexion
GET    /api/auth/me                                   // Profil utilisateur
PUT    /api/auth/me                                   // Modifier profil
POST   /api/auth/refresh                              // Rafraîchir token
POST   /api/auth/forgot-password                      // Mot de passe oublié
POST   /api/auth/reset-password                       // Réinitialiser mot de passe
```

#### 11. VÉTÉRINAIRES

```typescript
GET    /api/veterinaires/                             // Liste vétérinaires
POST   /api/veterinaires/                             // Créer vétérinaire
GET    /api/veterinaires/{id}                         // Détail vétérinaire
PUT    /api/veterinaires/{id}                         // Modifier vétérinaire
GET    /api/veterinaires/{id}/interventions           // Interventions vétérinaire
```

#### 12. CERTIFICATIONS

```typescript
GET    /api/certifications/gaveur/{gaveur_id}         // Certifications gaveur
GET    /api/certifications/canard/{canard_id}         // Certifications canard
POST   /api/certifications/                           // Ajouter certification
PUT    /api/certifications/{id}                       // Modifier certification
DELETE /api/certifications/{id}                       // Supprimer certification
```

#### 13. CONDITIONS ENVIRONNEMENTALES

```typescript
GET    /api/environnement/stabule/{stabule_id}        // Conditions stabule
POST   /api/environnement/                            // Enregistrer mesures
GET    /api/environnement/alertes/{stabule_id}        // Alertes qualité air
GET    /api/environnement/stats/{stabule_id}          // Statistiques environnement
```

#### 14. LOT DE MAÏS

```typescript
GET    /api/lots-mais/                                // Liste lots maïs
POST   /api/lots-mais/                                // Créer lot
GET    /api/lots-mais/{id}                            // Détail lot
PUT    /api/lots-mais/{id}                            // Modifier lot
GET    /api/lots-mais/{id}/utilisation                // Utilisation du lot
GET    /api/lots-mais/{id}/qualite                    // Suivi qualité
```

#### 15. COMPORTEMENT & SANTÉ CANARDS

```typescript
GET    /api/comportement/canard/{canard_id}           // Historique comportement
POST   /api/comportement/                             // Enregistrer observation
GET    /api/sante/canard/{canard_id}                  // État sanitaire
POST   /api/sante/intervention                        // Intervention vétérinaire
GET    /api/sante/stats/{gaveur_id}                   // Stats sanitaires gaveur
```

#### 16. PHOTOS & MÉDIAS

```typescript
POST   /api/photos/upload                             // Upload photo
GET    /api/photos/canard/{canard_id}                 // Photos d'un canard
GET    /api/photos/{id}                               // Détail photo
DELETE /api/photos/{id}                               // Supprimer photo
POST   /api/photos/{id}/annotate                      // Annoter photo
```

#### 17. SIMULATIONS & PRÉVISIONS AVANCÉES

```typescript
POST   /api/simulations/what-if                       // Simulation "What-if"
GET    /api/simulations/scenarios                     // Scénarios sauvegardés
POST   /api/simulations/optimize                      // Optimisation multi-objectifs
GET    /api/simulations/{id}/results                  // Résultats simulation
POST   /api/simulations/compare                       // Comparer scénarios
```

#### 18. INTÉGRATIONS EXTERNES

```typescript
// Abattoirs
GET    /api/integrations/abattoirs/                   // Liste abattoirs
POST   /api/integrations/abattoirs/send               // Envoi données abattoir
GET    /api/integrations/abattoirs/{id}/status        // Statut intégration

// Comptabilité
GET    /api/integrations/compta/export                // Export comptable
POST   /api/integrations/compta/sync                  // Sync logiciel compta
GET    /api/integrations/compta/summary/{periode}     // Résumé période

// Vétérinaires externes
POST   /api/integrations/vet/share                    // Partager données véto
GET    /api/integrations/vet/received                 // Données reçues
```

#### 19. SCAN QR/NFC

```typescript
GET    /api/qr/generate/{canard_id}                   // Générer QR code canard
POST   /api/qr/scan                                   // Scanner QR code
GET    /api/nfc/read                                  // Lire tag NFC
POST   /api/nfc/write                                 // Écrire tag NFC
GET    /api/qr/batch/{lot_id}                         // QR codes batch
```

#### 20. WEBSOCKET TEMPS RÉEL

```typescript
WS     /ws/gaveur/{gaveur_id}                         // WebSocket gaveur
WS     /ws/alerts                                     // WebSocket alertes globales
WS     /ws/canard/{canard_id}                         // WebSocket canard spécifique
```
```

## 📊 TYPES TYPESCRIPT COMPLETS

### Fichier : `lib/types.ts`

```typescript
// ============================================
// TYPES DE BASE
// ============================================

export interface Gaveur {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  numero_elevage: string;
  certifications: string[];
  created_at: string;
}

export interface Canard {
  id: number;
  gaveur_id: number;
  numero_identification: string;
  genetique: 'Mulard' | 'Barbarie' | 'Pekin';
  date_naissance: string;
  origine: string;
  numero_lot_canard: string;
  poids_initial: number;
  statut: 'en_gavage' | 'termine' | 'decede';
  created_at: string;
  poids_actuel?: number;
}

export interface GavageData {
  id: number;
  time: string;
  canard_id: number;
  dose_matin: number;
  dose_soir: number;
  dose_theorique_matin?: number;
  dose_theorique_soir?: number;
  heure_gavage_matin: string;
  heure_gavage_soir: string;
  poids_matin?: number;
  poids_soir?: number;
  temperature_stabule: number;
  humidite_stabule: number;
  co2_stabule?: number;
  lot_mais_id: number;
  remarques?: string;
  ecart_dose_matin?: number;
  ecart_dose_soir?: number;
  gain_poids?: number;
}

// ============================================
// ALERTES
// ============================================

export type AlerteNiveau = 'critique' | 'important' | 'info';

export interface Alerte {
  id: number;
  time: string;
  canard_id: number;
  niveau: AlerteNiveau;
  type_alerte: string;
  message: string;
  valeur_mesuree?: number;
  valeur_seuil?: number | string;
  acquittee: boolean;
  acquittee_par?: number;
  acquittee_le?: string;
  sms_envoye: boolean;
}

export interface AlerteDashboard {
  critiques_actives: number;
  importantes_actives: number;
  info_actives: number;
  alertes_24h: number;
  sms_envoyes: number;
}

// ============================================
// INTELLIGENCE ARTIFICIELLE
// ============================================

export interface DosesPredites {
  canard_id: number;
  dose_matin_optimale: number;
  dose_soir_optimale: number;
  gain_poids_predit: number;
  confiance: number;
  formule_utilisee?: string;
}

export interface FormulaDiscovery {
  genetique: string;
  formule: string;
  r2_score: number;
  mae: number;
  coefficients: Record<string, number>;
  features_importance: Record<string, number>;
}

// ============================================
// ANALYTICS
// ============================================

export interface PerformanceMetrics {
  canard_id: number;
  genetique: string;
  duree_gavage_jours: number;
  nb_gavages: number;
  poids_initial: number;
  poids_actuel: number;
  gain_total_grammes: number;
  gain_total_kg: number;
  gain_moyen_journalier: number;
  variance_gain: number;
  dose_totale_kg: number;
  indice_consommation: number;
  indice_consommation_optimal: number;
  taux_croissance_g_par_jour: number;
  score_performance: number;
  score_ic: number;
  score_gain: number;
  score_regularite: number;
  poids_final_predit: number;
  date_analyse: string;
}

export interface PrevisionProphet {
  date: string;
  poids_predit: number;
  poids_min: number;
  poids_max: number;
}

export interface CourbesPrediction {
  canard_id: number;
  previsions: PrevisionProphet[];
  confiance: number;
  methode: string;
  date_generation: string;
}

export interface ComparaisonGenetique {
  genetique: string;
  nb_canards: number;
  gain_moyen_grammes: number;
  gain_moyen_kg: number;
  dose_moyenne_kg: number;
  indice_consommation: number;
  taux_mortalite_pct: number;
}

export interface RapportHebdomadaire {
  periode: string;
  gaveur_id: number;
  statistiques: {
    canards_actifs: number;
    canards_gaves: number;
    gavages_total: number;
    gain_moyen_g: number;
    dose_moyenne_g: number;
    alertes_critiques: number;
    alertes_importantes: number;
  };
  top_performers: Array<{
    numero: string;
    gain_moyen: number;
  }>;
  date_generation: string;
}

// ============================================
// BLOCKCHAIN
// ============================================

export interface BlockchainEvent {
  index: number;
  timestamp: string;
  type_evenement: string;
  donnees: any;
  hash: string;
  hash_precedent: string;
  gaveur_id: number;
  abattoir_id?: number;
}

export interface BlockchainCertificat {
  canard_id: number;
  numero_identification: string;
  genetique: string;
  origine: string;
  date_naissance: string;
  poids_initial: number;
  duree_gavage_jours: number;
  nombre_gavages: number;
  dose_totale_mais_kg: number;
  abattoir?: {
    nom: string;
    adresse: string;
    agrement: string;
  };
  date_abattage: string;
  blockchain_hashes: string[];
  verification_blockchain: string;
}

// ============================================
// CORRECTIONS
// ============================================

export interface CorrectionDose {
  id: number;
  time: string;
  canard_id: number;
  dose_theorique: number;
  dose_reelle: number;
  ecart_grammes: number;
  ecart_pourcentage: number;
  correction_proposee: number;
  session: 'matin' | 'soir';
  sms_envoye: boolean;
}

// ============================================
// FORMULAIRES
// ============================================

export interface GavageFormData {
  canard_id: number;
  dose_matin: number;
  dose_soir: number;
  dose_theorique_matin?: number;
  dose_theorique_soir?: number;
  heure_gavage_matin: string;
  heure_gavage_soir: string;
  poids_matin?: number;
  poids_soir?: number;
  temperature_stabule: number;
  humidite_stabule: number;
  co2_stabule?: number;
  lot_mais_id: number;
  remarques?: string;
}

export interface CanardFormData {
  gaveur_id: number;
  numero_identification: string;
  genetique: 'Mulard' | 'Barbarie' | 'Pekin';
  date_naissance: string;
  origine: string;
  numero_lot_canard: string;
  poids_initial: number;
}

// ============================================
// DONNÉES COMPLÉMENTAIRES
// ============================================

export interface Veterinaire {
  id: number;
  nom: string;
  prenom: string;
  numero_ordre: string;
  telephone: string;
  email: string;
  specialite: string;
}

export interface Certification {
  id: number;
  type: 'Label Rouge' | 'IGP' | 'Bio' | 'AOP' | 'Autre';
  numero_certification: string;
  organisme_certificateur: string;
  date_obtention: string;
  date_expiration: string;
  canard_id?: number;
  elevage_id?: number;
}

export interface ConditionsEnvironnementales {
  id: number;
  time: string;
  stabule_id: number;
  temperature: number;
  humidite: number;
  co2_ppm: number;
  nh3_ppm: number;
  luminosite_lux: number;
  qualite_air_score: number;
}

export interface LotMais {
  id: number;
  numero_lot: string;
  origine: string;
  date_reception: string;
  quantite_kg: number;
  taux_humidite: number;
  temperature_stockage: number;
  qualite_score: number;
  fournisseur: string;
}

export interface ComportementCanard {
  id: number;
  time: string;
  canard_id: number;
  etat_sanitaire: 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique';
  comportement: string;
  consommation_eau_ml: number;
  niveau_activite: 'tres_actif' | 'actif' | 'normal' | 'apathique';
  observations_veterinaire?: string;
  veterinaire_id?: number;
}

export interface MetriquesPerformance {
  canard_id: number;
  indice_consommation: number;
  taux_gavabilite: number;
  score_conformation: number;
  efficacite_alimentaire: number;
  gain_moyen_quotidien: number;
}

// ============================================
// AUTHENTIFICATION & UTILISATEURS
// ============================================

export interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: 'admin' | 'gaveur' | 'veterinaire' | 'observateur';
  telephone?: string;
  created_at: string;
  last_login?: string;
  avatar_url?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: 'gaveur' | 'veterinaire';
  telephone?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ============================================
// WEBSOCKET TEMPS RÉEL
// ============================================

export interface WebSocketMessage {
  type: 'alerte' | 'gavage' | 'poids' | 'anomalie' | 'notification';
  timestamp: string;
  data: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface LiveAlerte extends WebSocketMessage {
  type: 'alerte';
  data: {
    alerte_id: number;
    canard_id: number;
    niveau: AlerteNiveau;
    message: string;
    action_requise?: string;
  };
}

// ============================================
// PHOTOS & MÉDIAS
// ============================================

export interface Photo {
  id: number;
  canard_id?: number;
  gavage_id?: number;
  url: string;
  thumbnail_url?: string;
  type: 'canard' | 'gavage' | 'sanitaire' | 'documentation';
  description?: string;
  uploaded_at: string;
  uploaded_by: number;
}

// ============================================
// SIMULATIONS & PRÉVISIONS
// ============================================

export interface SimulationWhatIf {
  scenario_id: string;
  scenario_name: string;
  parameters: {
    dose_matin_modifier: number;
    dose_soir_modifier: number;
    duree_gavage_jours: number;
    temperature_cible: number;
  };
  predictions: {
    poids_final_estime: number;
    indice_consommation_estime: number;
    cout_mais_estime: number;
    risque_mortalite: number;
    rentabilite_estimee: number;
  };
}

// ============================================
// API EXTERNE & INTÉGRATIONS
// ============================================

export interface AbattoirIntegration {
  abattoir_id: number;
  nom: string;
  adresse: string;
  agrement_sanitaire: string;
  api_endpoint?: string;
  api_key?: string;
  canards_envoyes: number;
  derniere_livraison?: string;
}

export interface ExportComptabilite {
  periode_debut: string;
  periode_fin: string;
  format: 'csv' | 'excel' | 'pdf' | 'json';
  categories: string[];
  total_depenses: number;
  total_revenus: number;
  benefice_net: number;
}
```

---

## 🎨 DESIGN SYSTEM

### Couleurs Tailwind

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Alertes
        critique: '#dc2626',      // red-600
        important: '#f97316',     // orange-500
        info: '#3b82f6',          // blue-600
        
        // Status
        success: '#10b981',       // green-600
        warning: '#f59e0b',       // amber-500
        error: '#ef4444',         // red-500
        
        // UI
        primary: '#6366f1',       // indigo-600
        secondary: '#8b5cf6',     // violet-600
        accent: '#06b6d4',        // cyan-600
      }
    }
  }
}
```

### Composants UI Tailwind

Utiliser ces classes systématiquement :
- **Cards** : `bg-white rounded-lg shadow-lg p-6`
- **Buttons** : `px-6 py-3 rounded-lg font-bold transition-colors`
- **Inputs** : `w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500`
- **Badges** : `px-3 py-1 rounded-full text-xs font-bold`

---

## 📱 SPÉCIFICATIONS DÉTAILLÉES PAR COMPOSANT

### 1. NAVBAR (`components/layout/Navbar.tsx`)

**Spécifications** :

```typescript
interface NavbarProps {}

// Fonctionnalités requises :
// - Logo + Titre "Système Gaveurs V2.1"
// - Menu navigation : Dashboard, Gavage, Analytics, Blockchain, Alertes, Canards
// - Badge alertes critiques (nombre)
// - Avatar gaveur (dropdown avec déconnexion)
// - Responsive (hamburger menu sur mobile)

// Design :
// - Hauteur : 64px
// - Background : bg-gradient-to-r from-blue-600 to-purple-600
// - Texte : text-white
// - Shadow : shadow-lg
// - Position : sticky top-0 z-50

// Navigation :
// - Utiliser next/link pour routing
// - Active state avec border-b-4
```

**Code de base** :

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Bell, User } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertesCount, setAlertesCount] = useState(0); // À charger depuis API
  
  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Gavage', href: '/gavage' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Blockchain', href: '/blockchain' },
    { label: 'Alertes', href: '/alertes' },
    { label: 'Canards', href: '/canards' },
  ];
  
  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🦆</span>
            <span className="text-xl font-bold">Système Gaveurs V2.1</span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:border-b-4 border-white pb-1 transition-all"
              >
                {item.label}
              </Link>
            ))}
            
            {/* Alertes Badge */}
            <Link href="/alertes" className="relative">
              <Bell size={24} />
              {alertesCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-2 py-1">
                  {alertesCount}
                </span>
              )}
            </Link>
            
            {/* User Avatar */}
            <button className="flex items-center gap-2">
              <User size={24} />
              <span>JJ</span>
            </button>
          </div>
          
          {/* Mobile Hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-blue-700 px-4 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-2 hover:bg-blue-800 px-3 rounded"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
```

---

### 2. PAGE D'ACCUEIL / DASHBOARD (`app/page.tsx`)

**Spécifications** :

```typescript
// Affichage principal :
// 1. KPIs en haut (4 cards) :
//    - Canards actifs
//    - Gavages aujourd'hui
//    - Alertes critiques
//    - Performance moyenne

// 2. Section Alertes urgentes (liste des 5 dernières critiques)

// 3. Section Activité récente (derniers gavages)

// 4. Section Performance (graphique gains de poids)

// APIs à appeler :
// - GET /api/canards/gaveur/{gaveur_id}
// - GET /api/gavage/gaveur/{gaveur_id}?limit=10
// - GET /api/alertes/gaveur/{gaveur_id}?acquittee=false&niveau=critique
// - GET /api/analytics/weekly-report/{gaveur_id}

// Design :
// - Layout grid : grid-cols-1 md:grid-cols-2 lg:grid-cols-4
// - Espacements : gap-6
// - Padding : p-6
```

**Structure** :

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';

export default function DashboardPage() {
  const [kpis, setKpis] = useState({
    canardsActifs: 0,
    gavagesAujourdhui: 0,
    alertesCritiques: 0,
    performanceMoyenne: 0,
  });
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    // TODO: Charger les données depuis API
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">
        Dashboard Gaveur
      </h1>
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          icon={<Users size={32} />}
          label="Canards Actifs"
          value={kpis.canardsActifs}
          color="blue"
        />
        <KPICard
          icon={<Activity size={32} />}
          label="Gavages Aujourd'hui"
          value={kpis.gavagesAujourdhui}
          color="green"
        />
        <KPICard
          icon={<AlertTriangle size={32} />}
          label="Alertes Critiques"
          value={kpis.alertesCritiques}
          color="red"
        />
        <KPICard
          icon={<TrendingUp size={32} />}
          label="Performance Moyenne"
          value={`${kpis.performanceMoyenne}/100`}
          color="purple"
        />
      </div>
      
      {/* Sections à ajouter */}
    </div>
  );
}

function KPICard({ icon, label, value, color }: any) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-lg p-6 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{label}</p>
          <p className="text-4xl font-bold mt-2">{value}</p>
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </div>
  );
}
```

---

### 3. MODULE SAISIE GAVAGE (`app/gavage/page.tsx`)

**Spécifications** :

Intégrer le composant `SaisieRapideGavage.tsx` déjà créé.

**Fonctionnalités critiques** :

1. **Sélection canard** (dropdown)
   - API : GET /api/canards/gaveur/1

2. **Calcul dose théorique automatique**
   - Dès sélection canard
   - API : GET /api/ml/predict-doses/{canard_id}
   - Pré-remplir les champs

3. **Détection écarts en temps réel**
   - Calcul : `ecart = ((dose_reelle - dose_theo) / dose_theo) * 100`
   - Couleur selon seuil :
     - < 10% : text-green-600
     - 10-25% : text-orange-500
     - > 25% : text-red-600

4. **Saisie vocale** (optionnel mais à implémenter structure)
   - Utiliser `webkitSpeechRecognition`
   - Parser commandes : "dose matin 450", "poids 3250"

5. **Vision caméra** (optionnel mais à implémenter structure)
   - `navigator.mediaDevices.getUserMedia({ video: true })`
   - Simulation pour l'instant

6. **Sauvegarde**
   - API : POST /api/gavage/
   - Body : GavageFormData
   - Callback : vérifier alertes après sauvegarde

**Code** : Utiliser `components/SaisieRapideGavage.tsx` déjà fourni.

---

### 4. DASHBOARD ANALYTICS (`app/analytics/page.tsx`)

**Spécifications** :

Intégrer le composant `DashboardAnalytics.tsx` déjà créé.

**4 Onglets requis** :

#### Onglet 1 : Alertes Actives

- Liste des alertes non acquittées
- Filtrage par niveau
- Bouton acquitter : POST /api/alertes/{id}/acquitter
- Badge couleur selon niveau

#### Onglet 2 : Analytics Canard

- Input : Sélection canard (ID)
- API : GET /api/analytics/metrics/{canard_id}
- Affichage 4 scores avec jauges circulaires
- Affichage prédiction poids final

#### Onglet 3 : Prédictions Prophet

- Graphique Area Chart (Recharts)
- API : GET /api/analytics/predict-prophet/{canard_id}?jours=7
- 3 courbes : poids_predit, poids_min, poids_max

#### Onglet 4 : Comparaison Génétiques

- Bar Chart (Recharts)
- API : GET /api/analytics/compare-genetiques?gaveur_id=1
- Tableau détaillé

**Code** : Utiliser `components/DashboardAnalytics.tsx` déjà fourni.

---

### 5. BLOCKCHAIN EXPLORER (`app/blockchain/page.tsx`)

**Spécifications** :

Intégrer le composant `BlockchainExplorer.tsx` déjà créé.

**Fonctionnalités** :

1. **Recherche**
   - Input : ID canard ou N° identification
   - API : GET /api/blockchain/canard/{id}/history
   - API : GET /api/blockchain/canard/{id}/certificat

2. **Timeline Interactive**
   - Affichage chronologique
   - Icônes par type événement :
     - 🌟 genesis
     - 🐣 initialisation_canard
     - 🌽 gavage
     - ⚖️ pesee
     - 🏭 abattage
   - Click pour détails (expand)

3. **Certificat**
   - Affichage formaté
   - Bouton téléchargement (JSON)
   - Bouton QR Code (alert pour l'instant)

4. **Vérification Intégrité**
   - Bouton : Vérifier Intégrité
   - API : GET /api/blockchain/verify
   - Affichage résultat (valide/compromis)

**Code** : Utiliser `components/BlockchainExplorer.tsx` déjà fourni.

---

### 6. GESTION ALERTES (`app/alertes/page.tsx`)

**Spécifications** :

```typescript
// Fonctionnalités :
// 1. Dashboard KPIs
//    - API : GET /api/alertes/dashboard/{gaveur_id}

// 2. Filtres
//    - Par niveau (critique, important, info)
//    - Par statut (acquittée / non acquittée)
//    - Par date

// 3. Liste alertes
//    - API : GET /api/alertes/gaveur/{gaveur_id}
//    - Tri par date DESC
//    - Badge niveau
//    - Bouton acquitter

// 4. Détail alerte (modal)
//    - Toutes les infos
//    - Historique si plusieurs
//    - Graphique évolution si applicable

// Design :
// - Cards avec border-l-4 selon niveau
// - Icônes : AlertTriangle, Bell, Info
// - Animation : fade-in pour nouvelles alertes
```

**Structure** :

```typescript
'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Info, CheckCircle } from 'lucide-react';
import type { Alerte, AlerteDashboard } from '@/lib/types';

export default function AlertesPage() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [dashboard, setDashboard] = useState<AlerteDashboard | null>(null);
  const [filterNiveau, setFilterNiveau] = useState<string>('all');
  const [filterAcquittee, setFilterAcquittee] = useState<boolean>(false);
  
  useEffect(() => {
    loadAlertes();
    loadDashboard();
  }, [filterNiveau, filterAcquittee]);
  
  const loadAlertes = async () => {
    const url = `/api/alertes/gaveur/1?acquittee=${filterAcquittee}`;
    // TODO: Fetch et filtrer
  };
  
  const acquitter = async (alerteId: number) => {
    await fetch(`/api/alertes/${alerteId}/acquitter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gaveur_id: 1 }),
    });
    loadAlertes();
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-4xl font-bold mb-8">Gestion des Alertes</h1>
      
      {/* Dashboard KPIs */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-6 mb-8">
          {/* KPI Cards */}
        </div>
      )}
      
      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
        <select
          value={filterNiveau}
          onChange={(e) => setFilterNiveau(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Tous les niveaux</option>
          <option value="critique">Critiques</option>
          <option value="important">Importantes</option>
          <option value="info">Informatives</option>
        </select>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filterAcquittee}
            onChange={(e) => setFilterAcquittee(e.target.checked)}
          />
          Afficher acquittées
        </label>
      </div>
      
      {/* Liste alertes */}
      <div className="space-y-4">
        {alertes.map((alerte) => (
          <AlerteCard
            key={alerte.id}
            alerte={alerte}
            onAcquitter={acquitter}
          />
        ))}
      </div>
    </div>
  );
}

function AlerteCard({ alerte, onAcquitter }: any) {
  const niveauColors = {
    critique: 'border-red-500 bg-red-50',
    important: 'border-orange-500 bg-orange-50',
    info: 'border-blue-500 bg-blue-50',
  };
  
  return (
    <div className={`border-l-4 ${niveauColors[alerte.niveau]} rounded-lg p-4`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {alerte.niveau === 'critique' && <AlertTriangle className="text-red-600" />}
            {alerte.niveau === 'important' && <Bell className="text-orange-600" />}
            {alerte.niveau === 'info' && <Info className="text-blue-600" />}
            <h3 className="font-bold">{alerte.type_alerte}</h3>
          </div>
          <p>{alerte.message}</p>
          <p className="text-sm text-gray-600 mt-2">
            {new Date(alerte.time).toLocaleString('fr-FR')}
          </p>
        </div>
        
        {!alerte.acquittee && (
          <button
            onClick={() => onAcquitter(alerte.id)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <CheckCircle size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### 7. LISTE CANARDS (`app/canards/page.tsx`)

**Spécifications** :

```typescript
// Fonctionnalités :
// 1. Liste en grille de cards
//    - API : GET /api/canards/gaveur/{gaveur_id}
//    - Affichage : numéro, génétique, poids actuel, statut

// 2. Filtres
//    - Par génétique
//    - Par statut
//    - Recherche par numéro

// 3. Tri
//    - Par numéro
//    - Par poids
//    - Par date

// 4. Card canard
//    - Click pour détail : /canards/{id}
//    - Badge statut
//    - Indicateur alertes actives

// Design :
// - Grid : grid-cols-1 md:grid-cols-2 lg:grid-cols-3
// - Cards avec hover:shadow-xl transition
// - Badge statut coloré
```

**Structure** :

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter } from 'lucide-react';
import type { Canard } from '@/lib/types';

export default function CanardsPage() {
  const [canards, setCanards] = useState<Canard[]>([]);
  const [search, setSearch] = useState('');
  const [filterGenetique, setFilterGenetique] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  
  useEffect(() => {
    loadCanards();
  }, []);
  
  const loadCanards = async () => {
    const res = await fetch('/api/canards/gaveur/1');
    const data = await res.json();
    setCanards(data);
  };
  
  const filteredCanards = canards.filter((c) => {
    if (search && !c.numero_identification.includes(search)) return false;
    if (filterGenetique !== 'all' && c.genetique !== filterGenetique) return false;
    if (filterStatut !== 'all' && c.statut !== filterStatut) return false;
    return true;
  });
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Mes Canards</h1>
        <Link
          href="/canards/new"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
        >
          + Nouveau Canard
        </Link>
      </div>
      
      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher par numéro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <select
          value={filterGenetique}
          onChange={(e) => setFilterGenetique(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Toutes génétiques</option>
          <option value="Mulard">Mulard</option>
          <option value="Barbarie">Barbarie</option>
          <option value="Pekin">Pékin</option>
        </select>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">Tous statuts</option>
          <option value="en_gavage">En gavage</option>
          <option value="termine">Terminé</option>
          <option value="decede">Décédé</option>
        </select>
      </div>
      
      {/* Grid Canards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCanards.map((canard) => (
          <CanardCard key={canard.id} canard={canard} />
        ))}
      </div>
    </div>
  );
}

function CanardCard({ canard }: { canard: Canard }) {
  const statutColors = {
    en_gavage: 'bg-green-100 text-green-800',
    termine: 'bg-blue-100 text-blue-800',
    decede: 'bg-red-100 text-red-800',
  };
  
  return (
    <Link href={`/canards/${canard.id}`}>
      <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">
              🦆 {canard.numero_identification}
            </h3>
            <p className="text-gray-600">{canard.genetique}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statutColors[canard.statut]}`}>
            {canard.statut}
          </span>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Poids initial :</span> {canard.poids_initial}g
          </p>
          {canard.poids_actuel && (
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Poids actuel :</span> {canard.poids_actuel}g
            </p>
          )}
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Lot :</span> {canard.numero_lot_canard}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

---

### 8. DÉTAIL CANARD (`app/canards/[id]/page.tsx`)

**Spécifications** :

```typescript
// Fonctionnalités :
// 1. Informations générales
//    - API : GET /api/canards/{id}

// 2. Historique gavage
//    - API : GET /api/gavage/canard/{id}
//    - Graphique courbe de poids (Line Chart)

// 3. Métriques de performance
//    - API : GET /api/analytics/metrics/{id}
//    - Affichage scores

// 4. Prévisions Prophet
//    - API : GET /api/analytics/predict-prophet/{id}
//    - Graphique Area Chart

// 5. Alertes actives
//    - API : GET /api/alertes/gaveur/{gaveur_id} filtré par canard_id

// 6. Blockchain
//    - Bouton "Voir Traçabilité Blockchain"
//    - Redirection : /blockchain?canard={id}

// Design :
// - Layout : 2 colonnes (info + graphiques)
// - Tabs pour sections (Gavage, Analytics, Alertes)
```

**Structure** :

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Canard, GavageData, PerformanceMetrics } from '@/lib/types';

export default function CanardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const canardId = parseInt(params.id as string);
  
  const [canard, setCanard] = useState<Canard | null>(null);
  const [gavages, setGavages] = useState<GavageData[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [selectedTab, setSelectedTab] = useState<'gavage' | 'analytics' | 'alertes'>('gavage');
  
  useEffect(() => {
    loadCanard();
    loadGavages();
    loadMetrics();
  }, [canardId]);
  
  const loadCanard = async () => {
    const res = await fetch(`/api/canards/${canardId}`);
    const data = await res.json();
    setCanard(data);
  };
  
  const loadGavages = async () => {
    const res = await fetch(`/api/gavage/canard/${canardId}`);
    const data = await res.json();
    setGavages(data);
  };
  
  const loadMetrics = async () => {
    const res = await fetch(`/api/analytics/metrics/${canardId}`);
    const data = await res.json();
    setMetrics(data);
  };
  
  if (!canard) return <div>Chargement...</div>;
  
  // Préparer données pour graphique
  const chartData = gavages.map((g) => ({
    date: new Date(g.time).toLocaleDateString('fr-FR'),
    poids_matin: g.poids_matin,
    poids_soir: g.poids_soir,
  }));
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              🦆 {canard.numero_identification}
            </h1>
            <p className="text-gray-600">{canard.genetique} - {canard.statut}</p>
          </div>
          <button
            onClick={() => router.push(`/blockchain?canard=${canardId}`)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700"
          >
            🔗 Voir Blockchain
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedTab('gavage')}
          className={`px-6 py-3 rounded-lg font-bold ${
            selectedTab === 'gavage'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Historique Gavage
        </button>
        <button
          onClick={() => setSelectedTab('analytics')}
          className={`px-6 py-3 rounded-lg font-bold ${
            selectedTab === 'analytics'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Analytics
        </button>
        <button
          onClick={() => setSelectedTab('alertes')}
          className={`px-6 py-3 rounded-lg font-bold ${
            selectedTab === 'alertes'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Alertes
        </button>
      </div>
      
      {/* Contenu selon tab */}
      {selectedTab === 'gavage' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Courbe de Poids</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="poids_matin" stroke="#3b82f6" name="Poids Matin" />
              <Line type="monotone" dataKey="poids_soir" stroke="#10b981" name="Poids Soir" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {selectedTab === 'analytics' && metrics && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Métriques de Performance</h2>
          <div className="grid grid-cols-4 gap-6">
            <MetricCard label="Score Global" value={metrics.score_performance} max={100} />
            <MetricCard label="IC" value={metrics.score_ic} max={100} />
            <MetricCard label="Gain" value={metrics.score_gain} max={100} />
            <MetricCard label="Régularité" value={metrics.score_regularite} max={100} />
          </div>
        </div>
      )}
      
      {selectedTab === 'alertes' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Alertes Actives</h2>
          {/* TODO: Charger et afficher alertes */}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, max }: any) {
  const percentage = (value / max) * 100;
  const color = percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <div className="text-center">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      <p className={`text-5xl font-bold ${color}`}>{Math.round(value)}</p>
      <p className="text-xs text-gray-500">/{max}</p>
    </div>
  );
}
```

---

### 9. MODULE AUTHENTIFICATION (`app/(auth)/`)

**Spécifications** :

```typescript
// Structure des pages Auth
app/
├── (auth)/
│   ├── layout.tsx          // Layout spécial sans navbar
│   ├── login/
│   │   └── page.tsx        // Page de connexion
│   ├── register/
│   │   └── page.tsx        // Page d'inscription
│   ├── forgot-password/
│   │   └── page.tsx        // Mot de passe oublié
│   └── reset-password/
│       └── page.tsx        // Réinitialisation

// Fonctionnalités requises :
// - Formulaires avec validation
// - Gestion erreurs API
// - Redirection après login
// - Stockage token (localStorage + httpOnly cookie)
// - Auto-logout si token expiré
// - Remember me (optionnel)

// Design :
// - Layout centré avec card
// - Background gradient
// - Logo + titre
// - Liens navigation (login <-> register)
```

**Page Login** : `app/(auth)/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Erreur de connexion');
      }

      const data = await res.json();
      
      // Stocker token
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirection selon rôle
      if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl">🦆</span>
          <h1 className="text-3xl font-bold text-gray-800 mt-4">
            Système Gaveurs V2.1
          </h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre compte</p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="vous@exemple.fr"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-600">Se souvenir</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Inscription */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              className="text-blue-600 font-bold hover:text-blue-700"
            >
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Page Register** : `app/(auth)/register/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: '',
    prenom: '',
    role: 'gaveur' as 'gaveur' | 'veterinaire',
    telephone: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nom: formData.nom,
          prenom: formData.prenom,
          role: formData.role,
          telephone: formData.telephone || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Erreur lors de l\'inscription');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
          <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Inscription réussie !
          </h2>
          <p className="text-gray-600">
            Redirection vers la page de connexion...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl">🦆</span>
          <h1 className="text-3xl font-bold text-gray-800 mt-4">
            Créer un compte
          </h1>
          <p className="text-gray-600 mt-2">Rejoignez le système Gaveurs V2.1</p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prénom
              </label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="vous@exemple.fr"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone (optionnel)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rôle
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="gaveur">Gaveur</option>
              <option value="veterinaire">Vétérinaire</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

        {/* Connexion */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Déjà un compte ?{' '}
            <Link
              href="/login"
              className="text-blue-600 font-bold hover:text-blue-700"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Auth Context** : `context/AuthContext.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, AuthToken } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Vérifier si token existe au chargement
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Erreur de connexion');
    }

    const data: AuthToken = await res.json();

    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);

    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

**Protected Route HOC** : `components/ProtectedRoute.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

---

### 10. WEBSOCKET TEMPS RÉEL (`context/WebSocketContext.tsx`)


### Fichier : `lib/api.ts`

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiClient {
  static async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  }
  
  static async post<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  }
  
  static async put<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  }
  
  static async delete(endpoint: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
  }
}

// Fonctions helper spécifiques
export const canardApi = {
  getAll: (gaveurId: number) => ApiClient.get(`/api/canards/gaveur/${gaveurId}`),
  getById: (id: number) => ApiClient.get(`/api/canards/${id}`),
  create: (data: any) => ApiClient.post('/api/canards/', data),
};

export const gavageApi = {
  create: (data: any) => ApiClient.post('/api/gavage/', data),
  getByCanard: (canardId: number) => ApiClient.get(`/api/gavage/canard/${canardId}`),
};

export const alerteApi = {
  getByGaveur: (gaveurId: number) => ApiClient.get(`/api/alertes/gaveur/${gaveurId}`),
  acquitter: (id: number, gaveurId: number) => 
    ApiClient.post(`/api/alertes/${id}/acquitter`, { gaveur_id: gaveurId }),
};

export const analyticsApi = {
  getMetrics: (canardId: number) => ApiClient.get(`/api/analytics/metrics/${canardId}`),
  getPredictions: (canardId: number, jours: number = 7) => 
    ApiClient.get(`/api/analytics/predict-prophet/${canardId}?jours=${jours}`),
  compareGenetiques: (gaveurId?: number) => {
    const url = gaveurId 
      ? `/api/analytics/compare-genetiques?gaveur_id=${gaveurId}`
      : '/api/analytics/compare-genetiques';
    return ApiClient.get(url);
  },
};

export const blockchainApi = {
  getHistory: (canardId: number) => ApiClient.get(`/api/blockchain/canard/${canardId}/history`),
  getCertificat: (canardId: number) => ApiClient.get(`/api/blockchain/canard/${canardId}/certificat`),
  verify: () => ApiClient.get('/api/blockchain/verify'),
};
```

### Fichier : `lib/utils.ts`

```typescript
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('fr-FR');
}

export function truncateHash(hash: string, length: number = 16): string {
  if (hash.length <= length) return hash;
  const half = Math.floor(length / 2);
  return `${hash.substring(0, half)}...${hash.substring(hash.length - half)}`;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function getNiveauColor(niveau: string): string {
  switch (niveau) {
    case 'critique':
      return 'bg-red-100 border-red-500 text-red-800';
    case 'important':
      return 'bg-orange-100 border-orange-500 text-orange-800';
    case 'info':
      return 'bg-blue-100 border-blue-500 text-blue-800';
    default:
      return 'bg-gray-100 border-gray-500 text-gray-800';
  }
}

export function calculateEcart(reel: number, theorique: number): number {
  if (!theorique) return 0;
  return ((reel - theorique) / theorique) * 100;
}

export function getEcartColor(ecart: number): string {
  const abs = Math.abs(ecart);
  if (abs >= 25) return 'text-red-600';
  if (abs >= 10) return 'text-orange-500';
  return 'text-green-600';
}
```

---

## 🎯 CHECKLIST DE DÉVELOPPEMENT

### Phase 1 : Setup Initial

- [ ] Créer projet Next.js 14 avec TypeScript
- [ ] Installer dépendances (recharts, lucide-react)
- [ ] Configurer Tailwind CSS
- [ ] Créer structure de dossiers
- [ ] Créer `lib/types.ts` avec tous les types
- [ ] Créer `lib/api.ts` avec ApiClient
- [ ] Créer `lib/utils.ts` avec helpers
- [ ] Créer `.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Phase 2 : Layout & Navigation

- [ ] Créer `app/layout.tsx` (layout racine)
- [ ] Créer `components/layout/Navbar.tsx`
- [ ] Créer `components/layout/Footer.tsx` (optionnel)
- [ ] Tester navigation entre pages

### Phase 3 : Pages Principales

- [ ] Créer `app/page.tsx` (Dashboard)
- [ ] Créer `app/gavage/page.tsx` (Saisie)
- [ ] Créer `app/analytics/page.tsx` (Analytics)
- [ ] Créer `app/blockchain/page.tsx` (Explorer)
- [ ] Créer `app/alertes/page.tsx` (Alertes)
- [ ] Créer `app/canards/page.tsx` (Liste)
- [ ] Créer `app/canards/[id]/page.tsx` (Détail)

### Phase 4 : Composants Avancés

- [ ] Intégrer `SaisieRapideGavage.tsx`
- [ ] Intégrer `DashboardAnalytics.tsx`
- [ ] Intégrer `BlockchainExplorer.tsx`
- [ ] Créer composants UI de base (Button, Card, Input, Select, Modal)

### Phase 5 : Intégrations API

- [ ] Tester tous les endpoints API
- [ ] Gérer états de chargement (loading)
- [ ] Gérer erreurs API
- [ ] Ajouter toasts/notifications

### Phase 6 : Fonctionnalités Avancées

- [ ] Implémenter saisie vocale (optionnel)
- [ ] Implémenter vision caméra (optionnel)
- [ ] Implémenter WebSocket real-time (optionnel)
- [ ] Ajouter animations/transitions

### Phase 7 : Polish & Tests

- [ ] Responsive design (mobile, tablet)
- [ ] Accessibilité (ARIA labels)
- [ ] Tests unitaires composants
- [ ] Tests E2E (Playwright/Cypress)
- [ ] Optimisation performance
- [ ] SEO (metadata)

---

## 🚀 COMMANDES DE DÉMARRAGE

### Initialisation

```bash
# Créer projet Next.js 14
npx create-next-app@latest gaveurs-frontend --typescript --tailwind --app

cd gaveurs-frontend

# Installer dépendances
npm install recharts lucide-react

# Créer structure
mkdir -p app/gavage app/analytics app/blockchain app/alertes app/canards/[id]
mkdir -p components/ui components/layout
mkdir -p lib context hooks

# Créer .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Lancer dev
npm run dev
```

### Démarrer Backend (dans un autre terminal)

```bash
cd /path/to/gaveurs-ai-blockchain
./start.sh
```

### Accès

- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:8000
- **API Docs** : http://localhost:8000/docs

---

## ⚠️ NOTES IMPORTANTES

### Priorités de Développement

**MUST HAVE** (P0) :
1. Navbar + Layout
2. Page Dashboard
3. Module Saisie Gavage
4. Liste Canards
5. Détail Canard

**SHOULD HAVE** (P1) :
6. Dashboard Analytics
7. Blockchain Explorer
8. Gestion Alertes

**NICE TO HAVE** (P2) :
9. Saisie vocale
10. Vision caméra
11. WebSocket real-time

### Données de Test

Utiliser **Gaveur ID = 1** pour tous les tests.

Backend possède des données de test :
- 2 gaveurs
- 7 canards
- 91 enregistrements de gavage (13 jours * 7 canards)

### Gestion des Erreurs

Toujours wrapper les appels API dans try/catch :

```typescript
try {
  const data = await ApiClient.get('/api/canards/gaveur/1');
  setCanards(data);
} catch (error) {
  console.error('Erreur chargement canards:', error);
  // TODO: Afficher toast erreur
}
```

### Performance

- Utiliser `React.memo` pour composants lourds
- Implémenter pagination pour listes longues
- Lazy load graphiques recharts

---

## 📞 CONTACT & SUPPORT

Pour toute question sur les spécifications :

**Développeur Backend** : JJ  
**API Documentation** : http://localhost:8000/docs

---

**🎯 READY TO CODE ! Ce document contient TOUTES les spécifications nécessaires pour développer le frontend complet.**

**Claude Code : Merci de suivre ces spécifications à la lettre. Tout le backend est opérationnel et testé. Tu peux commencer le développement immédiatement !**
