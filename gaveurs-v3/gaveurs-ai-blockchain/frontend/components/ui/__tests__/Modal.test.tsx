import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Modal from '../Modal'

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    document.body.style.overflow = 'unset'
  })

  describe('Basic Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<Modal {...defaultProps}>Modal content</Modal>)
      expect(screen.getByText('Modal content')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false}>Modal content</Modal>)
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
    })

    it('renders children correctly', () => {
      render(
        <Modal {...defaultProps}>
          <p>First paragraph</p>
          <p>Second paragraph</p>
        </Modal>
      )
      expect(screen.getByText('First paragraph')).toBeInTheDocument()
      expect(screen.getByText('Second paragraph')).toBeInTheDocument()
    })
  })

  describe('Title and Header', () => {
    it('renders title when provided', () => {
      render(<Modal {...defaultProps} title="Modal Title">Content</Modal>)
      expect(screen.getByText('Modal Title')).toBeInTheDocument()
    })

    it('does not render header when title is not provided', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const header = container.querySelector('.border-b')
      expect(header).not.toBeInTheDocument()
    })

    it('renders close button in header', () => {
      render(<Modal {...defaultProps} title="Title">Content</Modal>)
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
    })

    it('title has correct styling', () => {
      render(<Modal {...defaultProps} title="Test Title">Content</Modal>)
      const title = screen.getByText('Test Title')
      expect(title).toHaveClass('text-xl', 'font-bold', 'text-gray-800')
    })
  })

  describe('Size Variants', () => {
    it('renders medium size by default', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modal = container.querySelector('.max-w-md')
      expect(modal).toBeInTheDocument()
    })

    it('renders small size', () => {
      const { container } = render(<Modal {...defaultProps} size="sm">Content</Modal>)
      const modal = container.querySelector('.max-w-sm')
      expect(modal).toBeInTheDocument()
    })

    it('renders large size', () => {
      const { container } = render(<Modal {...defaultProps} size="lg">Content</Modal>)
      const modal = container.querySelector('.max-w-lg')
      expect(modal).toBeInTheDocument()
    })

    it('renders extra large size', () => {
      const { container } = render(<Modal {...defaultProps} size="xl">Content</Modal>)
      const modal = container.querySelector('.max-w-xl')
      expect(modal).toBeInTheDocument()
    })
  })

  describe('Backdrop', () => {
    it('renders backdrop', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const backdrop = container.querySelector('.bg-black.bg-opacity-50')
      expect(backdrop).toBeInTheDocument()
    })

    it('backdrop has fixed positioning', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const backdrop = container.querySelector('.bg-black.bg-opacity-50')
      expect(backdrop).toHaveClass('fixed', 'inset-0')
    })

    it('calls onClose when backdrop is clicked', () => {
      const onClose = jest.fn()
      const { container } = render(<Modal isOpen onClose={onClose}>Content</Modal>)
      const backdrop = container.querySelector('.bg-black.bg-opacity-50') as HTMLElement

      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Close Button Interaction', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn()
      render(<Modal isOpen onClose={onClose} title="Title">Content</Modal>)

      const closeButton = screen.getByRole('button')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('close button has hover effect', () => {
      const { container } = render(<Modal {...defaultProps} title="Title">Content</Modal>)
      const closeButton = screen.getByRole('button')
      expect(closeButton).toHaveClass('hover:bg-gray-100', 'transition-colors')
    })
  })

  describe('Keyboard Interactions', () => {
    it('calls onClose when Escape key is pressed', () => {
      const onClose = jest.fn()
      render(<Modal isOpen onClose={onClose}>Content</Modal>)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when other keys are pressed', () => {
      const onClose = jest.fn()
      render(<Modal isOpen onClose={onClose}>Content</Modal>)

      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Space' })

      expect(onClose).not.toHaveBeenCalled()
    })

    it('removes event listener when modal is closed', () => {
      const onClose = jest.fn()
      const { rerender } = render(<Modal isOpen onClose={onClose}>Content</Modal>)

      rerender(<Modal isOpen={false} onClose={onClose}>Content</Modal>)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Body Scroll Lock', () => {
    it('locks body scroll when modal opens', () => {
      render(<Modal {...defaultProps}>Content</Modal>)
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('unlocks body scroll when modal closes', () => {
      const { rerender } = render(<Modal {...defaultProps}>Content</Modal>)
      expect(document.body.style.overflow).toBe('hidden')

      rerender(<Modal {...defaultProps} isOpen={false}>Content</Modal>)
      expect(document.body.style.overflow).toBe('unset')
    })

    it('restores body scroll on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps}>Content</Modal>)
      expect(document.body.style.overflow).toBe('hidden')

      unmount()
      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('Modal Container Styling', () => {
    it('has fixed positioning and z-index', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modalContainer = container.querySelector('.fixed.inset-0.z-50')
      expect(modalContainer).toBeInTheDocument()
    })

    it('centers modal content', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const centerContainer = container.querySelector('.flex.min-h-full.items-center.justify-center')
      expect(centerContainer).toBeInTheDocument()
    })

    it('has white background', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modal = container.querySelector('.bg-white')
      expect(modal).toBeInTheDocument()
    })

    it('has shadow and rounded corners', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modal = container.querySelector('.shadow-xl.rounded-lg')
      expect(modal).toBeInTheDocument()
    })
  })

  describe('Content Area', () => {
    it('renders content with padding', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const contentArea = container.querySelector('.p-6')
      expect(contentArea).toBeInTheDocument()
    })

    it('renders complex content', () => {
      render(
        <Modal {...defaultProps}>
          <form data-testid="modal-form">
            <input type="text" />
            <button type="submit">Submit</button>
          </form>
        </Modal>
      )
      expect(screen.getByTestId('modal-form')).toBeInTheDocument()
    })
  })

  describe('Animations', () => {
    it('has fade-in animation', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modal = container.querySelector('.animate-fade-in')
      expect(modal).toBeInTheDocument()
    })

    it('has transition classes', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modal = container.querySelector('.transition-all')
      expect(modal).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has overflow-y-auto for scrolling long content', () => {
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      const modalContainer = container.querySelector('.overflow-y-auto')
      expect(modalContainer).toBeInTheDocument()
    })

    it('content is visible to screen readers', () => {
      render(<Modal {...defaultProps}>Accessible content</Modal>)
      expect(screen.getByText('Accessible content')).toBeVisible()
    })

    it('close button is accessible', () => {
      render(<Modal {...defaultProps} title="Title">Content</Modal>)
      const closeButton = screen.getByRole('button')
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid open/close toggling', () => {
      const onClose = jest.fn()
      const { rerender } = render(<Modal isOpen onClose={onClose}>Content</Modal>)

      rerender(<Modal isOpen={false} onClose={onClose}>Content</Modal>)
      rerender(<Modal isOpen onClose={onClose}>Content</Modal>)
      rerender(<Modal isOpen={false} onClose={onClose}>Content</Modal>)

      expect(document.body.style.overflow).toBe('unset')
    })

    it('handles empty content', () => {
      const { container } = render(<Modal {...defaultProps}></Modal>)
      const contentArea = container.querySelector('.p-6')
      expect(contentArea).toBeInTheDocument()
    })

    it('handles null children', () => {
      render(<Modal {...defaultProps}>{null}</Modal>)
      const { container } = render(<Modal {...defaultProps}>Content</Modal>)
      expect(container).toBeInTheDocument()
    })
  })
})
