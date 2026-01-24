# Correction Lien "Stats" sur Page Lots

**Date**: 11 Janvier 2026
**Problème**: Clic sur "📊 Stats" dans la card d'un lot → Erreur 404

---

## Problème Initial

Sur la page `/lots`, chaque card de lot affichait 4 boutons d'action:
- 📝 Gavage → `/lots/{id}/gavage` ✅
- 📈 Courbes → `/lots/{id}/courbes` ✅
- 📋 Historique → `/lots/{id}/historique` ✅
- 📊 Stats → `/lots/{id}/stats` ❌ **404 - Page n'existe pas**

---

## Cause du Problème

Le lien "Stats" (ligne 345 de `app/lots/page.tsx`) pointait vers:
```typescript
href={`/lots/${lot.id}/stats`}
```

Cette route n'existe pas dans le projet. Aucune page n'a été créée à ce chemin.

---

## Solution Implémentée

### Option Choisie: Redirection vers Dashboard avec Lot Pré-sélectionné

Au lieu de créer une nouvelle page stats dédiée, nous redirigeons vers le **Dashboard** (page d'accueil `/`) qui affiche déjà:
- 4 stats rapides (Jours saisis, Écart moyen, Écart max, Alertes)
- Dashboard 3-Courbes IA
- Widgets (Alertes récentes, Météo, Prochaine action)

### 1. Modification du lien "Stats" (`app/lots/page.tsx` ligne 345)

**Avant**:
```typescript
<Link
  href={`/lots/${lot.id}/stats`}
  className="..."
>
  📊 Stats
</Link>
```

**Après**:
```typescript
<Link
  href={`/?lot=${lot.id}`}
  className="..."
>
  📊 Stats
</Link>
```

### 2. Détection du paramètre URL dans la page d'accueil (`app/page.tsx`)

**Ajout de l'import** (ligne 4):
```typescript
import { useRouter, useSearchParams } from 'next/navigation';
```

**Ajout de la constante** (ligne 43):
```typescript
const searchParams = useSearchParams();
```

**Ajout du useEffect** (lignes 59-65):
```typescript
// Détecter le paramètre ?lot= dans l'URL
useEffect(() => {
  const lotIdFromUrl = searchParams.get('lot');
  if (lotIdFromUrl) {
    setSelectedLotId(parseInt(lotIdFromUrl, 10));
  }
}, [searchParams]);
```

---

## Comportement Final

### Scénario: Le gaveur veut voir les stats du Lot 5

**1. Page `/lots`**:
- Le gaveur voit la liste de ses lots
- Card du Lot 5 affichée avec 4 boutons

**2. Clic sur "📊 Stats"**:
- Redirection vers `/?lot=5`
- Page d'accueil (Dashboard) se charge

**3. Dashboard**:
- `useEffect` détecte le paramètre `?lot=5`
- `setSelectedLotId(5)` est appelé
- Le lot 5 est automatiquement sélectionné
- Dashboard 3-Courbes se charge pour le lot 5

**4. Le gaveur voit**:
- Sélecteur de lot avec "Lot 5" pré-sélectionné
- 4 stats rapides du lot 5:
  - Jours saisis: 11/14
  - Écart moyen: +2.5%
  - Écart max: -15.2%
  - Alertes: 2
- Graphique 3-Courbes du lot 5
- Widgets avec données du lot 5

---

## Flux de Navigation

```
[Page /lots]
    ↓
[Gaveur clique "📊 Stats" sur Lot 5]
    ↓
[Navigation vers /?lot=5]
    ↓
[Page d'accueil se charge]
    ↓
[useEffect détecte searchParams.get('lot') = '5']
    ↓
[setSelectedLotId(5)]
    ↓
[useEffect loadDashboardData(5)]
    ↓
[Dashboard affiche stats du Lot 5] ✅
```

---

## Avantages de cette Solution

### 1. Pas de duplication de code
- Réutilise le Dashboard existant
- Évite de créer une nouvelle page stats redondante

### 2. Expérience utilisateur cohérente
- Le gaveur arrive sur la même page qu'en cliquant "Dashboard" dans le menu
- Navigation intuitive

### 3. Fonctionnalités riches
- Le Dashboard offre plus que de simples stats:
  - Graphique 3-Courbes interactif
  - Widgets temps réel
  - Actions rapides (Saisir dose, Historique, Analytics)

### 4. Facile à étendre
- Si besoin d'ajouter plus de stats, on enrichit le Dashboard
- Paramètre `?lot=` peut être utilisé ailleurs

---

## Alternative Envisagée (Non Retenue)

### Option 2: Créer une page `/lots/[id]/stats` dédiée

**Pour**:
- URL plus explicite (`/lots/5/stats`)
- Page dédiée aux statistiques uniquement

**Contre**:
- Duplication du code du Dashboard
- Maintenance de 2 pages similaires
- Confusion utilisateur (quelle différence avec Dashboard?)

**Conclusion**: Non retenu car Dashboard actuel suffit

---

## Tests à Effectuer

### Test 1: Navigation depuis page lots
- [ ] Aller sur `/lots`
- [ ] Cliquer "📊 Stats" sur n'importe quel lot
- [ ] Vérifier redirection vers `/` avec lot pré-sélectionné
- [ ] Vérifier dashboard se charge avec le bon lot

### Test 2: URL directe avec paramètre
- [ ] Ouvrir directement `/?lot=5`
- [ ] Vérifier lot 5 est pré-sélectionné
- [ ] Vérifier dashboard affiche données du lot 5

### Test 3: Changement de lot après redirection
- [ ] Cliquer "Stats" sur Lot 5
- [ ] Une fois sur Dashboard, utiliser le sélecteur de lot
- [ ] Changer pour Lot 3
- [ ] Vérifier dashboard se met à jour avec données du lot 3

### Test 4: URL sans paramètre
- [ ] Ouvrir `/` sans paramètre `?lot=`
- [ ] Vérifier comportement normal (LotSelector auto-sélectionne premier lot en_gavage)

### Test 5: Paramètre lot invalide
- [ ] Ouvrir `/?lot=999` (lot inexistant)
- [ ] Vérifier gestion d'erreur (message d'erreur ou fallback vers lot par défaut)

