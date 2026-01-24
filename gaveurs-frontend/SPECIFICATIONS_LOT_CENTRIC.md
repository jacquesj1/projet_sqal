# 🦆 Spécifications LOT-CENTRIC - Frontend Gaveurs V3.0

**Date de création** : 28 décembre 2025
**Auteur** : JJ - A Deep Adventure
**Version** : 3.0.0
**Type** : Spécifications techniques corrigées

---

## ⚠️ Correction Fondamentale du Modèle de Données

### ❌ ERREUR dans les anciennes spécifications
- Les anciennes specs assumaient que le gaveur gère des **canards individuellement**
- Toutes les interfaces montraient des sélections de canards individuels
- Les doses étaient par canard

### ✅ RÉALITÉ du métier
- Un gaveur gère des **LOTS de canards** (~200 canards par lot)
- Les doses sont **COMMUNES à tout le lot**
- Le LOT ID est la clé primaire de liaison entre tous les systèmes

---

## 🎯 Codes de Lots et Provenance

### Format des codes de lots
```
LL_XXX  → Bretagne (Landerneau/Loudéac)
LS_XXX  → Pays de Loire (Loire-Sud)
MG_XXX  → Maubourguet (Hautes-Pyrénées)
```

**Exemples** :
- `LL_001` : Lot 1 de Bretagne
- `LS_042` : Lot 42 des Pays de Loire
- `MG_015` : Lot 15 de Maubourguet

### Caractéristiques d'un lot
```typescript
interface Lot {
  id: number;
  code_lot: string;              // LL_XXX, LS_XXX, MG_XXX
  site_origine: string;          // "Bretagne" | "Pays de Loire" | "Maubourguet"
  nombre_canards: number;        // ~200 canards par lot
  genetique: "mulard" | "barbarie" | "pekin" | "mixte";
  date_debut_gavage: string;     // ISO 8601
  date_fin_gavage_prevue: string;

  // Poids et statistiques du lot
  poids_moyen_initial: number;   // Grammes (moyenne du lot)
  poids_moyen_actuel: number;    // Grammes (moyenne du lot)

  // Courbe théorique (fournie par Euralis via PySR)
  courbe_theorique: CurvePoint[];

  // Objectif de gavage
  objectif_quantite_mais: number; // Grammes totaux par canard

  // État du lot
  statut: "en_preparation" | "en_gavage" | "termine" | "abattu";

  // Métadonnées
  gaveur_id: number;
  lot_mais_id: number;           // Lot de maïs utilisé

  created_at: string;
  updated_at: string;
}
```

---

## 📊 Les Trois Courbes Face-à-Face

### Concept Central
Le gaveur doit pouvoir visualiser **3 courbes superposées** en temps réel :

```
┌────────────────────────────────────────────────────────┐
│  📈 Courbes de Gavage - Lot LL_042                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Poids (g)                                             │
│  7000 ┤                                                │
│       │                          ╱- Prédiction IA     │
│  6500 ┤                      ╱──○                      │
│       │                  ╱───                          │
│  6000 ┤              ╱───  ← Écart détecté (15%)      │
│       │          ╱───                                  │
│  5500 ┤      ╱───                                      │
│       │  ╱───                                          │
│  5000 ┼──●───●───●───●  ← Courbe RÉELLE               │
│       │                                                │
│  4500 ┤      ─ ─ ─ ─ ─ ─ ─ ← Courbe THÉORIQUE        │
│       │                                                │
│  4000 ┤                                                │
│       └┬───┬───┬───┬───┬───┬───┬───┬───┬───┬──→       │
│        J1  J3  J5  J7  J9  J11 J13 J15 J17 J19 Jours  │
│                                                        │
│  🔵 Théorique (PySR Euralis)                          │
│  🟢 Réelle (données saisies)                          │
│  🟠 Prédiction IA (recommandations)                   │
│                                                        │
│  ⚠️ ALERTE : Écart > 10% détecté au jour 9            │
│  💡 Recommandation : Augmenter dose de +50g/jour      │
│     pour atteindre objectif de 6800g au jour 14       │
└────────────────────────────────────────────────────────┘
```

### 1️⃣ Courbe THÉORIQUE (Bleu)
- **Source** : PySR (régression symbolique) fournie par Euralis
- **Format** : Formule mathématique optimale basée sur historique
- **Affichage** : Ligne continue bleue
- **Utilité** : Objectif à suivre en conditions idéales

```typescript
interface CourbeTheorique {
  formule_pysr: string;  // "0.42*dose^0.8 + 0.38*temp - 12.3"
  points: CurvePoint[];  // Points précalculés pour affichage
  metadata: {
    r2_score: number;    // Précision du modèle (0.85-0.95)
    nombre_echantillons: number;
    date_generation: string;
  };
}
```

### 2️⃣ Courbe RÉELLE (Vert)
- **Source** : Données de gavage saisies quotidiennement par le gaveur
- **Format** : Poids moyens mesurés + doses réellement données
- **Affichage** : Ligne continue verte avec points de mesure
- **Utilité** : Vérité terrain, ce qui se passe vraiment

```typescript
interface DonneeReelle {
  jour: number;
  date: string;
  dose_matin: number;      // Grammes (commune à tout le lot)
  dose_soir: number;       // Grammes (commune à tout le lot)
  poids_moyen: number;     // Grammes (moyenne d'un échantillon)
  nb_canards_peses: number; // Ex: 10 canards pesés sur 200
  temperature_stabule: number;
  humidite_stabule: number;
  remarques?: string;      // Annotations du gaveur
}
```

### 3️⃣ Prédiction IA (Orange pointillé)
- **Source** : Modèle Prophet + Random Forest entraîné en temps réel
- **Format** : Prédiction des prochains jours avec intervalle de confiance
- **Affichage** : Ligne pointillée orange avec zone d'incertitude
- **Déclenchement** : Quand écart Réelle vs Théorique > **seuil configurable**

