# 🎮 Fonctionnement des Simulateurs - Guide Complet

**Date**: 23 Décembre 2024
**Version**: 3.0.0
**Statut**: ✅ Documentation Complète

---

## 🎯 Vue d'Ensemble

Le système Gaveurs V3.0 utilise **3 simulateurs** qui fonctionnent ensemble pour créer un flux de données temps réel complet, de la production jusqu'au contrôle qualité.

```
┌──────────────────────┐
│ 1. GAVAGE SIMULATOR  │  Simule opérations gavage 2×/jour
│    (Python)          │  Génère lots + données gavages
└─────────┬────────────┘
          │ WebSocket /ws/gavage
          ↓
┌──────────────────────┐
│    BACKEND API       │  Reçoit, stocke, broadcast
│    (FastAPI)         │  Crée sqal_pending_lots
└─────────┬────────────┘
          │
          ├──→ WebSocket /ws/realtime/ → Frontends
          │
          ↓
┌──────────────────────┐
│ 2. LOT MONITOR       │  Polling DB (60s)
│    (Python)          │  Détecte lots terminés
└─────────┬────────────┘
          │ Déclenche inspection
          ↓
┌──────────────────────┐
│ 3. SQAL SIMULATOR    │  Simule ESP32 + capteurs IoT
│    (Python)          │  ToF 8x8 + Spectral 10ch
└─────────┬────────────┘
          │ WebSocket /ws/sensors/
          ↓
     BACKEND → DB → Frontend SQAL
```

---

## 🦆 1. Simulateur Gavage Temps Réel

### Localisation

**Fichier**: [simulators/gavage_realtime/main.py](../simulators/gavage_realtime/main.py)

**Dossier**: `simulators/gavage_realtime/`

### Objectif

Simuler le processus complet de gavage de canards :
- **J-1** : Préparation du lot (création canards)
- **J0 → J11-14** : Gavages 2×/jour (matin 8h, soir 18h)
- **Fin** : Lot prêt pour abattage

### Architecture

#### Classes Principales

**1. Classe `Canard`**:
```python
class Canard:
    """Un canard individuel avec son cycle de vie"""

    def __init__(self, canard_id: int, genetique: str):
        # Poids initial selon génétique
        if genetique == "Mulard":
            self.poids_initial = random.uniform(4400, 4600)  # 4.4-4.6kg
        elif genetique == "Barbarie":
            self.poids_initial = random.uniform(3800, 4000)  # 3.8-4.0kg
        else:  # Pékin
            self.poids_initial = random.uniform(4000, 4200)  # 4.0-4.2kg

        self.poids_actuel = self.poids_initial
        self.vivant = True

    def gagner_poids(self, jour: int, duree_totale: int):
        """Gain de poids après gavage (non-linéaire)"""
        progression = jour / duree_totale

        # Gain de base selon génétique
        if self.genetique == "Mulard":
            gain_base = random.uniform(60, 90)  # 60-90g/gavage
        elif self.genetique == "Barbarie":
            gain_base = random.uniform(50, 70)  # 50-70g/gavage
        else:  # Pékin
            gain_base = random.uniform(55, 75)  # 55-75g/gavage

        # Diminution gain vers la fin (facteur 1.5 → 1.0)
        facteur = 1.5 - (progression * 0.5)
        gain = gain_base * facteur * random.uniform(0.9, 1.1)

        self.poids_actuel += gain

    def calculer_mortalite(self, jour: int) -> bool:
        """Mortalité aléatoire (augmente avec temps)"""
        risque_base = 0.0005  # 0.05% par gavage
        risque_progression = jour * 0.0001
        risque_total = risque_base + risque_progression

        if random.random() < risque_total:
            self.vivant = False
            return True
        return False
```

**Réalisme**:
- Poids initial réaliste par génétique
- Gain de poids progressif (courbe décroissante)
- Mortalité augmente avec durée gavage

