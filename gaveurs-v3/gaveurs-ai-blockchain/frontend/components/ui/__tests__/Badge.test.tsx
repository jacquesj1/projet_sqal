import { render, screen } from '@testing-library/react'
import Badge from '../Badge'

describe('Badge Component', () => {
  describe('Basic Rendering', () => {
    it('renders children correctly', () => {
      render(<Badge>Test Badge</Badge>)
      expect(screen.getByText('Test Badge')).toBeInTheDocument()
    })

    it('renders as span element', () => {
      const { container } = render(<Badge>Badge</Badge>)
      const badge = container.firstChild
      expect(badge?.nodeName).toBe('SPAN')
    })

    it('applies base classes', () => {
      const { container } = render(<Badge>Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full', 'font-bold')
    })

    it('applies custom className', () => {
      const { container } = render(<Badge className="custom-class">Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('custom-class')
    })
  })

  describe('Variant Styles', () => {
    it('renders default variant by default', () => {
      const { container } = render(<Badge>Default</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800')
    })

    it('renders success variant', () => {
      const { container } = render(<Badge variant="success">Success</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('renders warning variant', () => {
      const { container } = render(<Badge variant="warning">Warning</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800')
    })

    it('renders danger variant', () => {
      const { container } = render(<Badge variant="danger">Danger</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('renders info variant', () => {
      const { container } = render(<Badge variant="info">Info</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
    })
  })

  describe('Size Variants', () => {
    it('renders medium size by default', () => {
      const { container } = render(<Badge>Medium</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('px-3', 'py-1', 'text-xs')
    })

    it('renders small size', () => {
      const { container } = render(<Badge size="sm">Small</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs')
    })

    it('renders medium size explicitly', () => {
      const { container } = render(<Badge size="md">Medium</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('px-3', 'py-1', 'text-xs')
    })
  })

  describe('Content Rendering', () => {
    it('renders text content', () => {
      render(<Badge>Text Badge</Badge>)
      expect(screen.getByText('Text Badge')).toBeInTheDocument()
    })

    it('renders numeric content', () => {
      render(<Badge>42</Badge>)
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renders with icon and text', () => {
      const icon = <span data-testid="badge-icon">★</span>
      render(
        <Badge>
          {icon} Featured
        </Badge>
      )
      expect(screen.getByTestId('badge-icon')).toBeInTheDocument()
      expect(screen.getByText('Featured', { exact: false })).toBeInTheDocument()
    })

    it('renders complex children', () => {
      render(
        <Badge>
          <span data-testid="badge-content">
            <strong>New</strong> Feature
          </span>
        </Badge>
      )
      expect(screen.getByTestId('badge-content')).toBeInTheDocument()
    })
  })

  describe('Combined Variants and Sizes', () => {
    it('combines success variant with small size', () => {
      const { container } = render(<Badge variant="success" size="sm">Active</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'px-2', 'py-0.5')
    })

    it('combines danger variant with medium size', () => {
      const { container } = render(<Badge variant="danger" size="md">Error</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'px-3', 'py-1')
    })

    it('combines warning variant with small size', () => {
      const { container } = render(<Badge variant="warning" size="sm">Warning</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800', 'px-2', 'py-0.5')
    })

    it('combines info variant with medium size', () => {
      const { container } = render(<Badge variant="info" size="md">Info</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'px-3', 'py-1')
    })
  })

  describe('Styling', () => {
    it('has inline-flex display', () => {
      const { container } = render(<Badge>Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('inline-flex')
    })

    it('centers items', () => {
      const { container } = render(<Badge>Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('items-center')
    })

    it('has rounded-full shape', () => {
      const { container } = render(<Badge>Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('rounded-full')
    })

    it('has bold font weight', () => {
      const { container } = render(<Badge>Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('font-bold')
    })

    it('has text-xs font size', () => {
      const { container } = render(<Badge>Test</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('text-xs')
    })
  })

  describe('Use Cases', () => {
    it('renders status badge', () => {
      render(<Badge variant="success">Active</Badge>)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders count badge', () => {
      render(<Badge variant="danger" size="sm">99+</Badge>)
      expect(screen.getByText('99+')).toBeInTheDocument()
    })

    it('renders label badge', () => {
      render(<Badge variant="info">Beta</Badge>)
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })

    it('renders category badge', () => {
      render(<Badge variant="default">Technology</Badge>)
      expect(screen.getByText('Technology')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('can have aria-label', () => {
      const { container } = render(<Badge aria-label="Status indicator">Active</Badge>)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveAttribute('aria-label', 'Status indicator')
    })

    it('renders content accessibly', () => {
      render(<Badge>Important</Badge>)
      const badge = screen.getByText('Important')
      expect(badge).toBeVisible()
    })
  })
})
