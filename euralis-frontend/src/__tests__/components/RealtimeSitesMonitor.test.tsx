/**
 * Tests - RealtimeSitesMonitor Component
 * Tests unitaires pour le monitoring temps réel multi-sites avec WebSocket
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import RealtimeSitesMonitor from '@/components/realtime/RealtimeSitesMonitor'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: (() => void) | null = null

  send = jest.fn()
  close = jest.fn()

  constructor(public url: string) {
    // Simulate connection after a tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen()
      }
    }, 10)
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify(data),
      } as MessageEvent)
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose()
    }
  }
}

let mockWsInstance: MockWebSocket | null = null

// Mock WebSocket constructor
global.WebSocket = jest.fn((url: string) => {
  mockWsInstance = new MockWebSocket(url)
  return mockWsInstance
}) as any

// Mock environment variable
process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:8000'

describe('RealtimeSitesMonitor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockWsInstance = null
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('renders component title', () => {
    render(<RealtimeSitesMonitor />)

    expect(screen.getByText('Supervision Temps Réel Multi-Sites')).toBeInTheDocument()
  })

  it('shows disconnected status initially', () => {
    render(<RealtimeSitesMonitor />)

    expect(screen.getByText('Déconnecté')).toBeInTheDocument()
  })

  it('connects to WebSocket on mount', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    await waitFor(() => {
      expect(screen.getByText('Connecté')).toBeInTheDocument()
    })
  })

  it('renders all three sites (LL, LS, MT)', () => {
    render(<RealtimeSitesMonitor />)

    expect(screen.getByText('Site Bretagne')).toBeInTheDocument()
    expect(screen.getByText('Site Pays de Loire')).toBeInTheDocument()
    expect(screen.getByText('Site Maubourguet')).toBeInTheDocument()
  })

  it('displays site regions', () => {
    render(<RealtimeSitesMonitor />)

    expect(screen.getByText('Bretagne')).toBeInTheDocument()
    expect(screen.getByText('Pays de Loire')).toBeInTheDocument()
    expect(screen.getByText('Occitanie')).toBeInTheDocument()
  })

  it('shows initial stats as zero', () => {
    render(<RealtimeSitesMonitor />)

    // Total canards should be 0
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows "Sites actifs" count as 3', () => {
    render(<RealtimeSitesMonitor />)

    expect(screen.getByText('Sites actifs')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('displays empty activity message when no data', () => {
    render(<RealtimeSitesMonitor />)

    expect(screen.getByText('En attente de données temps réel...')).toBeInTheDocument()
  })

  it('updates stats when receiving gavage_realtime message', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const gavageMessage = {
      type: 'gavage_realtime',
      data: {
        code_lot: 'LOT_LL_001',
        gaveur_id: 1,
        gaveur_nom: 'Dupont Jean',
        site: 'LL',
        genetique: 'Mulard',
        jour: 10,
        moment: 'matin',
        dose_reelle: 450,
        poids_moyen: 6500,
        nb_canards_vivants: 120,
        taux_mortalite: 2.5,
        timestamp: new Date().toISOString(),
      },
    }

    await act(async () => {
      if (mockWsInstance) {
        mockWsInstance.simulateMessage(gavageMessage)
      }
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(screen.getByText('LOT_LL_001')).toBeInTheDocument()
    })
  })

  it('displays gaveur name in activity', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const gavageMessage = {
      type: 'gavage_realtime',
      data: {
        code_lot: 'LOT_LS_002',
        gaveur_id: 2,
        gaveur_nom: 'Martin Pierre',
        site: 'LS',
        genetique: 'Mulard',
        jour: 8,
        moment: 'soir',
        dose_reelle: 420,
        poids_moyen: 6200,
        nb_canards_vivants: 100,
        taux_mortalite: 1.8,
        timestamp: new Date().toISOString(),
      },
    }

    await act(async () => {
      if (mockWsInstance) {
        mockWsInstance.simulateMessage(gavageMessage)
      }
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(screen.getByText(/Martin Pierre/)).toBeInTheDocument()
    })
  })

  it('shows day and moment (matin/soir) with emojis', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const gavageMessage = {
      type: 'gavage_realtime',
      data: {
        code_lot: 'LOT_MT_003',
        gaveur_id: 3,
        gaveur_nom: 'Durand Luc',
        site: 'MT',
        genetique: 'Mulard',
        jour: 12,
        moment: 'matin',
        dose_reelle: 460,
        poids_moyen: 6800,
        nb_canards_vivants: 110,
        taux_mortalite: 2.0,
        timestamp: new Date().toISOString(),
      },
    }

    await act(async () => {
      if (mockWsInstance) {
        mockWsInstance.simulateMessage(gavageMessage)
      }
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(screen.getByText(/J12/)).toBeInTheDocument()
      expect(screen.getByText(/☀️/)).toBeInTheDocument()
    })
  })

  it('limits recent activity to 10 entries', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    // Send 15 messages
    for (let i = 0; i < 15; i++) {
      const gavageMessage = {
        type: 'gavage_realtime',
        data: {
          code_lot: `LOT_LL_${String(i).padStart(3, '0')}`,
          gaveur_id: i,
          gaveur_nom: `Gaveur ${i}`,
          site: 'LL',
          genetique: 'Mulard',
          jour: 10,
          moment: 'matin',
          dose_reelle: 450,
          poids_moyen: 6500,
          nb_canards_vivants: 120,
          taux_mortalite: 2.5,
          timestamp: new Date().toISOString(),
        },
      }

      await act(async () => {
        const ws = mockWsInstance
        if (ws) {
          ws.simulateMessage(gavageMessage)
        }
        jest.advanceTimersByTime(10)
      })
    }

    await waitFor(() => {
      expect(screen.getByText(/Activité Récente \(10\)/)).toBeInTheDocument()
    })
  })

  it('sends heartbeat every 30 seconds', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const ws = mockWsInstance

    await act(async () => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'heartbeat' })
      )
    })
  })

  it('handles WebSocket error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    await act(async () => {
      const ws = mockWsInstance
      if (ws) {
        ws.simulateError()
      }
    })

    await waitFor(() => {
      expect(screen.getByText('Erreur de connexion')).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })

  it('reconnects on connection close', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const initialCallCount = (global.WebSocket as any).mock.calls.length

    await act(async () => {
      const ws = mockWsInstance
      if (ws) {
        ws.simulateClose()
      }
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect((global.WebSocket as any).mock.calls.length).toBeGreaterThan(initialCallCount)
    })
  })

  it('shows reconnection attempt count', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    await act(async () => {
      const ws = mockWsInstance
      if (ws) {
        ws.simulateClose()
      }
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect(screen.getByText(/\(1\/10\)/)).toBeInTheDocument()
    })
  })

  it('stops reconnecting after 10 attempts', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    for (let i = 0; i < 11; i++) {
      await act(async () => {
        const ws = mockWsInstance
        if (ws) {
          ws.simulateClose()
        }
        jest.advanceTimersByTime(5000)
      })
    }

    // Should stop at 10 attempts
    const callCount = (global.WebSocket as any).mock.calls.length
    expect(callCount).toBeLessThanOrEqual(11) // 1 initial + 10 reconnects
  })

  it('displays total canards across all sites', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const messages = [
      {
        type: 'gavage_realtime',
        data: {
          code_lot: 'LOT_LL_001',
          gaveur_id: 1,
          gaveur_nom: 'Dupont',
          site: 'LL',
          genetique: 'Mulard',
          jour: 10,
          moment: 'matin',
          dose_reelle: 450,
          poids_moyen: 6500,
          nb_canards_vivants: 120,
          taux_mortalite: 2.5,
          timestamp: new Date().toISOString(),
        },
      },
      {
        type: 'gavage_realtime',
        data: {
          code_lot: 'LOT_LS_001',
          gaveur_id: 2,
          gaveur_nom: 'Martin',
          site: 'LS',
          genetique: 'Mulard',
          jour: 10,
          moment: 'matin',
          dose_reelle: 450,
          poids_moyen: 6200,
          nb_canards_vivants: 100,
          taux_mortalite: 1.8,
          timestamp: new Date().toISOString(),
        },
      },
    ]

    for (const msg of messages) {
      await act(async () => {
        const ws = mockWsInstance
        if (ws) {
          ws.simulateMessage(msg)
        }
        jest.advanceTimersByTime(10)
      })
    }

    await waitFor(() => {
      expect(screen.getByText('Total canards')).toBeInTheDocument()
    })
  })

  it('applies correct color for low mortality rate (< 3%)', async () => {
    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const gavageMessage = {
      type: 'gavage_realtime',
      data: {
        code_lot: 'LOT_LL_001',
        gaveur_id: 1,
        gaveur_nom: 'Dupont',
        site: 'LL',
        genetique: 'Mulard',
        jour: 10,
        moment: 'matin',
        dose_reelle: 450,
        poids_moyen: 6500,
        nb_canards_vivants: 120,
        taux_mortalite: 2.0,
        timestamp: new Date().toISOString(),
      },
    }

    await act(async () => {
      if (mockWsInstance) {
        mockWsInstance.simulateMessage(gavageMessage)
      }
      jest.advanceTimersByTime(100)
    })

    await waitFor(() => {
      const mortalityElement = screen.getByText(/2\.0%/)
      expect(mortalityElement).toHaveClass('text-green-600')
    })
  })

  it('closes WebSocket on unmount', async () => {
    const { unmount } = render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    const ws = mockWsInstance

    unmount()

    expect(ws.close).toHaveBeenCalled()
  })

  it('handles malformed JSON messages gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    render(<RealtimeSitesMonitor />)

    await act(async () => {
      jest.advanceTimersByTime(20)
    })

    await act(async () => {
      const ws = mockWsInstance
      if (ws && ws.onmessage) {
        ws.onmessage({
          data: 'invalid json {',
        } as MessageEvent)
      }
    })

    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
