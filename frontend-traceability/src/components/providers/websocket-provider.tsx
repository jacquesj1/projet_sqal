'use client'

import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from 'react'
import { toast } from 'react-hot-toast'

interface WebSocketContextType {
  ws: WebSocket | null
  isConnected: boolean
  sendCommand: (action: string, data?: any) => void
  addEventListener: (type: string, handler: (data: any) => void) => void
  removeEventListener: (type: string, handler: (data: any) => void) => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  const connectWebSocket = useCallback(() => {
    // Configuration WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
    const wsEndpoint = `${wsUrl}/api/v1/ws/traceability/events`

    console.log('📡 Connexion WebSocket Traceability...', wsEndpoint)

    try {
      const ws = new WebSocket(wsEndpoint)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('🔗 WebSocket Traceability connecté')
        setIsConnected(true)
        toast.success('Connexion temps réel établie')
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket Traceability déconnecté:', event.code, event.reason)
        setIsConnected(false)

        // Reconnexion automatique après 3 secondes
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Tentative de reconnexion...')
          connectWebSocket()
        }, 3000)
      }

      ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket Traceability:', error)
        setIsConnected(false)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('📨 Message reçu:', message.type, message)

          // Dispatch aux handlers enregistrés
          const handlers = eventHandlersRef.current.get(message.type)
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(message)
              } catch (error) {
                console.error('Erreur handler:', error)
              }
            })
          }

          // Handler pour connection_established
          if (message.type === 'connection_established') {
            console.log('✅ Connexion établie:', message.message)
          }

          // Handler pour heartbeat
          if (message.type === 'heartbeat') {
            console.log('💓 Heartbeat:', message.timestamp)
          }

          // Handler pour traceability_event
          if (message.type === 'traceability_event') {
            console.log('📦 Événement traçabilité:', message.event)
            // Afficher notification pour événements importants
            if (message.event?.event_type === 'quality_scan' || message.event?.event_type === 'shipment') {
              toast.success(`Nouvel événement: ${message.event?.event_type}`)
            }
          }

        } catch (error) {
          console.error('Erreur parsing message:', error)
        }
      }

    } catch (error) {
      console.error('Erreur création WebSocket:', error)
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setIsConnected(false)
    }
  }, [connectWebSocket])

  const sendCommand = useCallback((action: string, data?: any) => {
    if (wsRef.current && isConnected) {
      const command = {
        action,
        ...data
      }
      wsRef.current.send(JSON.stringify(command))
      console.log('📤 Commande envoyée:', command)
    } else {
      console.warn('WebSocket non connecté, impossible d\'envoyer:', action)
    }
  }, [isConnected])

  const addEventListener = useCallback((type: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(type)) {
      eventHandlersRef.current.set(type, new Set())
    }
    eventHandlersRef.current.get(type)!.add(handler)
  }, [])

  const removeEventListener = useCallback((type: string, handler: (data: any) => void) => {
    const handlers = eventHandlersRef.current.get(type)
    if (handlers) {
      handlers.delete(handler)
    }
  }, [])

  const contextValue: WebSocketContextType = {
    ws: wsRef.current,
    isConnected,
    sendCommand,
    addEventListener,
    removeEventListener,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

// Hook spécialisé pour suivre un produit spécifique
export function useTraceabilitySubscription(productId?: string) {
  const { sendCommand, isConnected } = useWebSocket()

  useEffect(() => {
    if (productId && isConnected) {
      // S'abonner aux événements du produit
      sendCommand('subscribe_product', { product_id: productId })
      console.log(`📡 Abonnement au produit ${productId}`)

      return () => {
        sendCommand('unsubscribe_product', { product_id: productId })
        console.log(`📡 Désabonnement du produit ${productId}`)
      }
    }
  }, [productId, isConnected, sendCommand])

  return { isConnected }
}

// Hook pour l'état de connexion
export function useConnectionStatus() {
  const { isConnected } = useWebSocket()

  return {
    isConnected,
    status: isConnected ? 'connected' : 'disconnected',
    indicator: isConnected ? 'bg-green-500' : 'bg-red-500',
  }
}
