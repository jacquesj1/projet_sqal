/**
 * Tests - SpectralChart Component
 * Tests unitaires pour le graphique spectral AS7341
 */

import { render, screen } from '@testing-library/react'
import { SpectralChart } from '../SpectralChart'

// Mock Recharts
jest.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}))

describe('SpectralChart Component', () => {
  const mockSpectralData = [
    { wavelength: '415nm', intensity: 1200, color: '#8B00FF' },
    { wavelength: '445nm', intensity: 1500, color: '#4B0082' },
    { wavelength: '480nm', intensity: 1800, color: '#0000FF' },
    { wavelength: '515nm', intensity: 2000, color: '#00FFFF' },
    { wavelength: '555nm', intensity: 2200, color: '#00FF00' },
    { wavelength: '590nm', intensity: 1900, color: '#FFFF00' },
    { wavelength: '630nm', intensity: 1600, color: '#FFA500' },
    { wavelength: '680nm', intensity: 1300, color: '#FF0000' },
  ]

  it('renders chart with default title', () => {
    render(<SpectralChart data={mockSpectralData} />)

    expect(screen.getByText("Spectre d'Absorption")).toBeInTheDocument()
  })

  it('renders chart with custom title', () => {
    render(<SpectralChart data={mockSpectralData} title="AS7341 Spectral Analysis" />)

    expect(screen.getByText('AS7341 Spectral Analysis')).toBeInTheDocument()
  })

  it('renders chart with description', () => {
    render(
      <SpectralChart
        data={mockSpectralData}
        description="10-channel spectral sensor data"
      />
    )

    expect(screen.getByText('10-channel spectral sensor data')).toBeInTheDocument()
  })

  it('renders without description', () => {
    render(<SpectralChart data={mockSpectralData} />)

    expect(screen.queryByText(/channel/)).not.toBeInTheDocument()
  })

  it('renders all chart components', () => {
    render(<SpectralChart data={mockSpectralData} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('area')).toBeInTheDocument()
  })

  it('renders color legend for all wavelengths', () => {
    render(<SpectralChart data={mockSpectralData} />)

    mockSpectralData.forEach((point) => {
      expect(screen.getByText(point.wavelength)).toBeInTheDocument()
    })
  })

  it('renders color boxes with correct background colors', () => {
    const { container } = render(<SpectralChart data={mockSpectralData} />)

    const colorBoxes = container.querySelectorAll('.w-4.h-4.rounded')
    expect(colorBoxes).toHaveLength(mockSpectralData.length)

    colorBoxes.forEach((box, index) => {
      const expectedColor = mockSpectralData[index].color
      expect(box).toHaveStyle({ backgroundColor: expectedColor })
    })
  })

  it('renders with custom height', () => {
    render(<SpectralChart data={mockSpectralData} height={500} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders with gradient when showGradient is true', () => {
    render(<SpectralChart data={mockSpectralData} showGradient={true} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('renders without gradient when showGradient is false', () => {
    render(<SpectralChart data={mockSpectralData} showGradient={false} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('renders with empty data', () => {
    render(<SpectralChart data={[]} />)

    expect(screen.getByText("Spectre d'Absorption")).toBeInTheDocument()
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('renders with single wavelength', () => {
    const singleData = [{ wavelength: '555nm', intensity: 2000, color: '#00FF00' }]

    render(<SpectralChart data={singleData} />)

    expect(screen.getByText('555nm')).toBeInTheDocument()
  })

  it('renders with all AS7341 channels (10 channels)', () => {
    const fullAS7341Data = [
      { wavelength: '415nm', intensity: 1200, color: '#8B00FF' },
      { wavelength: '445nm', intensity: 1500, color: '#4B0082' },
      { wavelength: '480nm', intensity: 1800, color: '#0000FF' },
      { wavelength: '515nm', intensity: 2000, color: '#00FFFF' },
      { wavelength: '555nm', intensity: 2200, color: '#00FF00' },
      { wavelength: '590nm', intensity: 1900, color: '#FFFF00' },
      { wavelength: '630nm', intensity: 1600, color: '#FFA500' },
      { wavelength: '680nm', intensity: 1300, color: '#FF0000' },
      { wavelength: '850nm', intensity: 1000, color: '#8B0000' },
      { wavelength: 'Clear', intensity: 15000, color: '#FFFFFF' },
    ]

    render(<SpectralChart data={fullAS7341Data} />)

    expect(screen.getAllByText(/nm|Clear/)).toHaveLength(10)
  })

  it('uses default props when not provided', () => {
    render(<SpectralChart data={mockSpectralData} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.getByText("Spectre d'Absorption")).toBeInTheDocument()
  })

  it('renders with all optional props', () => {
    render(
      <SpectralChart
        data={mockSpectralData}
        title="Custom Spectral"
        description="Test description"
        height={400}
        showGradient={false}
      />
    )

    expect(screen.getByText('Custom Spectral')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('renders legend in centered flex layout', () => {
    const { container } = render(<SpectralChart data={mockSpectralData} />)

    const legend = container.querySelector('.flex.flex-wrap.gap-2.justify-center')
    expect(legend).toBeInTheDocument()
  })

  it('handles high intensity values', () => {
    const highIntensityData = [
      { wavelength: '555nm', intensity: 65535, color: '#00FF00' }, // Max ADC value
    ]

    render(<SpectralChart data={highIntensityData} />)

    expect(screen.getByText('555nm')).toBeInTheDocument()
  })

  it('handles zero intensity values', () => {
    const zeroIntensityData = [
      { wavelength: '415nm', intensity: 0, color: '#8B00FF' },
    ]

    render(<SpectralChart data={zeroIntensityData} />)

    expect(screen.getByText('415nm')).toBeInTheDocument()
  })
})
