/**
 * Tests - API Service
 * Tests unitaires pour le client API Axios
 */

import axios from 'axios'
import { api } from '../api'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('API Service', () => {
  const mockApiClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedAxios.create = jest.fn().mockReturnValue(mockApiClient)
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Generic HTTP Methods', () => {
    it('performs GET request', async () => {
      const mockData = { id: 1, name: 'Test' }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.get('/test-endpoint')

      expect(mockApiClient.get).toHaveBeenCalledWith('/test-endpoint', { params: undefined })
      expect(result).toEqual(mockData)
    })

    it('performs GET request with query parameters', async () => {
      const mockData = [{ id: 1 }, { id: 2 }]
      const params = { limit: 10, offset: 0 }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.get('/test-endpoint', params)

      expect(mockApiClient.get).toHaveBeenCalledWith('/test-endpoint', { params })
      expect(result).toEqual(mockData)
    })

    it('performs POST request', async () => {
      const mockData = { id: 1, created: true }
      const postData = { name: 'New Item' }
      mockApiClient.post.mockResolvedValueOnce({ data: mockData })

      const result = await api.post('/test-endpoint', postData)

      expect(mockApiClient.post).toHaveBeenCalledWith('/test-endpoint', postData)
      expect(result).toEqual(mockData)
    })

    it('performs PUT request', async () => {
      const mockData = { id: 1, updated: true }
      const putData = { name: 'Updated Item' }
      mockApiClient.put.mockResolvedValueOnce({ data: mockData })

      const result = await api.put('/test-endpoint', putData)

      expect(mockApiClient.put).toHaveBeenCalledWith('/test-endpoint', putData)
      expect(result).toEqual(mockData)
    })

    it('performs PATCH request', async () => {
      const mockData = { id: 1, patched: true }
      const patchData = { status: 'active' }
      mockApiClient.patch.mockResolvedValueOnce({ data: mockData })

      const result = await api.patch('/test-endpoint', patchData)

      expect(mockApiClient.patch).toHaveBeenCalledWith('/test-endpoint', patchData)
      expect(result).toEqual(mockData)
    })

    it('performs DELETE request', async () => {
      const mockData = { success: true }
      mockApiClient.delete.mockResolvedValueOnce({ data: mockData })

      const result = await api.delete('/test-endpoint')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/test-endpoint')
      expect(result).toEqual(mockData)
    })
  })

  describe('Error Handling', () => {
    it('handles network errors', async () => {
      const networkError = new Error('Network Error')
      mockApiClient.get.mockRejectedValueOnce(networkError)

      await expect(api.get('/test-endpoint')).rejects.toThrow('Network Error')
    })

    it('handles 404 errors', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Not Found' },
        },
        config: { url: '/test-endpoint' },
      }
      mockApiClient.get.mockRejectedValueOnce(error)

      await expect(api.get('/test-endpoint')).rejects.toMatchObject(error)
    })

    it('handles 500 errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      }
      mockApiClient.get.mockRejectedValueOnce(error)

      await expect(api.get('/test-endpoint')).rejects.toMatchObject(error)
    })
  })

  describe('Sensors API', () => {
    it('fetches VL53L8CH raw data', async () => {
      const mockData = [{ id: 1, matrix: [[]] }]
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getVL53L8CHRaw({ limit: 10 })

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/vl53l8ch/raw/', {
        params: { limit: 10 },
      })
    })

    it('fetches VL53L8CH analysis', async () => {
      const mockData = { analysis: 'data' }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getVL53L8CHAnalysis()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/vl53l8ch/analysis/', undefined)
    })

    it('fetches VL53L8CH by ID', async () => {
      const mockData = { id: '123', matrix: [[]] }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getVL53L8CHById('123')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/vl53l8ch/raw/123/')
    })

    it('fetches AS7341 raw data', async () => {
      const mockData = [{ id: 1, spectral: {} }]
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getAS7341Raw()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/as7341/raw/', undefined)
    })

    it('fetches AS7341 analysis', async () => {
      const mockData = { analysis: 'spectral data' }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getAS7341Analysis({ page: 1 })

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/as7341/analysis/', {
        page: 1,
      })
    })

    it('fetches AS7341 by ID', async () => {
      const mockData = { id: '456', spectral: {} }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getAS7341ById('456')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/as7341/raw/456/')
    })

    it('fetches fusion results', async () => {
      const mockData = [{ id: 1, fusion_score: 85 }]
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getFusionResults({ limit: 5 })

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/fusion/', { limit: 5 })
    })

    it('fetches fusion result by ID', async () => {
      const mockData = { id: '789', fusion_score: 90 }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getFusionById('789')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/fusion/789/')
    })

    it('fetches devices list', async () => {
      const mockData = [
        { id: 'device1', name: 'Device 1' },
        { id: 'device2', name: 'Device 2' },
      ]
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getDevices()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/devices/', undefined)
    })

    it('fetches device by ID', async () => {
      const mockData = { id: 'dev123', name: 'Test Device' }
      mockApiClient.get.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.getDeviceById('dev123')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/sensors/devices/dev123/')
    })

    it('updates device', async () => {
      const mockData = { id: 'dev123', name: 'Updated Device' }
      const updateData = { name: 'Updated Device' }
      mockApiClient.patch.mockResolvedValueOnce({ data: mockData })

      const result = await api.sensors.updateDevice('dev123', updateData)

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/api/sensors/devices/dev123/',
        updateData
      )
    })
  })

  describe('Request Timeout', () => {
    it('uses configured timeout', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      )
    })
  })

  describe('Content-Type Header', () => {
    it('sets application/json as default content-type', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    })
  })
})