**2. Classe `Lot`**:
```python
class Lot:
    """Lot de 45-55 canards en gavage"""

    def __init__(self, code_lot: str, gaveur_id: int, gaveur_nom: str,
                 site: str, nb_canards: int, genetique: str, duree_prevue: int):
        self.code_lot = code_lot  # ex: LL2412001
        self.gaveur_id = gaveur_id
        self.gaveur_nom = gaveur_nom
        self.site = site  # LL/LS/MT
        self.nb_canards_initial = nb_canards
        self.genetique = genetique
        self.duree_prevue = duree_prevue  # 11-14 jours

        self.date_debut = datetime.now()
        self.jour_actuel = -1  # J-1 = préparation
        self.pret_abattage = False

        # Créer canards individuels
        self.canards = [Canard(i, genetique) for i in range(nb_canards)]

    def calculer_dose(self, moment: str) -> float:
        """Dose progressive selon courbe standard"""
        progression = min(1.0, self.jour_actuel / self.duree_prevue)

        # Doses croissantes (200g → 460g matin, 210g → 490g soir)
        if moment == "matin":
            dose = 200 + (460 - 200) * progression  # 200 → 460g
        else:  # soir
            dose = 210 + (490 - 210) * progression  # 210 → 490g

        return round(dose, 1)

    def effectuer_gavage(self, moment: str) -> Dict:
        """Exécute un gavage et retourne données complètes"""
        if moment == "matin":
            self.jour_actuel += 1

        # Dose théorique
        dose_theorique = self.calculer_dose(moment)

        # Dose réelle (variation ±5%)
        dose_reelle = dose_theorique * random.uniform(0.95, 1.05)

        # Appliquer gain poids + mortalité à chaque canard
        for canard in self.canards_vivants:
            canard.gagner_poids(self.jour_actuel, self.duree_prevue)
            canard.calculer_mortalite(self.jour_actuel)

        # Conditions environnementales
        temperature = random.uniform(19, 23)  # °C
        humidite = random.uniform(55, 75)     # %

        # Package données
        return {
            "code_lot": self.code_lot,
            "gaveur_id": self.gaveur_id,
            "gaveur_nom": self.gaveur_nom,
            "site": self.site,
            "genetique": self.genetique,
            "jour": self.jour_actuel,
            "moment": moment,
            "dose_theorique": dose_theorique,
            "dose_reelle": round(dose_reelle, 1),
            "poids_moyen": round(self.poids_moyen, 1),
            "nb_canards_vivants": len(self.canards_vivants),
            "taux_mortalite": round(self.taux_mortalite, 2),
            "temperature_stabule": round(temperature, 1),
            "humidite_stabule": round(humidite, 1),
            "timestamp": datetime.now().isoformat(),
            "pret_abattage": self.pret_abattage
        }
```

**Courbe de Doses Réaliste**:
| Jour | Dose Matin | Dose Soir | Total/Jour |
|------|-----------|-----------|------------|
| J0   | 200g      | 210g      | 410g       |
| J3   | 265g      | 280g      | 545g       |
| J6   | 330g      | 350g      | 680g       |
| J9   | 395g      | 420g      | 815g       |
| J12  | 460g      | 490g      | 950g       |

**3. Classe `GavageSimulator`**:
```python
class GavageSimulator:
    """Simulateur principal orchestrant tout"""

    def __init__(self, backend_url: str, nb_lots: int, acceleration: int = 1):
        self.backend_url = backend_url  # ws://localhost:8000/ws/gavage
        self.nb_lots_initial = nb_lots
        self.acceleration = acceleration  # ×1 à ×86400

        self.lots_actifs = []
        self.lots_termines = []

        # 5 gaveurs réalistes
        self.gaveurs = [
            {"id": 1, "nom": "Jean Martin", "site": "LL"},
            {"id": 2, "nom": "Sophie Dubois", "site": "LS"},
            {"id": 3, "nom": "Pierre Leroy", "site": "MT"},
            {"id": 4, "nom": "Marie Petit", "site": "LL"},
            {"id": 5, "nom": "Luc Blanc", "site": "LS"},
        ]

    async def cycle_gavage_quotidien(self):
        """Cycle principal: 2 gavages/jour"""
        duree_jour = 86400 / self.acceleration  # secondes
        delai_matin_soir = duree_jour / 2       # 12h

        while self.lots_actifs:
            # Matin (08h00)
            await self.effectuer_gavages("matin")
            await asyncio.sleep(delai_matin_soir)

            # Soir (18h00)
            await self.effectuer_gavages("soir")
            await asyncio.sleep(delai_matin_soir)

        # Tous les lots terminés
```

### Modes d'Accélération

| Mode | Facteur | 1 Jour Réel | 12 Jours Gavage | Usage |
|------|---------|-------------|-----------------|-------|
| **Temps réel** | ×1 | 24h | 12 jours | Production réelle |
| **Test modéré** | ×144 | 10 min | 2 heures | Tests longs |
| **Test rapide** | **×1440** | **60s** | **12 min** | **Défaut** |
| **Demo ultra** | ×86400 | 1s | 12 secondes | Démo rapide |

**Calcul**:
```python
duree_jour_secondes = 86400 / acceleration

# Exemple ×1440:
# duree_jour = 86400 / 1440 = 60 secondes
# 12 jours gavage = 12 × 60s = 720s = 12 minutes
```

### Utilisation

**Commande de base**:
```bash
cd simulators/gavage_realtime

# Mode défaut (×1440)
python main.py --nb-lots 3

# Mode personnalisé
python main.py \
  --backend-url ws://localhost:8000/ws/gavage \
  --nb-lots 5 \
  --acceleration 144
```

