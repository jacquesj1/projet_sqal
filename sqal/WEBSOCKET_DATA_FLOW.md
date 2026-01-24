# 🔄 SQAL - Flux de Données WebSocket Temps Réel

## 📋 Table des matières

1. [Architecture Globale](#architecture-globale)
2. [Types de Messages WebSocket](#types-de-messages-websocket)
3. [Flux de Dispatch Détaillé](#flux-de-dispatch-détaillé)
4. [Structure du Store Frontend](#structure-du-store-frontend)
5. [Utilisation dans les Pages React](#utilisation-dans-les-pages-react)
6. [Points Importants](#points-importants)
7. [Cas d'Usage](#cas-dusage)

---

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SIMULATEUR (Python)                          │
│  - foiegras_fusion_simulator.py                                     │
│  - Génère données ToF + Spectral + Fusion                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP POST /api/realtime/fusion
                             │ {vl53l8ch, as7341, fusion_result}
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND FASTAPI (Python)                        │
│  - Reçoit les données fusion                                        │
│  - Valide avec Pydantic                                             │
│  - Sauvegarde en TimescaleDB                                        │
│  - Broadcast via WebSocket /ws/realtime/                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ WebSocket /ws/realtime/
                             │ 3 messages séparés :
                             │  1. sensor_data (VL53L8CH)
                             │  2. sensor_data (AS7341)
                             │  3. analysis_result (Fusion)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND REACT (TypeScript)                       │
│  - useWebSocket hook (services/websocket.ts)                        │
│  - Reçoit les 3 messages                                            │
│  - Dispatch vers le store Zustand                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Store Zustand (realtimeStore.ts)
                             │ 3 propriétés séparées :
                             │  - latestVL53L8CH
                             │  - latestAS7341
                             │  - latestFusion
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PAGES REACT (Components)                        │
│  - Dashboard.tsx                                                     │
│  - FoieGrasPage.tsx                                                  │
│  - VL53L8CHPage.tsx                                                  │
│  - AS7341Page.tsx                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📨 Types de Messages WebSocket

Le backend envoie **4 types de messages** via WebSocket :

### **1. Message de connexion établie**

```json
{
  "type": "connection_established",
  "message": "Connected to realtime data stream"
}
```

**Quand ?** Immédiatement après la connexion WebSocket.

**Utilité ?** Confirmer que la connexion est active.

---

### **2. Message sensor_data (VL53L8CH - ToF)**

```json
{
  "type": "sensor_data",
  "sensor_type": "VL53L8CH",
  "data": {
    "sample_id": "sample-001",
    "timestamp": "2024-01-15T10:30:00Z",
    "device_id": "device-001",
    "distance_matrix": [[...], [...], ...],  // 8x8 matrix
    "reflectance_matrix": [[...], [...], ...],
    "amplitude_matrix": [[...], [...], ...],
    "metadata": {
      "temperature": 25.5,
      "integration_time": 100
    }
  }
}
```

**Quand ?** À chaque nouvelle mesure ToF reçue du simulateur.

**Contenu ?** Données brutes du capteur VL53L8CH (matrices 8x8).

**Stockage frontend ?** `latestVL53L8CH` dans le store.

---

### **3. Message sensor_data (AS7341 - Spectral)**

```json
{
  "type": "sensor_data",
  "sensor_type": "AS7341",
  "data": {
    "sample_id": "sample-001",
    "timestamp": "2024-01-15T10:30:00Z",
    "device_id": "device-001",
    "raw_counts": {
      "F1_415nm": 1234,
      "F2_445nm": 2345,
      "F3_480nm": 3456,
      "F4_515nm": 4567,
      "F5_555nm": 5678,
      "F6_590nm": 6789,
      "F7_630nm": 7890,
      "F8_680nm": 8901,
      "Clear": 9012,
      "NIR": 1023
    },
    "metadata": {
      "gain": 128,
      "integration_time": 100
    }
  }
}
```

**Quand ?** À chaque nouvelle mesure spectrale reçue du simulateur.

**Contenu ?** Données brutes du capteur AS7341 (10 canaux spectraux).

**Stockage frontend ?** `latestAS7341` dans le store.

---

### **4. Message analysis_result (Fusion)**

```json
{
  "type": "analysis_result",
  "data": {
    "sample_id": "sample-001",
    "timestamp": "2024-01-15T10:30:00Z",
    "device_id": "device-001",
    "grade": "A+",
    "quality_score": 0.95,
    "is_compliant": true,
    "defects": [
      {
        "type": "cavity",
        "severity": "minor",
        "position": {"x": 3, "y": 4},
        "size_mm2": 2.5
      }
    ],
    "foie_gras_metrics": {
      "volume_mm3": 1234.5,
      "avg_height_mm": 45.2,
      "surface_uniformity": 0.92,
      "color_score": 0.88,
      "freshness_index": 0.91,
      "oxidation_level": 0.12,
      "tof_score": 0.94,
      "spectral_score": 0.89,
      "Cp": 1.45,
      "Cpk": 1.32,
      "process_capability": "capable"
    }
  }
}
```

**Quand ?** À chaque nouvelle analyse fusion (ToF + Spectral) calculée par le simulateur.

**Contenu ?** Résultats de l'analyse complète (grade, score, défauts, métriques métier).

**Stockage frontend ?** `latestFusion` dans le store.

---

## 🔄 Flux de Dispatch Détaillé

### **Étape 1 : Simulateur → Backend**

```python
# foiegras_fusion_simulator.py
async def send_fusion_data():
    fusion_data = {
        "vl53l8ch": {...},      # Données ToF brutes
        "as7341": {...},        # Données spectrales brutes
        "fusion_result": {...}  # Résultats fusion
    }
    
    response = await session.post(
        "http://backend:8000/api/realtime/fusion",
        json=fusion_data
    )
```

**Format :** Un seul objet JSON contenant les 3 types de données.

---

### **Étape 2 : Backend Reçoit et Valide**

```python
# backend_new/app/main.py
@app.post("/api/realtime/fusion")
async def receive_fusion_data(data: dict):
    # Validation Pydantic
    vl53l8ch_data = VL53L8CHData(**data["vl53l8ch"])
    as7341_data = AS7341Data(**data["as7341"])
    fusion_result = FusionResult(**data["fusion_result"])
    
    # Sauvegarde en DB
    await save_to_timescaledb(...)
    
    # Broadcast WebSocket
    await broadcast_to_dashboards(data)
```

**Validation :** Pydantic vérifie la structure des données.

**Sauvegarde :** TimescaleDB pour l'historique.

**Broadcast :** Envoi aux clients WebSocket connectés.

---

### **Étape 3 : Backend Broadcast WebSocket**

```python
# backend_new/app/main.py
async def broadcast_to_dashboards(data: dict):
    # Message 1 : VL53L8CH
    await websocket.send_json({
        "type": "sensor_data",
        "sensor_type": "VL53L8CH",
        "data": data["vl53l8ch"]
    })
    
    # Message 2 : AS7341
    await websocket.send_json({
        "type": "sensor_data",
        "sensor_type": "AS7341",
        "data": data["as7341"]
    })
    
    # Message 3 : Fusion
    await websocket.send_json({
        "type": "analysis_result",
        "data": data["fusion_result"]
    })
```

**Important :** Le backend envoie **3 messages séparés** au lieu d'un seul.

**Pourquoi ?** Séparation des responsabilités, flexibilité, performance.

---

### **Étape 4 : Frontend Reçoit (useWebSocket)**

```typescript
// sqal/src/services/websocket.ts
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case "connection_established":
      console.log("✅ WebSocket connected");
      break;
      
    case "sensor_data":
      if (message.sensor_type === "VL53L8CH") {
        // Dispatch vers store
        useRealtimeStore.getState().setLatestVL53L8CH(message.data);
      } else if (message.sensor_type === "AS7341") {
        useRealtimeStore.getState().setLatestAS7341(message.data);
      }
      break;
      
    case "analysis_result":
      useRealtimeStore.getState().setLatestFusion(message.data);
      break;
  }
};
```

**Dispatch :** Chaque message est routé vers la bonne propriété du store.

---

### **Étape 5 : Store Zustand Met à Jour**

```typescript
// sqal/src/stores/realtimeStore.ts
interface RealtimeStore {
  latestVL53L8CH: VL53L8CHData | null;
  latestAS7341: AS7341Data | null;
  latestFusion: FusionResult | null;
  
  setLatestVL53L8CH: (data: VL53L8CHData) => void;
  setLatestAS7341: (data: AS7341Data) => void;
  setLatestFusion: (data: FusionResult) => void;
}

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  latestVL53L8CH: null,
  latestAS7341: null,
  latestFusion: null,
  
  setLatestVL53L8CH: (data) => set({ latestVL53L8CH: data }),
  setLatestAS7341: (data) => set({ latestAS7341: data }),
  setLatestFusion: (data) => set({ latestFusion: data }),
}));
```

**3 propriétés séparées :** Chaque type de données a sa propre propriété.

**Réactivité :** Zustand notifie automatiquement les composants abonnés.

---

### **Étape 6 : Pages React Consomment**

```typescript
// sqal/src/pages/Dashboard.tsx
export function Dashboard() {
  const { latestVL53L8CH, latestAS7341, latestFusion } = useRealtimeStore();
  
  return (
    <div>
      {/* Utiliser latestFusion pour les KPIs */}
      <KPICard 
        title="Qualité Moyenne"
        value={latestFusion?.quality_score}
      />
      
      {/* Utiliser latestVL53L8CH pour la heatmap ToF */}
      <ToFHeatmap 
        matrix={latestVL53L8CH?.distance_matrix}
      />
      
      {/* Utiliser latestAS7341 pour le graphique spectral */}
      <SpectralChart 
        data={latestAS7341?.raw_counts}
      />
    </div>
  );
}
```

**Accès direct :** Les pages accèdent directement aux 3 propriétés du store.

**Réactivité :** Les composants se mettent à jour automatiquement quand les données changent.

---

## 📊 Structure du Store Frontend

### **Propriété 1 : latestVL53L8CH**

```typescript
interface VL53L8CHData {
  sample_id: string;
  timestamp: string;
  device_id: string;
  distance_matrix: number[][];      // 8x8
  reflectance_matrix: number[][];   // 8x8
  amplitude_matrix: number[][];     // 8x8
  metadata: {
    temperature: number;
    integration_time: number;
  };
}
```

**Usage :** Affichage des matrices ToF (heatmap, 3D, profils).

---

### **Propriété 2 : latestAS7341**

```typescript
interface AS7341Data {
  sample_id: string;
  timestamp: string;
  device_id: string;
  raw_counts: {
    F1_415nm: number;
    F2_445nm: number;
    F3_480nm: number;
    F4_515nm: number;
    F5_555nm: number;
    F6_590nm: number;
    F7_630nm: number;
    F8_680nm: number;
    Clear: number;
    NIR: number;
  };
  metadata: {
    gain: number;
    integration_time: number;
  };
}
```

**Usage :** Affichage des données spectrales (graphiques, radar, analyse couleur).

---

### **Propriété 3 : latestFusion**

```typescript
interface FusionResult {
  sample_id: string;
  timestamp: string;
  device_id: string;
  grade: string;
  quality_score: number;
  is_compliant: boolean;
  defects: Array<{
    type: string;
    severity: string;
    position: { x: number; y: number };
    size_mm2: number;
  }>;
  foie_gras_metrics: {
    volume_mm3: number;
    avg_height_mm: number;
    surface_uniformity: number;
    color_score: number;
    freshness_index: number;
    oxidation_level: number;
    tof_score: number;
    spectral_score: number;
    Cp: number;
    Cpk: number;
    process_capability: string;
    [key: string]: any;  // Index signature pour flexibilité
  };
}
```

**Usage :** Affichage des résultats d'analyse (KPIs, alertes, grade, défauts).

---

## 🎯 Utilisation dans les Pages React

### **Dashboard.tsx**

```typescript
const { latestFusion, latestVL53L8CH, latestAS7341 } = useRealtimeStore();

// KPI Cards
<KPICard value={latestFusion?.quality_score} />

// Graphiques temps réel
<ThicknessChart data={fusionHistory} />  // Historique
<SpectralBandsChart data={latestAS7341?.raw_counts} />  // Dernier échantillon
```

**Utilise :** Les 3 propriétés selon le besoin.

---

### **FoieGrasPage.tsx**

```typescript
const { latestFusion, latestVL53L8CH, latestAS7341 } = useRealtimeStore();

// Transformation des données
const foieGrasData = {
  sample_id: latestFusion?.sample_id,
  grade: latestFusion?.grade,
  volume_mm3: latestFusion?.foie_gras_metrics?.volume_mm3,
  distance_matrix: latestVL53L8CH?.distance_matrix,
  raw_counts: latestAS7341?.raw_counts,
  // ...
};

// Affichage
<TopViewHeatmap matrix={foieGrasData.distance_matrix} />
<SpectralAnalysis data={foieGrasData.raw_counts} />
```

**Utilise :** Les 3 propriétés pour reconstituer les données complètes.

---

### **VL53L8CHPage.tsx**

```typescript
const { latestVL53L8CH } = useRealtimeStore();

// Affichage ToF uniquement
<ToFHeatmap2D matrix={latestVL53L8CH?.distance_matrix} />
<ToF3DVisualization data={latestVL53L8CH} />
```

**Utilise :** Uniquement `latestVL53L8CH`.

---

### **AS7341Page.tsx**

```typescript
const { latestAS7341 } = useRealtimeStore();

// Affichage spectral uniquement
<SpectralBandsChart data={latestAS7341?.raw_counts} />
<ColorAnalysis data={latestAS7341} />
```

**Utilise :** Uniquement `latestAS7341`.

---

## ⚠️ Points Importants

### **1. Pourquoi 3 propriétés séparées ?**

❌ **Mauvaise approche :**
```typescript
latestFusion: {
  vl53l8ch: {...},  // Duplication des matrices (192 valeurs)
  as7341: {...},    // Duplication des spectres (10 valeurs)
  fusion_result: {...}
}
```

✅ **Bonne approche :**
```typescript
latestVL53L8CH: {...}  // Données ToF brutes
latestAS7341: {...}    // Données spectrales brutes
latestFusion: {...}    // Résultats fusion (sans duplication)
```

**Avantages :**
- ✅ Pas de duplication des données
- ✅ Séparation des responsabilités
- ✅ Flexibilité (pages peuvent utiliser ce dont elles ont besoin)
- ✅ Performance (pas de copie de matrices)

---

### **2. Comment accéder aux matrices ToF dans FoieGrasPage ?**

❌ **MAUVAIS :**
```typescript
const matrices = latestFusion.vl53l8ch;  // undefined !
```

✅ **BON :**
```typescript
const { latestVL53L8CH, latestFusion } = useRealtimeStore();
const matrices = latestVL53L8CH?.distance_matrix;  // ✅
```

---

### **3. Synchronisation des données**

Les 3 messages WebSocket ont le **même `sample_id`**, ce qui permet de les associer :

```typescript
if (latestVL53L8CH?.sample_id === latestFusion?.sample_id) {
  // Les données sont synchronisées
}
```

---

### **4. Gestion des données null**

Toujours vérifier si les données existent avant de les utiliser :

```typescript
const quality = latestFusion?.quality_score ?? 0;
const matrix = latestVL53L8CH?.distance_matrix ?? [];
```

---

## 🎯 Cas d'Usage

### **Cas 1 : Afficher le grade et le score**

```typescript
const { latestFusion } = useRealtimeStore();

<div>
  <p>Grade: {latestFusion?.grade ?? "N/A"}</p>
  <p>Score: {latestFusion?.quality_score ?? 0}</p>
</div>
```

---

### **Cas 2 : Afficher la heatmap ToF**

```typescript
const { latestVL53L8CH } = useRealtimeStore();

<ToFHeatmap2D 
  matrix={latestVL53L8CH?.distance_matrix ?? []}
/>
```

---

### **Cas 3 : Afficher le graphique spectral**

```typescript
const { latestAS7341 } = useRealtimeStore();

<SpectralBandsChart 
  data={latestAS7341?.raw_counts ?? {}}
/>
```

---

### **Cas 4 : Afficher les défauts avec position**

```typescript
const { latestFusion, latestVL53L8CH } = useRealtimeStore();

<DefectOverlay 
  defects={latestFusion?.defects ?? []}
  matrix={latestVL53L8CH?.distance_matrix ?? []}
/>
```

---

### **Cas 5 : Calculer des métriques dérivées**

```typescript
const { latestFusion } = useRealtimeStore();

const metrics = latestFusion?.foie_gras_metrics;
const totalScore = (
  (metrics?.tof_score ?? 0) * 0.6 +
  (metrics?.spectral_score ?? 0) * 0.4
);
```

---

## 📚 Résumé

```
✅ 1 endpoint HTTP POST : /api/realtime/fusion (Simulateur → Backend)
✅ 1 endpoint WebSocket : /ws/realtime/ (Backend → Frontend)
✅ 4 types de messages : connection_established, sensor_data (x2), analysis_result
✅ 3 propriétés du store : latestVL53L8CH, latestAS7341, latestFusion
✅ Séparation des données : Pas de duplication, flexibilité maximale
✅ Réactivité : Zustand notifie automatiquement les composants
✅ Synchronisation : sample_id identique pour les 3 messages
```

---

## 🚀 Prochaines Étapes

1. **Enrichir les interfaces TypeScript** avec tous les champs métier
2. **Ajouter des historiques** (fusionHistory, vl53l8chHistory, as7341History)
3. **Implémenter le filtrage** des données (par device_id, grade, etc.)
4. **Ajouter la gestion d'erreurs** (reconnexion WebSocket, timeout, etc.)
5. **Optimiser les performances** (debounce, throttle, memoization)

---

**Documentation créée le 2024-01-15 | Version 1.0**