```typescript
interface PredictionIA {
  points_predits: CurvePoint[];
  intervalle_confiance: {
    lower: number[];   // Borne basse (10%)
    upper: number[];   // Borne haute (90%)
  };

  // Recommandations
  recommandations: Recommandation[];

  // Métriques
  ecart_actuel: number;         // % d'écart par rapport à théorique
  probabilite_atteinte_objectif: number; // 0-1
  jours_restants_optimises: number;
}

interface Recommandation {
  type: "augmenter_dose" | "reduire_dose" | "maintenir" | "alerter_veterinaire";
  message: string;
  ajustement_dose: number;      // +/- grammes
  impact_prevu: {
    poids_final_estime: number;
    jours_gavage_estimes: number;
  };
  urgence: "info" | "warning" | "critique";
}
```

### Seuils d'alerte et actions

```typescript
const SEUILS_ALERTE = {
  ECART_INFO: 5,        // 5% → Notification simple
  ECART_WARNING: 10,    // 10% → Afficher prédiction IA
  ECART_CRITIQUE: 25,   // 25% → Alerte SMS + recommandation urgente
};

// Logique de déclenchement
if (ecart_pourcent >= SEUILS_ALERTE.ECART_WARNING) {
  // 1. Calculer prédiction IA
  // 2. Afficher courbe orange
  // 3. Générer recommandations
  // 4. Si >= CRITIQUE : Envoyer SMS
}
```

---

## 📝 Formulaire de Gavage LOT-Centric

### Utilisation Principale (80% du temps)
Le gaveur doit pouvoir saisir rapidement les données de gavage pour un lot entier.

### Interface Simplifiée

```typescript
interface FormulaireGavageLot {
  // Section 1 : Identification du lot
  lot_id: number;              // Sélection par code lot (LL_042)
  date_gavage: string;         // Date du jour (pré-remplie)
  jour_gavage: number;         // J1, J2, J3... (auto-calculé)

  // Section 2 : Doses (COMMUNES à tout le lot)
  dose_matin: number;          // Grammes
  heure_gavage_matin: string;  // "08:30"
  dose_soir: number;           // Grammes
  heure_gavage_soir: string;   // "18:30"

  // Section 3 : Poids (échantillon)
  nb_canards_peses: number;    // Ex: 10 sur 200
  poids_echantillon: number[]; // [4200, 4150, 4180, ...] → 10 valeurs
  poids_moyen_calcule: number; // Auto-calculé : moyenne

  // Section 4 : Conditions environnementales
  temperature_stabule: number; // °C
  humidite_stabule: number;    // %

  // Section 5 : Annotations et écarts
  suit_courbe_theorique: boolean;
  raison_ecart?: string;       // Si non conforme
  remarques?: string;

  // Section 6 : Événements spéciaux
  mortalite?: {
    nombre: number;
    cause?: string;
  };
  problemes_sante?: string;
}
```

### Mockup Interface

```
┌──────────────────────────────────────────────────────────┐
│  📝 Gavage du Jour - 28 Décembre 2025                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🦆 Sélection du Lot                                     │
│  ┌──────────────────────────────────────┐               │
│  │ LL_042 - Bretagne (200 canards) ▼   │               │
│  └──────────────────────────────────────┘               │
│  Jour de gavage : J9 / 14                               │
│  Poids moyen actuel : 4850g                             │
│  Objectif final : 6800g                                 │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🌅 Gavage Matin                                         │
│  Dose : [____450____] g     Heure : [__08:30__]         │
│                                                          │
│  🌙 Gavage Soir                                          │
│  Dose : [____480____] g     Heure : [__18:30__]         │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  ⚖️ Pesée (Échantillon)                                  │
│  Nombre pesés : [__10__] / 200                          │
│                                                          │
│  Poids individuels (grammes) :                          │
│  ┌──────┬──────┬──────┬──────┬──────┐                  │
│  │ 4820 │ 4790 │ 4880 │ 4850 │ 4910 │                  │
│  ├──────┼──────┼──────┼──────┼──────┤                  │
│  │ 4760 │ 4890 │ 4830 │ 4870 │ 4800 │                  │
│  └──────┴──────┴──────┴──────┴──────┘                  │
│                                                          │
│  📊 Poids moyen : 4840g (auto-calculé)                  │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🌡️ Conditions Stabule                                   │
│  Température : [__22.5__] °C                            │
│  Humidité :    [__65.0__] %                             │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  ⚠️ Écart par rapport à la courbe théorique             │
│  ☐ Je suis la courbe théorique                         │
│  ☑ Écart volontaire (raison ci-dessous)                │
│                                                          │
│  Raison de l'écart :                                    │
│  ┌────────────────────────────────────────────────┐    │
│  │ Canards moins actifs ce matin,                │    │
│  │ j'ai réduit la dose pour éviter le stress     │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Remarques générales :                                  │
│  ┌────────────────────────────────────────────────┐    │
│  │ RAS, lot en bonne santé                        │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🚨 Événements spéciaux (optionnel)                     │
│  ☐ Mortalité (nombre : [____])                         │
│  ☐ Problèmes de santé                                   │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [ 💾 Enregistrer ]  [ 📊 Voir Courbes ]               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Fonctionnalités Auto-remplissage IA

```typescript
// Suggestions IA basées sur historique
interface SuggestionIA {
  dose_matin_suggeree: number;
  dose_soir_suggeree: number;
  confiance: number;           // 0-1
  base_sur: {
    jours_historique: number;
    lots_similaires: number;
  };
}

// Exemple d'affichage
// "💡 Suggestion IA : 450g matin, 480g soir (confiance 87%)"
// [Accepter] [Modifier]
```

---

## 🎨 Composants React Principaux

### 1. `LotSelector.tsx`

```typescript
interface LotSelectorProps {
  gaveurId: number;
  onLotSelect: (lot: Lot) => void;
  filterStatut?: ("en_preparation" | "en_gavage" | "termine")[];
}

