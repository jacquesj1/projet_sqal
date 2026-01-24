/**
 * Tests - RealtimeChart Component
 * Tests unitaires pour le graphique temps réel
 */

import { render, screen } from '@testing-library/react'
import { RealtimeChart } from '../RealtimeChart'

// Mock Recharts
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}))

describe('RealtimeChart Component', () => {
  const mockData = [
    { timestamp: '10:00', value: 25.5 },
    { timestamp: '10:05', value: 26.2 },
    { timestamp: '10:10', value: 24.8 },
  ]

  it('renders chart with title', () => {
    render(<RealtimeChart data={mockData} title="Temperature Chart" />)

    expect(screen.getByText('Temperature Chart')).toBeInTheDocument()
  })

  it('renders chart with description', () => {
    render(
      <RealtimeChart
        data={mockData}
        title="Temperature"
        description="Real-time temperature monitoring"
      />
    )

    expect(screen.getByText('Real-time temperature monitoring')).toBeInTheDocument()
  })

  it('renders without description', () => {
    render(<RealtimeChart data={mockData} title="Temperature" />)

    expect(screen.queryByText(/monitoring/)).not.toBeInTheDocument()
  })

  it('renders all chart components', () => {
    render(<RealtimeChart data={mockData} title="Test Chart" />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('line')).toBeInTheDocument()
  })

  it('renders legend when showLegend is true', () => {
    render(<RealtimeChart data={mockData} title="Chart" showLegend={true} />)

    expect(screen.getByTestId('legend')).toBeInTheDocument()
  })

  it('does not render legend when showLegend is false', () => {
    render(<RealtimeChart data={mockData} title="Chart" showLegend={false} />)

    expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
  })

  it('renders with custom dataKey', () => {
    const customData = [
      { timestamp: '10:00', temperature: 25.5 },
      { timestamp: '10:05', temperature: 26.2 },
    ]

    render(<RealtimeChart data={customData} title="Chart" dataKey="temperature" />)

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders with custom xAxisKey', () => {
    const customData = [
      { time: '10:00', value: 25.5 },
      { time: '10:05', value: 26.2 },
    ]

    render(<RealtimeChart data={customData} title="Chart" xAxisKey="time" />)

    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
  })

  it('renders with custom color', () => {
    render(<RealtimeChart data={mockData} title="Chart" color="#ff0000" />)

    expect(screen.getByTestId('line')).toBeInTheDocument()
  })

  it('renders with custom height', () => {
    render(<RealtimeChart data={mockData} title="Chart" height={500} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders with empty data', () => {
    render(<RealtimeChart data={[]} title="Empty Chart" />)

    expect(screen.getByText('Empty Chart')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders with yAxisLabel', () => {
    render(<RealtimeChart data={mockData} title="Chart" yAxisLabel="Temperature (°C)" />)

    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
  })

  it('renders with xAxisLabel', () => {
    render(<RealtimeChart data={mockData} title="Chart" xAxisLabel="Time" />)

    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
  })

  it('uses default props when not provided', () => {
    render(<RealtimeChart data={mockData} title="Default Chart" />)

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('legend')).toBeInTheDocument() // showLegend defaults to true
  })

  it('renders with single data point', () => {
    const singleData = [{ timestamp: '10:00', value: 25.5 }]

    render(<RealtimeChart data={singleData} title="Single Point" />)

    expect(screen.getByText('Single Point')).toBeInTheDocument()
  })

  it('renders with large dataset', () => {
    const largeData = Array.from({ length: 100 }, (_, i) => ({
      timestamp: `10:${i.toString().padStart(2, '0')}`,
      value: Math.random() * 100,
    }))

    render(<RealtimeChart data={largeData} title="Large Dataset" />)

    expect(screen.getByText('Large Dataset')).toBeInTheDocument()
  })

  it('renders with all optional props', () => {
    render(
      <RealtimeChart
        data={mockData}
        title="Full Chart"
        description="Complete test"
        dataKey="value"
        xAxisKey="timestamp"
        color="#00ff00"
        height={400}
        showLegend={true}
        yAxisLabel="Value"
        xAxisLabel="Time"
      />
    )

    expect(screen.getByText('Full Chart')).toBeInTheDocument()
    expect(screen.getByText('Complete test')).toBeInTheDocument()
  })
})