**Paramètres**:
- `--backend-url` : URL WebSocket backend (défaut: `ws://localhost:8000/ws/gavage`)
- `--nb-lots` : Nombre de lots à créer (défaut: 3)
- `--acceleration` : Facteur temps (défaut: 1440 = 60s/jour)

### Logs Exemple

```
🦆 SIMULATEUR GAVAGE TEMPS RÉEL - Démarrage
============================================================
📦 Création de 3 lots initiaux...
✅ Lot créé: LL2412001 - Jean Martin - 48 canards Mulard
✅ Lot créé: LS2412002 - Sophie Dubois - 52 canards Mulard
✅ Lot créé: MT2412003 - Pierre Leroy - 50 canards Barbarie
✅ 3 lots créés et prêts pour J0

⏳ Attente début gavage (J0)...

============================================================
🍽️  GAVAGE MATIN - 23/12/2024 14:30
============================================================
📊 LL2412001 (J0/12) - Jean Martin - Dose: 198.5g - Poids moyen: 4512.3g - Vivants: 48/48 - Mortalité: 0.00%
📊 LS2412002 (J0/13) - Sophie Dubois - Dose: 205.2g - Poids moyen: 4478.9g - Vivants: 52/52 - Mortalité: 0.00%
📊 MT2412003 (J0/11) - Pierre Leroy - Dose: 201.8g - Poids moyen: 3912.1g - Vivants: 50/50 - Mortalité: 0.00%
📤 Envoyé: Lot LL2412001 J0 matin

[... 30 secondes plus tard ...]

============================================================
🍽️  GAVAGE SOIR - 23/12/2024 14:30
============================================================
📊 LL2412001 (J0/12) - Jean Martin - Dose: 212.3g - Poids moyen: 4580.7g - Vivants: 48/48 - Mortalité: 0.00%
...

[... 12 minutes plus tard en mode ×1440 ...]

✅ Lot LL2412001 terminé ! Prêt pour abattage.

📊 RÉSUMÉ SIMULATION
============================================================
Lots terminés: 3
  • LL2412001: Jean Martin - 47/48 vivants - Poids moyen final: 7845.3g - Mortalité: 2.08%
  • LS2412002: Sophie Dubois - 51/52 vivants - Poids moyen final: 7722.8g - Mortalité: 1.92%
  • MT2412003: Pierre Leroy - 49/50 vivants - Poids moyen final: 6890.5g - Mortalité: 2.00%
```

### Format Données WebSocket

**Message envoyé au backend**:
```json
{
  "code_lot": "LL2412001",
  "gaveur_id": 1,
  "gaveur_nom": "Jean Martin",
  "site": "LL",
  "genetique": "Mulard",
  "jour": 0,
  "moment": "matin",
  "dose_theorique": 200.0,
  "dose_reelle": 198.5,
  "poids_moyen": 4512.3,
  "nb_canards_vivants": 48,
  "taux_mortalite": 0.0,
  "temperature_stabule": 20.2,
  "humidite_stabule": 62.5,
  "timestamp": "2024-12-23T14:30:15.123456",
  "pret_abattage": false
}
```

**Dernier gavage (flag abattage)**:
```json
{
  ...
  "jour": 12,
  "moment": "soir",
  "dose_reelle": 487.3,
  "poids_moyen": 7845.3,
  "pret_abattage": true  ← FLAG IMPORTANT
}
```

---

## 🔍 2. Lot Monitor (Synchronisation Auto)

### Localisation

**Fichier**: [simulators/sqal/lot_monitor.py](../simulators/sqal/lot_monitor.py)

**Dossier**: `simulators/sqal/`

### Objectif

**Pont automatique** entre le simulateur gavage et le simulateur SQAL :
1. **Polling** de la table `sqal_pending_lots` (toutes les 60s)
2. **Détection** des lots terminés (`status='pending'`)
3. **Lancement automatique** du simulateur SQAL pour inspecter le lot
4. **Mise à jour** status → `'inspected'`

### Architecture

```python
class LotMonitor:
    """Surveille et déclenche contrôle qualité auto"""

    async def _check_pending_lots(self):
        """Vérifie lots en attente"""
        # Query DB
        lots = await conn.fetch("""
            SELECT id, code_lot, gaveur_id, site, genetique,
                   poids_moyen_final, nb_canards_final
            FROM sqal_pending_lots
            WHERE status = 'pending'
            ORDER BY date_abattage ASC
            LIMIT 10
        """)

        for lot_record in lots:
            logger.info(f"📦 Lot détecté: {lot_record['code_lot']}")

            # Lancer inspection SQAL
            await self._inspect_lot(lot_record)

    async def _inspect_lot(self, lot: dict):
        """Lance série de mesures SQAL pour un lot"""
        for sample_num in range(self.samples_per_lot):  # Ex: 5 échantillons
            # Générer données SQAL réalistes
            sample_data = self._generate_sqal_sample(
                lot, sample_num
            )

            # Envoyer via WebSocket (simule ESP32)
            await self._send_to_backend(sample_data)

            # Délai entre échantillons (10s)
            await asyncio.sleep(10)

        # Marquer lot comme inspecté
        await conn.execute("""
            UPDATE sqal_pending_lots
            SET status = 'inspected', inspected_at = NOW()
            WHERE id = $1
        """, lot['id'])
```

