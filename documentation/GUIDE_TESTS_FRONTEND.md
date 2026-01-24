# 📘 Guide Complet - Tests Frontend

**Date**: 25 décembre 2024
**Objectif**: Comprendre et utiliser les tests frontend Jest + React Testing Library

---

## 📚 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Comment ça fonctionne](#comment-ça-fonctionne)
3. [Structure des tests](#structure-des-tests)
4. [Exécuter les tests](#exécuter-les-tests)
5. [Écrire de nouveaux tests](#écrire-de-nouveaux-tests)
6. [Exemples pratiques](#exemples-pratiques)
7. [Troubleshooting](#troubleshooting)

---

## 📖 Vue d'ensemble

### Qu'est-ce que c'est?

Les **tests frontend** vérifient automatiquement que vos composants React, services API, et fonctions utilitaires fonctionnent correctement.

**110+ tests créés** couvrant:
- ✅ **Composants UI** (boutons, cartes, spinners, filtres)
- ✅ **Charts** (graphiques temps réel, spectral)
- ✅ **Services** (API, WebSocket)
- ✅ **Utilities** (fonctions helpers)

### Technologies utilisées

1. **Jest** - Framework de test JavaScript
2. **React Testing Library (RTL)** - Bibliothèque pour tester composants React
3. **TypeScript** - Support typage
4. **jsdom** - Simule un navigateur dans Node.js

### Pourquoi c'est important?

✅ **Détection bugs** - Trouve les erreurs avant la production
✅ **Documentation vivante** - Les tests montrent comment utiliser le code
✅ **Refactoring confiant** - Modifiez le code sans casser les fonctionnalités
✅ **Qualité code** - Force à écrire du code testable (meilleur design)

---

## 🔍 Comment ça fonctionne

### Architecture des tests

```
┌─────────────────────────────────────────────────────────┐
│                    VOTRE APPLICATION                     │
│  (Composants React, Services, Utilities)                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    TESTS JEST                            │
│  - Importent vos composants/services                    │
│  - Les testent isolément                                │
│  - Vérifient le comportement attendu                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    MOCKS                                 │
│  - Simulent APIs externes (fetch, WebSocket)            │
│  - Simulent dépendances (Recharts, Next.js)             │
│  - Permettent tests rapides et isolés                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    RÉSULTATS                             │
│  ✅ Tests passés: 110+                                   │
│  ❌ Tests échoués: 0                                     │
│  📊 Coverage: 50-55%                                     │
└─────────────────────────────────────────────────────────┘
```

### Cycle de vie d'un test

```javascript
describe('Component/Service Name', () => {
  // 1️⃣ SETUP - Avant chaque test
  beforeEach(() => {
    jest.clearAllMocks() // Reset les mocks
  })

  // 2️⃣ TEST - Tester un comportement
  it('should render correctly', () => {
    // ARRANGE - Préparer le test
    const props = { title: 'Test' }

    // ACT - Exécuter l'action
    render(<Component {...props} />)

    // ASSERT - Vérifier le résultat
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  // 3️⃣ CLEANUP - Après chaque test
  afterEach(() => {
    // Nettoyage automatique par RTL
  })
})
```

---

## 🏗️ Structure des tests

### Organisation des fichiers

```
sqal/FrontEnd/
├── jest.config.js              # ⚙️ Configuration Jest
├── jest.setup.ts               # 🔧 Mocks globaux
├── __mocks__/
│   └── fileMock.js             # 🖼️ Mock images/SVG
├── run_tests.sh                # 🐧 Script Linux/Mac
├── run_tests.bat               # 🪟 Script Windows
└── src/
    ├── components/
    │   └── common/
    │       ├── LoadingSpinner.tsx          # Composant
    │       └── __tests__/
    │           └── LoadingSpinner.test.tsx # ✅ Tests
    ├── services/
    │   ├── api.ts                          # Service
    │   └── __tests__/
    │       └── api.test.ts                 # ✅ Tests
    └── lib/
        ├── utils.ts                        # Utilities
        └── __tests__/
            └── utils.test.ts               # ✅ Tests
```

**Convention**: Fichiers tests sont dans `__tests__/` à côté du code source

### Configuration Jest (jest.config.js)

```javascript
export default {
  preset: 'ts-jest',                    // Support TypeScript
  testEnvironment: 'jsdom',             // Simule navigateur
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Mocks globaux

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',     // Alias @/
    '\\.(css|scss)$': 'identity-obj-proxy', // Mock CSS
  },

  coverageThresholds: {
    global: {
      branches: 70,                      // 70% branches couvertes
      functions: 70,                     // 70% fonctions testées
      lines: 70,                         // 70% lignes exécutées
      statements: 70,                    // 70% statements testés
    },
  },
}
```

### Mocks globaux (jest.setup.ts)

Les mocks simulent des dépendances externes pour que les tests soient rapides et isolés.

```typescript
// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
)

// Mock WebSocket
global.WebSocket = class WebSocket {
  send = jest.fn()
  close = jest.fn()
  addEventListener = jest.fn()
  readyState = 1 // OPEN
} as any

// Mock Canvas (pour charts)
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  // ... autres méthodes
})) as any
```

---

## 🚀 Exécuter les tests

### Méthode 1: Scripts automatisés (Recommandé)

**Linux/Mac**:
```bash
cd sqal/FrontEnd

# Tous les tests
./run_tests.sh all

# Tests par catégorie
./run_tests.sh unit           # Tests unitaires
./run_tests.sh components     # Tests composants
./run_tests.sh services       # Tests services

# Coverage HTML
./run_tests.sh coverage       # Génère coverage/index.html

# Mode watch (auto-reload)
./run_tests.sh watch

# Aide
./run_tests.sh help
```

**Windows**:
```cmd
cd sqal\FrontEnd

# Tous les tests
run_tests.bat all

# Coverage HTML
run_tests.bat coverage

# Aide
run_tests.bat help
```

### Méthode 2: npm scripts

```bash
cd sqal/FrontEnd

# Installer dépendances
npm install

# Tous les tests
npm test

# Mode watch
npm run test:watch

# Coverage
npm test -- --coverage
```

### Méthode 3: Jest CLI directe

```bash
cd sqal/FrontEnd

# Activer environnement
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Test fichier spécifique
npm test -- src/components/common/__tests__/LoadingSpinner.test.tsx

# Test avec pattern
npm test -- --testPathPattern="LoadingSpinner"

# Verbose mode
npm test -- --verbose

# Update snapshots
npm test -- -u
```

---

## ✍️ Écrire de nouveaux tests

### Template de base

```typescript
/**
 * Tests - ComponentName
 * Description de ce qui est testé
 */

import { render, screen } from '@testing-library/react'
import { ComponentName } from '../ComponentName'

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />)

    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })

  it('should handle props', () => {
    render(<ComponentName title="Test Title" />)

    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('should handle edge cases', () => {
    render(<ComponentName data={[]} />)

    expect(screen.queryByText('No data')).toBeInTheDocument()
  })
})
```

### Queries React Testing Library

```typescript
// Préféré (accessible)
screen.getByRole('button')              // Bouton
screen.getByLabelText('Email')          // Input avec label
screen.getByPlaceholderText('Search')   // Input placeholder
screen.getByText('Submit')              // Texte visible

// Alternatifs
screen.getByTestId('custom-element')    // data-testid
screen.getByAltText('Logo')             // Image alt

// Queries async
await screen.findByText('Loaded')       // Attend apparition

// Queries optional
screen.queryByText('Optional')          // null si absent
```

### Matchers Jest communs

```typescript
// Valeurs
expect(value).toBe(5)                   // Égalité stricte
expect(value).toEqual({ a: 1 })         // Égalité profonde
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeTruthy()
expect(value).toBeFalsy()

// Nombres
expect(value).toBeGreaterThan(10)
expect(value).toBeLessThan(100)
expect(value).toBeCloseTo(3.14, 2)      // Précision 2 décimales

// Strings
expect(str).toContain('substring')
expect(str).toMatch(/regex/)

// Arrays
expect(arr).toHaveLength(3)
expect(arr).toContain(item)

// DOM
expect(element).toBeInTheDocument()
expect(element).toBeVisible()
expect(element).toHaveClass('active')
expect(element).toHaveAttribute('disabled')
expect(input).toHaveValue('test')

// Functions
expect(fn).toHaveBeenCalled()
expect(fn).toHaveBeenCalledWith(arg1, arg2)
expect(fn).toHaveBeenCalledTimes(2)
```

### Tester événements utilisateur

```typescript
import { render, screen, fireEvent } from '@testing-library/react'

it('should handle button click', () => {
  const handleClick = jest.fn()

  render(<Button onClick={handleClick}>Click me</Button>)

  const button = screen.getByRole('button')
  fireEvent.click(button)

  expect(handleClick).toHaveBeenCalledTimes(1)
})

it('should handle input change', () => {
  render(<Input />)

  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'new value' } })

  expect(input).toHaveValue('new value')
})
```

### Tester code async

```typescript
import { render, screen, waitFor } from '@testing-library/react'

it('should load data', async () => {
  render(<AsyncComponent />)

  // Attendre que le texte apparaisse
  const text = await screen.findByText('Loaded data')
  expect(text).toBeInTheDocument()
})

it('should handle async action', async () => {
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: 'test' })
  })

  global.fetch = mockFetch

  render(<Component />)

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalled()
  })
})
```

---

## 💡 Exemples pratiques

### Exemple 1: Tester un composant simple

**Composant** (`LoadingSpinner.tsx`):
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  return (
    <div>
      <div className={`spinner ${size}`} />
      {message && <p>{message}</p>}
    </div>
  )
}
```

**Tests** (`LoadingSpinner.test.tsx`):
```typescript
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    const { container } = render(<LoadingSpinner />)

    const spinner = container.querySelector('.spinner')
    expect(spinner).toHaveClass('md')
  })

  it('renders with custom size', () => {
    const { container } = render(<LoadingSpinner size="lg" />)

    const spinner = container.querySelector('.spinner')
    expect(spinner).toHaveClass('lg')
  })

  it('renders message when provided', () => {
    render(<LoadingSpinner message="Loading..." />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('does not render message when not provided', () => {
    const { container } = render(<LoadingSpinner />)

    const message = container.querySelector('p')
    expect(message).not.toBeInTheDocument()
  })
})
```

**Résultat**:
```
✓ renders with default size (15ms)
✓ renders with custom size (8ms)
✓ renders message when provided (12ms)
✓ does not render message when not provided (6ms)

Tests: 4 passed, 4 total
```

### Exemple 2: Tester un service API

**Service** (`api.ts`):
```typescript
export const api = {
  get: <T>(url: string): Promise<T> =>
    fetch(url).then(res => res.json()),

  post: <T>(url: string, data: any): Promise<T> =>
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(res => res.json()),
}
```

**Tests** (`api.test.ts`):
```typescript
describe('API Service', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('performs GET request', async () => {
    const mockData = { id: 1, name: 'Test' }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    })

    const result = await api.get('/test')

    expect(global.fetch).toHaveBeenCalledWith('/test')
    expect(result).toEqual(mockData)
  })

  it('performs POST request', async () => {
    const postData = { name: 'New Item' }
    const mockResponse = { id: 2, ...postData }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await api.post('/create', postData)

    expect(global.fetch).toHaveBeenCalledWith(
      '/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(postData),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('handles errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    )

    await expect(api.get('/test')).rejects.toThrow('Network error')
  })
})
```

### Exemple 3: Tester WebSocket

**Service** (`websocket.ts`):
```typescript
class WebSocketService {
  private ws: WebSocket | null = null

