# Guide Pytest (Windows / venv)

Ce document explique comment exécuter les tests `pytest` sur ce projet, en particulier sous Windows avec un environnement virtuel.

## 1) Pré-requis

### 1.1 Vérifier que l’on est bien dans le venv

Depuis le terminal (celui qui affiche par ex. `(venvW)`):

```powershell
python -c "import sys; print(sys.executable)"
python -m pip --version
```

Les chemins doivent pointer vers `...\\venvW\\...`.

### 1.2 Installer les dépendances de tests

Ce repo utilise des options dans `pytest.ini` qui nécessitent des plugins.

Installer les dépendances minimales (dans le venv) :

```powershell
python -m pip install pytest pytest-cov pytest-asyncio
```

Dépendances optionnelles (selon les tests) :

```powershell
python -m pip install httpx
```

## 2) Lancer pytest

Recommandation sous Windows : utiliser `python -m pytest` plutôt que `pytest` (moins de problèmes de PATH).

### 2.1 Lancer tous les tests

Depuis la racine :

```powershell
python -m pytest
```

En mode silencieux :

```powershell
python -m pytest -q
```

## 3) Comprendre `pytest.ini`

Le repo a un `pytest.ini` à la racine.

### 3.1 Options `addopts` (coverage / asyncio)

Si `pytest` affiche :

- `unrecognized arguments: --cov=...` → il manque `pytest-cov`
- `unrecognized arguments: --asyncio-mode=auto` → il manque `pytest-asyncio`

### 3.2 Bypasser temporairement les options `addopts`

Pour lancer des tests sans appliquer les options définies dans `pytest.ini` :

```powershell
python -m pytest -q -o addopts=
```

## 4) Sélectionner / exclure des tests

### 4.1 Exclure des catégories par mots-clés

Exemple : exclure les tests websocket et e2e :

```powershell
python -m pytest -q -k "not websocket and not e2e"
```

### 4.2 Exécuter un fichier ou un test spécifique

```powershell
python -m pytest -q tests/websocket/test_websocket_flow.py
python -m pytest -q tests/websocket/test_websocket_flow.py::test_all_websocket_flows
```

### 4.3 Marqueurs

Si des tests utilisent des markers (`@pytest.mark...`), on peut filtrer via `-m`.

Exemple générique :

```powershell
python -m pytest -q -m "not e2e"
```

## 5) Notes sur les tests WebSocket

Plusieurs échecs ont été observés sur `tests/websocket/test_websocket_flow.py` avec un message de type :

- attendu : `pong` / `ack` / `error`
- reçu : `connection_established`

Interprétation typique :

- le serveur WebSocket envoie un message de handshake `connection_established` au connect
- les tests attendent directement `pong` / `ack` (sans ignorer le handshake)

Approches possibles :

- adapter les tests pour ignorer le 1er message `connection_established`
- ou adapter le serveur pour répondre au connect par `pong`

Ces tests peuvent être considérés hors-scope si on valide une feature backend non liée au WebSocket.

## 6) Coverage : warnings fréquents

Warnings possibles :

- `Module backend/app was never imported`
- `No data was collected`

Cause fréquente : le chemin passé à `--cov=...` ne correspond pas exactement à l’arborescence importée.

Dans ce projet, le code backend est sous `backend-api/app/...`. Si `pytest.ini` fait référence à un chemin différent, le coverage peut être vide.

Pour investiguer :

- vérifier `pytest.ini`
- lancer un test qui importe réellement l’application
- ou ajuster le `--cov=` pour pointer vers le bon package importé

## 7) Dépannage rapide

- Si `pytest` n’est pas reconnu :

```powershell
python -m pytest -q
```

- Si `httpx` manque :

```powershell
python -m pip install httpx
```

- Si tu veux un run “simple” sans coverage/config :

```powershell
python -m pytest -q -o addopts=
```