### Workflow

```
1. Backend reçoit gavage avec pret_abattage=true
   └─ Insère dans sqal_pending_lots (status='pending')

2. LotMonitor polling (60s)
   └─ SELECT * FROM sqal_pending_lots WHERE status='pending'

3. Lot détecté
   ├─ Génère 5 échantillons SQAL (ToF + Spectral)
   ├─ Envoie via WebSocket /ws/sensors/
   └─ UPDATE status='inspected'

4. Backend reçoit mesures SQAL
   ├─ Stocke dans sqal_sensor_samples
   ├─ Calcule grade (A+, A, B, C, D)
   └─ Broadcast frontend SQAL
```

### Utilisation

```bash
cd simulators/sqal

# Mode défaut
python lot_monitor.py

# Mode personnalisé
python lot_monitor.py \
  --db-url postgresql://gaveurs_admin:password@localhost:5432/gaveurs_db \
  --backend-url ws://localhost:8000/ws/sensors/ \
  --device-id ESP32_SQAL_AUTO \
  --samples-per-lot 5 \
  --polling-interval 60
```

**Paramètres**:
- `--db-url` : URL PostgreSQL (défaut: env `DATABASE_URL`)
- `--backend-url` : URL WebSocket SQAL (défaut: `ws://localhost:8000/ws/sensors/`)
- `--device-id` : ID device auto (défaut: `ESP32_SQAL_AUTO`)
- `--samples-per-lot` : Échantillons par lot (défaut: 5)
- `--polling-interval` : Intervalle polling secondes (défaut: 60)

### Logs Exemple

```
✅ Connexion DB établie pour LotMonitor
🔍 Démarrage monitoring lots (polling: 60s)

[... 60 secondes ...]

📦 1 lot(s) en attente d'inspection SQAL
📦 Lot détecté: LL2412001 (Jean Martin, Site LL)
🔬 Inspection SQAL: LL2412001 - Échantillon 1/5
   ToF Relief: Score=94.2 | Spectral Couleur: Score=96.8 | Grade: A+
📤 Envoyé échantillon 1 via WebSocket

[... 10 secondes ...]

🔬 Inspection SQAL: LL2412001 - Échantillon 2/5
   ToF Relief: Score=92.5 | Spectral Couleur: Score=95.1 | Grade: A
📤 Envoyé échantillon 2 via WebSocket

[... 50 secondes plus tard ...]

✅ Lot LL2412001 inspecté avec succès (5 échantillons)
📊 Grades: A+ (2), A (2), B (1) | Grade moyen: A

[... Retour polling 60s ...]
```

---

## 🔬 3. Simulateur SQAL (ESP32 Digital Twin)

### Localisation

**Fichier**: [simulators/sqal/esp32_simulator.py](../simulators/sqal/esp32_simulator.py)

**Dossier**: `simulators/sqal/`

### Objectif

Simuler un **ESP32 réel** avec capteurs IoT pour contrôle qualité foie gras :
- **VL53L8CH** : Capteur ToF laser 8x8 (profil relief 3D)
- **AS7341** : Capteur spectral 10 canaux (415nm-NIR, analyse couleur)

### Architecture ESP32 Virtuel

```python
class ESP32_Simulator:
    """Digital Twin complet d'un ESP32 de production"""

    def __init__(self, device_id, location, backend_url,
                 config_profile="foiegras_standard_barquette"):
        # Identité device
        self.device_id = device_id  # Ex: ESP32_LL_01
        self.mac_address = self._generate_mac()
        self.location = location  # "Ligne A"

        # État système
        self.status = ESP32_Status.BOOTING  # BOOTING → WIFI_CONNECTING → ONLINE
        self.wifi_ip = None
        self.websocket = None

        # Bus I2C virtuel avec 2 capteurs
        self.i2c_bus = I2C_Bus_Simulator(config_profile)
        # Devices I2C: 0x29 (VL53L8CH), 0x39 (AS7341)

        # Analyseurs de données
        self.vl53l8ch_analyzer = VL53L8CH_DataAnalyzer()
        self.as7341_analyzer = AS7341_DataAnalyzer()

        # Fusion simulator (métriques métier foie gras)
        self.fusion_simulator = FoieGrasFusionSimulator()

        # Buffer local (si offline)
        self.buffer = deque(maxlen=100)

        # Configuration profil
        config_path = Path(__file__).parent / "config_foiegras.yaml"
        self.config_loader = ConfigLoader(config_path)
        self.config_loader.load(config_profile)
        self.config = self.config_loader.config
```

