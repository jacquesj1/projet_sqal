import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import Input from '../Input'

describe('Input Component', () => {
  describe('Basic Rendering', () => {
    it('renders input element', () => {
      render(<Input placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      const { container } = render(<Input className="custom-class" />)
      const input = container.querySelector('input')
      expect(input).toHaveClass('custom-class')
    })

    it('applies base classes', () => {
      const { container } = render(<Input />)
      const input = container.querySelector('input')
      expect(input).toHaveClass('w-full', 'p-3', 'border', 'rounded-lg')
    })
  })

  describe('Label Support', () => {
    it('renders label when provided', () => {
      render(<Input label="Username" />)
      expect(screen.getByText('Username')).toBeInTheDocument()
    })

    it('does not render label when not provided', () => {
      const { container } = render(<Input />)
      const label = container.querySelector('label')
      expect(label).not.toBeInTheDocument()
    })

    it('associates label with input', () => {
      render(<Input label="Email" id="email-input" />)
      const label = screen.getByText('Email')
      expect(label).toHaveClass('block', 'text-sm', 'font-medium', 'text-gray-700')
    })
  })

  describe('Icon Support', () => {
    it('renders icon when provided', () => {
      const icon = <span data-testid="test-icon">Icon</span>
      render(<Input icon={icon} />)
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    })

    it('adds left padding when icon is present', () => {
      const icon = <span>Icon</span>
      const { container } = render(<Input icon={icon} />)
      const input = container.querySelector('input')
      expect(input).toHaveClass('pl-10')
    })

    it('does not add left padding when icon is not present', () => {
      const { container } = render(<Input />)
      const input = container.querySelector('input')
      expect(input).not.toHaveClass('pl-10')
    })

    it('positions icon correctly', () => {
      const icon = <span data-testid="test-icon">Icon</span>
      const { container } = render(<Input icon={icon} />)
      const iconContainer = container.querySelector('.absolute.left-3')
      expect(iconContainer).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('renders error message when provided', () => {
      render(<Input error="This field is required" />)
      expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('applies error styling to input', () => {
      const { container } = render(<Input error="Invalid input" />)
      const input = container.querySelector('input')
      expect(input).toHaveClass('border-red-500', 'focus:ring-red-500')
    })

    it('does not show error when not provided', () => {
      const { container } = render(<Input />)
      const error = container.querySelector('.text-red-600')
      expect(error).not.toBeInTheDocument()
    })

    it('error message has correct styling', () => {
      render(<Input error="Error message" />)
      const errorElement = screen.getByText('Error message')
      expect(errorElement).toHaveClass('text-sm', 'text-red-600', 'mt-1')
    })
  })

  describe('Helper Text', () => {
    it('renders helper text when provided', () => {
      render(<Input helper="Enter your email address" />)
      expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    })

    it('does not render helper when error is present', () => {
      render(<Input helper="Helper text" error="Error message" />)
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('helper text has correct styling', () => {
      render(<Input helper="Helper text" />)
      const helper = screen.getByText('Helper text')
      expect(helper).toHaveClass('text-sm', 'text-gray-500', 'mt-1')
    })

    it('does not show helper when not provided', () => {
      const { container } = render(<Input />)
      const helper = container.querySelector('.text-gray-500')
      expect(helper).not.toBeInTheDocument()
    })
  })

  describe('Focus States', () => {
    it('applies focus ring on normal state', () => {
      const { container } = render(<Input />)
      const input = container.querySelector('input')
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-blue-500')
    })

    it('applies focus ring on error state', () => {
      const { container } = render(<Input error="Error" />)
      const input = container.querySelector('input')
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-red-500')
    })
  })

  describe('HTML Input Attributes', () => {
    it('forwards type attribute', () => {
      render(<Input type="email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('forwards placeholder attribute', () => {
      render(<Input placeholder="Enter text" />)
      const input = screen.getByPlaceholderText('Enter text')
      expect(input).toBeInTheDocument()
    })

    it('forwards name attribute', () => {
      const { container } = render(<Input name="username" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('name', 'username')
    })

    it('forwards disabled attribute', () => {
      const { container } = render(<Input disabled />)
      const input = container.querySelector('input')
      expect(input).toBeDisabled()
    })

    it('forwards required attribute', () => {
      const { container } = render(<Input required />)
      const input = container.querySelector('input')
      expect(input).toBeRequired()
    })

    it('forwards maxLength attribute', () => {
      const { container } = render(<Input maxLength={10} />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('maxLength', '10')
    })

    it('forwards value attribute', () => {
      const { container } = render(<Input value="test value" onChange={() => {}} />)
      const input = container.querySelector('input') as HTMLInputElement
      expect(input.value).toBe('test value')
    })

    it('forwards defaultValue attribute', () => {
      const { container } = render(<Input defaultValue="default text" />)
      const input = container.querySelector('input') as HTMLInputElement
      expect(input.value).toBe('default text')
    })
  })

  describe('Interaction', () => {
    it('calls onChange when input value changes', () => {
      const handleChange = jest.fn()
      render(<Input onChange={handleChange} />)
      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'new value' } })

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('calls onFocus when input is focused', () => {
      const handleFocus = jest.fn()
      render(<Input onFocus={handleFocus} />)
      const input = screen.getByRole('textbox')

      fireEvent.focus(input)

      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('calls onBlur when input loses focus', () => {
      const handleBlur = jest.fn()
      render(<Input onBlur={handleBlur} />)
      const input = screen.getByRole('textbox')

      fireEvent.blur(input)

      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('Ref Forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Input ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('allows ref to focus input', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Input ref={ref} />)

      ref.current?.focus()

      expect(document.activeElement).toBe(ref.current)
    })
  })

  describe('Accessibility', () => {
    it('has accessible role', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(<Input aria-label="Username input" />)
      const input = screen.getByLabelText('Username input')
      expect(input).toBeInTheDocument()
    })

    it('supports aria-describedby', () => {
      const { container } = render(<Input aria-describedby="help-text" />)
      const input = container.querySelector('input')
      expect(input).toHaveAttribute('aria-describedby', 'help-text')
    })
  })
})
