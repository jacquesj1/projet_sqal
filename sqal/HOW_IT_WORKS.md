# 🔬 SQAL System - Comment Ça Fonctionne

**Guide Technique Détaillé**

Ce document explique en détail comment fonctionne le système SQAL, du capteur au dashboard.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Flux de données complet](#flux-de-données-complet)
3. [Simulator - Génération de données](#simulator---génération-de-données)
4. [Backend - Traitement et stockage](#backend---traitement-et-stockage)
5. [Database - Persistance](#database---persistance)
6. [Frontend - Visualisation](#frontend---visualisation)
7. [Sécurité et validation](#sécurité-et-validation)
8. [Performance et optimisation](#performance-et-optimisation)

---

## 🎯 Vue d'ensemble

### Concept du Système

SQAL est un système de **contrôle qualité en temps réel** pour la production de foie gras. Il utilise deux capteurs complémentaires pour analyser chaque échantillon :

1. **VL53L8CH** (Time-of-Flight) : Mesure la géométrie 3D
   - Matrice 8x8 de distances (jusqu'à 400mm)
   - Réflectance de surface
   - Amplitude du signal

2. **AS7341** (Spectral) : Analyse la composition chimique
   - 10 canaux spectraux (415nm à NIR)
   - Indices de fraîcheur, qualité du gras, oxydation
   - Analyse couleur RGB

3. **Fusion** : Combine les deux pour un score final
   - Pondération : 60% VL53L8CH + 40% AS7341
   - Détection de défauts multi-source
   - Grade final : A+, A, B, C, REJECT

### Architecture en 4 Couches

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 : PRESENTATION (Frontend)                      │
│  React + TypeScript + WebSocket                         │
│  └─> Dashboard, Graphiques, Alertes                     │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (ws://backend:8000/ws/realtime/)
                     │ REST API (http://backend:8000/api/...)
┌────────────────────▼────────────────────────────────────┐
│  LAYER 2 : APPLICATION (Backend)                        │
│  FastAPI + Pydantic + SQLAlchemy                        │
│  └─> Validation, Business Logic, API                    │
└────────────────────┬────────────────────────────────────┘
                     │ PostgreSQL Protocol
┌────────────────────▼────────────────────────────────────┐
│  LAYER 3 : PERSISTENCE (Database)                       │
│  TimescaleDB + Hypertables                              │
│  └─> Stockage, Agrégations, Compression                 │
└─────────────────────────────────────────────────────────┘
                     ▲
                     │ WebSocket (ws://backend:8000/ws/sensors/)
┌────────────────────┴────────────────────────────────────┐
│  LAYER 0 : DATA SOURCE (Simulator)                      │
│  Python + I2C Bus Simulation                            │
│  └─> VL53L8CH, AS7341, Analyseurs, Fusion               │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de Données Complet

### Étape par Étape

#### 1. Génération de Données (Simulator)

```python
# simulator/data_generator.py

# 1.1 Démarrage mesure VL53L8CH via I2C
i2c_bus.write_byte(VL53L8CH_ADDR, REG_START_MEASUREMENT, 1)

# 1.2 Démarrage mesure AS7341 via I2C
i2c_bus.write_byte(AS7341_ADDR, REG_ENABLE, 0x01)

# 1.3 Attente que les données soient prêtes (polling)
while not ready:
    status = i2c_bus.read_byte(VL53L8CH_ADDR, REG_DATA_READY)
    time.sleep(0.01)  # Poll every 10ms

# 1.4 Lecture données BRUTES
vl_raw = {
    'distance_matrix': [[...], ...],      # 8x8, en mm
    'reflectance_matrix': [[...], ...],   # 8x8, 0-255
    'amplitude_matrix': [[...], ...]      # 8x8, signal strength
}

as_raw = {
    'channels': {
        'F1_415nm': 1234,  # Violet
        'F2_445nm': 1567,  # Indigo
        # ... 10 canaux total
    },
    'integration_time': 100,  # ms
    'gain': 16               # multiplier
}

# 1.5 ANALYSE avec analyseurs dédiés
vl_analyzed = VL53L8CH_DataAnalyzer().process(vl_raw)
# └─> Calcule : volume, hauteur moy/max/min, uniformité
#     Analyse bins, reflectance, amplitude
#     Détecte défauts (surface_irregularity, low_reflectance, etc.)
#     Score : 0.0-1.0, Grade : A+/A/B/C/REJECT

as_analyzed = AS7341_DataAnalyzer().process(as_raw)
# └─> Calcule : ratios spectraux (violet/orange, bleu/rouge, etc.)
#     Indices qualité (freshness, fat_quality, oxidation)
#     Analyse couleur RGB
#     Détecte défauts (oxidation_detected, freshness_issue, etc.)
#     Score : 0.0-1.0, Grade : A+/A/B/C/REJECT

# 1.6 FUSION multi-capteurs
fusion = {
    'final_score': vl_score * 0.6 + as_score * 0.4,  # Pondération
    'final_grade': calculate_grade(final_score),
    'vl53l8ch_score': vl_score,
    'as7341_score': as_score,
    'defects': vl_defects + as_defects  # Combinés
}

# 1.7 Création du message complet
message = {
    'type': 'sensor_data',
    'timestamp': '2025-10-26T10:30:00.000Z',
    'device_id': 'ESP32-FOIEGRAS-001',
    'sample_id': 'SAMPLE-20251026-103000-123',
    'vl53l8ch': {**vl_raw, **vl_analyzed},  # RAW + ANALYZED
    'as7341': {**as_raw, **as_analyzed},    # RAW + ANALYZED
    'fusion': fusion,
    'meta': {
        'firmware_version': '1.0.0',
        'temperature_c': 25.5,
        'humidity_percent': 50.0,
        'config_profile': 'foiegras_premium'
    }
}

# 1.8 Envoi via WebSocket
await websocket.send(json.dumps(message))
```

#### 2. Réception et Validation (Backend)

```python
# backend_new/app/main.py

@app.websocket("/ws/sensors/")
async def websocket_sensors(websocket: WebSocket):
    await websocket.accept()
    client_id = f"{websocket.client.host}:{websocket.client.port}"

    while True:
        # 2.1 Réception du message
        data = await websocket.receive_json()

        # 2.2 RATE LIMITING (Quick Win #2)
        if not rate_limiter.is_allowed(client_id):
            await websocket.send_json({
                "type": "rate_limit_exceeded",
                "usage": rate_limiter.get_usage(client_id)
            })
            continue

        # 2.3 VALIDATION PYDANTIC (Quick Win #1)
        try:
            validated = SensorDataMessage(**data)
            # Valide :
            # - Matrices 8x8 (dimensions exactes)
            # - Reflectance 0-255
            # - Scores 0.0-1.0
            # - Grade pattern A+|A|B|C|REJECT|UNKNOWN
            # - device_id cohérent entre message et meta
            # - Grade correspond au score (A+ >= 0.85, etc.)
            # - Température -40 à 85°C
            # - Humidité 0-100%
            # - Firmware version format sémantique (1.0.0)
        except ValidationError as e:
            logger.error(f"❌ Validation failed: {e.errors()}")
            await websocket.send_json({
                "type": "validation_error",
                "errors": e.errors()
            })
            continue

        # 2.4 Sauvegarde en base de données
        await save_sensor_sample(db, validated.dict())

        # 2.5 Broadcast aux dashboards connectés
        await broadcast_to_dashboards(validated.dict())
```

#### 3. Sauvegarde en Base (Database)

```python
# backend_new/app/main.py

async def save_sensor_sample(db, data):
    # 3.1 Extraction des données
    vl = data['vl53l8ch']
    as7341 = data['as7341']
    fusion = data['fusion']
    meta = data['meta']

    # 3.2 Création de l'enregistrement
    sample = SensorSample(
        timestamp=data['timestamp'],
        device_id=data['device_id'],
        sample_id=data['sample_id'],

        # VL53L8CH - Raw data
        vl53l8ch_distance_matrix=vl['distance_matrix'],
        vl53l8ch_reflectance_matrix=vl['reflectance_matrix'],
        vl53l8ch_amplitude_matrix=vl['amplitude_matrix'],

        # VL53L8CH - Basic metrics
        vl53l8ch_volume_mm3=vl['volume_mm3'],
        vl53l8ch_avg_height_mm=vl['average_height_mm'],
        vl53l8ch_surface_uniformity=vl['surface_uniformity'],
        vl53l8ch_quality_score=vl['quality_score'],
        vl53l8ch_grade=vl['grade'],

        # VL53L8CH - Detailed analysis (JSONB)
        vl53l8ch_bins_analysis=vl.get('bins_analysis'),
        vl53l8ch_reflectance_analysis=vl.get('reflectance_analysis'),
        vl53l8ch_amplitude_consistency=vl.get('amplitude_consistency'),
        vl53l8ch_score_breakdown=vl.get('score_breakdown'),
        vl53l8ch_defects=vl.get('defects'),

        # AS7341 - Raw data
        as7341_channels=as7341['channels'],
        as7341_integration_time=as7341['integration_time'],
        as7341_gain=as7341['gain'],

        # AS7341 - Quality indices
        as7341_freshness_index=as7341['freshness_index'],
        as7341_fat_quality_index=as7341['fat_quality_index'],
        as7341_oxidation_index=as7341['oxidation_index'],
        as7341_quality_score=as7341['quality_score'],
        as7341_grade=as7341['grade'],

        # AS7341 - Detailed analysis (JSONB)
        as7341_spectral_analysis=as7341.get('spectral_analysis'),
        as7341_color_analysis=as7341.get('color_analysis'),
        as7341_score_breakdown=as7341.get('score_breakdown'),
        as7341_defects=as7341.get('defects'),

        # Fusion
        fusion_final_score=fusion['final_score'],
        fusion_final_grade=fusion['final_grade'],
        fusion_vl53l8ch_score=fusion['vl53l8ch_score'],
        fusion_as7341_score=fusion['as7341_score'],
        fusion_defects=fusion['defects'],

        # Metadata
        meta_firmware_version=meta['firmware_version'],
        meta_temperature_c=meta['temperature_c'],
        meta_humidity_percent=meta['humidity_percent'],
        meta_config_profile=meta['config_profile']
    )

    # 3.3 Insertion dans TimescaleDB
    db.add(sample)
    await db.commit()

    # 3.4 Hypertable gère automatiquement :
    # - Partitionnement par timestamp
    # - Compression après 7 jours
    # - Rétention 90 jours
    # - Continuous aggregates (hourly, daily)
```

#### 4. Broadcast aux Dashboards (Backend)

```python
# backend_new/app/main.py

async def broadcast_to_dashboards(data):
    # 4.1 Construction du message
    message = {
        "type": "sensor_update",
        "timestamp": data['timestamp'],
        "device_id": data['device_id'],
        "sample_id": data['sample_id'],
        "vl53l8ch": data['vl53l8ch'],
        "as7341": data['as7341'],
        "fusion": data['fusion'],
        "meta": data['meta']
    }

    # 4.2 Envoi à tous les dashboards connectés
    disconnected = []
    for ws in connected_dashboards:
        try:
            await ws.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send: {e}")
            disconnected.append(ws)

    # 4.3 Nettoyage des dashboards déconnectés
    for ws in disconnected:
        connected_dashboards.remove(ws)
```

#### 5. Affichage Frontend (Dashboard)

```typescript
// sqal/src/hooks/useWebSocket.ts

const useWebSocket = (url: string) => {
    const [latestSample, setLatestSample] = useState<SensorSample | null>(null);

    useEffect(() => {
        // 5.1 Connexion WebSocket
        const ws = new WebSocket(url);

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            // 5.2 Traitement selon le type
            if (message.type === 'sensor_update') {
                // 5.3 Mise à jour de l'état React
                setLatestSample(message);

                // 5.4 Stockage dans Zustand store
                realtimeStore.addSample(message);

                // 5.5 Déclenchement de notifications si défauts
                if (message.fusion.defects.length > 0) {
                    notificationStore.addAlert({
                        type: 'warning',
                        message: `${message.fusion.defects.length} defects detected`,
                        sample_id: message.sample_id
                    });
                }
            }
        };

        return () => ws.close();
    }, [url]);

    return latestSample;
};

// 5.6 Utilisation dans un composant
function Dashboard() {
    const latestSample = useWebSocket('ws://localhost:8000/ws/realtime/');

    return (
        <div>
            {latestSample && (
                <SensorDataViewer sample={latestSample} />
            )}
        </div>
    );
}
```

#### 6. Visualisation Détaillée (SensorDataViewer)

```typescript
// sqal/src/components/sensors/SensorDataViewer.tsx

export const SensorDataViewer: React.FC<{sample: SensorSample}> = ({ sample }) => {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* TAB 1 : Vue d'ensemble */}
            <TabsContent value="overview">
                <GradeBadge grade={sample.fusion.final_grade} />
                <ScoreCard score={sample.fusion.final_score} />
                <KeyMetrics vl={sample.vl53l8ch} as={sample.as7341} />
                <DefectsSummary fusion={sample.fusion} />
            </TabsContent>

            {/* TAB 2 : VL53L8CH détails */}
            <TabsContent value="vl53l8ch">
                {/* 6.1 Matrices 8x8 en heatmap */}
                <MatrixVisualization
                    title="Distance"
                    matrix={sample.vl53l8ch.distance_matrix}
                    colorScheme="blue"
                />

                {/* 6.2 Statistiques de base */}
                <MetricCard title="Volume" value={sample.vl53l8ch.volume_mm3} unit="mm³" />

                {/* 6.3 Analyses détaillées */}
                {sample.vl53l8ch.bins_analysis && (
                    <BinsAnalysisCard data={sample.vl53l8ch.bins_analysis} />
                )}

                {/* 6.4 Score breakdown */}
                {sample.vl53l8ch.score_breakdown && (
                    <ScoreBar components={sample.vl53l8ch.score_breakdown} />
                )}
            </TabsContent>

            {/* TAB 3 : AS7341 détails */}
            <TabsContent value="as7341">
                {/* 6.5 Canaux spectraux */}
                <SpectralChannelsChart channels={sample.as7341.channels} />

                {/* 6.6 Indices de qualité */}
                <QualityIndices
                    freshness={sample.as7341.freshness_index}
                    fatQuality={sample.as7341.fat_quality_index}
                    oxidation={sample.as7341.oxidation_index}
                />

                {/* 6.7 Analyse spectrale (ratios) */}
                {sample.as7341.spectral_analysis && (
                    <SpectralRatiosCard ratios={sample.as7341.spectral_analysis.spectral_ratios} />
                )}

                {/* 6.8 Analyse couleur */}
                {sample.as7341.color_analysis && (
                    <ColorPreview rgb={sample.as7341.color_analysis.rgb} />
                )}
            </TabsContent>

            {/* TAB 4 : Fusion */}
            <TabsContent value="fusion">
                <FusionScore score={sample.fusion.final_score} grade={sample.fusion.final_grade} />
                <ContributionsChart
                    vl_score={sample.fusion.vl53l8ch_score}
                    as_score={sample.fusion.as7341_score}
                />
                <DefectsList defects={sample.fusion.defects} />
            </TabsContent>

            {/* TAB 5 : Metadata */}
            <TabsContent value="metadata">
                <DeviceInfo meta={sample.meta} />
            </TabsContent>
        </Tabs>
    );
};
```

---

## 🎛️ Simulator - Génération de Données

### Architecture du Simulator

```
simulator/
├── data_generator.py          # Orchestrateur principal
├── i2c_bus_simulator.py       # Simulation bus I2C
├── vl53l8ch_simulator.py      # Capteur ToF virtuel
├── as7341_simulator.py        # Capteur spectral virtuel
├── vl53l8ch_data_analyzer.py  # Analyseur ToF
├── as7341_data_analyzer.py    # Analyseur spectral
└── config_foiegras.yaml       # Configuration profils qualité
```

### Simulation I2C Bus

```python
# simulator/i2c_bus_simulator.py

class I2C_Bus_Simulator:
    """Simule un bus I2C avec registres virtuels"""

    def __init__(self):
        # Dictionnaire : {adresse_i2c: {registre: valeur}}
        self.devices = {}

    def write_byte(self, address: int, register: int, value: int):
        """Écriture dans un registre"""
        if address not in self.devices:
            self.devices[address] = {}
        self.devices[address][register] = value

    def read_byte(self, address: int, register: int) -> int:
        """Lecture d'un registre"""
        return self.devices.get(address, {}).get(register, 0)

    def read_block(self, address: int, register: int, length: int) -> List[int]:
        """Lecture multi-bytes"""
        data = []
        for i in range(length):
            data.append(self.read_byte(address, register + i))
        return data
```

### VL53L8CH Simulator

```python
# simulator/vl53l8ch_simulator.py

class VL53L8CH_Simulator:
    """Simule le capteur ToF ST VL53L8CH"""

    # Adresse I2C et registres
    I2C_ADDRESS = 0x29
    REG_START_MEASUREMENT = 0x87
    REG_DATA_READY = 0x00
    REG_RANGING_DATA = 0x89

    def __init__(self, i2c_bus, quality_profile):
        self.i2c = i2c_bus
        self.quality = quality_profile
        self.measurement_ready = False

    def start_measurement(self):
        """Déclenche une mesure (écriture registre)"""
        self.i2c.write_byte(self.I2C_ADDRESS, self.REG_START_MEASUREMENT, 1)
        # Simule un délai de mesure
        self.measurement_ready = False
        threading.Timer(0.05, self._complete_measurement).start()

    def _complete_measurement(self):
        """Simule la fin de mesure"""
        # Génère des données 8x8 basées sur le profil qualité
        distance_matrix = self._generate_distance_matrix()
        reflectance_matrix = self._generate_reflectance_matrix()
        amplitude_matrix = self._generate_amplitude_matrix()

        # Stocke dans les registres I2C (format binaire)
        data = self._pack_matrices(distance_matrix, reflectance_matrix, amplitude_matrix)
        for i, byte in enumerate(data):
            self.i2c.write_byte(self.I2C_ADDRESS, self.REG_RANGING_DATA + i, byte)

        # Marque data ready
        self.i2c.write_byte(self.I2C_ADDRESS, self.REG_DATA_READY, 1)
        self.measurement_ready = True

    def _generate_distance_matrix(self) -> List[List[float]]:
        """Génère matrice 8x8 de distances réalistes"""
        base_height = random.uniform(
            self.quality['height']['min'],
            self.quality['height']['max']
        )

        matrix = []
        for row in range(8):
            row_data = []
            for col in range(8):
                # Ajout de bruit gaussien pour réalisme
                noise = random.gauss(0, 0.5)
                distance = base_height + noise
                row_data.append(max(0, distance))
            matrix.append(row_data)

        return matrix

    def read_measurement_data(self) -> dict:
        """Lit les données de mesure depuis les registres I2C"""
        if not self.measurement_ready:
            return None

        # Lecture des registres
        data_bytes = self.i2c.read_block(self.I2C_ADDRESS, self.REG_RANGING_DATA, 192)

        # Décodage (192 bytes = 64 pixels * 3 bytes/pixel)
        return self._unpack_matrices(data_bytes)
```

### AS7341 Simulator

```python
# simulator/as7341_simulator.py

class AS7341_Simulator:
    """Simule le capteur spectral AMS AS7341"""

    I2C_ADDRESS = 0x39
    REG_ENABLE = 0x80
    REG_STATUS = 0x93
    REG_CH0_DATA_L = 0x95  # Channel 0 (F1) low byte

    def __init__(self, i2c_bus, quality_profile):
        self.i2c = i2c_bus
        self.quality = quality_profile

    def start_measurement(self):
        """Déclenche une mesure spectrale"""
        self.i2c.write_byte(self.I2C_ADDRESS, self.REG_ENABLE, 0x01)
        threading.Timer(0.1, self._complete_measurement).start()

    def _complete_measurement(self):
        """Génère données spectrales réalistes"""
        # Génère 10 canaux basés sur profil qualité
        channels = {
            'F1_415nm': self._generate_channel_value('violet'),
            'F2_445nm': self._generate_channel_value('indigo'),
            'F3_480nm': self._generate_channel_value('blue'),
            'F4_515nm': self._generate_channel_value('cyan'),
            'F5_555nm': self._generate_channel_value('green'),
            'F6_590nm': self._generate_channel_value('yellow'),
            'F7_630nm': self._generate_channel_value('orange'),
            'F8_680nm': self._generate_channel_value('red'),
            'Clear': self._generate_channel_value('clear'),
            'NIR': self._generate_channel_value('nir')
        }

        # Encode dans registres I2C (2 bytes par canal, 16-bit ADC)
        for i, (channel_name, value) in enumerate(channels.items()):
            low_byte = value & 0xFF
            high_byte = (value >> 8) & 0xFF
            self.i2c.write_byte(self.I2C_ADDRESS, self.REG_CH0_DATA_L + i*2, low_byte)
            self.i2c.write_byte(self.I2C_ADDRESS, self.REG_CH0_DATA_L + i*2 + 1, high_byte)

        # Marque data ready
        self.i2c.write_byte(self.I2C_ADDRESS, self.REG_STATUS, 0x01)

    def _generate_channel_value(self, channel_type: str) -> int:
        """Génère valeur 16-bit réaliste pour un canal"""
        # Base selon profil qualité
        base = self.quality['spectral'][channel_type]['mean']

        # Ajout bruit
        noise = random.gauss(0, base * 0.05)  # 5% de bruit

        # Clamp à 0-65535 (16-bit ADC)
        return int(max(0, min(65535, base + noise)))
```

### Analyseurs

Les analyseurs transforment les données brutes en métriques de qualité :

**VL53L8CH Analyzer** :
```python
# Calcule volume par intégration de surface
volume = sum(sum(row) for row in distance_matrix) * pixel_area

# Détecte uniformité de surface
uniformity = 1.0 - (std_dev / mean_height)

# Analyse histogramme pour détecter multi-peaks
bins = create_histogram(distance_matrix.flatten())
multi_peak = detect_peaks(bins) > 1

# Score final = moyenne pondérée
score = (
    volume_score * 0.3 +
    uniformity_score * 0.3 +
    reflectance_score * 0.2 +
    amplitude_score * 0.2
)
```

**AS7341 Analyzer** :
```python
# Calcule ratios spectraux
violet_orange_ratio = F1_415nm / F7_630nm  # Oxydation
blue_red_ratio = F3_480nm / F8_680nm       # Fraîcheur

# Indices de qualité
freshness_index = normalize(blue_red_ratio, optimal_range)
oxidation_index = 1.0 - normalize(violet_orange_ratio, optimal_range)

# Score final = moyenne pondérée
score = (
    freshness_score * 0.4 +
    fat_quality_score * 0.4 +
    (1 - oxidation_score) * 0.2
)
```

---

## 🔒 Sécurité et Validation

### Validation Multi-Niveaux

**Niveau 1 : Format de Message (Pydantic)**
```python
# Valide la structure du message
SensorDataMessage(
    type='sensor_data',  # Pattern exact
    timestamp=datetime,  # Format ISO 8601
    device_id=str,       # Min 1, max 100 chars
    # ...
)
```

**Niveau 2 : Ranges Physiques**
```python
# Température : -40°C à 85°C (limits capteurs)
temperature_c: float = Field(..., ge=-40, le=85)

# Humidité : 0-100%
humidity_percent: float = Field(..., ge=0, le=100)

# Reflectance : 0-255 (8-bit)
reflectance_value: int = Field(..., ge=0, le=255)

# Scores : 0.0-1.0
quality_score: float = Field(..., ge=0.0, le=1.0)
```

**Niveau 3 : Validation Croisée**
```python
@root_validator
def validate_grade_score_consistency(cls, values):
    score = values['fusion'].final_score
    grade = values['fusion'].final_grade

    # Vérification cohérence
    if grade == 'A+' and score < 0.85:
        raise ValueError("Grade A+ requires score >= 0.85")
    # ... autres grades
    return values
```

**Niveau 4 : Rate Limiting**
```python
# Protection DDoS
if not rate_limiter.is_allowed(client_id):
    return {
        "type": "rate_limit_exceeded",
        "max": 100,
        "window": "60 seconds"
    }
```

---

## ⚡ Performance et Optimisation

### TimescaleDB Optimisations

**Hypertables** : Partitionnement automatique par temps
```sql
-- Crée hypertable
SELECT create_hypertable('sensor_samples', 'timestamp');

-- Partition automatique chaque 7 jours
SELECT set_chunk_time_interval('sensor_samples', INTERVAL '7 days');
```

**Continuous Aggregates** : Pré-calcul de métriques
```sql
-- Agrégations horaires
CREATE MATERIALIZED VIEW sensor_data_hourly AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    device_id,
    COUNT(*) as sample_count,
    AVG(fusion_final_score) as avg_quality,
    COUNT(*) FILTER (WHERE fusion_final_grade = 'A+') as count_a_plus
FROM sensor_samples
GROUP BY bucket, device_id;

-- Refresh automatique toutes les heures
SELECT add_continuous_aggregate_policy('sensor_data_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

**Compression** : Économie de stockage
```sql
-- Compression après 7 jours
SELECT add_compression_policy('sensor_samples', INTERVAL '7 days');

-- Ratio de compression typique : 10:1
```

**Rétention** : Nettoyage automatique
```sql
-- Supprime données > 90 jours
SELECT add_retention_policy('sensor_samples', INTERVAL '90 days');
```

### WebSocket Optimisations

**Connexion persistante avec ping/pong**
```python
async with websockets.connect(url, ping_interval=5, ping_timeout=10) as ws:
    # Garde la connexion active
    # Détecte déconnexions rapidement
```

**Broadcast sélectif (À venir - Phase 3)**
```python
# Dashboard s'abonne uniquement à certains devices
subscription = {
    "device_ids": ["ESP32-001", "ESP32-002"],
    "metrics_only": True  # Pas de matrices 8x8
}
```

---

## 📊 Métriques et Monitoring

### Logs Structurés

```python
# Chaque étape loggée
logger.info("=" * 80)
logger.info("📥 DATA RECEIVED FROM DATA_GENERATOR (VALIDATED ✅)")
logger.info(f"Device ID: {validated_data.device_id}")
logger.info(f"Sample ID: {validated_data.sample_id}")
logger.info(f"Fusion Grade: {data['fusion']['final_grade']}")
logger.info(f"Fusion Score: {data['fusion']['final_score']:.3f}")
logger.info("=" * 80)
```

### Métriques Clés (À implémenter - Phase 5)

- `samples_received_total` - Compteur total d'échantillons
- `sample_processing_time_seconds` - Histogramme temps de traitement
- `database_errors_total` - Compteur erreurs DB
- `connected_dashboards` - Gauge dashboards actifs
- `validation_errors_total` - Compteur erreurs validation

---

## 🎓 Résumé pour Nouveaux Développeurs

**En 5 minutes** :
1. Le **Simulator** génère des données réalistes de 2 capteurs (ToF + Spectral)
2. Le **Backend** reçoit, valide (Pydantic), et stocke dans TimescaleDB
3. Le **Frontend** affiche en temps réel via WebSocket
4. La **Validation** empêche les données corrompues
5. Le **Rate Limiting** protège contre les abus

**Pour aller plus loin** :
- Voir `DATA_ALIGNMENT_GUIDE.md` pour la structure de données complète
- Voir `QUICK_WINS_IMPLEMENTED.md` pour validation et rate limiting
- Voir `PROJECT_STATUS.md` pour l'état actuel du projet

---

**Ce document sera mis à jour à chaque évolution majeure du système.**
