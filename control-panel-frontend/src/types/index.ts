// ==============================================================================
// TypeScript Types for Control Panel
// ==============================================================================

export type SimulatorStatus = 'running' | 'stopped' | 'error' | 'not_found';

export type ScenarioName = 'multi_site' | 'stress_test' | 'production_demo';

export interface SimulatorConfig {
  device_id: string;
  location: string;
  backend_url?: string;
  interval: number;
  config_profile: string;
}

export interface SimulatorStartRequest {
  device_id: string;
  location: string;
  interval: number;
  config_profile: string;
  duration: number;
}

export interface SimulatorStopRequest {
  device_id: string;
  force: boolean;
}

export interface SimulatorStatusInfo {
  device_id: string;
  container_name: string;
  status: SimulatorStatus;
  created_at?: string;
  started_at?: string;
  uptime_seconds?: number;
  location?: string;
  interval?: number;
  config_profile?: string;
}

export interface ControlPanelStats {
  total_simulators: number;
  running_simulators: number;
  stopped_simulators: number;
  error_simulators: number;
  docker_available: boolean;
  backend_healthy: boolean;
}

export interface ScenarioRequest {
  scenario_name: ScenarioName;
  duration: number;
}

export interface ApiResponse<T = any> {
  status: string;
  message?: string;
  data?: T;
}

export interface LogMessage {
  type: 'log' | 'error';
  device_id: string;
  message: string;
  timestamp?: string;
}
