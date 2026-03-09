const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiClient {
  static async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API Error: ${res.statusText}`);
    }
    return res.json();
  }

  static async post<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API Error: ${res.statusText}`);
    }
    return res.json();
  }

  static async put<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API Error: ${res.statusText}`);
    }
    return res.json();
  }

  static async delete(endpoint: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API Error: ${res.statusText}`);
    }
  }

  static async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API Error: ${res.statusText}`);
    }
    return res.json();
  }
}

// ============================================
// API Gaveurs
// ============================================
export const gaveurApi = {
  getAll: () => ApiClient.get('/api/gaveurs/'),
  getById: (id: number) => ApiClient.get(`/api/gaveurs/${id}`),
  create: (data: unknown) => ApiClient.post('/api/gaveurs/', data),
};

// ============================================
// API Canards
// ============================================
export const canardApi = {
  getByGaveur: (gaveurId: number) => ApiClient.get(`/api/canards/gaveur/${gaveurId}`),
  getById: (id: number) => ApiClient.get(`/api/canards/${id}`),
  create: (data: unknown) => ApiClient.post('/api/canards/', data),
  update: (id: number, data: unknown) => ApiClient.put(`/api/canards/${id}`, data),
};

// ============================================
// API Gavage
// ============================================
export const gavageApi = {
  create: (data: unknown) => ApiClient.post('/api/gavage/', data),
  getByCanard: (canardId: number) => ApiClient.get(`/api/gavage/canard/${canardId}`),
  getByGaveur: (gaveurId: number, limit?: number) => {
    const url = limit
      ? `/api/gavage/gaveur/${gaveurId}?limit=${limit}`
      : `/api/gavage/gaveur/${gaveurId}`;
    return ApiClient.get(url);
  },
};

// ============================================
// API Intelligence Artificielle
// ============================================
export const mlApi = {
  discoverFormula: (genetique: string) => ApiClient.post(`/api/ml/discover-formula/${genetique}`, {}),
  predictDoses: (canardId: number) => ApiClient.get(`/api/ml/predict-doses/${canardId}`),
  retrain: (genetique: string) => ApiClient.post(`/api/ml/retrain/${genetique}`, {}),
};

// ============================================
// API Alertes
// ============================================
export const alerteApi = {
  getByGaveur: (gaveurId: number, acquittee?: boolean) => {
    const url = acquittee !== undefined
      ? `/api/alertes/gaveur/${gaveurId}?acquittee=${acquittee}`
      : `/api/alertes/gaveur/${gaveurId}`;
    return ApiClient.get(url);
  },
  getDashboard: (gaveurId: number) => ApiClient.get(`/api/alertes/dashboard/${gaveurId}`),
  create: (data: unknown) => ApiClient.post('/api/alertes/', data),
  checkAll: (canardId: number) => ApiClient.post(`/api/alertes/check-all/${canardId}`, {}),
  acquitter: (alerteId: number, gaveurId: number) =>
    ApiClient.post(`/api/alertes/${alerteId}/acquitter`, { gaveur_id: gaveurId }),
};

// ============================================
// API Analytics
// ============================================
export const analyticsApi = {
  getMetrics: (canardId: number) => ApiClient.get(`/api/analytics/metrics/${canardId}`),
  getPredictions: (canardId: number, jours: number = 7) =>
    ApiClient.get(`/api/analytics/predict-prophet/${canardId}?jours=${jours}`),
  compareGenetiques: (gaveurId?: number) => {
    const url = gaveurId
      ? `/api/analytics/compare-genetiques?gaveur_id=${gaveurId}`
      : '/api/analytics/compare-genetiques';
    return ApiClient.get(url);
  },
  getCorrelationTemperature: (canardId: number) =>
    ApiClient.get(`/api/analytics/correlation-temperature/${canardId}`),
  getPatterns: (gaveurId: number) => ApiClient.get(`/api/analytics/patterns/${gaveurId}`),
  getWeeklyReport: (gaveurId: number) => ApiClient.get(`/api/analytics/weekly-report/${gaveurId}`),
};

// ============================================
// API Blockchain
// ============================================
export const blockchainApi = {
  init: () => ApiClient.post('/api/blockchain/init', {}),

  // LOT-based blockchain (NEW - correct architecture)
  getLotHistory: (lotId: number) =>
    ApiClient.get(`/api/blockchain/lot/${lotId}/history`),
  getLotCertificat: (lotId: number) =>
    ApiClient.get(`/api/blockchain/lot/${lotId}/certificat`),

  // CANARD-based blockchain (DEPRECATED - kept for backward compatibility)
  addEvent: (canardId: number, data: unknown) =>
    ApiClient.post(`/api/blockchain/canard/${canardId}`, data),
  getHistory: (canardId: number) =>
    ApiClient.get(`/api/blockchain/canard/${canardId}/history`),
  getCertificat: (canardId: number) =>
    ApiClient.get(`/api/blockchain/canard/${canardId}/certificat`),

  verify: () => ApiClient.get('/api/blockchain/verify'),
};

// ============================================
// API Corrections
// ============================================
export const correctionApi = {
  getByCanard: (canardId: number) => ApiClient.get(`/api/corrections/canard/${canardId}`),
  getStats: (gaveurId: number) => ApiClient.get(`/api/corrections/stats/${gaveurId}`),
};

// ============================================
// API Anomalies
// ============================================
export const anomalyApi = {
  detect: (canardId: number) => ApiClient.get(`/api/anomalies/detect/${canardId}`),
};

// ============================================
// API Authentification
// ============================================
export const authApi = {
  register: (data: unknown) => ApiClient.post('/api/auth/register', data),
  login: (data: unknown) => ApiClient.post('/api/auth/login', data),
  logout: () => ApiClient.post('/api/auth/logout', {}),
  getMe: () => ApiClient.get('/api/auth/me'),
  updateMe: (data: unknown) => ApiClient.put('/api/auth/me', data),
  refresh: () => ApiClient.post('/api/auth/refresh', {}),
  forgotPassword: (email: string) => ApiClient.post('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    ApiClient.post('/api/auth/reset-password', { token, password }),
};

// ============================================
// API Vétérinaires
// ============================================
export const veterinaireApi = {
  getAll: () => ApiClient.get('/api/veterinaires/'),
  getById: (id: number) => ApiClient.get(`/api/veterinaires/${id}`),
  create: (data: unknown) => ApiClient.post('/api/veterinaires/', data),
  update: (id: number, data: unknown) => ApiClient.put(`/api/veterinaires/${id}`, data),
  getInterventions: (id: number) => ApiClient.get(`/api/veterinaires/${id}/interventions`),
};

// ============================================
// API Certifications
// ============================================
export const certificationApi = {
  getByGaveur: (gaveurId: number) => ApiClient.get(`/api/certifications/gaveur/${gaveurId}`),
  getByCanard: (canardId: number) => ApiClient.get(`/api/certifications/canard/${canardId}`),
  create: (data: unknown) => ApiClient.post('/api/certifications/', data),
  update: (id: number, data: unknown) => ApiClient.put(`/api/certifications/${id}`, data),
  delete: (id: number) => ApiClient.delete(`/api/certifications/${id}`),
};

// ============================================
// API Environnement
// ============================================
export const environnementApi = {
  getByStabule: (stabuleId: number) => ApiClient.get(`/api/environnement/stabule/${stabuleId}`),
  create: (data: unknown) => ApiClient.post('/api/environnement/', data),
  getAlertes: (stabuleId: number) => ApiClient.get(`/api/environnement/alertes/${stabuleId}`),
  getStats: (stabuleId: number) => ApiClient.get(`/api/environnement/stats/${stabuleId}`),
};

// ============================================
// API Lots Maïs
// ============================================
export const lotMaisApi = {
  getAll: () => ApiClient.get('/api/lots-mais/'),
  getById: (id: number) => ApiClient.get(`/api/lots-mais/${id}`),
  create: (data: unknown) => ApiClient.post('/api/lots-mais/', data),
  update: (id: number, data: unknown) => ApiClient.put(`/api/lots-mais/${id}`, data),
  getUtilisation: (id: number) => ApiClient.get(`/api/lots-mais/${id}/utilisation`),
  getQualite: (id: number) => ApiClient.get(`/api/lots-mais/${id}/qualite`),
};

// ============================================
// API Comportement & Santé
// ============================================
export const comportementApi = {
  getByCanard: (canardId: number) => ApiClient.get(`/api/comportement/canard/${canardId}`),
  create: (data: unknown) => ApiClient.post('/api/comportement/', data),
};

export const santeApi = {
  getByCanard: (canardId: number) => ApiClient.get(`/api/sante/canard/${canardId}`),
  createIntervention: (data: unknown) => ApiClient.post('/api/sante/intervention', data),
  getStats: (gaveurId: number) => ApiClient.get(`/api/sante/stats/${gaveurId}`),
};

// ============================================
// API Photos
// ============================================
export const photoApi = {
  upload: (formData: FormData) => ApiClient.uploadFile('/api/photos/upload', formData),
  getByCanard: (canardId: number) => ApiClient.get(`/api/photos/canard/${canardId}`),
  getById: (id: number) => ApiClient.get(`/api/photos/${id}`),
  delete: (id: number) => ApiClient.delete(`/api/photos/${id}`),
  annotate: (id: number, data: unknown) => ApiClient.post(`/api/photos/${id}/annotate`, data),
};

// ============================================
// API Simulations
// ============================================
export const simulationApi = {
  whatIf: (data: unknown) => ApiClient.post('/api/simulations/what-if', data),
  getScenarios: () => ApiClient.get('/api/simulations/scenarios'),
  optimize: (data: unknown) => ApiClient.post('/api/simulations/optimize', data),
  getResults: (id: string) => ApiClient.get(`/api/simulations/${id}/results`),
  compare: (data: unknown) => ApiClient.post('/api/simulations/compare', data),
};

// ============================================
// API QR/NFC
// ============================================
export const qrApi = {
  generate: (canardId: number) => ApiClient.get(`/api/qr/generate/${canardId}`),
  scan: (qrData: string) => ApiClient.post('/api/qr/scan', { qr_data: qrData }),
  getBatch: (lotId: number) => ApiClient.get(`/api/qr/batch/${lotId}`),
};

// ============================================
// API Voice Recognition - Saisie Rapide
// ============================================
export interface VoiceParseResult {
  command_original: string;
  parsed_at: string;
  success: boolean;
  type: 'dose' | 'poids' | 'temperature' | 'humidite' | 'mortalite' | null;
  data: {
    valeur?: number;
    unite?: string;
    session?: 'matin' | 'soir';
    lot_code?: string;
    context?: Record<string, unknown>;
  };
  error?: string;
}

export interface VoiceContext {
  gaveur_id?: number;
  canard_id?: number;
  lot_id?: number;
  session_date?: string;
}

export const voiceApi = {
  /**
   * Parse une commande vocale et extrait les données structurées
   * @example voiceApi.parse("dose matin 450 grammes lot A123")
   */
  parse: (command: string, context?: VoiceContext): Promise<VoiceParseResult> =>
    ApiClient.post('/api/voice/parse', { command, context }),

  /**
   * Parse plusieurs commandes en batch (max 50)
   */
  parseBatch: (commands: string[]): Promise<VoiceParseResult[]> =>
    ApiClient.post('/api/voice/parse-batch', { commands }),

  /**
   * Génère des suggestions de commandes basées sur un début de phrase
   * @example voiceApi.suggestions("dose") → ["dose matin 450 grammes", ...]
   */
  suggestions: (partialCommand: string): Promise<string[]> =>
    ApiClient.post('/api/voice/suggestions', { partial_command: partialCommand }),

  /**
   * Retourne les exemples de commandes par catégorie (documentation)
   */
  getExamples: (): Promise<Record<string, string[]>> =>
    ApiClient.get('/api/voice/commands/examples'),

  /**
   * Health check du service voice
   */
  health: (): Promise<{ status: string; supported_commands: string[] }> =>
    ApiClient.get('/api/voice/health'),
};

// ============================================
// API OCR - Saisie Rapide
// ============================================
export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  char_count: number;
  line_count: number;
  error?: string;
}

export interface ParsedDocument {
  success: boolean;
  document_type: 'bon_livraison' | 'fiche_mortalite' | 'fiche_lot' | 'inconnu';
  data: {
    type_document: string;
    // Bon livraison
    date_livraison?: string;
    numero_bon?: string;
    fournisseur?: string;
    quantite_kg?: number;
    prix_unitaire?: number;
    total_ht?: number;
    // Fiche mortalité
    date?: string;
    lot_code?: string;
    nombre_morts?: number;
    causes?: string[];
    // Fiche lot
    code_lot?: string;
    date_debut?: string;
    nb_canards?: number;
    souche?: string;
    poids_moyen_initial?: number;
    // Raw text
    raw_text: string;
  };
  raw_text: string;
  ocr_confidence: number;
}

export interface DocumentType {
  description: string;
  fields: string[];
  example: string;
}

export const ocrApi = {
  /**
   * Extrait le texte brut d'une image via OCR
   * @param imageBase64 Image encodée en base64 (avec ou sans préfixe data:image)
   * @param lang Langue du document (fra par défaut)
   */
  scanImage: (imageBase64: string, lang: string = 'fra'): Promise<OCRResult> =>
    ApiClient.post('/api/ocr/scan-image', { image_base64: imageBase64, lang }),

  /**
   * Scanne un document et extrait les données structurées
   * @param imageBase64 Image encodée en base64
   * @param documentType Type de document (bon_livraison, fiche_mortalite, fiche_lot)
   * @param lang Langue du document
   */
  scanDocument: (
    imageBase64: string,
    documentType?: 'bon_livraison' | 'fiche_mortalite' | 'fiche_lot',
    lang: string = 'fra'
  ): Promise<ParsedDocument> =>
    ApiClient.post('/api/ocr/scan-document', {
      image_base64: imageBase64,
      document_type: documentType,
      lang,
    }),

  /**
   * Upload un fichier image pour OCR
   */
  uploadFile: (file: File, lang: string = 'fra'): Promise<OCRResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return ApiClient.uploadFile(`/api/ocr/upload-file?lang=${lang}`, formData);
  },

  /**
   * Retourne les types de documents supportés avec exemples
   */
  getDocumentTypes: (): Promise<Record<string, DocumentType>> =>
    ApiClient.get('/api/ocr/document-types'),

  /**
   * Health check du service OCR
   */
  health: (): Promise<{
    status: string;
    tesseract_available: boolean;
    supported_documents: string[];
  }> => ApiClient.get('/api/ocr/health'),
};

export const nfcApi = {
  read: () => ApiClient.get('/api/nfc/read'),
  write: (data: unknown) => ApiClient.post('/api/nfc/write', data),
};

// ============================================
// API Intégrations
// ============================================
export const integrationApi = {
  // Abattoirs
  getAbattoirs: () => ApiClient.get('/api/integrations/abattoirs/'),
  sendToAbattoir: (data: unknown) => ApiClient.post('/api/integrations/abattoirs/send', data),
  getAbattoirStatus: (id: number) => ApiClient.get(`/api/integrations/abattoirs/${id}/status`),

  // Comptabilité
  exportCompta: () => ApiClient.get('/api/integrations/compta/export'),
  syncCompta: (data: unknown) => ApiClient.post('/api/integrations/compta/sync', data),
  getComptaSummary: (periode: string) => ApiClient.get(`/api/integrations/compta/summary/${periode}`),

  // Vétérinaires externes
  shareWithVet: (data: unknown) => ApiClient.post('/api/integrations/vet/share', data),
  getReceivedVetData: () => ApiClient.get('/api/integrations/vet/received'),
};
