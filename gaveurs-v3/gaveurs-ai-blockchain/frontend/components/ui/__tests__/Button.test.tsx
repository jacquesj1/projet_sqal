import { render, screen, fireEvent } from '@testing-library/react'
import Button from '../Button'

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with children', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      const { container } = render(<Button className="custom-class">Test</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('Variants', () => {
    it('renders primary variant by default', () => {
      const { container } = render(<Button>Primary</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-blue-600')
    })

    it('renders secondary variant', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-gray-200')
    })

    it('renders success variant', () => {
      const { container } = render(<Button variant="success">Success</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-green-600')
    })

    it('renders danger variant', () => {
      const { container } = render(<Button variant="danger">Danger</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-red-600')
    })

    it('renders warning variant', () => {
      const { container } = render(<Button variant="warning">Warning</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-orange-500')
    })

    it('renders ghost variant', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-transparent')
    })
  })

  describe('Sizes', () => {
    it('renders medium size by default', () => {
      const { container } = render(<Button>Medium</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('px-6 py-3')
    })

    it('renders small size', () => {
      const { container } = render(<Button size="sm">Small</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('px-3 py-1.5 text-sm')
    })

    it('renders large size', () => {
      const { container } = render(<Button size="lg">Large</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('px-8 py-4 text-lg')
    })
  })

  describe('States', () => {
    it('can be disabled', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('shows loading state', () => {
      render(<Button loading>Loading</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('disables button when loading', () => {
      render(<Button loading>Test</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Interaction', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = jest.fn()
      render(<Button onClick={handleClick}>Click</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const handleClick = jest.fn()
      render(<Button disabled onClick={handleClick}>Disabled</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', () => {
      const handleClick = jest.fn()
      render(<Button loading onClick={handleClick}>Loading</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Icon Support', () => {
    it('renders with icon', () => {
      const icon = <span data-testid="test-icon">Icon</span>
      render(<Button icon={icon}>With Icon</Button>)

      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(screen.getByText('With Icon')).toBeInTheDocument()
    })

    it('does not show icon when loading', () => {
      const icon = <span data-testid="test-icon">Icon</span>
      render(<Button icon={icon} loading>Loading</Button>)

      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument()
    })
  })

  describe('HTML Attributes', () => {
    it('forwards HTML button attributes', () => {
      render(<Button type="submit" name="submitBtn">Submit</Button>)
      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('name', 'submitBtn')
    })

    it('supports data attributes', () => {
      render(<Button data-testid="custom-button">Test</Button>)
      expect(screen.getByTestId('custom-button')).toBeInTheDocument()
    })
  })
})
