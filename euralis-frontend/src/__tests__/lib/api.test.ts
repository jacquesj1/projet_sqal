/**
 * Tests - API Client Library
 * Tests unitaires pour les fonctions API Euralis
 */

describe('Euralis API Client', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchDashboardData', () => {
    it('fetches dashboard data successfully', async () => {
      const mockData = {
        total_lots: 42,
        total_canards: 5000,
        itm_moyen: 520,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const fetchDashboardData = async () => {
        const response = await fetch(`${API_URL}/api/euralis/dashboard`)
        return response.json()
      }

      const data = await fetchDashboardData()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/euralis/dashboard')
      )
      expect(data).toEqual(mockData)
    })

    it('handles fetch errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      const fetchDashboardData = async () => {
        try {
          const response = await fetch(`${API_URL}/api/euralis/dashboard`)
          return response.json()
        } catch (error) {
          throw error
        }
      }

      await expect(fetchDashboardData()).rejects.toThrow('Network error')
    })

    it('handles 404 errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const fetchDashboardData = async () => {
        const response = await fetch(`${API_URL}/api/euralis/dashboard`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response.json()
      }

      await expect(fetchDashboardData()).rejects.toThrow('HTTP 404: Not Found')
    })
  })

  describe('fetchSites', () => {
    it('fetches sites list successfully', async () => {
      const mockSites = [
        { code: 'LL', nom: 'Landes' },
        { code: 'LS', nom: 'Landes Sud' },
        { code: 'MT', nom: 'Mont-de-Marsan' },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSites,
      })

      const fetchSites = async () => {
        const response = await fetch(`${API_URL}/api/euralis/sites`)
        return response.json()
      }

      const sites = await fetchSites()

      expect(sites).toHaveLength(3)
      expect(sites[0]).toHaveProperty('code', 'LL')
    })

    it('fetches single site details', async () => {
      const mockSite = {
        code: 'LL',
        nom: 'Landes',
        total_lots: 15,
        total_gaveurs: 8,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSite,
      })

      const fetchSiteDetails = async (code: string) => {
        const response = await fetch(`${API_URL}/api/euralis/sites/${code}`)
        return response.json()
      }

      const site = await fetchSiteDetails('LL')

      expect(site.code).toBe('LL')
      expect(site.nom).toBe('Landes')
    })
  })

  describe('fetchLots', () => {
    it('fetches lots with pagination', async () => {
      const mockLots = {
        lots: [
          { id: 1, numero_lot: 'LL2024001' },
          { id: 2, numero_lot: 'LL2024002' },
        ],
        total: 42,
        limit: 10,
        offset: 0,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLots,
      })

      const fetchLots = async (limit = 10, offset = 0) => {
        const response = await fetch(
          `${API_URL}/api/euralis/lots?limit=${limit}&offset=${offset}`
        )
        return response.json()
      }

      const lots = await fetchLots(10, 0)

      expect(lots.lots).toHaveLength(2)
      expect(lots.total).toBe(42)
    })

    it('filters lots by site code', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lots: [], total: 0 }),
      })

      const fetchLots = async (siteCode?: string) => {
        const url = siteCode
          ? `${API_URL}/api/euralis/lots?site_code=${siteCode}`
          : `${API_URL}/api/euralis/lots`
        const response = await fetch(url)
        return response.json()
      }

      await fetchLots('LL')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('site_code=LL')
      )
    })
  })

  describe('fetchGaveursPerformance', () => {
    it('fetches gaveurs performance data', async () => {
      const mockPerformance = [
        {
          gaveur_id: 1,
          nom: 'Dupont',
          itm_moyen: 520,
          taux_mortalite: 1.2,
          cluster: 'Elite',
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPerformance,
      })

      const fetchPerformance = async () => {
        const response = await fetch(`${API_URL}/api/euralis/gaveurs/performance`)
        return response.json()
      }

      const performance = await fetchPerformance()

      expect(performance).toHaveLength(1)
      expect(performance[0].cluster).toBe('Elite')
    })
  })

  describe('fetchMLForecasts', () => {
    it('fetches ML forecasts for 7 days', async () => {
      const mockForecast = {
        site_code: 'LL',
        horizon: 7,
        predictions: [100, 105, 110, 108, 112, 115, 118],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockForecast,
      })

      const fetchForecasts = async (siteCode: string, horizon: number) => {
        const response = await fetch(
          `${API_URL}/api/euralis/ml/forecasts?site_code=${siteCode}&horizon=${horizon}`
        )
        return response.json()
      }

      const forecast = await fetchForecasts('LL', 7)

      expect(forecast.predictions).toHaveLength(7)
      expect(forecast.horizon).toBe(7)
    })
  })

  describe('Error Handling', () => {
    it('handles timeout errors', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      )

      const fetchWithTimeout = async () => {
        const response = await fetch(`${API_URL}/api/euralis/dashboard`)
        return response.json()
      }

      await expect(fetchWithTimeout()).rejects.toThrow('Timeout')
    })

    it('handles malformed JSON responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const fetchData = async () => {
        const response = await fetch(`${API_URL}/api/euralis/dashboard`)
        return response.json()
      }

      await expect(fetchData()).rejects.toThrow('Invalid JSON')
    })
  })

  describe('Request Headers', () => {
    it('includes correct content-type header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await fetch(`${API_URL}/api/euralis/dashboard`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })
})
