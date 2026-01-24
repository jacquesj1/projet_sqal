// Re-export hooks from useWebSocket file
export {
  useWebSocketEvent,
  useAlertesLive,
  useGavagesLive,
  usePoidsLive,
  useAnomaliesLive,
  useNotificationsLive,
  useAllMessagesLive
} from './useWebSocket';

// Re-export useWebSocket from context
export { useWebSocket } from '@/context/WebSocketContext';