### Capteur 1: VL53L8CH (Time-of-Flight)

**Spécifications**:
- **Résolution**: 8×8 = 64 zones
- **Portée**: 0-400 cm
- **Précision**: ±1 cm
- **Fréquence**: jusqu'à 60 Hz

**Simulation**:
```python
def simulate_vl53l8ch_matrix(config):
    """Génère matrice ToF 8x8 réaliste"""
    # Paramètres config
    resolution = config['vl53l8ch']['resolution']  # 8
    height_sensor = config['vl53l8ch']['height_sensor_mm']  # 100mm
    shape_profile = config['specimen_characteristics']['shape_profile']

    # Générer matrice de base (distance mm)
    if shape_profile == "uniformly_flat":
        # Surface plane
        distances = np.full((8, 8), height_sensor)
        # Variation ±2mm
        distances += np.random.normal(0, 2, (8, 8))

    elif shape_profile == "slightly_convex":
        # Surface bombée
        x = np.linspace(-1, 1, 8)
        y = np.linspace(-1, 1, 8)
        X, Y = np.meshgrid(x, y)
        # Paraboloïde
        Z = -5 * (X**2 + Y**2)  # Centre plus haut
        distances = height_sensor + Z + np.random.normal(0, 1.5, (8, 8))

    # Convertir en mm (integer)
    return distances.astype(np.int16)
```

**Exemple matrice ToF**:
```
Matrice 8×8 distances (mm):
[
  [102, 104, 105, 105, 104, 103, 101, 100],
  [103, 105, 107, 108, 107, 105, 103, 102],
  [104, 107, 110, 111, 110, 107, 104, 103],
  [105, 108, 111, 113, 112, 108, 105, 104],
  [105, 108, 111, 113, 112, 108, 105, 104],
  [104, 107, 110, 111, 110, 107, 104, 103],
  [103, 105, 107, 108, 107, 105, 103, 102],
  [102, 104, 105, 105, 104, 103, 101, 100]
]
```

**Analyse Relief**:
```python
def analyze_tof_matrix(matrix):
    """Calcule métriques qualité relief"""
    # Uniformité (écart-type)
    uniformity_score = 100 - (np.std(matrix) * 10)

    # Détection irrégularités (zones aberrantes)
    mean_dist = np.mean(matrix)
    outliers = np.abs(matrix - mean_dist) > 10  # >10mm écart
    defect_score = 100 - (np.sum(outliers) / 64 * 100)

    # Score global relief
    relief_score = (uniformity_score * 0.6 + defect_score * 0.4)

    return {
        "relief_score": round(relief_score, 1),
        "uniformity": round(uniformity_score, 1),
        "defects": int(np.sum(outliers))
    }
```

### Capteur 2: AS7341 (Spectral)

**Spécifications**:
- **10 canaux** : F1-F8 (415nm-680nm) + NIR (910nm) + Clear
- **Résolution**: 16 bits (0-65535)
- **Integration time**: 50-1000ms

**Canaux**:
| Canal | λ (nm) | Couleur | Usage Foie Gras |
|-------|--------|---------|-----------------|
| F1 | 415 | Violet | Oxydation |
| F2 | 445 | Bleu | Fraîcheur |
| F3 | 480 | Cyan | - |
| F4 | 515 | Vert | - |
| F5 | 555 | Vert clair | Coloration jaune |
| F6 | 590 | Jaune | **Pic optimal** |
| F7 | 630 | Orange | Couleur naturelle |
| F8 | 680 | Rouge | Taches |
| NIR | 910 | Infrarouge | Teneur lipides |
| Clear | - | Total | Luminosité |