  connect(url: string) {
    this.ws = new WebSocket(url)
    this.ws.onopen = () => console.log('Connected')
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect() {
    this.ws?.close()
  }
}
```

**Tests** (`websocket.test.ts`):
```typescript
// Mock WebSocket
class MockWebSocket {
  readyState = MockWebSocket.OPEN
  static OPEN = 1

  send = jest.fn()
  close = jest.fn()
  onopen: (() => void) | null = null

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 10)
  }
}

global.WebSocket = MockWebSocket as any

describe('WebSocket Service', () => {
  let wsService: WebSocketService

  beforeEach(() => {
    wsService = new WebSocketService()
    jest.useFakeTimers()
  })

  afterEach(() => {
    wsService.disconnect()
    jest.useRealTimers()
  })

  it('connects to WebSocket server', () => {
    wsService.connect('ws://localhost:8000')

    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8000')
  })

  it('sends message when connected', () => {
    wsService.connect('ws://localhost:8000')
    jest.advanceTimersByTime(20) // Wait for connection

    wsService.send({ type: 'test', data: 'hello' })

    const mockWs = (global.WebSocket as any).mock.instances[0]
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test', data: 'hello' })
    )
  })

  it('disconnects from server', () => {
    wsService.connect('ws://localhost:8000')
    jest.advanceTimersByTime(20)

    wsService.disconnect()

    const mockWs = (global.WebSocket as any).mock.instances[0]
    expect(mockWs.close).toHaveBeenCalled()
  })
})
```

---

## 🐛 Troubleshooting

### Problème: Tests ne passent pas

**Erreur**: `Cannot find module '@/components/...'`

**Solution**: Vérifier `jest.config.js`:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

---

**Erreur**: `Not implemented: HTMLFormElement.prototype.submit`

**Solution**: Ajouter mock dans `jest.setup.ts`:
```typescript
HTMLFormElement.prototype.submit = jest.fn()
```

---

**Erreur**: `Cannot read property 'getContext' of null`

**Solution**: Mock Canvas déjà dans `jest.setup.ts`:
```typescript
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
})) as any
```

---

### Problème: Tests lents

**Cause**: Trop de re-renders ou tests non isolés

**Solutions**:
1. Utiliser `beforeEach` pour reset state
2. Mocker dépendances lourdes
3. Éviter tests E2E dans tests unitaires

```typescript
beforeEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})
```

---

### Problème: Coverage faible

**Vérifier coverage**:
```bash
./run_tests.sh coverage
# Ouvrir: coverage/index.html
```

**Identifier gaps**:
- Lignes rouges = non couvertes
- Lignes jaunes = partiellement couvertes
- Lignes vertes = couvertes

**Augmenter coverage**:
1. Tester edge cases (null, undefined, empty)
2. Tester error paths (try/catch)
3. Tester conditions (if/else)
4. Tester loops (forEach, map)

---

### Problème: Tests flaky (intermittents)

**Causes communes**:
- Timers non mockés
- Promises non attendues
- State partagé entre tests

**Solutions**:
```typescript
// Mock timers
jest.useFakeTimers()
jest.advanceTimersByTime(1000)
jest.useRealTimers()

