# TODO

## En cours

- Phase 2 migration SQAL ORM: basculer lectures/endpoints vers ORM + déprécier l'ancien stockage.

## À faire (priorité haute)

- Phase 3 ML SQAL (vrai modèle): chargement modèle depuis /models + feature extraction depuis sensor_samples + sélection ai_models actif + écriture predictions + endpoint predict stable.
- Nettoyer les secrets/exemples bloquants (Push Protection): supprimer/placeholder webhooks, ne pas versionner .env* sensibles, garder uniquement .env.example.

## À faire (priorité medium)

- Phase 2 (suite): retirer le double-write et déprécier/archiver l'ancien schéma sqal_sensor_samples après validation (feature flag / migration).

## À faire (à planifier)

- Mettre à jour front SQAL pour intégrer l'affichage/usage ML (après migration endpoints).
- Mettre à jour ./Presentation pour inclure partie ML + approche technique (après stabilisation API).
