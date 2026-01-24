// API Types for Control Panel V2

export interface SimulatorStatus {
  device_id?: string;
  container_name: string;
  status: 'running' | 'stopped' | 'error' | 'not_found' | 'docker_unavailable';
  created_at?: string;
  started_at?: string;
  uptime_seconds?: number;
  location?: string;
  interval?: number;
}

export interface GavageStatus {
  status: string;
  container_name: string;
  created_at?: string;
  started_at?: string;
  uptime_seconds?: number;
}

export interface ConsumerStatus {
  status: string;
  container_name: string;
  created_at?: string;
  started_at?: string;
  uptime_seconds?: number;
}

export interface LotStats {
  total_lots: number;
  active_lots: number;
  completed_lots: number;
  avg_itm: number;
}

export interface OrchestrationStatus {
  gavage: GavageStatus;
  sqal: {
    total_devices: number;
    running_devices: number;
    devices: { device_id: string; status: string }[];
  };
  consumer: ConsumerStatus;
  lots: LotStats;
  overall_status: {
    total_simulators: number;
    running_simulators: number;
  };
}

export interface SimulatorStartRequest {
  device_id: string;
  location?: string;
  interval?: number;
  config_profile?: string;
  duration?: number;
}

export interface GavageStartRequest {
  nb_lots: number;
  acceleration: number;
  backend_url?: string;
  duration?: number;
}

export interface ConsumerStartRequest {
  feedbacks_per_hour: number;
  min_rating: number;
  max_rating: number;
  duration?: number;
  use_active_lots?: boolean;
  interval?: number;
  num_feedbacks?: number;
  code_lot?: string;
}

export interface OrchestrationRequest {
  scenario_name: 'complete_demo' | 'quality_focus' | 'gavage_realtime' | 'consumer_analysis';
  duration?: number;
  acceleration?: number;
  nb_lots?: number;
  nb_sqal_devices?: number;
  feedbacks_per_hour?: number;
}

export interface OrchestrationResult {
  scenario: string;
  status: 'starting' | 'running' | 'partial' | 'stopped' | 'error';
  gavage: any;
  sqal_devices: any[];
  consumer: any;
  errors: string[];
  running_count: number;
  started_at: string;
}

export interface ControlPanelStats {
  total_simulators: number;
  running_simulators: number;
  stopped_simulators: number;
  error_simulators: number;
  docker_available: boolean;
  backend_healthy: boolean;
}

export interface ConsumerProduct {
  product_id: string;
  qr_code: string;
  lot_id: number | null;
  sample_id: string | null;
  sqal_grade: string | null;
  blockchain_hash: string | null;
  tof_score?: number | null;
  as7341_score?: number | null;
  created_at?: string;
}

export interface LatestConsumerProductResponse {
  code_lot: string | null;
  lot_id: number | null;
  product: ConsumerProduct;
}

export interface BlockchainVerifyResponse {
  valid: boolean;
  blockchain_hash?: string;
  timestamp?: string;
  verified_at?: string;
  data?: any;
  error?: string;
  message?: string;
}