**Simulation**:
```python
def simulate_as7341_spectrum(config):
    """Génère spectre 10 canaux réaliste"""
    color_profile = config['specimen_characteristics']['color_profile']

    if color_profile == "uniform_golden_yellow":
        # Profil optimal foie gras
        spectrum = {
            "F1_415nm": random.randint(1200, 1400),   # Violet (faible)
            "F2_445nm": random.randint(1800, 2200),   # Bleu
            "F3_480nm": random.randint(2300, 2700),   # Cyan
            "F4_515nm": random.randint(3000, 3400),   # Vert
            "F5_555nm": random.randint(3500, 3900),   # Vert clair
            "F6_590nm": random.randint(3800, 4200),   # JAUNE (max)
            "F7_630nm": random.randint(3200, 3600),   # Orange
            "F8_680nm": random.randint(2400, 2800),   # Rouge
            "NIR_910nm": random.randint(1600, 2000),  # NIR
            "Clear": random.randint(24000, 26000)     # Total
        }

    elif color_profile == "slightly_mottled":
        # Qualité moyenne (taches)
        spectrum = {
            "F1_415nm": random.randint(1500, 1700),
            "F2_445nm": random.randint(2000, 2400),
            "F3_480nm": random.randint(2500, 2900),
            "F4_515nm": random.randint(3100, 3500),
            "F5_555nm": random.randint(3400, 3800),
            "F6_590nm": random.randint(3300, 3700),  # Jaune diminué
            "F7_630nm": random.randint(3400, 3800),  # Orange augmenté
            "F8_680nm": random.randint(2800, 3200),  # Rouge augmenté
            "NIR_910nm": random.randint(1800, 2200),
            "Clear": random.randint(23000, 25000)
        }

    return spectrum
```

**Exemple spectre**:
```json
{
  "F1_415nm": 1280,
  "F2_445nm": 1950,
  "F3_480nm": 2480,
  "F4_515nm": 3180,
  "F5_555nm": 3680,
  "F6_590nm": 3980,  ← Pic jaune (optimal)
  "F7_630nm": 3380,
  "F8_680nm": 2580,
  "NIR_910nm": 1780,
  "Clear": 24800
}
```

**Analyse Spectre**:
```python
def analyze_spectrum(spectrum):
    """Calcule métriques couleur"""
    # Ratio jaune (F6 optimal)
    yellow_ratio = spectrum["F6_590nm"] / spectrum["Clear"]
    if 0.12 < yellow_ratio < 0.15:
        color_score = 100
    elif 0.10 < yellow_ratio < 0.17:
        color_score = 85
    else:
        color_score = 60

    # Pic dans bon canal (F5-F7)
    peak_channel = max(spectrum, key=spectrum.get)
    if peak_channel in ["F5_555nm", "F6_590nm", "F7_630nm"]:
        peak_score = 100
    else:
        peak_score = 70

    # Score global couleur
    color_score = (yellow_ratio_score * 0.7 + peak_score * 0.3)

    return {
        "color_score": round(color_score, 1),
        "yellow_ratio": round(yellow_ratio, 3),
        "peak_channel": peak_channel
    }
```

### Grading Automatique

**Algorithme complet**:
```python
def calculate_grade(tof_analysis, spectral_analysis):
    """Grade final A+ → D"""
    # Pondération
    relief_score = tof_analysis["relief_score"]      # 40%
    color_score = spectral_analysis["color_score"]   # 30%
    peak_score = spectral_analysis["peak_score"]     # 20%
    freshness_score = spectral_analysis["nir_score"] # 10%

    # Score pondéré total
    total_score = (
        relief_score * 0.40 +
        color_score * 0.30 +
        peak_score * 0.20 +
        freshness_score * 0.10
    )

    # Grading
    if total_score >= 95:
        return "A+", total_score
    elif total_score >= 85:
        return "A", total_score
    elif total_score >= 75:
        return "B", total_score
    elif total_score >= 60:
        return "C", total_score
    else:
        return "D", total_score
```

### Profils Qualité

**Fichier config**: `config_foiegras.yaml`

**3 profils disponibles**:

**1. `foiegras_standard_barquette`** (Standard):
```yaml
specimen_characteristics:
  shape_profile: "slightly_convex"
  color_profile: "uniform_golden_yellow"
  surface_quality: "smooth"
  expected_weight_range: [180, 220]  # grammes

quality_metrics:
  target_grade: "A"
  min_acceptable_grade: "B"
```
- Grade attendu: **A-B**
- Relief: légèrement bombé, variation ±5mm
- Couleur: jaune doré uniforme

**2. `foiegras_premium_terrine`** (Premium):
```yaml
specimen_characteristics:
  shape_profile: "uniformly_flat"
  color_profile: "uniform_golden_yellow"
  surface_quality: "very_smooth"
  expected_weight_range: [250, 350]

quality_metrics:
  target_grade: "A+"
  min_acceptable_grade: "A"
```
- Grade attendu: **A+-A**
- Relief: parfaitement plat, variation ±2mm
- Couleur: jaune parfait, pas de taches

**3. `foiegras_bio_entier`** (Bio):
```yaml
specimen_characteristics:
  shape_profile: "irregular"
  color_profile: "slightly_mottled"
  surface_quality: "natural"
  expected_weight_range: [400, 600]

quality_metrics:
  target_grade: "B"
  min_acceptable_grade: "C"
```
- Grade attendu: **B-C**
- Relief: irrégulier naturel, variation ±8mm
- Couleur: jaune orangé, taches acceptables

