# Positions Géographiques Correctes

Basé sur la carte fournie (image avec les 6 points numérotés):

## Sites Euralis Réels

1. **LL - Lantic** (Bretagne, Côtes-d'Armor)
   - Point 6 sur la carte
   - Position: Extrême Nord-Ouest (côte Bretagne)
   - SVG: `x: 150, y: 220`

2. **LS - La Séguinière** (Pays de la Loire, Maine-et-Loire)
   - Point 5 sur la carte  
   - Position: Ouest-Centre (entre Bretagne et Sud-Ouest)
   - SVG: `x: 220, y: 350`

3. **MT - Maubourguet** (Hautes-Pyrénées, près Pau)
   - Point 4 sur la carte
   - Position: Sud-Ouest (frontière espagnole)
   - SVG: `x: 280, y: 540`

## Positions pour SVG viewBox="0 0 800 700"

```javascript
const sitesPositions = [
  { x: 150, y: 220, name: 'LL', ville: 'Lantic', region: 'Bretagne' },
  { x: 220, y: 350, name: 'LS', ville: 'La Séguinière', region: 'Pays de la Loire' },
  { x: 280, y: 540, name: 'MT', ville: 'Maubourguet', region: 'Hautes-Pyrénées' }
];
```
