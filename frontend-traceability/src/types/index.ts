export interface TraceabilityData {
  id: string
  product: {
    name: string
    category: string
    description: string
    weight: string
    production_date: string
    product_code: string
    certifications: string[]
  }
  quality: {
    score: number
    grade: 'excellent' | 'good' | 'poor'
    metrics?: {
      texture: string
      appearance: string
      taste: string
    }
    analysis?: string
  }
  timeline: TraceabilityStep[]
  gaveur: {
    name: string
    farm_name: string
    address: string
    location: string
    phone?: string
    email?: string
    performance_score: number
    certifications: string[]
    animals_count: number
    description?: string
  }
  blockchain: {
    transaction_hash: string
    block_number: number
    confirmations: number
    timestamp: string
  }
}

export interface TraceabilityStep {
  id: string
  title: string
  description: string
  status: 'completed' | 'in_progress' | 'pending'
  date: string
  location?: string
  details?: string
}

export interface APIError {
  message: string
  status: number
  code?: string
}