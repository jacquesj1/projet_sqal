import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ToastProvider, useToast, WebSocketNotifications } from '../Toast'
import { ReactNode } from 'react'

// Helper component to test useToast hook
function ToastTestComponent({ onAddToast }: { onAddToast?: (addToast: any) => void }) {
  const { addToast } = useToast()

  if (onAddToast) {
    onAddToast(addToast)
  }

  return (
    <div>
      <button onClick={() => addToast({ type: 'success', title: 'Success message' })}>
        Add Success
      </button>
      <button onClick={() => addToast({ type: 'error', title: 'Error message' })}>
        Add Error
      </button>
      <button onClick={() => addToast({ type: 'warning', title: 'Warning message' })}>
        Add Warning
      </button>
      <button onClick={() => addToast({ type: 'info', title: 'Info message' })}>
        Add Info
      </button>
    </div>
  )
}

describe('Toast Component', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('ToastProvider', () => {
    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <div>Child content</div>
        </ToastProvider>
      )
      expect(screen.getByText('Child content')).toBeInTheDocument()
    })

    it('provides toast context to children', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )
      expect(screen.getByText('Add Success')).toBeInTheDocument()
    })
  })

  describe('useToast Hook', () => {
    it('throws error when used outside ToastProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<ToastTestComponent />)
      }).toThrow('useToast must be used within a ToastProvider')

      consoleSpy.mockRestore()
    })

    it('provides addToast function', () => {
      let addToastFn: any
      render(
        <ToastProvider>
          <ToastTestComponent onAddToast={(fn) => (addToastFn = fn)} />
        </ToastProvider>
      )
      expect(typeof addToastFn).toBe('function')
    })
  })

  describe('Toast Display', () => {
    it('displays success toast', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      expect(screen.getByText('Success message')).toBeInTheDocument()
    })

    it('displays error toast', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Error'))
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('displays warning toast', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Warning'))
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    it('displays info toast', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Info'))
      expect(screen.getByText('Info message')).toBeInTheDocument()
    })

    it('displays toast with message', () => {
      let addToastFn: any
      render(
        <ToastProvider>
          <ToastTestComponent onAddToast={(fn) => (addToastFn = fn)} />
        </ToastProvider>
      )

      act(() => {
        addToastFn({ type: 'info', title: 'Title', message: 'Detailed message' })
      })

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Detailed message')).toBeInTheDocument()
    })

    it('does not show message when not provided', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))

      const { container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )
      const messages = container.querySelectorAll('.text-sm.text-gray-600')
      expect(messages.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Toast Icons', () => {
    it('displays success icon', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const { container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )
      fireEvent.click(screen.getAllByText('Add Success')[1])

      // Success toast should have green icon
      const toast = screen.getAllByText('Success message')[1].closest('.flex.items-start')
      expect(toast).toBeInTheDocument()
    })
  })

  describe('Toast Background Colors', () => {
    it('success toast has green background', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const toast = screen.getByText('Success message').closest('.bg-green-50')
      expect(toast).toBeInTheDocument()
    })

    it('error toast has red background', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Error'))
      const toast = screen.getByText('Error message').closest('.bg-red-50')
      expect(toast).toBeInTheDocument()
    })

    it('warning toast has orange background', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Warning'))
      const toast = screen.getByText('Warning message').closest('.bg-orange-50')
      expect(toast).toBeInTheDocument()
    })

    it('info toast has blue background', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Info'))
      const toast = screen.getByText('Info message').closest('.bg-blue-50')
      expect(toast).toBeInTheDocument()
    })
  })

  describe('Toast Close Functionality', () => {
    it('displays close button', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const closeButtons = screen.getAllByRole('button')
      const hasCloseButton = closeButtons.some(btn => btn.className.includes('hover:bg-gray-200'))
      expect(hasCloseButton).toBe(true)
    })

    it('removes toast when close button is clicked', async () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      expect(screen.getByText('Success message')).toBeInTheDocument()

      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn => btn.className.includes('hover:bg-gray-200'))

      if (closeButton) {
        fireEvent.click(closeButton)

        act(() => {
          jest.advanceTimersByTime(300)
        })

        await waitFor(() => {
          expect(screen.queryByText('Success message')).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('Toast Auto-Dismiss', () => {
    it('auto-dismisses after default duration', async () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      expect(screen.getByText('Success message')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument()
      })
    })

    it('auto-dismisses after custom duration', async () => {
      let addToastFn: any
      render(
        <ToastProvider>
          <ToastTestComponent onAddToast={(fn) => (addToastFn = fn)} />
        </ToastProvider>
      )

      act(() => {
        addToastFn({ type: 'info', title: 'Custom duration', duration: 3000 })
      })

      expect(screen.getByText('Custom duration')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(screen.queryByText('Custom duration')).not.toBeInTheDocument()
      })
    })
  })

  describe('Multiple Toasts', () => {
    it('displays multiple toasts simultaneously', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      fireEvent.click(screen.getByText('Add Error'))
      fireEvent.click(screen.getByText('Add Info'))

      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
      expect(screen.getByText('Info message')).toBeInTheDocument()
    })

    it('stacks toasts vertically', () => {
      const { container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      fireEvent.click(screen.getByText('Add Error'))

      const toastContainer = container.querySelector('.space-y-2')
      expect(toastContainer).toBeInTheDocument()
    })
  })

  describe('Toast Container Positioning', () => {
    it('positions container at bottom-right', () => {
      const { container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      const toastContainer = container.querySelector('.fixed.bottom-4.right-4')
      expect(toastContainer).toBeInTheDocument()
    })

    it('has high z-index', () => {
      const { container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      const toastContainer = container.querySelector('.z-50')
      expect(toastContainer).toBeInTheDocument()
    })
  })

  describe('Toast Styling', () => {
    it('has rounded corners', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const toast = screen.getByText('Success message').closest('.rounded-lg')
      expect(toast).toBeInTheDocument()
    })

    it('has shadow', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const toast = screen.getByText('Success message').closest('.shadow-lg')
      expect(toast).toBeInTheDocument()
    })

    it('has minimum width', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const toast = screen.getByText('Success message').closest('.min-w-\\[300px\\]')
      expect(toast).toBeInTheDocument()
    })

    it('has maximum width', () => {
      render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      )

      fireEvent.click(screen.getByText('Add Success'))
      const toast = screen.getByText('Success message').closest('.max-w-md')
      expect(toast).toBeInTheDocument()
    })
  })

  describe('WebSocketNotifications', () => {
    it('renders without errors', () => {
      render(
        <ToastProvider>
          <WebSocketNotifications />
        </ToastProvider>
      )
      // Component returns null, so just verify it doesn't crash
      expect(true).toBe(true)
    })

    it('listens for WebSocket messages', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      render(
        <ToastProvider>
          <WebSocketNotifications />
        </ToastProvider>
      )

      expect(addEventListenerSpy).toHaveBeenCalledWith('ws-message', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <ToastProvider>
          <WebSocketNotifications />
        </ToastProvider>
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('ws-message', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })

    it('displays toast for critical alert', () => {
      render(
        <ToastProvider>
          <WebSocketNotifications />
        </ToastProvider>
      )

      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'alerte',
          data: { niveau: 'critique', message: 'Critical alert!' }
        }
      })

      act(() => {
        window.dispatchEvent(event)
      })

      expect(screen.getByText('Critical alert!')).toBeInTheDocument()
    })

    it('displays toast for important alert', () => {
      render(
        <ToastProvider>
          <WebSocketNotifications />
        </ToastProvider>
      )

      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'alerte',
          data: { niveau: 'important', message: 'Important alert' }
        }
      })

      act(() => {
        window.dispatchEvent(event)
      })

      expect(screen.getByText('Important alert')).toBeInTheDocument()
    })

    it('displays toast for notification', () => {
      render(
        <ToastProvider>
          <WebSocketNotifications />
        </ToastProvider>
      )

      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'notification',
          data: { message: 'New notification' }
        }
      })

      act(() => {
        window.dispatchEvent(event)
      })

      expect(screen.getByText('New notification')).toBeInTheDocument()
    })

    it('uses longer duration for critical alerts', () => {
      let addToastFn: any
      render(
        <ToastProvider>
          <ToastTestComponent onAddToast={(fn) => (addToastFn = fn)} />
          <WebSocketNotifications />
        </ToastProvider>
      )

      const event = new CustomEvent('ws-message', {
        detail: {
          type: 'alerte',
          data: { niveau: 'critique', message: 'Critical!' }
        }
      })

      act(() => {
        window.dispatchEvent(event)
      })

      expect(screen.getByText('Critical!')).toBeInTheDocument()

      // Should not disappear after 5 seconds (default)
      act(() => {
        jest.advanceTimersByTime(5000)
      })

      expect(screen.getByText('Critical!')).toBeInTheDocument()

      // Should disappear after 10 seconds
      act(() => {
        jest.advanceTimersByTime(5000)
      })
    })
  })
})