// Await promises
await waitFor(() => {
  expect(element).toBeInTheDocument()
})

// Isoler tests
beforeEach(() => {
  jest.clearAllMocks()
  // Reset state
})
```

---

## 📊 Comprendre le Coverage Report

### Ouvrir le rapport

```bash
cd sqal/FrontEnd
./run_tests.sh coverage
# Ouvrir: coverage/index.html dans navigateur
```

### Métriques expliquées

```
| File         | % Stmts | % Branch | % Funcs | % Lines |
|--------------|---------|----------|---------|---------|
| api.ts       | 85.71   | 75.00    | 100.00  | 85.71   |
```

- **% Stmts** (Statements): Pourcentage d'instructions exécutées
- **% Branch** (Branches): Pourcentage de branches (if/else) testées
- **% Funcs** (Functions): Pourcentage de fonctions appelées
- **% Lines** (Lines): Pourcentage de lignes exécutées

**Objectif**: 70% minimum pour chaque métrique

### Couleurs dans HTML

- 🟢 **Vert** (> 80%): Excellente couverture
- 🟡 **Jaune** (50-80%): Couverture acceptable
- 🔴 **Rouge** (< 50%): Couverture insuffisante

---

## 🎯 Best Practices

### ✅ DO (Bonnes pratiques)

```typescript
// ✅ Tester le comportement, pas l'implémentation
it('should submit form', () => {
  render(<Form />)
  fireEvent.click(screen.getByText('Submit'))
  expect(mockSubmit).toHaveBeenCalled()
})

