import axios from 'axios';
import type {
  SimulatorStatus,
  GavageStatus,
  ConsumerStatus,
  OrchestrationStatus,
  SimulatorStartRequest,
  GavageStartRequest,
  ConsumerStartRequest,
  OrchestrationRequest,
  OrchestrationResult,
  ControlPanelStats,
  ConsumerProduct,
  LatestConsumerProductResponse,
  BlockchainVerifyResponse,
} from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/control-panel`,
  headers: {
    'Content-Type': 'application/json',
  },
});

const controlApi = axios.create({
  baseURL: `${API_BASE_URL}/api/control`,
  headers: {
    'Content-Type': 'application/json',
  },
});

const consumerApi = axios.create({
  baseURL: `${API_BASE_URL}/api/consumer`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health & Stats
export const getHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getStats = async (): Promise<ControlPanelStats> => {
  const response = await api.get<ControlPanelStats>('/stats');
  return response.data;
};

// SQAL Simulators
export const listSqalSimulators = async (): Promise<SimulatorStatus[]> => {
  const response = await api.get<SimulatorStatus[]>('/simulators/list');
  return response.data;
};

export const startSqalSimulator = async (config: SimulatorStartRequest) => {
  const response = await api.post('/simulators/start', config);
  return response.data;
};

export const stopSqalSimulator = async (device_id: string, force: boolean = false) => {
  const response = await api.post('/simulators/stop', { device_id, force });
  return response.data;
};

export const getSqalSimulatorStatus = async (device_id: string): Promise<SimulatorStatus> => {
  const response = await api.get<SimulatorStatus>(`/simulators/status/${device_id}`);
  return response.data;
};

export const getSqalSimulatorLogs = async (device_id: string, tail: number = 100) => {
  const response = await api.get(`/simulators/logs/${device_id}`, { params: { tail } });
  return response.data;
};

export const stopAllSqalSimulators = async (force: boolean = false) => {
  const response = await api.post('/simulators/stop-all', { force });
  return response.data;
};

// Gavage Simulator
export const startGavageSimulator = async (config: GavageStartRequest) => {
  const response = await api.post('/gavage/start', config);
  return response.data;
};

export const stopGavageSimulator = async (force: boolean = false) => {
  const response = await api.post('/gavage/stop', { force });
  return response.data;
};

export const getGavageStatus = async (): Promise<GavageStatus> => {
  const response = await api.get<GavageStatus>('/gavage/status');
  return response.data;
};

// Consumer Simulator
export const startConsumerSimulator = async (config: ConsumerStartRequest) => {
  const response = await api.post('/consumer/start', config);
  return response.data;
};

export const stopConsumerSimulator = async (force: boolean = false) => {
  const response = await api.post('/consumer/stop', { force });
  return response.data;
};

export const getConsumerStatus = async (): Promise<ConsumerStatus> => {
  const response = await api.get<ConsumerStatus>('/consumer/status');
  return response.data;
};

// Orchestration
export const startOrchestration = async (config: OrchestrationRequest): Promise<OrchestrationResult> => {
  const response = await api.post<OrchestrationResult>('/orchestrate/start', config);
  return response.data;
};

export const stopAllOrchestration = async () => {
  const response = await api.post('/orchestrate/stop-all');
  return response.data;
};

export const getOrchestrationStatus = async (): Promise<OrchestrationStatus> => {
  const response = await api.get<OrchestrationStatus>('/orchestrate/status');
  return response.data;
};

// Scenarios
export const startScenario = async (scenario_name: string, duration: number = 0) => {
  const response = await api.post('/scenarios/start', { scenario_name, duration });
  return response.data;
};

// ============================================================================
// E2E Demo (process-based simulators via /api/control)
// ============================================================================

export const getControlStatus = async () => {
  const response = await controlApi.get('/status');
  return response.data;
};

export const startControlGavage = async (config: { nb_lots: number; acceleration: number }) => {
  const response = await controlApi.post('/gavage/start', config);
  return response.data;
};

export const stopControlGavage = async () => {
  const response = await controlApi.post('/gavage/stop');
  return response.data;
};

export const startControlMonitor = async (config: { polling_interval: number }) => {
  const response = await controlApi.post('/monitor/start', config);
  return response.data;
};

export const stopControlMonitor = async () => {
  const response = await controlApi.post('/monitor/stop');
  return response.data;
};

export const startControlSqal = async (config: { device_id: string; interval: number; nb_samples: number }) => {
  const response = await controlApi.post('/sqal/start', config);
  return response.data;
};

export const ensureControlSqalLot = async (config: { code_lot: string }) => {
  const response = await controlApi.post('/sqal/ensure-lot', config);
  return response.data as { code_lot: string; lot_id: number };
};

export const getLatestControlGavageLot = async () => {
  const response = await controlApi.get('/gavage/latest-lot');
  return response.data as { code_lot: string; lot_id: number };
};

export const stopControlSqal = async () => {
  const response = await controlApi.post('/sqal/stop');
  return response.data;
};

export const startControlConsumer = async (config: { interval: number; num_feedbacks?: number; code_lot?: string }) => {
  const response = await controlApi.post('/consumer/start', config);
  return response.data;
};

export const stopControlConsumer = async () => {
  const response = await controlApi.post('/consumer/stop');
  return response.data;
};

export const getConsumerProducts = async (params?: { code_lot?: string; lot_id?: number }): Promise<ConsumerProduct[]> => {
  const response = await consumerApi.get<ConsumerProduct[]>('/products', { params });
  return response.data;
};

export const getLatestConsumerProduct = async (): Promise<LatestConsumerProductResponse> => {
  const response = await consumerApi.get<LatestConsumerProductResponse>('/latest-product');
  return response.data;
};

export const verifyBlockchainHash = async (blockchain_hash: string): Promise<BlockchainVerifyResponse> => {
  const response = await consumerApi.get<BlockchainVerifyResponse>(`/blockchain/verify/${encodeURIComponent(blockchain_hash)}`);
  return response.data;
};
