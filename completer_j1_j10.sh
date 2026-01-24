#!/bin/bash
# Script pour compléter les jours J1 à J10 du lot 1

API_URL="http://localhost:8000/api/lots/gavage"

# Date de début du lot : 2025-12-19
# J1 = 19/12, J2 = 20/12, ..., J10 = 28/12

dates=(
  "2025-12-19:1:3570:145"
  "2025-12-20:2:3640:150"
  "2025-12-21:3:3710:155"
  "2025-12-22:4:3780:160"
  "2025-12-23:5:3850:165"
  "2025-12-24:6:3920:170"
  "2025-12-25:7:3990:175"
  "2025-12-26:8:4060:180"
  "2025-12-27:9:4130:185"
  "2025-12-28:10:4200:190"
)

for entry in "${dates[@]}"; do
  IFS=':' read -r date jour poids dose <<< "$entry"

  echo "Création J$jour - $date - ${poids}g - ${dose}g x2..."

  curl -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"lot_id\": 1,
      \"date_gavage\": \"$date\",
      \"dose_matin\": $dose,
      \"dose_soir\": $dose,
      \"heure_gavage_matin\": \"08:30\",
      \"heure_gavage_soir\": \"18:30\",
      \"nb_canards_peses\": 10,
      \"poids_echantillon\": [$poids, $((poids+20)), $((poids+10)), $((poids-10)), $((poids+15)), $((poids-5)), $((poids+25)), $((poids-15)), $((poids+5)), $((poids-20))],
      \"temperature_stabule\": 22,
      \"humidite_stabule\": 65,
      \"suit_courbe_theorique\": true,
      \"remarques\": \"[RATTRAPAGE] Historique complété\"
    }" \
    -s | python -m json.tool | grep -E "(id|jour_gavage|alerte_generee)" | head -5

  echo "---"
done

echo "✅ Historique complété !"
