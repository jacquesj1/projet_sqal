/**
 * Tests - ProductionChart Component
 * Tests unitaires pour le graphique de production multi-sites
 */

import { render, screen } from '@testing-library/react'
import ProductionChart from '@/components/euralis/charts/ProductionChart'

// Mock Recharts
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Line: ({ dataKey, name }: any) => <div data-testid="line" data-key={dataKey} data-name={name} />,
  Area: ({ dataKey, name }: any) => <div data-testid="area" data-key={dataKey} data-name={name} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

describe('ProductionChart Component', () => {
  const mockData = [
    { date: '2024-01', LL: 1250, LS: 980, MT: 1100 },
    { date: '2024-02', LL: 1340, LS: 1020, MT: 1180 },
    { date: '2024-03', LL: 1420, LS: 1100, MT: 1250 },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders area chart by default', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('renders line chart when type is line', () => {
    render(<ProductionChart data={mockData} type="line" />)

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
  })

  it('renders all three site lines/areas (LL, LS, MT)', () => {
    render(<ProductionChart data={mockData} type="area" />)

    const areas = screen.getAllByTestId('area')
    expect(areas).toHaveLength(3)

    // Vérifier les dataKeys
    const dataKeys = areas.map(area => area.getAttribute('data-key'))
    expect(dataKeys).toContain('LL')
    expect(dataKeys).toContain('LS')
    expect(dataKeys).toContain('MT')
  })

  it('renders site names in legend format', () => {
    render(<ProductionChart data={mockData} type="area" />)

    const areas = screen.getAllByTestId('area')
    const names = areas.map(area => area.getAttribute('data-name'))

    expect(names).toContain('Bretagne (LL)')
    expect(names).toContain('Pays de Loire (LS)')
    expect(names).toContain('Maubourguet (MT)')
  })

  it('renders ResponsiveContainer', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders CartesianGrid', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
  })

  it('renders XAxis', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
  })

  it('renders YAxis', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
  })

  it('renders Tooltip', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
  })

  it('renders Legend', () => {
    render(<ProductionChart data={mockData} />)

    expect(screen.getByTestId('legend')).toBeInTheDocument()
  })

  it('handles empty data array', () => {
    render(<ProductionChart data={[]} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('handles single data point', () => {
    const singleData = [{ date: '2024-01', LL: 1250, LS: 980, MT: 1100 }]

    render(<ProductionChart data={singleData} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.getAllByTestId('area')).toHaveLength(3)
  })

  it('renders all components when type is line', () => {
    render(<ProductionChart data={mockData} type="line" />)

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('legend')).toBeInTheDocument()
  })

  it('renders three Line components when type is line', () => {
    render(<ProductionChart data={mockData} type="line" />)

    const lines = screen.getAllByTestId('line')
    expect(lines).toHaveLength(3)
  })

  it('has correct container styling', () => {
    const { container } = render(<ProductionChart data={mockData} />)

    const chartContainer = container.firstChild
    expect(chartContainer).toHaveClass('w-full', 'h-80')
  })

  it('handles large dataset', () => {
    const largeData = Array.from({ length: 100 }, (_, i) => ({
      date: `2024-${String(i + 1).padStart(2, '0')}`,
      LL: 1000 + Math.random() * 500,
      LS: 900 + Math.random() * 400,
      MT: 1000 + Math.random() * 450,
    }))

    render(<ProductionChart data={largeData} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('handles missing site data gracefully', () => {
    const partialData = [
      { date: '2024-01', LL: 1250 }, // Missing LS and MT
      { date: '2024-02', LS: 1020 }, // Missing LL and MT
    ]

    render(<ProductionChart data={partialData} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.getAllByTestId('area')).toHaveLength(3)
  })

  it('renders with default type when type prop is undefined', () => {
    render(<ProductionChart data={mockData} type={undefined} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })
})
