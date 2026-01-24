// ============================================================================
// SQAL Frontend - WebSocket Service
// Real-time communication with Django Channels
// ============================================================================

import { WS_BASE_URL, WS_EVENTS } from "@constants/index";
import type {
  WSMessage,
  WSMessageType,
  SensorDataMessage,
  AnalysisResultMessage,
  DeviceStatusMessage,
  AlertMessage,
} from "@/types";

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  connect(token?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log("WebSocket already connected or connecting");
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Build WebSocket URL with token
      const wsUrl = token
        ? `${WS_BASE_URL}/ws/realtime/?token=${token}`
        : `${WS_BASE_URL}/ws/realtime/`;

      console.log("Connecting to WebSocket:", wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Send message to WebSocket server
   */
  send(type: WSMessageType, payload: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected. Cannot send message:", type);
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  on(event: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off(event: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(event);
      }
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("WebSocket connected");
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.emit(WS_EVENTS.CONNECT, { connected: true });
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: any = JSON.parse(event.data);
      console.log("WebSocket message received:", message.type);

      // Handle connection established message
      if (message.type === "connection_established") {
        console.log("WebSocket connection established:", message.message || message);
        this.emit(WS_EVENTS.CONNECT, { connected: true, message: message.message });
        return;
      }

      // Handle Django backend message formats
      if (message.type === "sensor_update") {
        // Message from Django: { type: "sensor_update", fusion: {...}, vl53l8ch: {...}, as7341: {...}, blockchain: {...} }
        console.log("Processing sensor_update from Django backend", {
          has_blockchain: !!message.blockchain,
          blockchain_hash: message.blockchain?.blockchain_hash?.substring(0, 20)
        });

        // Update fusion result if present - SEND COMPLETE MESSAGE
        if (message.fusion) {
          // Send complete message with vl53l8ch, as7341, fusion, and blockchain
          const analysisResult = {
            ...message.fusion,
            vl53l8ch: message.vl53l8ch,
            as7341: message.as7341,
            blockchain: message.blockchain,
            sample_id: message.sample_id,
            device_id: message.device_id,
            timestamp: message.timestamp,
          };

          console.log("📡 Emitting ANALYSIS_RESULT with blockchain:", {
            sample_id: analysisResult.sample_id,
            has_blockchain: !!analysisResult.blockchain,
            blockchain_keys: analysisResult.blockchain ? Object.keys(analysisResult.blockchain) : []
          });

          this.emit(WS_EVENTS.ANALYSIS_RESULT, {
            result: analysisResult
          });
        }

        // Update sensor data if present
        if (message.vl53l8ch) {
          this.emit(WS_EVENTS.SENSOR_DATA, {
            sensor_type: "VL53L8CH",
            data: message.vl53l8ch
          });
        }

        if (message.as7341) {
          this.emit(WS_EVENTS.SENSOR_DATA, {
            sensor_type: "AS7341",
            data: message.as7341
          });
        }

        return;
      }
      
      if (message.type === "latest_data") {
        // Message from Django: { type: "latest_data", data: {...} }
        console.log("Processing latest_data from Django backend");
        if (message.data) {
          this.emit(WS_EVENTS.ANALYSIS_RESULT, { result: message.data });
        }
        return;
      }

      if (message.type === "latest_sample") {
        // Message from FastAPI broadcaster: { type: "latest_sample", data: {...} }
        console.log("Processing latest_sample from backend");
        if (message.data) {
          this.emit(WS_EVENTS.ANALYSIS_RESULT, { result: message.data });
        }
        return;
      }

      // Emit to specific event handlers (original format)
      this.emit(message.type, message.payload);

      // Handle specific message types (original format)
      switch (message.type) {
        case WS_EVENTS.SENSOR_DATA:
          this.handleSensorData(message.payload as SensorDataMessage);
          break;

        case WS_EVENTS.ANALYSIS_RESULT:
          this.handleAnalysisResult(message.payload as AnalysisResultMessage);
          break;

        case WS_EVENTS.DEVICE_STATUS:
          this.handleDeviceStatus(message.payload as DeviceStatusMessage);
          break;

        case WS_EVENTS.ALERT:
          this.handleAlert(message.payload as AlertMessage);
          break;

        case WS_EVENTS.NOTIFICATION:
          this.handleNotification(message.payload);
          break;

        case WS_EVENTS.SYSTEM_STATUS:
          this.handleSystemStatus(message.payload);
          break;

        case "ping":
          // Ignore ping messages - they're keepalive heartbeats
          break;

        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.emit(WS_EVENTS.ERROR, { error: "WebSocket connection error" });
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log("WebSocket closed:", event.code, event.reason);
    this.isConnecting = false;
    this.ws = null;

    this.emit(WS_EVENTS.DISCONNECT, {
      code: event.code,
      reason: event.reason,
    });

    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const token = localStorage.getItem("sqal_auth_token");
      this.connect(token || undefined);
    }, delay);
  }

  /**
   * Emit event to all registered handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in handler for event ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle sensor data message
   */
  private handleSensorData(data: SensorDataMessage): void {
    console.log("Sensor data received:", data.device_id, data.sensor_type);
    // Additional processing can be done here
  }

  /**
   * Handle analysis result message
   */
  private handleAnalysisResult(data: AnalysisResultMessage): void {
    console.log("Analysis result received:", data.sample_id, data.result.final_grade);
    // Additional processing can be done here
  }

  /**
   * Handle device status message
   */
  private handleDeviceStatus(data: DeviceStatusMessage): void {
    console.log("Device status received:", data.device_id, data.status);
    // Additional processing can be done here
  }

  /**
   * Handle alert message
   */
  private handleAlert(data: AlertMessage): void {
    console.log("Alert received:", data.severity, data.title);
    // Additional processing can be done here
    // Could trigger toast notifications, etc.
  }

  /**
   * Handle notification message
   */
  private handleNotification(data: any): void {
    console.log("Notification received:", data);
    // Additional processing can be done here
  }

  /**
   * Handle system status message
   */
  private handleSystemStatus(data: any): void {
    console.log("System status received:", data);
    // Additional processing can be done here
  }
}

// Create singleton instance
const wsService = new WebSocketService();

export default wsService;
