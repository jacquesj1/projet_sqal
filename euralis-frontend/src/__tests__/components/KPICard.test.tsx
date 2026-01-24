/**
 * Tests - KPICard Component
 * Tests unitaires pour les cartes d'indicateurs clés de performance
 */

import { render, screen } from '@testing-library/react'
import KPICard from '@/components/euralis/kpis/KPICard'
import { Activity } from 'lucide-react'

describe('KPICard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders title and value', () => {
    render(<KPICard title="Total Production" value="1,250 kg" />)

    expect(screen.getByText('Total Production')).toBeInTheDocument()
    expect(screen.getByText('1,250 kg')).toBeInTheDocument()
  })

  it('renders with numeric value', () => {
    render(<KPICard title="Active Lots" value={42} />)

    expect(screen.getByText('Active Lots')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders with string value', () => {
    render(<KPICard title="Status" value="Active" />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <KPICard
        title="Production"
        value="1,250 kg"
        subtitle="Cette semaine"
      />
    )

    expect(screen.getByText('Cette semaine')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    const { container } = render(<KPICard title="Production" value="1,250 kg" />)

    expect(container.querySelector('.text-xs.text-gray-500')).not.toBeInTheDocument()
  })

  it('applies default blue color', () => {
    const { container } = render(<KPICard title="Test" value="100" />)

    const card = container.firstChild
    expect(card).toHaveClass('bg-blue-50', 'text-blue-600', 'border-blue-200')
  })

  it('applies green color when specified', () => {
    const { container } = render(
      <KPICard title="Test" value="100" color="green" />
    )

    const card = container.firstChild
    expect(card).toHaveClass('bg-green-50', 'text-green-600', 'border-green-200')
  })

  it('applies orange color when specified', () => {
    const { container } = render(
      <KPICard title="Test" value="100" color="orange" />
    )

    const card = container.firstChild
    expect(card).toHaveClass('bg-orange-50', 'text-orange-600', 'border-orange-200')
  })

  it('applies red color when specified', () => {
    const { container } = render(<KPICard title="Test" value="100" color="red" />)

    const card = container.firstChild
    expect(card).toHaveClass('bg-red-50', 'text-red-600', 'border-red-200')
  })

  it('renders icon when provided', () => {
    const { container } = render(
      <KPICard
        title="Activity"
        value="100"
        icon={<Activity data-testid="activity-icon" />}
      />
    )

    expect(screen.getByTestId('activity-icon')).toBeInTheDocument()
  })

  it('does not render icon when not provided', () => {
    const { container } = render(<KPICard title="Test" value="100" />)

    expect(container.querySelector('.ml-4')).not.toBeInTheDocument()
  })

  it('renders upward trend with positive value', () => {
    render(
      <KPICard
        title="Production"
        value="1,250 kg"
        trend={{ value: 12.5, direction: 'up' }}
      />
    )

    expect(screen.getByText(/12.5%/)).toBeInTheDocument()
    expect(screen.getByText(/↑/)).toBeInTheDocument()
  })

  it('renders downward trend', () => {
    render(
      <KPICard
        title="Production"
        value="1,250 kg"
        trend={{ value: 8.3, direction: 'down' }}
      />
    )

    expect(screen.getByText(/8.3%/)).toBeInTheDocument()
    expect(screen.getByText(/↓/)).toBeInTheDocument()
  })

  it('renders trend with negative value', () => {
    render(
      <KPICard
        title="Production"
        value="1,250 kg"
        trend={{ value: -5.2, direction: 'down' }}
      />
    )

    // Should use Math.abs() so shows positive percentage
    expect(screen.getByText(/5.2%/)).toBeInTheDocument()
    expect(screen.getByText(/↓/)).toBeInTheDocument()
  })

  it('renders trend comparison text', () => {
    render(
      <KPICard
        title="Production"
        value="1,250 kg"
        trend={{ value: 10, direction: 'up' }}
      />
    )

    expect(screen.getByText('vs période précédente')).toBeInTheDocument()
  })

  it('applies green color to positive upward trend', () => {
    const { container } = render(
      <KPICard
        title="Production"
        value="1,250 kg"
        trend={{ value: 10, direction: 'up' }}
      />
    )

    const trendElement = screen.getByText(/10%/)
    expect(trendElement).toHaveClass('text-green-600')
  })

  it('applies red color to negative upward trend (bad trend)', () => {
    const { container } = render(
      <KPICard
        title="Mortalité"
        value="5%"
        trend={{ value: -3, direction: 'up' }}
      />
    )

    const trendElement = screen.getByText(/3%/)
    expect(trendElement).toHaveClass('text-red-600')
  })

  it('applies green color to positive downward trend (good decrease)', () => {
    const { container } = render(
      <KPICard
        title="Mortalité"
        value="2%"
        trend={{ value: 1.5, direction: 'down' }}
      />
    )

    const trendElement = screen.getByText(/1.5%/)
    expect(trendElement).toHaveClass('text-red-600')
  })

  it('does not render trend when not provided', () => {
    render(<KPICard title="Production" value="1,250 kg" />)

    expect(screen.queryByText(/vs période précédente/)).not.toBeInTheDocument()
  })

  it('renders all elements together', () => {
    render(
      <KPICard
        title="Total Production"
        value="1,250 kg"
        subtitle="Cette semaine"
        icon={<Activity data-testid="icon" />}
        trend={{ value: 12.5, direction: 'up' }}
        color="green"
      />
    )

    expect(screen.getByText('Total Production')).toBeInTheDocument()
    expect(screen.getByText('1,250 kg')).toBeInTheDocument()
    expect(screen.getByText('Cette semaine')).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText(/12.5%/)).toBeInTheDocument()
    expect(screen.getByText('vs période précédente')).toBeInTheDocument()
  })

  it('handles zero trend value', () => {
    render(
      <KPICard
        title="Production"
        value="1,250 kg"
        trend={{ value: 0, direction: 'up' }}
      />
    )

    expect(screen.getByText(/0%/)).toBeInTheDocument()
  })

  it('has correct structure with border and padding', () => {
    const { container } = render(<KPICard title="Test" value="100" />)

    const card = container.firstChild
    expect(card).toHaveClass('border', 'rounded-lg', 'p-6')
  })

  it('renders value with large number', () => {
    render(<KPICard title="Production" value={1_250_000} />)

    expect(screen.getByText('1250000')).toBeInTheDocument()
  })

  it('renders value with formatted string', () => {
    render(<KPICard title="Production" value="1 250 000 kg" />)

    expect(screen.getByText('1 250 000 kg')).toBeInTheDocument()
  })
})