export function LotSelector({ gaveurId, onLotSelect, filterStatut }: LotSelectorProps) {
  const [lots, setLots] = useState<Lot[]>([]);

  useEffect(() => {
    // Charger les lots du gaveur
    fetch(`/api/lots/gaveur/${gaveurId}`)
      .then(res => res.json())
      .then(setLots);
  }, [gaveurId]);

  const lotsFiltered = filterStatut
    ? lots.filter(l => filterStatut.includes(l.statut))
    : lots;

  return (
    <select onChange={(e) => {
      const lot = lots.find(l => l.id === parseInt(e.target.value));
      if (lot) onLotSelect(lot);
    }}>
      <option value="">-- Sélectionner un lot --</option>
      {lotsFiltered.map(lot => (
        <option key={lot.id} value={lot.id}>
          {lot.code_lot} - {lot.site_origine} ({lot.nombre_canards} canards)
        </option>
      ))}
    </select>
  );
}
```

### 2. `TripleCurveChart.tsx`

```typescript
interface TripleCurveChartProps {
  lotId: number;
  courbeTheorique: CurvePoint[];
  courbeReelle: CurvePoint[];
  courbePrediction?: CurvePoint[];
  showLegend?: boolean;
  height?: number;
}

export function TripleCurveChart({
  lotId,
  courbeTheorique,
  courbeReelle,
  courbePrediction,
  showLegend = true,
  height = 400
}: TripleCurveChartProps) {

  // Calcul de l'écart actuel
  const ecartActuel = useMemo(() => {
    const dernierPointReel = courbeReelle[courbeReelle.length - 1];
    const pointTheoriqueCorrespondant = courbeTheorique.find(
      p => p.jour === dernierPointReel.jour
    );

    if (!pointTheoriqueCorrespondant) return 0;

    const ecart = ((dernierPointReel.poids - pointTheoriqueCorrespondant.poids) /
                   pointTheoriqueCorrespondant.poids) * 100;

    return ecart;
  }, [courbeReelle, courbeTheorique]);

  // Déterminer niveau d'alerte
  const niveauAlerte = useMemo(() => {
    const absEcart = Math.abs(ecartActuel);
    if (absEcart >= SEUILS_ALERTE.ECART_CRITIQUE) return "critique";
    if (absEcart >= SEUILS_ALERTE.ECART_WARNING) return "warning";
    if (absEcart >= SEUILS_ALERTE.ECART_INFO) return "info";
    return "ok";
  }, [ecartActuel]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">
          📈 Courbes de Gavage - Lot {lotId}
        </h3>

        {niveauAlerte !== "ok" && (
          <div className={`px-4 py-2 rounded-lg ${
            niveauAlerte === "critique" ? "bg-red-100 text-red-800" :
            niveauAlerte === "warning" ? "bg-orange-100 text-orange-800" :
            "bg-blue-100 text-blue-800"
          }`}>
            ⚠️ Écart détecté : {ecartActuel.toFixed(1)}%
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="jour"
            label={{ value: "Jour de gavage", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            label={{ value: "Poids moyen (g)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />

          {showLegend && (
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
            />
          )}

          {/* Courbe Théorique */}
          <Line
            data={courbeTheorique}
            type="monotone"
            dataKey="poids"
            stroke="#3B82F6"
            strokeWidth={2}
            name="Théorique (PySR)"
            dot={false}
          />

          {/* Courbe Réelle */}
          <Line
            data={courbeReelle}
            type="monotone"
            dataKey="poids"
            stroke="#10B981"
            strokeWidth={3}
            name="Réelle"
            dot={{ r: 5, fill: "#10B981" }}
          />

          {/* Courbe Prédiction IA */}
          {courbePrediction && courbePrediction.length > 0 && (
            <Line
              data={courbePrediction}
              type="monotone"
              dataKey="poids"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Prédiction IA"
              dot={{ r: 4, fill: "#F59E0B", strokeWidth: 2, stroke: "#fff" }}
            />
          )}

          {/* Zone de confiance (si prédiction) */}
          {courbePrediction && (
            <Area
              data={courbePrediction}
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#F59E0B"
              fillOpacity={0.1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Recommandations IA */}
      {courbePrediction && niveauAlerte !== "ok" && (
        <RecommandationsPanel
          lotId={lotId}
          ecart={ecartActuel}
          niveau={niveauAlerte}
        />
      )}
    </div>
  );
}
```

### 3. `RecommandationsPanel.tsx`

```typescript
interface RecommandationsPanelProps {
  lotId: number;
  ecart: number;
  niveau: "info" | "warning" | "critique";
}

export function RecommandationsPanel({ lotId, ecart, niveau }: RecommandationsPanelProps) {
  const [recommandations, setRecommandations] = useState<Recommandation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Appel API pour obtenir recommandations IA
    fetch(`/api/ml/recommandations/lot/${lotId}`)
      .then(res => res.json())
      .then(data => {
        setRecommandations(data.recommandations);
        setLoading(false);
      });
  }, [lotId]);

  if (loading) return <div>Chargement des recommandations...</div>;

  return (
    <div className={`mt-4 p-4 rounded-lg border-l-4 ${
      niveau === "critique" ? "bg-red-50 border-red-500" :
      niveau === "warning" ? "bg-orange-50 border-orange-500" :
      "bg-blue-50 border-blue-500"
    }`}>
      <h4 className="font-bold text-lg mb-2">
        💡 Recommandations IA
      </h4>

      <div className="space-y-3">
        {recommandations.map((rec, idx) => (
          <div key={idx} className="bg-white p-3 rounded shadow-sm">
            <div className="flex items-start gap-2">
              <span className="text-2xl">
                {rec.type === "augmenter_dose" ? "⬆️" :
                 rec.type === "reduire_dose" ? "⬇️" :
                 rec.type === "alerter_veterinaire" ? "🚨" : "✅"}
              </span>

              <div className="flex-1">
                <p className="font-medium">{rec.message}</p>

                {rec.ajustement_dose !== 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Ajustement suggéré :
                    <span className={`font-bold ml-1 ${
                      rec.ajustement_dose > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {rec.ajustement_dose > 0 ? "+" : ""}
                      {rec.ajustement_dose}g par gavage
                    </span>
                  </p>
                )}

                <div className="mt-2 text-sm text-gray-500">
                  Impact prévu :
                  <ul className="list-disc list-inside mt-1">
                    <li>Poids final : {rec.impact_prevu.poids_final_estime}g</li>
                    <li>Durée totale : {rec.impact_prevu.jours_gavage_estimes} jours</li>
                  </ul>
                </div>
              </div>

              <span className={`px-2 py-1 rounded text-xs font-bold ${
                rec.urgence === "critique" ? "bg-red-100 text-red-800" :
                rec.urgence === "warning" ? "bg-orange-100 text-orange-800" :
                "bg-blue-100 text-blue-800"
              }`}>
                {rec.urgence.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. `FormulaireGavageLot.tsx`

```typescript
interface FormulaireGavageLotProps {
  lot: Lot;
  onSubmit: (data: FormulaireGavageLot) => Promise<void>;
}

export function FormulaireGavageLot({ lot, onSubmit }: FormulaireGavageLotProps) {
  const [formData, setFormData] = useState<FormulaireGavageLot>({
    lot_id: lot.id,
    date_gavage: new Date().toISOString().split('T')[0],
    jour_gavage: 0, // Calculé automatiquement
    dose_matin: 0,
    heure_gavage_matin: "08:30",
    dose_soir: 0,
    heure_gavage_soir: "18:30",
    nb_canards_peses: 10,
    poids_echantillon: Array(10).fill(0),
    poids_moyen_calcule: 0,
    temperature_stabule: 22,
    humidite_stabule: 65,
    suit_courbe_theorique: true,
    remarques: "",
  });

  const [suggestionIA, setSuggestionIA] = useState<SuggestionIA | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculer jour de gavage
  useEffect(() => {
    const dateDebut = new Date(lot.date_debut_gavage);
    const dateActuelle = new Date(formData.date_gavage);
    const diffJours = Math.floor((dateActuelle.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    setFormData(prev => ({ ...prev, jour_gavage: diffJours }));
  }, [formData.date_gavage, lot.date_debut_gavage]);

  // Obtenir suggestions IA
  useEffect(() => {
    fetch(`/api/ml/suggestions/lot/${lot.id}/jour/${formData.jour_gavage}`)
      .then(res => res.json())
      .then(setSuggestionIA);
  }, [lot.id, formData.jour_gavage]);

  // Auto-calculer poids moyen
  useEffect(() => {
    const moyenne = formData.poids_echantillon.reduce((a, b) => a + b, 0) / formData.nb_canards_peses;
    setFormData(prev => ({ ...prev, poids_moyen_calcule: Math.round(moyenne) }));
  }, [formData.poids_echantillon, formData.nb_canards_peses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(formData);
      // Succès : rediriger ou afficher courbes
    } catch (error) {
      console.error("Erreur enregistrement:", error);
    } finally {
      setLoading(false);
    }
  };

  const accepterSuggestionIA = () => {
    if (!suggestionIA) return;

    setFormData(prev => ({
      ...prev,
      dose_matin: suggestionIA.dose_matin_suggeree,
      dose_soir: suggestionIA.dose_soir_suggeree,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">📝 Gavage du Jour</h2>
        <p className="text-gray-600 mt-1">
          {new Date(formData.date_gavage).toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Informations Lot */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold mb-2">🦆 Lot Sélectionné</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Code :</span>
            <span className="font-bold ml-2">{lot.code_lot}</span>
          </div>
          <div>
            <span className="text-gray-600">Site :</span>
            <span className="ml-2">{lot.site_origine}</span>
          </div>
          <div>
            <span className="text-gray-600">Jour de gavage :</span>
            <span className="font-bold ml-2">J{formData.jour_gavage} / 14</span>
          </div>
          <div>
            <span className="text-gray-600">Poids moyen actuel :</span>
            <span className="ml-2">{lot.poids_moyen_actuel}g</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-600">Objectif final :</span>
            <span className="font-bold ml-2 text-green-600">{lot.objectif_quantite_mais}g</span>
          </div>
        </div>
      </div>

      {/* Suggestion IA */}
      {suggestionIA && (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-purple-900">💡 Suggestion IA</p>
              <p className="text-sm text-purple-700 mt-1">
                Matin : <span className="font-bold">{suggestionIA.dose_matin_suggeree}g</span>
                {" · "}
                Soir : <span className="font-bold">{suggestionIA.dose_soir_suggeree}g</span>
                {" · "}
                Confiance : {Math.round(suggestionIA.confiance * 100)}%
              </p>
            </div>
            <button
              type="button"
              onClick={accepterSuggestionIA}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Accepter
            </button>
          </div>
        </div>
      )}

      {/* Doses */}
      <div>
        <h3 className="font-bold mb-3">🌅 Gavage Matin</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dose (grammes)</label>
            <input
              type="number"
              value={formData.dose_matin}
              onChange={(e) => setFormData(prev => ({ ...prev, dose_matin: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Heure</label>
            <input
              type="time"
              value={formData.heure_gavage_matin}
              onChange={(e) => setFormData(prev => ({ ...prev, heure_gavage_matin: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3">🌙 Gavage Soir</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dose (grammes)</label>
            <input
              type="number"
              value={formData.dose_soir}
              onChange={(e) => setFormData(prev => ({ ...prev, dose_soir: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Heure</label>
            <input
              type="time"
              value={formData.heure_gavage_soir}
              onChange={(e) => setFormData(prev => ({ ...prev, heure_gavage_soir: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
        </div>
      </div>

      {/* Pesée Échantillon */}
      <div>
        <h3 className="font-bold mb-3">⚖️ Pesée (Échantillon)</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">
            Nombre de canards pesés
          </label>
          <input
            type="number"
            value={formData.nb_canards_peses}
            onChange={(e) => {
              const nb = parseInt(e.target.value);
              setFormData(prev => ({
                ...prev,
                nb_canards_peses: nb,
                poids_echantillon: Array(nb).fill(0)
              }));
            }}
            className="w-32 px-4 py-2 border rounded-lg"
            min="1"
            max="50"
          />
          <span className="ml-2 text-gray-600">/ {lot.nombre_canards}</span>
        </div>

        <p className="text-sm text-gray-600 mb-2">Poids individuels (grammes) :</p>
        <div className="grid grid-cols-5 gap-2">
          {formData.poids_echantillon.map((poids, idx) => (
            <input
              key={idx}
              type="number"
              value={poids || ""}
              onChange={(e) => {
                const newPoids = [...formData.poids_echantillon];
                newPoids[idx] = parseInt(e.target.value) || 0;
                setFormData(prev => ({ ...prev, poids_echantillon: newPoids }));
              }}
              className="px-2 py-2 border rounded text-center"
              placeholder={`#${idx + 1}`}
            />
          ))}
        </div>

        <div className="mt-3 p-3 bg-green-50 rounded-lg">
          <p className="font-bold text-green-800">
            📊 Poids moyen calculé : {formData.poids_moyen_calcule}g
          </p>
        </div>
      </div>

      {/* Conditions Stabule */}
      <div>
        <h3 className="font-bold mb-3">🌡️ Conditions Stabule</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Température (°C)</label>
            <input
              type="number"
              step="0.1"
              value={formData.temperature_stabule}
              onChange={(e) => setFormData(prev => ({ ...prev, temperature_stabule: parseFloat(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Humidité (%)</label>
            <input
              type="number"
              step="0.1"
              value={formData.humidite_stabule}
              onChange={(e) => setFormData(prev => ({ ...prev, humidite_stabule: parseFloat(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Écart courbe théorique */}
      <div>
        <h3 className="font-bold mb-3">⚠️ Suivi de la courbe théorique</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.suit_courbe_theorique}
              onChange={(e) => setFormData(prev => ({ ...prev, suit_courbe_theorique: e.target.checked }))}
              className="w-4 h-4"
            />
            <span>Je suis la courbe théorique fournie par Euralis</span>
          </label>

          {!formData.suit_courbe_theorique && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Raison de l'écart
              </label>
              <textarea
                value={formData.raison_ecart || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, raison_ecart: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg"
                rows={3}
                placeholder="Expliquez pourquoi vous vous écartez de la courbe théorique..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Remarques */}
      <div>
        <label className="block text-sm font-medium mb-1">Remarques générales</label>
        <textarea
          value={formData.remarques}
          onChange={(e) => setFormData(prev => ({ ...prev, remarques: e.target.value }))}
          className="w-full px-4 py-2 border rounded-lg"
          rows={3}
          placeholder="Observations, comportement du lot, etc."
        />
      </div>

      {/* Événements spéciaux */}
      <div>
        <h3 className="font-bold mb-3">🚨 Événements spéciaux (optionnel)</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData(prev => ({ ...prev, mortalite: { nombre: 0 } }));
                } else {
                  setFormData(prev => {
                    const { mortalite, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              className="w-4 h-4"
            />
            <span>Mortalité</span>
          </label>

          {formData.mortalite && (
            <div className="ml-6 space-y-2">
              <input
                type="number"
                value={formData.mortalite.nombre}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  mortalite: { ...prev.mortalite!, nombre: parseInt(e.target.value) }
                }))}
                className="w-24 px-4 py-2 border rounded-lg"
                placeholder="Nombre"
              />
              <input
                type="text"
                value={formData.mortalite.cause || ""}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  mortalite: { ...prev.mortalite!, cause: e.target.value }
                }))}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Cause (optionnel)"
              />
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData(prev => ({ ...prev, problemes_sante: "" }));
                } else {
                  setFormData(prev => {
                    const { problemes_sante, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              className="w-4 h-4"
            />
            <span>Problèmes de santé</span>
          </label>

          {formData.problemes_sante !== undefined && (
            <textarea
              value={formData.problemes_sante}
              onChange={(e) => setFormData(prev => ({ ...prev, problemes_sante: e.target.value }))}
              className="ml-6 w-full px-4 py-2 border rounded-lg"
              rows={2}
              placeholder="Décrire les problèmes observés..."
            />
          )}
        </div>
      </div>

      {/* Boutons */}
      <div className="flex gap-4 pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? "Enregistrement..." : "💾 Enregistrer"}
        </button>

        <button
          type="button"
          onClick={() => {
            // Rediriger vers page de visualisation des courbes
            window.location.href = `/lots/${lot.id}/courbes`;
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          📊 Voir Courbes
        </button>
      </div>
    </form>
  );
}
```

---

## 🔗 Routes API LOT-Centric

### Gestion des lots

```typescript
// GET /api/lots/gaveur/:gaveurId
// Récupérer tous les lots d'un gaveur
Response: Lot[]

// GET /api/lots/:lotId
// Détails d'un lot spécifique
Response: Lot

// POST /api/lots/
// Créer un nouveau lot
Body: {
  code_lot: string;
  site_origine: string;
  nombre_canards: number;
  genetique: string;
  date_debut_gavage: string;
  objectif_quantite_mais: number;
  gaveur_id: number;
}
Response: Lot

// PUT /api/lots/:lotId
// Mettre à jour un lot
Body: Partial<Lot>
Response: Lot

// DELETE /api/lots/:lotId
// Supprimer un lot (soft delete)
Response: { success: boolean }
```

### Gavage quotidien

```typescript
// POST /api/gavage/lot/:lotId
// Enregistrer un gavage pour un lot
Body: FormulaireGavageLot
Response: {
  gavage_id: number;
  ecart_courbe_theorique: number;
  alerte_generee: boolean;
  recommandations: Recommandation[];
}

// GET /api/gavage/lot/:lotId/historique
// Historique de tous les gavages d'un lot
Response: DonneeReelle[]

// GET /api/gavage/lot/:lotId/jour/:jour
// Données d'un jour spécifique
Response: DonneeReelle
```

### Courbes et prédictions

```typescript
// GET /api/courbes/lot/:lotId/theorique
// Courbe théorique PySR pour un lot
Response: {
  formule_pysr: string;
  points: CurvePoint[];
  metadata: {
    r2_score: number;
    nombre_echantillons: number;
    date_generation: string;
  };
}

// GET /api/courbes/lot/:lotId/reelle
// Courbe réelle basée sur données saisies
Response: CurvePoint[]

// GET /api/courbes/lot/:lotId/prediction
// Prédiction IA des prochains jours
Query params: ?horizon=7 (nombre de jours à prédire)
Response: {
  points_predits: CurvePoint[];
  intervalle_confiance: {
    lower: number[];
    upper: number[];
  };
  ecart_actuel: number;
  probabilite_atteinte_objectif: number;
}

// POST /api/courbes/lot/:lotId/prediction/refresh
// Recalculer la prédiction avec nouvelles données
Response: PredictionIA
```

### Recommandations IA

```typescript
// GET /api/ml/recommandations/lot/:lotId
// Obtenir recommandations IA basées sur écart actuel
Response: {
  recommandations: Recommandation[];
  ecart_actuel: number;
  niveau_alerte: "ok" | "info" | "warning" | "critique";
}

// GET /api/ml/suggestions/lot/:lotId/jour/:jour
// Suggestions IA pour le prochain gavage
Response: SuggestionIA

// POST /api/ml/formule-pysr/lot/:lotId/generate
// Générer formule PySR personnalisée pour ce lot
Body: {
  max_iterations: number;
  use_historical_data: boolean;
}
Response: {
  formule_symbolique: string;
  score_r2: number;
  coefficients: Record<string, number>;
}
```

### Statistiques et analytics

```typescript
// GET /api/stats/lot/:lotId
// Statistiques complètes d'un lot
Response: {
  progression: {
    jours_ecoules: number;
    jours_restants: number;
    pourcent_avancement: number;
  };
  poids: {
    initial: number;
    actuel: number;
    objectif: number;
    gain_total: number;
    gain_moyen_jour: number;
  };
  doses: {
    total_donne: number;
    objectif_total: number;
    pourcent_objectif: number;
    moyenne_jour: number;
  };
  conformite: {
    ecart_moyen_courbe: number;
    jours_hors_tolerance: number;
    taux_conformite: number;
  };
  sante: {
    mortalite_totale: number;
    taux_mortalite: number;
    nombre_alertes: number;
  };
}

// GET /api/stats/gaveur/:gaveurId/performance
// Performance globale d'un gaveur sur tous ses lots
Response: {
  lots_actifs: number;
  lots_termines: number;
  taux_reussite: number;
  gain_poids_moyen: number;
  conformite_moyenne: number;
}
```

---

## 📱 Pages de l'Application

### 1. `/lots` - Vue d'ensemble des lots

**Objectif** : Voir tous les lots du gaveur avec statuts et KPIs

```
┌────────────────────────────────────────────────────────┐
│  🦆 Mes Lots de Gavage                     [+ Nouveau] │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📊 En cours (3 lots)                                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │ LL_042 - Bretagne               J9/14  [Détails] │ │
│  │ 200 canards · Poids: 4850g → 6800g              │ │
│  │ ⚠️ Écart +12% (Warning)                          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ LS_028 - Pays de Loire          J5/14  [Détails] │ │
│  │ 195 canards · Poids: 4200g → 6800g              │ │
│  │ ✅ Conforme (Écart -2%)                          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ MG_015 - Maubourguet            J12/14 [Détails] │ │
│  │ 210 canards · Poids: 6200g → 6800g              │ │
│  │ ✅ Conforme (Écart +1%)                          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  📦 Terminés (8 lots)                    [Voir tout]  │
│  🗓️ Programmés (2 lots)                  [Voir tout]  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 2. `/lots/:id/gavage` - Formulaire de gavage quotidien

**Objectif** : Saisie rapide des données du jour (80% du temps passé)

Voir mockup `FormulaireGavageLot` ci-dessus.

### 3. `/lots/:id/courbes` - Visualisation des 3 courbes

**Objectif** : Analyser la progression et les écarts

```
┌────────────────────────────────────────────────────────┐
│  📈 Courbes de Gavage - Lot LL_042                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Graphique TripleCurveChart avec les 3 courbes]      │
│                                                        │
│  ⚠️ ALERTE : Écart +12% détecté au jour 9             │
│                                                        │
│  💡 Recommandations IA :                               │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ⬆️ Augmenter dose de +50g par gavage             │ │
│  │    Impact prévu : Poids final 6820g en 14 jours │ │
│  │    Urgence : WARNING                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  📊 Statistiques :                                     │
│  · Gain moyen/jour : 180g                             │
│  · Dose totale donnée : 4200g / 6300g (67%)          │
│  · Conformité courbe : 75%                            │
│                                                        │
│  [ 📝 Saisir Gavage ]  [ 📄 Historique ]              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4. `/lots/:id/historique` - Historique détaillé

**Objectif** : Consulter toutes les saisies passées

```
┌────────────────────────────────────────────────────────┐
│  📋 Historique Gavage - Lot LL_042                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Jour 9 - 28 Décembre 2025                            │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Matin : 450g à 08:30                             │ │
│  │ Soir  : 480g à 18:30                             │ │
│  │ Poids : 4850g (10 pesés)                         │ │
│  │ Temp  : 22.5°C · Humidité : 65%                  │ │
│  │ ⚠️ Écart courbe : +12%                            │ │
│  │ 📝 "Canards moins actifs ce matin..."            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  Jour 8 - 27 Décembre 2025                            │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Matin : 420g à 08:25                             │ │
│  │ Soir  : 450g à 18:35                             │ │
│  │ Poids : 4670g (10 pesés)                         │ │
│  │ Temp  : 23°C · Humidité : 63%                    │ │
│  │ ✅ Conforme (+3%)                                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ... (autres jours)                                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 5. `/lots/:id/stats` - Statistiques et analytics

**Objectif** : KPIs détaillés du lot (20% du temps)

```
┌────────────────────────────────────────────────────────┐
│  📊 Statistiques - Lot LL_042                         │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📈 Progression                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 64%           │
│  Jour 9 / 14 · 5 jours restants                       │
│                                                        │
│  ⚖️ Poids                                              │
│  Initial : 4000g → Actuel : 4850g → Objectif : 6800g │
│  Gain total : 850g · Gain moyen/jour : 94g            │
│  Encore 1950g à gagner                                │
│                                                        │
│  🌽 Doses                                              │
│  Total donné : 4200g / 6300g (67%)                    │
│  Moyenne/jour : 467g                                   │
│                                                        │
│  ✅ Conformité                                         │
│  Écart moyen : +8.5%                                  │
│  Jours hors tolérance : 2 / 9 (22%)                   │
│  Taux conformité : 78%                                │
│                                                        │
│  🏥 Santé                                              │
│  Mortalité : 2 / 200 (1%)                             │
│  Alertes : 3 (1 warning, 2 info)                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 6. `/dashboard` - Vue d'ensemble gaveur

**Objectif** : Landing page avec résumé de tous les lots

```
┌────────────────────────────────────────────────────────┐
│  🦆 Tableau de Bord Gaveur                            │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Bienvenue, Jean Dupont                               │
│  28 Décembre 2025 - 14:32                             │
│                                                        │
│  📊 Vue d'ensemble                                     │
│  ┌────────────┬────────────┬────────────┬───────────┐ │
│  │ 3 lots     │ 605        │ 12         │ 94%       │ │
│  │ en cours   │ canards    │ alertes    │ conformité│ │
│  └────────────┴────────────┴────────────┴───────────┘ │
│                                                        │
│  🚨 Alertes Actives (3)                               │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ⚠️ LL_042 : Écart +12% (Warning)   [Voir]       │ │
│  │ ℹ️ LS_028 : Rappel pesée demain     [Voir]       │ │
│  │ ℹ️ MG_015 : Fin gavage dans 2 jours [Voir]       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  📝 Actions Rapides                                    │
│  [Saisir Gavage] [Voir Lots] [Statistiques]          │
│                                                        │
│  📈 Performance Globale                                │
│  · Gain poids moyen : 885g                            │
│  · Taux conformité : 94%                              │
│  · Lots terminés ce mois : 8                          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 🔄 WebSocket Real-Time

### Endpoint
```
ws://localhost:8000/ws/gaveur/:gaveurId
```

### Messages envoyés par le serveur

```typescript
// Alerte en temps réel
{
  type: "ALERTE",
  lot_id: number;
  niveau: "info" | "warning" | "critique";
  message: string;
  timestamp: string;
}

// Mise à jour prédiction IA
{
  type: "PREDICTION_UPDATE",
  lot_id: number;
  prediction: PredictionIA;
  timestamp: string;
}

// Notification système
{
  type: "NOTIFICATION",
  titre: string;
  message: string;
  icon: string;
}
```

---

## 🧪 Algorithmes IA/ML

### 1. PySR - Régression Symbolique

**Objectif** : Découvrir formules optimales pour courbe théorique

```python
# Exemple de formule découverte par PySR
# ITM (poids final) = f(doses, conditions)

formule = "0.42 * dose_matin^0.8 + 0.38 * dose_soir^0.75 - 0.15 * temperature + 12.3"

# Appliqué au niveau LOT
def calculer_courbe_theorique(lot: Lot) -> List[CurvePoint]:
    points = []
    for jour in range(1, 15):
        # Appliquer formule PySR
        dose_theorique = evaluer_formule_pysr(jour, lot.genetique, conditions)
        poids_theorique = poids_initial + gain_cumule(dose_theorique, jour)

        points.append(CurvePoint(
            jour=jour,
            poids=poids_theorique,
            dose_matin=dose_theorique * 0.48,  # 48% matin
            dose_soir=dose_theorique * 0.52    # 52% soir
        ))

    return points
```

### 2. Prophet - Prédictions temporelles

**Objectif** : Prédire l'évolution future du lot

```python
from fbprophet import Prophet

def predire_evolution_lot(lot_id: int, horizon_jours: int = 7) -> PredictionIA:
    # Charger historique du lot
    historique = get_donnees_reelles(lot_id)

    # Préparer données pour Prophet
    df = pd.DataFrame({
        'ds': [h.date for h in historique],
        'y': [h.poids_moyen for h in historique]
    })

    # Entraîner modèle
    model = Prophet(
        changepoint_prior_scale=0.05,
        seasonality_mode='multiplicative'
    )
    model.fit(df)

    # Prédire
    future = model.make_future_dataframe(periods=horizon_jours)
    forecast = model.predict(future)

    # Extraire prédictions + intervalles
    points_predits = []
    for idx, row in forecast.tail(horizon_jours).iterrows():
        points_predits.append(CurvePoint(
            jour=len(historique) + idx + 1,
            poids=row['yhat'],
            lower=row['yhat_lower'],
            upper=row['yhat_upper']
        ))

    return PredictionIA(
        points_predits=points_predits,
        intervalle_confiance={
            'lower': [p.lower for p in points_predits],
            'upper': [p.upper for p in points_predits]
        }
    )
```

### 3. Random Forest - Recommandations

**Objectif** : Suggérer ajustements de doses

```python
from sklearn.ensemble import RandomForestRegressor

def generer_recommandations(lot_id: int) -> List[Recommandation]:
    lot = get_lot(lot_id)
    historique = get_donnees_reelles(lot_id)
    courbe_theorique = get_courbe_theorique(lot_id)

    # Calculer écart actuel
    dernier_point = historique[-1]
    point_theorique = courbe_theorique[dernier_point.jour - 1]
    ecart_pourcent = ((dernier_point.poids_moyen - point_theorique.poids) /
                      point_theorique.poids) * 100

    # Préparer features
    features = {
        'jour_actuel': dernier_point.jour,
        'poids_actuel': dernier_point.poids_moyen,
        'poids_objectif': lot.objectif_poids_final,
        'ecart_pourcent': ecart_pourcent,
        'dose_moyenne_recente': np.mean([h.dose_matin + h.dose_soir for h in historique[-3:]]),
        'temperature_moyenne': np.mean([h.temperature_stabule for h in historique[-3:]]),
        'genetique': lot.genetique
    }

    # Modèle entraîné sur historique multi-lots
    model = load_trained_model('random_forest_recommandations.pkl')

    # Prédire ajustement optimal
    X = prepare_features(features)
    ajustement_predit = model.predict([X])[0]

    # Générer recommandation
    recommandations = []

    if abs(ecart_pourcent) >= SEUILS_ALERTE.ECART_WARNING:
        if ecart_pourcent > 0:  # En avance
            recommandations.append(Recommandation(
                type="reduire_dose",
                message=f"Réduire la dose pour revenir sur la courbe théorique",
                ajustement_dose=int(ajustement_predit),
                impact_prevu={
                    'poids_final_estime': dernier_point.poids_moyen + calculate_impact(ajustement_predit),
                    'jours_gavage_estimes': 14
                },
                urgence="warning" if abs(ecart_pourcent) < SEUILS_ALERTE.ECART_CRITIQUE else "critique"
            ))
        else:  # En retard
            recommandations.append(Recommandation(
                type="augmenter_dose",
                message=f"Augmenter la dose pour atteindre l'objectif",
                ajustement_dose=int(ajustement_predit),
                impact_prevu={
                    'poids_final_estime': dernier_point.poids_moyen + calculate_impact(ajustement_predit),
                    'jours_gavage_estimes': 14
                },
                urgence="warning" if abs(ecart_pourcent) < SEUILS_ALERTE.ECART_CRITIQUE else "critique"
            ))

    return recommandations
```

---

## 🔐 Blockchain Traçabilité

### Événements blockchain LOT-centric

```typescript
// Initialiser blockchain pour un lot
POST /api/blockchain/lot/:lotId/init
Body: {
  gaveur_id: number;
  description: string;
}

// Ajouter événement gavage
POST /api/blockchain/lot/:lotId/gavage
Body: {
  jour: number;
  dose_matin: number;
  dose_soir: number;
  poids_moyen: number;
  nb_peses: number;
}

// Événement abattage
POST /api/blockchain/lot/:lotId/abattage
Body: {
  date_abattage: string;
  abattoir: string;
  poids_moyen_final: number;
  qualite_moyenne: string; // A+, A, B, C
}

// Certificat consommateur pour un canard du lot
GET /api/blockchain/lot/:lotId/canard/:numeroCanard/certificat
Response: {
  qr_code: string; // Base64 PNG
  blockchain_data: {
    lot: Lot;
    historique_gavage: DonneeReelle[];
    origine: string;
    abattoir: string;
    hashes: string[];
  };
}
```

---

## ✅ Checklist de Migration Canard → Lot

### Backend

- [ ] Créer table `lots` avec structure LOT
- [ ] Migrer table `gavage_data` pour référencer `lot_id` au lieu de `canard_id`
- [ ] Ajouter colonne `nb_canards_peses` et `poids_echantillon` (JSONB)
- [ ] Créer routes API LOT-centric (voir section Routes API)
- [ ] Adapter services PySR pour travailler au niveau LOT
- [ ] Modifier génération courbe théorique (par lot, pas par canard)
- [ ] Adapter modèle Prophet pour prédictions LOT
- [ ] Créer endpoint recommandations IA
- [ ] Modifier blockchain pour événements LOT
- [ ] Mettre à jour WebSocket pour notifications LOT

### Frontend

- [ ] Créer composant `LotSelector`
- [ ] Créer composant `TripleCurveChart`
- [ ] Créer composant `RecommandationsPanel`
- [ ] Créer composant `FormulaireGavageLot`
- [ ] Créer page `/lots` (liste des lots)
- [ ] Créer page `/lots/:id/gavage` (formulaire)
- [ ] Créer page `/lots/:id/courbes` (3 courbes)
- [ ] Créer page `/lots/:id/historique`
- [ ] Créer page `/lots/:id/stats`
- [ ] Mettre à jour `/dashboard` pour afficher lots
- [ ] Adapter tous les appels API pour utiliser `/lots` au lieu de `/canards`
- [ ] Mettre à jour types TypeScript (Canard → Lot)
- [ ] Tester WebSocket avec notifications LOT

### Documentation

- [ ] Mettre à jour README.md avec modèle LOT
- [ ] Créer guide utilisateur pour formulaire LOT
- [ ] Documenter les 3 courbes et seuils d'alerte
- [ ] Créer tutoriel vidéo de saisie de gavage
- [ ] Mettre à jour diagrammes d'architecture

---

## 🎯 Prochaines Étapes

1. **Valider cette spécification** avec l'équipe métier
2. **Créer schéma base de données LOT** (migration SQL)
3. **Implémenter backend LOT-centric** (routes + services)
4. **Développer composants React** (formulaire + courbes)
5. **Intégrer modèles IA** (PySR, Prophet, Random Forest)
6. **Tests E2E** du workflow complet
7. **Déploiement progressif** (beta-test avec 2-3 gaveurs)

---

**Auteur** : JJ - A Deep Adventure
**Contact** : support@adeep.fr
**Dernière mise à jour** : 28 décembre 2025

---

*Ce document corrige le modèle de données canard-centric en modèle LOT-centric, reflétant la réalité du métier de gaveur.*
