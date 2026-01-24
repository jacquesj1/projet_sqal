/**
 * Tests - LoadingSpinner Component
 * Tests unitaires pour le spinner de chargement
 */

import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../LoadingSpinner'

describe('LoadingSpinner Component', () => {
  it('renders spinner with default props', () => {
    const { container } = render(<LoadingSpinner />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('w-8', 'h-8') // default md size
  })

  it('renders spinner with small size', () => {
    const { container } = render(<LoadingSpinner size="sm" />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toHaveClass('w-4', 'h-4')
  })

  it('renders spinner with large size', () => {
    const { container } = render(<LoadingSpinner size="lg" />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toHaveClass('w-12', 'h-12')
  })

  it('renders spinner with extra large size', () => {
    const { container } = render(<LoadingSpinner size="xl" />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toHaveClass('w-16', 'h-16')
  })

  it('renders message when provided', () => {
    render(<LoadingSpinner message="Loading data..." />)

    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('does not render message when not provided', () => {
    const { container } = render(<LoadingSpinner />)

    const message = container.querySelector('.text-muted-foreground')
    expect(message).not.toBeInTheDocument()
  })

  it('renders fullscreen spinner when fullScreen prop is true', () => {
    const { container } = render(<LoadingSpinner fullScreen={true} message="Loading..." />)

    const fullscreenContainer = container.querySelector('.fixed.inset-0')
    expect(fullscreenContainer).toBeInTheDocument()
    expect(fullscreenContainer).toHaveClass('backdrop-blur-sm', 'z-50')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('does not render fullscreen spinner when fullScreen prop is false', () => {
    const { container } = render(<LoadingSpinner fullScreen={false} />)

    const fullscreenContainer = container.querySelector('.fixed.inset-0')
    expect(fullscreenContainer).not.toBeInTheDocument()
  })

  it('renders with primary color', () => {
    const { container } = render(<LoadingSpinner />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toHaveClass('text-primary')
  })

  it('renders all size variants correctly', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const
    const expectedClasses = {
      sm: ['w-4', 'h-4'],
      md: ['w-8', 'h-8'],
      lg: ['w-12', 'h-12'],
      xl: ['w-16', 'h-16'],
    }

    sizes.forEach((size) => {
      const { container } = render(<LoadingSpinner size={size} />)
      const spinner = container.querySelector('.animate-spin')

      expectedClasses[size].forEach((className) => {
        expect(spinner).toHaveClass(className)
      })
    })
  })

  it('combines message and fullScreen correctly', () => {
    render(<LoadingSpinner fullScreen={true} message="Please wait..." />)

    expect(screen.getByText('Please wait...')).toBeInTheDocument()
    const fullscreenContainer = document.querySelector('.fixed.inset-0')
    expect(fullscreenContainer).toBeInTheDocument()
  })
})