### Utilisation

```bash
cd simulators/sqal

# Mode défaut (standard)
python esp32_simulator.py --device ESP32_LL_01

# Mode premium
python esp32_simulator.py \
  --device ESP32_LS_02 \
  --config-profile foiegras_premium_terrine \
  --interval 30

# Mode bio
python esp32_simulator.py \
  --device ESP32_MT_03 \
  --config-profile foiegras_bio_entier \
  --interval 20
```

**Paramètres**:
- `--device` : ID ESP32 (défaut: auto-généré)
- `--backend-url` : URL WebSocket (défaut: `ws://localhost:8000/ws/sensors/`)
- `--interval` : Secondes entre mesures (défaut: 30)
- `--config-profile` : Profil YAML (défaut: `foiegras_standard_barquette`)

### Logs Exemple

```
🔌 ESP32 SIMULATOR - Démarrage
============================================================
Device ID: ESP32_LL_01
MAC Address: E8:9F:6D:42:A7:C3
Location: Ligne A
Config Profile: foiegras_standard_barquette
Backend: ws://localhost:8000/ws/sensors/
============================================================

🔧 BOOT SEQUENCE
├─ I2C Bus initialized
├─ Devices found: 0x29 (VL53L8CH), 0x39 (AS7341)
├─ Configuration loaded: foiegras_standard_barquette
├─ WiFi connecting to "FoieGras-Production"...
├─ WiFi connected! IP: 192.168.1.142
├─ WebSocket connecting to backend...
└─ ✅ Status: ONLINE

🔬 MESURE #1 (14:45:23)
============================================================
📡 ToF VL53L8CH (8×8 matrix):
   Distances moyennes: 102-112mm
   Uniformité: 94.2%
   Défauts: 0 zones aberrantes
   → Relief Score: 94.2

🌈 Spectral AS7341 (10 channels):
   Peak: F6_590nm (3980)
   Yellow Ratio: 0.136 (optimal)
   NIR/Clear: 0.072 (frais)
   → Color Score: 96.8

⭐ GRADING FINAL:
   Score Total: 95.8
   Grade: A+
   Confiance: 0.92

📤 Envoi WebSocket... OK
📊 Mesure enregistrée (ID: SQAL-ESP32_LL_01-001)

[... 30 secondes ...]

🔬 MESURE #2 (14:45:53)
...
```

### Format Données WebSocket

**Message complet**:
```json
{
  "type": "sensor_data",
  "device_id": "ESP32_LL_01",
  "lot_code": "LL2412001",
  "sample_number": 3,

  "tof_matrix": [
    [102, 104, 105, 105, 104, 103, 101, 100],
    [103, 105, 107, 108, 107, 105, 103, 102],
    ...
  ],

  "spectral": {
    "F1_415nm": 1280,
    "F2_445nm": 1950,
    "F3_480nm": 2480,
    "F4_515nm": 3180,
    "F5_555nm": 3680,
    "F6_590nm": 3980,
    "F7_630nm": 3380,
    "F8_680nm": 2580,
    "NIR_910nm": 1780,
    "Clear": 24800
  },

  "quality_metrics": {
    "relief_score": 94.2,
    "color_score": 96.8,
    "total_score": 95.8,
    "grade": "A+",
    "confidence": 0.92
  },

  "temperature": 18.5,
  "humidity": 62.3,
  "timestamp": "2024-12-23T14:45:23.456789Z"
}
```

---

## 🔄 Flux Complet Intégré

### Scénario Test Complet

**Terminal 1 - Backend**:
```bash
cd backend-api
uvicorn app.main:app --reload
```

**Terminal 2 - Simulateur Gavage**:
```bash
cd simulators/gavage_realtime
python main.py --nb-lots 1 --acceleration 86400
# 1 lot, accélération ×86400 (1 jour = 1 seconde)
# Durée totale: ~12-14 secondes
```

**Terminal 3 - Lot Monitor**:
```bash
cd simulators/sqal
python lot_monitor.py --polling-interval 10
# Polling toutes les 10 secondes
```

**Terminal 4 - Frontend Euralis**:
```bash
cd euralis-frontend
npm run dev
# http://localhost:3000/euralis/dashboard
```

**Terminal 5 - Frontend SQAL**:
```bash
cd sqal/FrontEnd
npm run dev
# http://localhost:5173
```

### Timeline Événements

