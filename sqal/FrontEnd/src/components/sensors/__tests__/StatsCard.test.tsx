/**
 * Tests - StatsCard Component
 * Tests unitaires pour la carte de statistiques
 */

import { render, screen } from '@testing-library/react'
import { StatsCard } from '../StatsCard'

describe('StatsCard Component', () => {
  it('renders title and value', () => {
    render(<StatsCard title="Temperature" value={25.5} />)

    expect(screen.getByText('Temperature')).toBeInTheDocument()
    expect(screen.getByText(/25.5/)).toBeInTheDocument()
  })

  it('renders with unit', () => {
    render(<StatsCard title="Temperature" value={25.5} unit="°C" />)

    expect(screen.getByText(/25.5 °C/)).toBeInTheDocument()
  })

  it('renders without unit', () => {
    render(<StatsCard title="Count" value={42} />)

    const content = screen.getByText(/42/)
    expect(content).toBeInTheDocument()
    expect(content.textContent).toBe('42 ')
  })

  it('renders string value', () => {
    render(<StatsCard title="Status" value="Active" />)

    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders numeric value as string', () => {
    render(<StatsCard title="ID" value="12345" unit="items" />)

    expect(screen.getByText(/12345 items/)).toBeInTheDocument()
  })

  it('renders zero value', () => {
    render(<StatsCard title="Errors" value={0} />)

    expect(screen.getByText(/^0/)).toBeInTheDocument()
  })

  it('renders negative value', () => {
    render(<StatsCard title="Deviation" value={-5.2} unit="mm" />)

    expect(screen.getByText(/-5.2 mm/)).toBeInTheDocument()
  })

  it('renders large number', () => {
    render(<StatsCard title="Total Samples" value={1234567} />)

    expect(screen.getByText(/1234567/)).toBeInTheDocument()
  })

  it('renders decimal number with precision', () => {
    render(<StatsCard title="Precision" value={3.14159} unit="rad" />)

    expect(screen.getByText(/3.14159 rad/)).toBeInTheDocument()
  })

  it('has correct styling classes', () => {
    const { container } = render(<StatsCard title="Test" value={100} />)

    const card = container.querySelector('.shadow-md.rounded-2xl')
    expect(card).toBeInTheDocument()

    const valueElement = screen.getByText(/100/)
    expect(valueElement).toHaveClass('text-3xl', 'font-bold')

    const title = screen.getByText('Test')
    expect(title).toHaveClass('text-lg')
  })
})
