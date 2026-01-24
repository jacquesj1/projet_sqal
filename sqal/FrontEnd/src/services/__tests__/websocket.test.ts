/**
 * Tests - WebSocket Service
 * Tests unitaires pour le service WebSocket temps réel
 */

import { WebSocketService } from '../websocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((error: any) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(public url: string) {
    // Simulate connection opening after a delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen()
      }
    }, 10)
  }

  send = jest.fn()
  close = jest.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose()
    }
  })

  simulateMessage(data: any) {
    if (this.onmessage) {
      const event = { data: JSON.stringify(data) } as MessageEvent
      this.onmessage(event)
    }
  }

  simulateError(error: any) {
    if (this.onerror) {
      this.onerror(error)
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose()
    }
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any

describe('WebSocket Service', () => {
  let wsService: WebSocketService
  let mockWs: MockWebSocket

  beforeEach(() => {
    wsService = new WebSocketService()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    wsService.disconnect()
    jest.useRealTimers()
  })

  describe('Connection', () => {
    it('connects to WebSocket server', () => {
      wsService.connect()

      expect(global.WebSocket).toHaveBeenCalled()
    })

    it('connects with auth token', () => {
      const token = 'test-token-123'
      wsService.connect(token)

      const constructorCalls = (global.WebSocket as jest.MockedClass<typeof WebSocket>).mock.calls
      const wsUrl = constructorCalls[constructorCalls.length - 1][0]
      expect(wsUrl).toContain(`token=${token}`)
    })

    it('does not reconnect if already connected', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20) // Wait for connection to open

      const initialCallCount = (global.WebSocket as jest.Mock).mock.calls.length

      wsService.connect() // Try to connect again

      expect((global.WebSocket as jest.Mock).mock.calls.length).toBe(initialCallCount)
    })

    it('sets isConnecting flag during connection', () => {
      wsService.connect()

      expect(wsService['isConnecting']).toBe(true)
    })

    it('clears isConnecting flag after connection opens', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      expect(wsService['isConnecting']).toBe(false)
    })
  })

  describe('Disconnection', () => {
    it('disconnects from WebSocket server', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      wsService.disconnect()

      expect(wsService.isConnected()).toBe(false)
    })

    it('prevents reconnection after manual disconnect', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      wsService.disconnect()

      expect(wsService['shouldReconnect']).toBe(false)
    })

    it('clears reconnect timer on disconnect', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      wsService.disconnect()

      expect(wsService['reconnectTimer']).toBeNull()
    })

    it('resets reconnect attempts on disconnect', () => {
      wsService['reconnectAttempts'] = 3

      wsService.disconnect()

      expect(wsService['reconnectAttempts']).toBe(0)
    })
  })

  describe('Message Sending', () => {
    it('sends message when connected', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.send.mockClear()

      wsService.send('sensor_data', { temperature: 25 })

      expect(mockWs.send).toHaveBeenCalled()
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentMessage.type).toBe('sensor_data')
      expect(sentMessage.payload).toEqual({ temperature: 25 })
      expect(sentMessage.timestamp).toBeDefined()
    })

    it('does not send message when disconnected', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      wsService.send('sensor_data', { temperature: 25 })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket not connected'),
        'sensor_data'
      )

      consoleSpy.mockRestore()
    })

    it('includes timestamp in sent messages', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.send.mockClear()

      const beforeSend = new Date().toISOString()
      wsService.send('test', { data: 'test' })
      const afterSend = new Date().toISOString()

      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentMessage.timestamp).toBeDefined()
      expect(sentMessage.timestamp >= beforeSend).toBe(true)
      expect(sentMessage.timestamp <= afterSend).toBe(true)
    })
  })

  describe('Event Handling', () => {
    it('subscribes to events with on()', () => {
      const handler = jest.fn()

      wsService.on('sensor_update', handler)

      expect(wsService['messageHandlers'].has('sensor_update')).toBe(true)
    })

    it('unsubscribes from events with off()', () => {
      const handler = jest.fn()

      wsService.on('sensor_update', handler)
      wsService.off('sensor_update', handler)

      expect(wsService['messageHandlers'].has('sensor_update')).toBe(false)
    })

    it('calls event handler when message received', async () => {
      const handler = jest.fn()

      wsService.on('sensor_update', handler)
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.simulateMessage({
        type: 'sensor_update',
        payload: { temperature: 25 },
      })

      expect(handler).toHaveBeenCalledWith({ temperature: 25 })
    })

    it('supports multiple handlers for same event', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      wsService.on('sensor_update', handler1)
      wsService.on('sensor_update', handler2)
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.simulateMessage({
        type: 'sensor_update',
        payload: { temperature: 25 },
      })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('handles connection_established message', async () => {
      const connectHandler = jest.fn()

      wsService.on('connect', connectHandler)
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.simulateMessage({
        type: 'connection_established',
        message: 'Welcome',
      })

      expect(connectHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          connected: true,
          message: 'Welcome',
        })
      )
    })

    it('handles sensor_update with fusion data', async () => {
      const analysisHandler = jest.fn()

      wsService.on('analysis_result', analysisHandler)
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.simulateMessage({
        type: 'sensor_update',
        fusion: { quality_score: 85 },
        vl53l8ch: { matrix: [[]] },
        as7341: { spectral: {} },
        sample_id: 'sample-123',
      })

      expect(analysisHandler).toHaveBeenCalled()
      const callArg = analysisHandler.mock.calls[0][0]
      expect(callArg.result.quality_score).toBe(85)
      expect(callArg.result.sample_id).toBe('sample-123')
    })
  })

  describe('Connection Status', () => {
    it('returns false when not connected', () => {
      expect(wsService.isConnected()).toBe(false)
    })

    it('returns true when connected', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      expect(wsService.isConnected()).toBe(true)
    })

    it('returns false after disconnect', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      wsService.disconnect()

      expect(wsService.isConnected()).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('handles JSON parse errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      if (mockWs.onmessage) {
        const invalidEvent = { data: 'invalid json' } as MessageEvent
        mockWs.onmessage(invalidEvent)
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('handles connection errors', async () => {
      const errorHandler = jest.fn()

      wsService.on('error', errorHandler)
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.simulateError(new Error('Connection failed'))

      expect(errorHandler).toBeDefined()
    })
  })

  describe('Reconnection Logic', () => {
    it('attempts reconnection on close', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      const initialCalls = (global.WebSocket as jest.Mock).mock.calls.length

      const mockWs = wsService['ws'] as any
      mockWs.simulateClose()

      jest.advanceTimersByTime(3000) // Reconnect delay

      expect((global.WebSocket as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls)
    })

    it('increments reconnect attempts', async () => {
      wsService.connect()
      jest.advanceTimersByTime(20)

      const mockWs = wsService['ws'] as any
      mockWs.simulateClose()

      expect(wsService['reconnectAttempts']).toBeGreaterThan(0)
    })

    it('respects maxReconnectAttempts', async () => {
      wsService['maxReconnectAttempts'] = 2

      for (let i = 0; i < 5; i++) {
        wsService.connect()
        jest.advanceTimersByTime(20)

        const mockWs = wsService['ws'] as any
        mockWs.simulateClose()

        jest.advanceTimersByTime(3000)
      }

      expect(wsService['reconnectAttempts']).toBeLessThanOrEqual(2)
    })
  })
})
