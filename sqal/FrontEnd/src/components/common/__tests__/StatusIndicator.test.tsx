/**
 * Tests - StatusIndicator Component
 * Tests unitaires pour l'indicateur de statut
 */

import { render, screen } from '@testing-library/react'
import { StatusIndicator, Status } from '../StatusIndicator'

describe('StatusIndicator Component', () => {
  describe('Rendering', () => {
    it('renders success status indicator', () => {
      const { container } = render(<StatusIndicator status="success" />)

      const dot = container.querySelector('.bg-green-500')
      expect(dot).toBeInTheDocument()
    })

    it('renders error status indicator', () => {
      const { container } = render(<StatusIndicator status="error" />)

      const dot = container.querySelector('.bg-red-500')
      expect(dot).toBeInTheDocument()
    })

    it('renders warning status indicator', () => {
      const { container } = render(<StatusIndicator status="warning" />)

      const dot = container.querySelector('.bg-yellow-500')
      expect(dot).toBeInTheDocument()
    })

    it('renders pending status indicator', () => {
      const { container } = render(<StatusIndicator status="pending" />)

      const dot = container.querySelector('.bg-blue-500')
      expect(dot).toBeInTheDocument()
    })

    it('renders loading status indicator', () => {
      const { container } = render(<StatusIndicator status="loading" />)

      const dot = container.querySelector('.bg-gray-500')
      expect(dot).toBeInTheDocument()
    })

    it('renders info status indicator', () => {
      const { container } = render(<StatusIndicator status="info" />)

      const dot = container.querySelector('.bg-blue-500')
      expect(dot).toBeInTheDocument()
    })
  })

  describe('Label Mode', () => {
    it('renders label when provided', () => {
      render(<StatusIndicator status="success" label="Active" />)

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders icon with label when showIcon is true', () => {
      const { container } = render(
        <StatusIndicator status="success" label="Active" showIcon={true} />
      )

      expect(screen.getByText('Active')).toBeInTheDocument()
      const icon = container.querySelector('.lucide-check-circle')
      expect(icon).toBeInTheDocument()
    })

    it('does not render icon with label when showIcon is false', () => {
      const { container } = render(
        <StatusIndicator status="success" label="Active" showIcon={false} />
      )

      expect(screen.getByText('Active')).toBeInTheDocument()
      const icon = container.querySelector('.lucide-check-circle')
      expect(icon).not.toBeInTheDocument()
    })

    it('renders badge with correct background colors', () => {
      const { container } = render(<StatusIndicator status="success" label="Success" />)

      const badge = container.querySelector('.bg-green-100')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('text-green-700')
    })
  })

  describe('Sizes', () => {
    it('renders small size dot', () => {
      const { container } = render(<StatusIndicator status="success" size="sm" />)

      const dot = container.querySelector('.w-2.h-2')
      expect(dot).toBeInTheDocument()
    })

    it('renders medium size dot (default)', () => {
      const { container } = render(<StatusIndicator status="success" size="md" />)

      const dot = container.querySelector('.w-3.h-3')
      expect(dot).toBeInTheDocument()
    })

    it('renders large size dot', () => {
      const { container } = render(<StatusIndicator status="success" size="lg" />)

      const dot = container.querySelector('.w-4.h-4')
      expect(dot).toBeInTheDocument()
    })
  })

  describe('Pulse Animation', () => {
    it('renders pulse animation when showPulse is true', () => {
      const { container } = render(<StatusIndicator status="success" showPulse={true} />)

      const pulse = container.querySelector('.animate-ping')
      expect(pulse).toBeInTheDocument()
    })

    it('does not render pulse animation when showPulse is false', () => {
      const { container } = render(<StatusIndicator status="success" showPulse={false} />)

      const pulse = container.querySelector('.animate-ping')
      expect(pulse).not.toBeInTheDocument()
    })

    it('does not render pulse by default', () => {
      const { container } = render(<StatusIndicator status="success" />)

      const pulse = container.querySelector('.animate-ping')
      expect(pulse).not.toBeInTheDocument()
    })
  })

  describe('All Status Types', () => {
    const statuses: Status[] = ['success', 'error', 'warning', 'pending', 'loading', 'info']

    statuses.forEach((status) => {
      it(`renders ${status} status with label`, () => {
        render(<StatusIndicator status={status} label={`Status: ${status}`} />)

        expect(screen.getByText(`Status: ${status}`)).toBeInTheDocument()
      })

      it(`renders ${status} status without label`, () => {
        const { container } = render(<StatusIndicator status={status} />)

        const dot = container.querySelector('.rounded-full')
        expect(dot).toBeInTheDocument()
      })
    })
  })

  describe('Loading Status', () => {
    it('renders loading status with spinning icon in label mode', () => {
      const { container } = render(<StatusIndicator status="loading" label="Loading..." />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Default Props', () => {
    it('shows icon by default in label mode', () => {
      const { container } = render(<StatusIndicator status="success" label="Success" />)

      const icon = container.querySelector('.lucide-check-circle')
      expect(icon).toBeInTheDocument()
    })

    it('uses medium size by default', () => {
      const { container } = render(<StatusIndicator status="success" />)

      const dot = container.querySelector('.w-3.h-3')
      expect(dot).toBeInTheDocument()
    })
  })
})