// ✅ Utiliser queries accessibles
screen.getByRole('button', { name: 'Submit' })

// ✅ Tester edge cases
it('handles empty data', () => {
  render(<List items={[]} />)
  expect(screen.getByText('No items')).toBeInTheDocument()
})

// ✅ Noms descriptifs
it('should display error message when email is invalid', () => {
  // ...
})

// ✅ Arrange-Act-Assert
it('test name', () => {
  // Arrange
  const props = { ... }

  // Act
  render(<Component {...props} />)

  // Assert
  expect(...).toBe(...)
})
```

### ❌ DON'T (À éviter)

```typescript
// ❌ Tester détails d'implémentation
it('should call setState', () => {
  // Interne au composant, peut changer
})

// ❌ Queries fragiles
screen.getByTestId('submit-btn-123') // Peut changer

// ❌ Tests trop larges
it('should do everything', () => {
  // Tester 1 chose par test
})

// ❌ Noms vagues
it('works correctly', () => {
  // Trop vague, pas clair
})

// ❌ Snapshot testing excessif
expect(component).toMatchSnapshot() // Fragile, verbeux
```

---

## 📚 Ressources

### Documentation

- **[FRONTEND_TESTS_RECAP.md](../FRONTEND_TESTS_RECAP.md)** - Récapitulatif 110+ tests créés
- **[PHASE_3_TESTS_RECAP.md](../PHASE_3_TESTS_RECAP.md)** - Tests backend (163 tests)
- **[SESSION_2024-12-25_FINALE.md](../SESSION_2024-12-25_FINALE.md)** - Session complète

### Liens externes

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Jest Matchers](https://jestjs.io/docs/expect)

### Commandes rapides

```bash
# Lancer tous les tests
./run_tests.sh all

