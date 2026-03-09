/**
 * Tests - EuralisAPI Class
 * Tests unitaires pour la classe client API Euralis
 */

import EuralisAPI from '@/lib/euralis/api'

describe('EuralisAPI Class', () => {
  let api: EuralisAPI
  const mockFetch = jest.fn()

  beforeEach(() => {
    global.fetch = mockFetch
    api = new EuralisAPI('http://localhost:8000')
    jest.clearAllMocks()
  })

  describe('Sites Endpoints', () => {
    it('getSites() fetches all sites', async () => {
      const mockSites = [
        { id: 1, code: 'LL', nom: 'Bretagne' },
        { id: 2, code: 'LS', nom: 'Pays de Loire' },
        { id: 3, code: 'MT', nom: 'Maubourguet' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSites,
      })

      const sites = await api.getSites()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/sites',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(sites).toEqual(mockSites)
      expect(sites).toHaveLength(3)
    })

    it('getSiteDetail() fetches single site', async () => {
      const mockSite = { id: 1, code: 'LL', nom: 'Bretagne', region: 'Bretagne' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSite,
      })

      const site = await api.getSiteDetail('LL')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/sites/LL',
        expect.any(Object)
      )
      expect(site).toEqual(mockSite)
    })

    it('getSiteStats() fetches site statistics', async () => {
      const mockStats = {
        site_code: 'LL',
        site_nom: 'Bretagne',
        nb_lots: 15,
        nb_gaveurs: 8,
        itm_moyen: 520,
        mortalite_moyenne: 1.8,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      })

      const stats = await api.getSiteStats('LL')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/sites/LL/stats',
        expect.any(Object)
      )
      expect(stats).toEqual(mockStats)
    })

    it('getSiteStats() with month filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await api.getSiteStats('LL', '2024-01')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/sites/LL/stats?mois=2024-01',
        expect.any(Object)
      )
    })

    it('getSiteLots() fetches lots for a site', async () => {
      const mockLots = [
        { id: 1, code_lot: 'LL2024001', statut: 'actif' },
        { id: 2, code_lot: 'LL2024002', statut: 'actif' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLots,
      })

      const lots = await api.getSiteLots('LL')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/euralis/sites/LL/lots'),
        expect.any(Object)
      )
      expect(lots).toEqual(mockLots)
    })

    it('getSiteLots() with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await api.getSiteLots('LL', 'termine', 50)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('statut=termine'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      )
    })

    it('compareSites() compares sites by metric', async () => {
      const mockComparison = {
        metrique: 'itm',
        sites: [
          { code: 'LL', valeur: 520 },
          { code: 'LS', valeur: 510 },
          { code: 'MT', valeur: 530 },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComparison,
      })

      const comparison = await api.compareSites('itm')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/sites/compare?metrique=itm',
        expect.any(Object)
      )
      expect(comparison).toEqual(mockComparison)
    })
  })

  describe('Dashboard Endpoints', () => {
    it('getDashboardKPIs() fetches KPIs', async () => {
      const mockKPIs = {
        production_totale_kg: 12500,
        nb_lots_actifs: 42,
        nb_lots_termines: 150,
        nb_gaveurs_actifs: 25,
        itm_moyen_global: 520,
        mortalite_moyenne_globale: 1.8,
        nb_alertes_critiques: 3,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockKPIs,
      })

      const kpis = await api.getDashboardKPIs()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/dashboard/kpis',
        expect.any(Object)
      )
      expect(kpis).toEqual(mockKPIs)
    })

    it('getProductionChart() fetches production chart data', async () => {
      const mockChartData = [
        { date: '2024-01', LL: 1250, LS: 980, MT: 1100 },
        { date: '2024-02', LL: 1340, LS: 1020, MT: 1180 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChartData,
      })

      const data = await api.getProductionChart(30)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/dashboard/charts/production?periode=30',
        expect.any(Object)
      )
      expect(data).toEqual(mockChartData)
    })

    it('getITMComparisonChart() fetches ITM comparison', async () => {
      const mockChartData = [
        { site: 'LL', itm: 520, sigma: 42 },
        { site: 'LS', itm: 510, sigma: 38 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChartData,
      })

      const data = await api.getITMComparisonChart()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/dashboard/charts/itm',
        expect.any(Object)
      )
      expect(data).toEqual(mockChartData)
    })
  })

  describe('Lots Endpoints', () => {
    it('getLots() fetches lots with default params', async () => {
      const mockLots = [
        { id: 1, code_lot: 'LL2024001' },
        { id: 2, code_lot: 'LS2024001' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLots,
      })

      const lots = await api.getLots()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/euralis/lots?'),
        expect.any(Object)
      )
      expect(lots).toEqual(mockLots)
    })

    it('getLots() with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await api.getLots('LL', 'actif', 50, 10)

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('site_code=LL')
      expect(callUrl).toContain('statut=actif')
      expect(callUrl).toContain('limit=50')
      expect(callUrl).toContain('offset=10')
    })

    it('getLotDetail() fetches single lot', async () => {
      const mockLot = {
        id: 1,
        code_lot: 'LL2024001',
        site_code: 'LL',
        itm: 520,
        sigma: 42,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLot,
      })

      const lot = await api.getLotDetail(1)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/lots/1',
        expect.any(Object)
      )
      expect(lot).toEqual(mockLot)
    })

    it('getLotDoses() fetches doses for a lot', async () => {
      const mockDoses = [
        { jour: 1, dose: 100 },
        { jour: 2, dose: 150 },
        { jour: 3, dose: 200 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDoses,
      })

      const doses = await api.getLotDoses(1)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/lots/1/doses',
        expect.any(Object)
      )
      expect(doses).toEqual(mockDoses)
    })
  })

  describe('Alertes Endpoints', () => {
    it('getAlertes() fetches alerts with default params', async () => {
      const mockAlertes = [
        {
          id: 1,
          time: '2024-01-01T10:00:00Z',
          niveau: 'warning',
          severite: 'important' as const,
          message: 'Mortalité élevée',
          acquittee: false,
          type_alerte: 'mortalite',
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertes,
      })

      const alertes = await api.getAlertes()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/euralis/alertes?'),
        expect.any(Object)
      )
      expect(alertes).toEqual(mockAlertes)
    })

    it('getAlertes() with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await api.getAlertes('warning', 'LL', 'critique', false, 20)

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('niveau=warning')
      expect(callUrl).toContain('site_code=LL')
      expect(callUrl).toContain('severite=critique')
      expect(callUrl).toContain('acquittee=false')
      expect(callUrl).toContain('limit=20')
    })

    it('acquitterAlerte() acknowledges an alert', async () => {
      const mockResponse = { message: 'Alerte acquittée' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await api.acquitterAlerte(1)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/alertes/1/acquitter',
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Health Endpoint', () => {
    it('healthCheck() checks API health', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2024-01-01T10:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      })

      const health = await api.healthCheck()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/euralis/health',
        expect.any(Object)
      )
      expect(health).toEqual(mockHealth)
    })
  })

  describe('Error Handling', () => {
    it('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      })

      await expect(api.getSites()).rejects.toThrow('API Error: Not Found')
    })

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(api.getSites()).rejects.toThrow('Network error')
    })

    it('logs error to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      mockFetch.mockRejectedValueOnce(new Error('Test error'))

      await expect(api.getSites()).rejects.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching /api/euralis/sites:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      await expect(api.getSites()).rejects.toThrow('Invalid JSON')
    })
  })

  describe('Constructor', () => {
    it('uses default API_URL when not provided', () => {
      const defaultApi = new EuralisAPI()
      expect(defaultApi).toBeInstanceOf(EuralisAPI)
    })

    it('uses custom baseUrl when provided', () => {
      const customApi = new EuralisAPI('https://custom.api.com')
      expect(customApi).toBeInstanceOf(EuralisAPI)
    })
  })

  describe('Headers', () => {
    it('includes Content-Type header in all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await api.getSites()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('merges custom headers with default headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'OK' }),
      })

      await api.acquitterAlerte(1)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })
})
