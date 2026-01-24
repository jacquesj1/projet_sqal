// ==============================================================================
// API Service - Control Panel Backend Communication
// ==============================================================================

import axios, { AxiosInstance } from 'axios';
import type {
  SimulatorStartRequest,
  SimulatorStopRequest,
  SimulatorStatusInfo,
  ControlPanelStats,
  ScenarioRequest,
  ApiResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ControlPanelAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api/control-panel`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Get statistics
  async getStats(): Promise<ControlPanelStats> {
    const response = await this.client.get('/stats');
    return response.data;
  }

  // Start simulator
  async startSimulator(config: SimulatorStartRequest): Promise<ApiResponse> {
    const response = await this.client.post('/simulators/start', config);
    return response.data;
  }

  // Stop simulator
  async stopSimulator(request: SimulatorStopRequest): Promise<ApiResponse> {
    const response = await this.client.post('/simulators/stop', request);
    return response.data;
  }

  // Stop all simulators
  async stopAllSimulators(force: boolean = false): Promise<ApiResponse> {
    const response = await this.client.post('/simulators/stop-all', null, {
      params: { force },
    });
    return response.data;
  }

  // Get simulator status
  async getSimulatorStatus(deviceId: string): Promise<SimulatorStatusInfo> {
    const response = await this.client.get(`/simulators/status/${deviceId}`);
    return response.data;
  }

  // List all simulators
  async listSimulators(): Promise<SimulatorStatusInfo[]> {
    const response = await this.client.get('/simulators/list');
    return response.data;
  }

  // Get simulator logs
  async getSimulatorLogs(deviceId: string, tail: number = 100): Promise<{ device_id: string; logs: string }> {
    const response = await this.client.get(`/simulators/logs/${deviceId}`, {
      params: { tail },
    });
    return response.data;
  }

  // Start scenario
  async startScenario(request: ScenarioRequest): Promise<ApiResponse> {
    const response = await this.client.post('/scenarios/start', request);
    return response.data;
  }
}

export const api = new ControlPanelAPI();
