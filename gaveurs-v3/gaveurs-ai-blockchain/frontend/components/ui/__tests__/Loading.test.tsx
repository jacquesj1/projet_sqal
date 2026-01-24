import { render, screen } from '@testing-library/react'
import Loading, { LoadingOverlay, LoadingSkeleton } from '../Loading'

describe('Loading Component', () => {
  describe('Basic Rendering', () => {
    it('renders loading spinner', () => {
      const { container } = render(<Loading />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('renders with text when provided', () => {
      render(<Loading text="Loading data..." />)
      expect(screen.getByText('Loading data...')).toBeInTheDocument()
    })

    it('does not render text when not provided', () => {
      const { container } = render(<Loading />)
      const text = container.querySelector('p')
      expect(text).not.toBeInTheDocument()
    })

    it('centers text below spinner', () => {
      render(<Loading text="Please wait" />)
      const text = screen.getByText('Please wait')
      expect(text).toHaveClass('mt-4', 'text-gray-600')
    })
  })

  describe('Size Variants', () => {
    it('renders medium size by default', () => {
      const { container } = render(<Loading />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('h-12', 'w-12', 'border-3')
    })

    it('renders small size', () => {
      const { container } = render(<Loading size="sm" />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('h-8', 'w-8', 'border-2')
    })

    it('renders large size', () => {
      const { container } = render(<Loading size="lg" />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('h-16', 'w-16', 'border-4')
    })
  })

  describe('Spinner Styling', () => {
    it('has correct base classes', () => {
      const { container } = render(<Loading />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('border-blue-600', 'border-t-transparent', 'rounded-full', 'mx-auto')
    })

    it('uses blue color for spinner', () => {
      const { container } = render(<Loading />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('border-blue-600')
    })

    it('has transparent top border for spinning effect', () => {
      const { container } = render(<Loading />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('border-t-transparent')
    })
  })

  describe('Full Screen Mode', () => {
    it('does not use full screen by default', () => {
      const { container } = render(<Loading />)
      const fullScreenContainer = container.querySelector('.min-h-screen')
      expect(fullScreenContainer).not.toBeInTheDocument()
    })

    it('renders in full screen mode when enabled', () => {
      const { container } = render(<Loading fullScreen />)
      const fullScreenContainer = container.querySelector('.min-h-screen')
      expect(fullScreenContainer).toBeInTheDocument()
    })

    it('centers content in full screen mode', () => {
      const { container } = render(<Loading fullScreen />)
      const fullScreenContainer = container.querySelector('.min-h-screen')
      expect(fullScreenContainer).toHaveClass('flex', 'items-center', 'justify-center', 'bg-gray-50')
    })

    it('renders text in full screen mode', () => {
      render(<Loading fullScreen text="Loading application..." />)
      expect(screen.getByText('Loading application...')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('centers content horizontally', () => {
      const { container } = render(<Loading />)
      const wrapper = container.querySelector('.text-center')
      expect(wrapper).toBeInTheDocument()
    })

    it('centers spinner', () => {
      const { container } = render(<Loading />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toHaveClass('mx-auto')
    })
  })
})

describe('LoadingOverlay Component', () => {
  describe('Basic Rendering', () => {
    it('renders overlay container', () => {
      const { container } = render(<LoadingOverlay />)
      const overlay = container.querySelector('.absolute.inset-0')
      expect(overlay).toBeInTheDocument()
    })

    it('has semi-transparent white background', () => {
      const { container } = render(<LoadingOverlay />)
      const overlay = container.querySelector('.absolute.inset-0')
      expect(overlay).toHaveClass('bg-white', 'bg-opacity-75')
    })

    it('centers loading spinner', () => {
      const { container } = render(<LoadingOverlay />)
      const overlay = container.querySelector('.absolute.inset-0')
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center')
    })

    it('has high z-index', () => {
      const { container } = render(<LoadingOverlay />)
      const overlay = container.querySelector('.absolute.inset-0')
      expect(overlay).toHaveClass('z-10')
    })
  })

  describe('Text Support', () => {
    it('renders Loading component inside overlay', () => {
      const { container } = render(<LoadingOverlay />)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('passes text to Loading component', () => {
      render(<LoadingOverlay text="Processing..." />)
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('does not show text when not provided', () => {
      const { container } = render(<LoadingOverlay />)
      const text = container.querySelector('p')
      expect(text).not.toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('covers entire parent element', () => {
      const { container } = render(<LoadingOverlay />)
      const overlay = container.querySelector('.absolute.inset-0')
      expect(overlay).toHaveClass('absolute', 'inset-0')
    })
  })
})

describe('LoadingSkeleton Component', () => {
  describe('Basic Rendering', () => {
    it('renders skeleton element', () => {
      const { container } = render(<LoadingSkeleton />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toBeInTheDocument()
    })

    it('has pulse animation', () => {
      const { container } = render(<LoadingSkeleton />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('animate-pulse')
    })

    it('has gray background', () => {
      const { container } = render(<LoadingSkeleton />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('bg-gray-200')
    })

    it('has rounded corners', () => {
      const { container } = render(<LoadingSkeleton />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('rounded')
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const { container } = render(<LoadingSkeleton className="h-4 w-full" />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('h-4', 'w-full')
    })

    it('does not have default size classes', () => {
      const { container } = render(<LoadingSkeleton />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).not.toHaveClass('h-')
      expect(skeleton).not.toHaveClass('w-')
    })

    it('allows combining multiple custom classes', () => {
      const { container } = render(<LoadingSkeleton className="h-10 w-20 mb-4" />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('h-10', 'w-20', 'mb-4')
    })
  })

  describe('Use Cases', () => {
    it('can be used for text skeleton', () => {
      const { container } = render(<LoadingSkeleton className="h-4 w-3/4" />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('h-4', 'w-3/4')
    })

    it('can be used for avatar skeleton', () => {
      const { container } = render(<LoadingSkeleton className="h-12 w-12 rounded-full" />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('h-12', 'w-12', 'rounded-full')
    })

    it('can be used for button skeleton', () => {
      const { container } = render(<LoadingSkeleton className="h-10 w-24" />)
      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toHaveClass('h-10', 'w-24')
    })
  })
})
