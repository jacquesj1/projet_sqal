"""
Module ML pour génération de courbes de gavage personnalisées

Sprint 3 - IA Courbes Optimales Individuelles
Date: 2026-01-15

Objectif: Recommander des courbes de gavage optimales par gaveur
basées sur leur profil de performance (cluster ML, ITM historique, etc.)
"""

import logging
from typing import Dict, List, Optional, Tuple
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class CourbesPersonnaliseesML:
    """
    Générateur de courbes de gavage personnalisées par profil gaveur
    """

    # Courbes de référence par cluster (11 jours, doses en grammes)
    COURBES_REFERENCE = {
        0: {  # Cluster Excellent (ITM ~13)
            "itm_cible": 13.0,
            "total_mais_cible": 10500,  # ~10.5 kg par canard
            "courbe": [
                {"jour": 1, "matin": 250, "soir": 300, "total": 550},
                {"jour": 2, "matin": 300, "soir": 350, "total": 650},
                {"jour": 3, "matin": 350, "soir": 400, "total": 750},
                {"jour": 4, "matin": 400, "soir": 450, "total": 850},
                {"jour": 5, "matin": 450, "soir": 500, "total": 950},
                {"jour": 6, "matin": 480, "soir": 520, "total": 1000},
                {"jour": 7, "matin": 500, "soir": 520, "total": 1020},
                {"jour": 8, "matin": 500, "soir": 500, "total": 1000},
                {"jour": 9, "matin": 480, "soir": 480, "total": 960},
                {"jour": 10, "matin": 450, "soir": 450, "total": 900},
                {"jour": 11, "matin": 400, "soir": 400, "total": 800}
            ]
        },
        1: {  # Cluster Très bon (ITM ~14)
            "itm_cible": 14.0,
            "total_mais_cible": 10000,
            "courbe": [
                {"jour": 1, "matin": 230, "soir": 280, "total": 510},
                {"jour": 2, "matin": 280, "soir": 330, "total": 610},
                {"jour": 3, "matin": 330, "soir": 380, "total": 710},
                {"jour": 4, "matin": 380, "soir": 430, "total": 810},
                {"jour": 5, "matin": 430, "soir": 480, "total": 910},
                {"jour": 6, "matin": 460, "soir": 500, "total": 960},
                {"jour": 7, "matin": 480, "soir": 500, "total": 980},
                {"jour": 8, "matin": 480, "soir": 480, "total": 960},
                {"jour": 9, "matin": 460, "soir": 460, "total": 920},
                {"jour": 10, "matin": 430, "soir": 430, "total": 860},
                {"jour": 11, "matin": 380, "soir": 380, "total": 760}
            ]
        },
        2: {  # Cluster Bon (ITM ~15)
            "itm_cible": 15.0,
            "total_mais_cible": 9500,
            "courbe": [
                {"jour": 1, "matin": 220, "soir": 270, "total": 490},
                {"jour": 2, "matin": 270, "soir": 320, "total": 590},
                {"jour": 3, "matin": 320, "soir": 370, "total": 690},
                {"jour": 4, "matin": 370, "soir": 420, "total": 790},
                {"jour": 5, "matin": 410, "soir": 460, "total": 870},
                {"jour": 6, "matin": 440, "soir": 480, "total": 920},
                {"jour": 7, "matin": 460, "soir": 480, "total": 940},
                {"jour": 8, "matin": 460, "soir": 460, "total": 920},
                {"jour": 9, "matin": 440, "soir": 440, "total": 880},
                {"jour": 10, "matin": 410, "soir": 410, "total": 820},
                {"jour": 11, "matin": 360, "soir": 360, "total": 720}
            ]
        },
        3: {  # Cluster À améliorer (ITM ~16)
            "itm_cible": 16.0,
            "total_mais_cible": 9000,
            "courbe": [
                {"jour": 1, "matin": 210, "soir": 260, "total": 470},
                {"jour": 2, "matin": 260, "soir": 310, "total": 570},
                {"jour": 3, "matin": 310, "soir": 360, "total": 670},
                {"jour": 4, "matin": 360, "soir": 410, "total": 770},
                {"jour": 5, "matin": 390, "soir": 440, "total": 830},
                {"jour": 6, "matin": 420, "soir": 460, "total": 880},
                {"jour": 7, "matin": 440, "soir": 460, "total": 900},
                {"jour": 8, "matin": 440, "soir": 440, "total": 880},
                {"jour": 9, "matin": 420, "soir": 420, "total": 840},
                {"jour": 10, "matin": 390, "soir": 390, "total": 780},
                {"jour": 11, "matin": 340, "soir": 340, "total": 680}
            ]
        },
        4: {  # Cluster Critique (ITM >17)
            "itm_cible": 15.5,  # Objectif réaliste, pas 17+
            "total_mais_cible": 8500,
            "courbe": [
                {"jour": 1, "matin": 200, "soir": 250, "total": 450},
                {"jour": 2, "matin": 250, "soir": 300, "total": 550},
                {"jour": 3, "matin": 300, "soir": 350, "total": 650},
                {"jour": 4, "matin": 350, "soir": 400, "total": 750},
                {"jour": 5, "matin": 380, "soir": 420, "total": 800},
                {"jour": 6, "matin": 400, "soir": 450, "total": 850},
                {"jour": 7, "matin": 420, "soir": 450, "total": 870},
                {"jour": 8, "matin": 420, "soir": 430, "total": 850},
                {"jour": 9, "matin": 400, "soir": 400, "total": 800},
                {"jour": 10, "matin": 380, "soir": 380, "total": 760},
                {"jour": 11, "matin": 350, "soir": 350, "total": 700}
            ]
        }
    }

    def __init__(self):
        self.courbes_reference = self.COURBES_REFERENCE

    def generer_courbe_personnalisee(
        self,
        cluster: int,
        itm_historique: float,
        mortalite_historique: float,
        nb_canards: int = 800,
        souche: str = "Mulard",
        ajustements_personnalises: Optional[Dict] = None
    ) -> Dict:
        """
        Génère une courbe de gavage personnalisée pour un gaveur

        Args:
            cluster: Cluster ML du gaveur (0-4)
            itm_historique: ITM moyen historique du gaveur
            mortalite_historique: Taux de mortalité historique (%)
            nb_canards: Nombre de canards du lot
            souche: Souche de canards
            ajustements_personnalises: Ajustements spécifiques (dict)

        Returns:
            Dict avec courbe générée et métadonnées
        """
        logger.info(f"Génération courbe pour cluster {cluster}, ITM hist {itm_historique:.2f}")

        # Récupérer courbe de référence du cluster
        if cluster not in self.courbes_reference:
            logger.warning(f"Cluster {cluster} inconnu, utilisation cluster 2 (défaut)")
            cluster = 2

        courbe_ref = self.courbes_reference[cluster].copy()
        courbe_base = [jour.copy() for jour in courbe_ref["courbe"]]

        # Ajustement 1: Adapter selon ITM historique
        # Si ITM historique > ITM cible cluster, réduire légèrement les doses
        # Si ITM historique < ITM cible cluster, augmenter légèrement les doses
        ecart_itm = itm_historique - courbe_ref["itm_cible"]
        facteur_ajustement = 1.0

        if abs(ecart_itm) > 0.5:  # Ajustement si écart significatif
            # Formule: pour chaque point d'ITM au-dessus, réduire doses de 3%
            # pour chaque point d'ITM en-dessous, augmenter doses de 3%
            facteur_ajustement = 1.0 - (ecart_itm * 0.03)
            # Limiter l'ajustement à ±15%
            facteur_ajustement = max(0.85, min(1.15, facteur_ajustement))
            logger.info(f"Ajustement ITM: {facteur_ajustement:.3f} (écart ITM: {ecart_itm:.2f})")

        # Ajustement 2: Adapter selon mortalité historique
        # Si mortalité élevée, courbe plus progressive (réduire début, augmenter fin)
        facteur_mortalite = 1.0
        if mortalite_historique > 2.0:  # Mortalité > 2%
            facteur_mortalite = 0.95  # Réduire agressivité de 5%
            logger.info(f"Mortalité élevée ({mortalite_historique:.1f}%), réduction agressivité")

        # Appliquer ajustements
        courbe_ajustee = []
        for jour_data in courbe_base:
            jour_num = jour_data["jour"]

            # Facteur progressif: plus conservateur en début si mortalité élevée
            if mortalite_historique > 2.0:
                # Jours 1-4: réduire plus, jours 8-11: réduire moins
                facteur_progressif = 0.90 if jour_num <= 4 else (0.95 if jour_num <= 7 else 1.0)
            else:
                facteur_progressif = 1.0

            # Combiner tous les facteurs
            facteur_total = facteur_ajustement * facteur_mortalite * facteur_progressif

            matin_ajuste = round(jour_data["matin"] * facteur_total)
            soir_ajuste = round(jour_data["soir"] * facteur_total)
            total_ajuste = matin_ajuste + soir_ajuste

            courbe_ajustee.append({
                "jour": jour_num,
                "matin": matin_ajuste,
                "soir": soir_ajuste,
                "total": total_ajuste
            })

        # Ajustements personnalisés optionnels
        if ajustements_personnalises:
            courbe_ajustee = self._appliquer_ajustements_personnalises(
                courbe_ajustee,
                ajustements_personnalises
            )

        # Calculer totaux
        total_mais = sum(j["total"] for j in courbe_ajustee)
        total_mais_lot = total_mais * nb_canards / 1000  # en kg

        # Estimer ITM cible pour cette courbe
        # ITM = total_mais / poids_foie
        # Hypothèse: poids foie moyen ~450g
        poids_foie_estime = 450  # grammes
        itm_estime = total_mais / poids_foie_estime

        return {
            "courbe": courbe_ajustee,
            "metadata": {
                "cluster": cluster,
                "itm_historique": round(itm_historique, 2),
                "itm_cible": round(itm_estime, 2),
                "mortalite_historique": round(mortalite_historique, 2),
                "nb_canards": nb_canards,
                "souche": souche,
                "total_mais_par_canard_g": total_mais,
                "total_mais_lot_kg": round(total_mais_lot, 2),
                "facteur_ajustement": round(facteur_ajustement, 3),
                "date_generation": datetime.now().isoformat(),
                "source": "ML"
            },
            "recommandations": self._generer_recommandations(
                cluster,
                itm_historique,
                mortalite_historique,
                courbe_ajustee
            )
        }

    def _appliquer_ajustements_personnalises(
        self,
        courbe: List[Dict],
        ajustements: Dict
    ) -> List[Dict]:
        """
        Applique des ajustements personnalisés à la courbe

        Exemples d'ajustements:
        - {"jour_5_boost": 50} -> +50g au jour 5
        - {"jours_1_3_reduction": 30} -> -30g jours 1-3
        """
        courbe_modifiee = [j.copy() for j in courbe]

        for key, valeur in ajustements.items():
            if key.startswith("jour_") and "_boost" in key:
                jour_num = int(key.split("_")[1])
                for jour in courbe_modifiee:
                    if jour["jour"] == jour_num:
                        jour["matin"] += valeur // 2
                        jour["soir"] += valeur // 2
                        jour["total"] += valeur
                        break

        return courbe_modifiee

    def _generer_recommandations(
        self,
        cluster: int,
        itm_historique: float,
        mortalite_historique: float,
        courbe: List[Dict]
    ) -> List[str]:
        """Génère des recommandations textuelles pour le gaveur"""
        recommandations = []

        # Recommandations basées sur cluster
        if cluster == 0:
            recommandations.append(
                "✅ Vous êtes dans le cluster EXCELLENT. Cette courbe aggressive "
                "maximise votre potentiel. Maintenez la régularité."
            )
        elif cluster == 4:
            recommandations.append(
                "⚠️ Courbe progressive adaptée à votre profil. Respectez scrupuleusement "
                "les doses pour améliorer votre ITM."
            )
        else:
            recommandations.append(
                "📊 Courbe optimisée pour votre profil de performance. "
                "Suivez-la rigoureusement pour progresser."
            )

        # Recommandations basées sur ITM
        if itm_historique > 16:
            recommandations.append(
                "🎯 Objectif: réduire votre ITM en dessous de 16. "
                "Contrôlez bien les doses et évitez le sous-gavage."
            )
        elif itm_historique < 14:
            recommandations.append(
                "🏆 Excellent ITM! Vous pouvez tenter une courbe plus aggressive "
                "pour maximiser la production."
            )

        # Recommandations basées sur mortalité
        if mortalite_historique > 2.5:
            recommandations.append(
                "🚨 Mortalité élevée détectée. Cette courbe est plus progressive "
                "pour réduire le stress. Surveillez l'état des canards."
            )
        elif mortalite_historique < 1.0:
            recommandations.append(
                "✨ Excellente maîtrise de la mortalité. "
                "Vous pouvez maintenir cette courbe."
            )

        # Recommandations générales
        total_j1_j3 = sum(j["total"] for j in courbe[:3])
        total_j9_j11 = sum(j["total"] for j in courbe[-3:])

        if total_j1_j3 < 1800:
            recommandations.append(
                "💡 Démarrage progressif (J1-J3). Laissez les canards s'habituer."
            )

        if total_j9_j11 < total_j1_j3:
            recommandations.append(
                "📉 Finition en décroissance (J9-J11). Normal pour optimiser le foie."
            )

        return recommandations

    def comparer_courbes(
        self,
        courbe_recommandee: List[Dict],
        courbe_standard: List[Dict]
    ) -> Dict:
        """
        Compare une courbe recommandée vs courbe standard

        Returns:
            Dict avec métriques de comparaison
        """
        total_recommande = sum(j["total"] for j in courbe_recommandee)
        total_standard = sum(j["total"] for j in courbe_standard)

        ecart_total = total_recommande - total_standard
        ecart_pct = (ecart_total / total_standard * 100) if total_standard > 0 else 0

        # Identifier les jours avec plus grandes différences
        differences_par_jour = []
        for i, (jr, js) in enumerate(zip(courbe_recommandee, courbe_standard)):
            ecart = jr["total"] - js["total"]
            differences_par_jour.append({
                "jour": i + 1,
                "ecart_g": ecart,
                "recommande": jr["total"],
                "standard": js["total"]
            })

        # Trier par écart absolu
        differences_par_jour.sort(key=lambda x: abs(x["ecart_g"]), reverse=True)

        return {
            "total_recommande_g": total_recommande,
            "total_standard_g": total_standard,
            "ecart_total_g": ecart_total,
            "ecart_pct": round(ecart_pct, 2),
            "top_3_differences": differences_par_jour[:3],
            "interpretation": (
                "Courbe plus aggressive" if ecart_total > 0 else
                "Courbe plus conservative" if ecart_total < 0 else
                "Courbe identique"
            )
        }


# Fonction utilitaire pour usage externe
def recommander_courbe_gaveur(
    gaveur_data: Dict,
    nb_canards: int = 800,
    souche: str = "Mulard"
) -> Dict:
    """
    Recommande une courbe de gavage pour un gaveur

    Args:
        gaveur_data: Dict avec cluster, itm_moyen, mortalite, etc.
        nb_canards: Nombre de canards du lot
        souche: Souche de canards

    Returns:
        Dict avec courbe recommandée et métadonnées
    """
    ml = CourbesPersonnaliseesML()

    cluster = gaveur_data.get("cluster", 2)
    itm_historique = gaveur_data.get("itm_moyen", 15.0)
    mortalite_historique = gaveur_data.get("mortalite", 1.5)

    return ml.generer_courbe_personnalisee(
        cluster=cluster,
        itm_historique=itm_historique,
        mortalite_historique=mortalite_historique,
        nb_canards=nb_canards,
        souche=souche
    )
