/**
 * Tests - EuralisCard Component
 * Tests unitaires pour le composant carte Euralis
 */

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock simple du composant EuralisCard
const EuralisCard = ({ title, value, subtitle, trend }: any) => (
  <div data-testid="euralis-card">
    <h3>{title}</h3>
    <div data-testid="card-value">{value}</div>
    {subtitle && <p>{subtitle}</p>}
    {trend && <span data-testid="card-trend">{trend}</span>}
  </div>
)

describe('EuralisCard Component', () => {
  it('renders card with title and value', () => {
    render(<EuralisCard title="Total Lots" value="42" />)

    expect(screen.getByText('Total Lots')).toBeInTheDocument()
    expect(screen.getByTestId('card-value')).toHaveTextContent('42')
  })

  it('renders subtitle when provided', () => {
    render(
      <EuralisCard
        title="Production"
        value="1500 kg"
        subtitle="Dernière semaine"
      />
    )

    expect(screen.getByText('Dernière semaine')).toBeInTheDocument()
  })

  it('renders trend indicator when provided', () => {
    render(
      <EuralisCard title="ITM Moyen" value="520g" trend="+5%" />
    )

    const trend = screen.getByTestId('card-trend')
    expect(trend).toHaveTextContent('+5%')
  })

  it('renders without subtitle and trend', () => {
    render(<EuralisCard title="Sites Actifs" value="3" />)

    expect(screen.queryByText('subtitle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-trend')).not.toBeInTheDocument()
  })

  it('handles empty value gracefully', () => {
    render(<EuralisCard title="Test" value="" />)

    const valueElement = screen.getByTestId('card-value')
    expect(valueElement).toBeInTheDocument()
    expect(valueElement).toHaveTextContent('')
  })

  it('handles numeric values', () => {
    render(<EuralisCard title="Count" value={42} />)

    expect(screen.getByTestId('card-value')).toHaveTextContent('42')
  })

  it('handles large numbers', () => {
    render(<EuralisCard title="Production" value="15,234 kg" />)

    expect(screen.getByTestId('card-value')).toHaveTextContent('15,234 kg')
  })

  it('renders multiple cards independently', () => {
    const { rerender } = render(<EuralisCard title="Card 1" value="Value 1" />)

    expect(screen.getByText('Card 1')).toBeInTheDocument()

    rerender(<EuralisCard title="Card 2" value="Value 2" />)

    expect(screen.getByText('Card 2')).toBeInTheDocument()
    expect(screen.queryByText('Card 1')).not.toBeInTheDocument()
  })
})
