import { render, screen, fireEvent } from '@testing-library/react'
import Card, { KPICard } from '../Card'

describe('Card Component', () => {
  describe('Basic Rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('applies base classes', () => {
      const { container } = render(<Card>Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('rounded-lg', 'shadow-lg', 'p-6')
    })

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('custom-class')
    })
  })

  describe('Gradient Support', () => {
    it('uses white background by default', () => {
      const { container } = render(<Card>Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-white')
    })

    it('applies gradient when provided', () => {
      const { container } = render(<Card gradient="from-blue-500 to-purple-500">Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-gradient-to-br', 'from-blue-500', 'to-purple-500')
      expect(card).not.toHaveClass('bg-white')
    })
  })

  describe('Hover Effects', () => {
    it('does not have hover effects by default', () => {
      const { container } = render(<Card>Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).not.toHaveClass('hover:shadow-xl')
      expect(card).not.toHaveClass('cursor-pointer')
    })

    it('applies hover effects when enabled', () => {
      const { container } = render(<Card hover>Test</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('hover:shadow-xl', 'transition-shadow', 'cursor-pointer')
    })
  })

  describe('Click Interaction', () => {
    it('calls onClick when clicked', () => {
      const handleClick = jest.fn()
      const { container } = render(<Card onClick={handleClick}>Click me</Card>)

      const card = container.firstChild as HTMLElement
      fireEvent.click(card)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('can be clicked without onClick handler', () => {
      const { container } = render(<Card>Test</Card>)
      const card = container.firstChild as HTMLElement

      expect(() => fireEvent.click(card)).not.toThrow()
    })
  })

  describe('Complex Children', () => {
    it('renders nested components', () => {
      render(
        <Card>
          <div data-testid="nested-div">
            <h2>Title</h2>
            <p>Description</p>
          </div>
        </Card>
      )

      expect(screen.getByTestId('nested-div')).toBeInTheDocument()
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })
})

describe('KPICard Component', () => {
  const defaultProps = {
    icon: <span data-testid="test-icon">Icon</span>,
    label: 'Total Users',
    value: 1234,
    color: 'blue' as const,
  }

  describe('Basic Rendering', () => {
    it('renders all required elements', () => {
      render(<KPICard {...defaultProps} />)

      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(screen.getByText('Total Users')).toBeInTheDocument()
      expect(screen.getByText('1234')).toBeInTheDocument()
    })

    it('renders string value', () => {
      render(<KPICard {...defaultProps} value="99.5%" />)
      expect(screen.getByText('99.5%')).toBeInTheDocument()
    })

    it('renders numeric value', () => {
      render(<KPICard {...defaultProps} value={42} />)
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renders subtitle when provided', () => {
      render(<KPICard {...defaultProps} subtitle="+5% from last month" />)
      expect(screen.getByText('+5% from last month')).toBeInTheDocument()
    })

    it('does not render subtitle when not provided', () => {
      const { container } = render(<KPICard {...defaultProps} />)
      const subtitle = container.querySelector('.text-xs')
      expect(subtitle).not.toBeInTheDocument()
    })
  })

  describe('Color Variants', () => {
    it('renders blue color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="blue" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('from-blue-500', 'to-blue-600')
    })

    it('renders green color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="green" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('from-green-500', 'to-green-600')
    })

    it('renders red color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="red" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('from-red-500', 'to-red-600')
    })

    it('renders purple color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="purple" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('from-purple-500', 'to-purple-600')
    })

    it('renders orange color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="orange" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('from-orange-500', 'to-orange-600')
    })

    it('renders cyan color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="cyan" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('from-cyan-500', 'to-cyan-600')
    })
  })

  describe('Styling', () => {
    it('has correct base classes', () => {
      const { container } = render(<KPICard {...defaultProps} />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-gradient-to-br', 'rounded-lg', 'shadow-lg', 'p-6', 'text-white')
    })

    it('displays icon with correct opacity', () => {
      const { container } = render(<KPICard {...defaultProps} />)
      const iconContainer = container.querySelector('.opacity-80')
      expect(iconContainer).toBeInTheDocument()
    })

    it('displays label with correct styling', () => {
      const { container } = render(<KPICard {...defaultProps} />)
      const label = screen.getByText('Total Users')
      expect(label).toHaveClass('text-sm', 'opacity-90')
    })

    it('displays value with correct styling', () => {
      const { container } = render(<KPICard {...defaultProps} />)
      const value = screen.getByText('1234')
      expect(value).toHaveClass('text-4xl', 'font-bold', 'mt-2')
    })
  })

  describe('Layout', () => {
    it('arranges icon and content in flex layout', () => {
      const { container } = render(<KPICard {...defaultProps} />)
      const flexContainer = container.querySelector('.flex.items-center.justify-between')
      expect(flexContainer).toBeInTheDocument()
    })
  })
})