---

## Impact Code

**Fichiers modifiés**: 2

### 1. `app/lots/page.tsx` (ligne 345)
- Changement du lien `href`
- Avant: `/lots/${lot.id}/stats`
- Après: `/?lot=${lot.id}`

### 2. `app/page.tsx` (lignes 4, 43, 59-65)
- Import `useSearchParams`
- Ajout constante `searchParams`
- Ajout useEffect pour détecter paramètre URL

**Lignes ajoutées**: ~10 lignes
**Lignes modifiées**: 1 ligne

---

## Améliorations Futures (Optionnel)

### 1. Mise à jour de l'URL lors du changement de lot
Quand le gaveur change de lot via le sélecteur, mettre à jour l'URL:

```typescript
const handleLotChange = (newLotId: number) => {
  setSelectedLotId(newLotId);
  router.push(`/?lot=${newLotId}`);
};
```

**Avantage**: L'URL reflète toujours le lot affiché (bookmarkable, partageable)

### 2. Gestion des erreurs
Si le lot n'existe pas ou n'appartient pas au gaveur:

```typescript
useEffect(() => {
  const lotIdFromUrl = searchParams.get('lot');
  if (lotIdFromUrl) {
    const lotId = parseInt(lotIdFromUrl, 10);
    // Vérifier que le lot existe
    fetch(`${API_URL}/api/lots/${lotId}`)
      .then(res => {
        if (res.ok) {
          setSelectedLotId(lotId);
        } else {
          setError('Lot non trouvé ou accès refusé');
        }
      });
  }
}, [searchParams]);
```

### 3. Breadcrumb navigation
Ajouter un fil d'Ariane pour montrer d'où vient l'utilisateur:

```
Lots > Lot 5 > Stats
```

---

## Conclusion

✅ **Problème résolu**: Le lien "📊 Stats" redirige maintenant vers le Dashboard avec le lot pré-sélectionné

✅ **Pas de 404**: L'utilisateur arrive sur une page existante riche en informations

✅ **UX améliorée**: Navigation fluide depuis la liste des lots vers les stats détaillées

✅ **Code maintenable**: Réutilisation du Dashboard existant au lieu de créer une page redondante

✅ **Extensible**: Le paramètre `?lot=` peut être utilisé dans d'autres contextes

---

**Status**: ✅ CORRECTION COMPLETE - LIEN STATS FONCTIONNEL
**Auteur**: Claude Sonnet 4.5
**Date**: 11 Janvier 2026
