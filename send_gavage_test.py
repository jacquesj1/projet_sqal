#!/usr/bin/env python3
"""
Script de test pour envoyer des données de gavage au WebSocket backend
Simule un gavage en temps réel de Jean Martin
"""

import asyncio
import websockets
import json
from datetime import datetime

async def send_gavage_data():
    uri = "ws://localhost:8000/ws/gavage"

    # Données de gavage de Jean Martin (format GavageRealtimeMessage)
    gavage_message = {
        "code_lot": "LL_JM_2024_01",
        "gaveur_id": 1,
        "gaveur_nom": "Jean Martin",
        "site": "LL",
        "genetique": "Grimaud",
        "jour": 6,
        "moment": "matin",
        "dose_reelle": 175.5,
        "poids_moyen": 520.5,
        "nb_canards_vivants": 148,
        "taux_mortalite": 1.33,
        "pret_abattage": False
    }

    try:
        print(f"[*] Connexion au WebSocket {uri}...")
        async with websockets.connect(uri) as websocket:
            print("[OK] Connecte au backend!")

            # Envoyer le message
            print(f"\n[+] Envoi des donnees de gavage:")
            print(json.dumps(gavage_message, indent=2))

            await websocket.send(json.dumps(gavage_message))
            print("\n[OK] Message envoye!")

            # Attendre confirmation
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"\n[<-] Reponse du backend: {response}")
            except asyncio.TimeoutError:
                print("\n[i] Pas de reponse (timeout) - C'est normal")

            # Envoyer un deuxième gavage (soir)
            await asyncio.sleep(2)

            gavage_message["moment"] = "soir"
            gavage_message["jour"] = 5
            gavage_message["dose_reelle"] = 172.0
            gavage_message["poids_moyen"] = 515.2

            print(f"\n[+] Envoi d'un second gavage (soir):")
            await websocket.send(json.dumps(gavage_message))
            print("[OK] Second message envoye!")

            await asyncio.sleep(2)

    except ConnectionRefusedError:
        print("[ERROR] Erreur: Impossible de se connecter au WebSocket backend")
        print("        Verifiez que le backend est demarre: docker-compose ps backend")
    except Exception as e:
        print(f"[ERROR] Erreur: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print(" Simulateur de Gavage Temps Reel - Jean Martin")
    print("=" * 60)
    print()

    asyncio.run(send_gavage_data())

    print()
    print("=" * 60)
    print("[OK] Termine!")
    print()
    print("[>>] Verifiez le dashboard Euralis:")
    print("     http://localhost:3000/euralis/dashboard")
    print()
    print("     Section: 'Supervision Temps Reel Multi-Sites'")
    print("     Vous devriez voir le gavage de Jean Martin (Site LL)")
    print("=" * 60)