# Lancer tests spécifiques
npm test -- LoadingSpinner

# Coverage HTML
./run_tests.sh coverage

# Watch mode
./run_tests.sh watch

# Aide
./run_tests.sh help
```

---

## 🎓 Quiz de Compréhension

### Q1: Quel est le rôle de `jest.config.js`?
<details>
<summary>Réponse</summary>

Configuration Jest: environnement (jsdom), mocks (CSS, images), coverage thresholds, etc.
</details>

### Q2: Pourquoi utiliser `beforeEach()` dans les tests?
<details>
<summary>Réponse</summary>

Pour reset l'état avant chaque test (isolation des tests, éviter side effects).
</details>

### Q3: Différence entre `getBy` et `queryBy`?
<details>
<summary>Réponse</summary>

- `getBy`: Lance une erreur si élément non trouvé
- `queryBy`: Retourne `null` si élément non trouvé (pour tester absence)
</details>

### Q4: Comment tester un comportement async?
<details>
<summary>Réponse</summary>

Utiliser `await` avec `findBy` ou `waitFor`:
```typescript
await screen.findByText('Loaded')
// ou
await waitFor(() => expect(fn).toHaveBeenCalled())
```
</details>

### Q5: Pourquoi mocker les dépendances?
<details>
<summary>Réponse</summary>

- Tests plus rapides (pas d'appels réseau réels)
- Tests isolés (pas de dépendances externes)
- Tests déterministes (mêmes résultats à chaque fois)
</details>

---

## ✨ Conclusion

Vous savez maintenant:
- ✅ Comment les tests frontend fonctionnent
- ✅ Comment exécuter les tests
- ✅ Comment écrire de nouveaux tests
- ✅ Comment débugger les problèmes
- ✅ Comment améliorer le coverage

**Prochaines étapes**:
1. Exécuter `./run_tests.sh all` pour voir les tests en action
2. Générer coverage report: `./run_tests.sh coverage`
3. Écrire vos propres tests en suivant les exemples

**Besoin d'aide?** Consultez la documentation ou les exemples de tests existants.

---

**Dernière mise à jour**: 25 décembre 2024
**Contributeur**: Claude Sonnet 4.5
**Version**: 1.0.0