```
T+0s   : Simulateur Gavage démarre
         ├─ Crée lot LL2412001 (48 canards Mulard, 12 jours)
         └─ État: J-1 préparation

T+1s   : J0 Matin
         ├─ Dose: 200g
         ├─ Poids moyen: 4512g
         └─ Envoi WebSocket → Backend

T+1.5s : J0 Soir
         ├─ Dose: 210g
         ├─ Poids moyen: 4580g
         └─ Envoi WebSocket → Backend

T+2s   : J1 Matin ...

[... 12 secondes ...]

T+12s  : J12 Soir (dernier gavage)
         ├─ Dose: 490g
         ├─ Poids moyen: 7845g
         ├─ FLAG: pret_abattage=true
         └─ Backend insère dans sqal_pending_lots

T+15s  : Lot Monitor détecte (polling 10s)
         ├─ Query: SELECT * FROM sqal_pending_lots WHERE status='pending'
         ├─ Trouve: LL2412001
         └─ Lance inspection SQAL

T+15s  : Lot Monitor génère échantillon 1/5
         ├─ ToF: Relief score 94.2
         ├─ Spectral: Color score 96.8
         ├─ Grade: A+ (95.8)
         └─ Envoi WebSocket /ws/sensors/ → Backend

T+25s  : Échantillon 2/5 (Grade: A, 92.5)
T+35s  : Échantillon 3/5 (Grade: A, 89.7)
T+45s  : Échantillon 4/5 (Grade: B, 78.2)
T+55s  : Échantillon 5/5 (Grade: A, 91.3)

T+55s  : Lot Monitor finalise
         ├─ UPDATE sqal_pending_lots SET status='inspected'
         └─ Grade moyen lot: A (89.5)

T+56s  : Frontend SQAL affiche
         ├─ 5 échantillons lot LL2412001
         ├─ Distribution: A+ (1), A (3), B (1)
         └─ Graphiques heatmaps ToF + spectres
```

---

## 📊 Performance & Ressources

### Utilisation Ressources

| Simulateur | CPU | RAM | Réseau |
|------------|-----|-----|--------|
| Gavage (×1440, 3 lots) | <1% | 15 MB | 2 KB/s |
| Lot Monitor | <1% | 10 MB | 0.5 KB/s |
| SQAL ESP32 (1 device) | <2% | 20 MB | 5 KB/s |
| **Total 3 simulateurs** | **<5%** | **45 MB** | **7.5 KB/s** |

### Throughput

**Gavage Simulator**:
- Mode ×1: 2 messages/jour = 0.00002 msg/s
- Mode ×1440: 2 messages/60s = 0.033 msg/s
- Mode ×86400: 2 messages/1s = 2 msg/s

**SQAL Simulator**:
- Intervalle 30s: 0.033 msg/s
- Intervalle 10s: 0.1 msg/s
- Intervalle 1s: 1 msg/s

**Lot Monitor**:
- 5 échantillons/lot, 1 lot/min: 0.083 msg/s

**Total système (mode test)**:
- ~3-5 messages/seconde
- ~15-25 KB/s trafic WebSocket

---

## 🧪 Tests Recommandés

### Test 1: Cycle Complet Rapide (1 minute)

```bash
# Terminal 1: Backend
uvicorn app.main:app --reload

# Terminal 2: Gavage ultra-rapide
python simulators/gavage_realtime/main.py --nb-lots 1 --acceleration 86400

# Terminal 3: Monitor réactif
python simulators/sqal/lot_monitor.py --polling-interval 5

# Résultat après ~1 minute:
# - 1 lot créé
# - 24 gavages (12 jours × 2)
# - Lot terminé
# - 5 échantillons SQAL
# - Grade final calculé
```

### Test 2: Multi-Lots Réaliste (10 minutes)

```bash
# Gavage: 3 lots, accélération modérée
python simulators/gavage_realtime/main.py --nb-lots 3 --acceleration 1440

# Résultat après ~12 minutes:
# - 3 lots traités
# - ~72 gavages total
# - 3 lots inspectés SQAL (15 échantillons)
```

### Test 3: Production Continue (24h)

```bash
# Gavage: temps réel
python simulators/gavage_realtime/main.py --nb-lots 5 --acceleration 1

# Résultat après 12 jours réels:
# - 5 lots traités
# - Production réaliste
```

---

## 🔗 Liens Documentation

- [05-SIMULATEURS/README.md](05-SIMULATEURS/README.md) - Vue d'ensemble simulateurs
- [SIMULATEURS_TEMPS_REEL.md](../SIMULATEURS_TEMPS_REEL.md) - Documentation technique complète
- [07-SQAL/README.md](07-SQAL/README.md) - Système SQAL détaillé
- [FRONTEND_WEBSOCKET_INTEGRATION.md](FRONTEND_WEBSOCKET_INTEGRATION.md) - Intégration frontends

---

**Date**: 23 Décembre 2024
**Version**: 3.0.0
**Auteur**: Équipe Développement Euralis
**Statut**: ✅ Documentation Complète

---

**Retour**: [Index Documentation](README.md)
