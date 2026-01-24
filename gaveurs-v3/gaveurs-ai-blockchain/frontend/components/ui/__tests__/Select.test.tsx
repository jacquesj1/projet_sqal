import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import Select from '../Select'

describe('Select Component', () => {
  const defaultOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ]

  describe('Basic Rendering', () => {
    it('renders select element', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select')
      expect(select).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      const { container } = render(<Select options={defaultOptions} className="custom-class" />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('custom-class')
    })

    it('applies base classes', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('w-full', 'p-3', 'border', 'rounded-lg', 'appearance-none')
    })

    it('has white background', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('bg-white')
    })
  })

  describe('Options Rendering', () => {
    it('renders all options', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const options = container.querySelectorAll('option')
      expect(options).toHaveLength(3)
    })

    it('renders options with correct values', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const option1 = container.querySelector('option[value="option1"]')
      const option2 = container.querySelector('option[value="option2"]')
      const option3 = container.querySelector('option[value="option3"]')
      expect(option1).toBeInTheDocument()
      expect(option2).toBeInTheDocument()
      expect(option3).toBeInTheDocument()
    })

    it('renders options with correct labels', () => {
      render(<Select options={defaultOptions} />)
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('handles numeric values', () => {
      const numericOptions = [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
      ]
      const { container } = render(<Select options={numericOptions} />)
      const option1 = container.querySelector('option[value="1"]')
      const option2 = container.querySelector('option[value="2"]')
      expect(option1).toBeInTheDocument()
      expect(option2).toBeInTheDocument()
    })

    it('renders empty options array', () => {
      const { container } = render(<Select options={[]} />)
      const options = container.querySelectorAll('option')
      expect(options).toHaveLength(0)
    })
  })

  describe('Placeholder Support', () => {
    it('renders placeholder when provided', () => {
      render(<Select options={defaultOptions} placeholder="Select an option" />)
      expect(screen.getByText('Select an option')).toBeInTheDocument()
    })

    it('placeholder has empty value', () => {
      const { container } = render(<Select options={defaultOptions} placeholder="Choose..." />)
      const placeholder = container.querySelector('option[value=""]')
      expect(placeholder).toBeInTheDocument()
      expect(placeholder?.textContent).toBe('Choose...')
    })

    it('does not render placeholder when not provided', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const emptyOption = container.querySelector('option[value=""]')
      expect(emptyOption).not.toBeInTheDocument()
    })

    it('placeholder appears first in options list', () => {
      const { container } = render(<Select options={defaultOptions} placeholder="Select..." />)
      const firstOption = container.querySelector('option')
      expect(firstOption?.textContent).toBe('Select...')
    })
  })

  describe('Label Support', () => {
    it('renders label when provided', () => {
      render(<Select options={defaultOptions} label="Choose option" />)
      expect(screen.getByText('Choose option')).toBeInTheDocument()
    })

    it('does not render label when not provided', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const label = container.querySelector('label')
      expect(label).not.toBeInTheDocument()
    })

    it('label has correct styling', () => {
      render(<Select options={defaultOptions} label="Select field" />)
      const label = screen.getByText('Select field')
      expect(label).toHaveClass('block', 'text-sm', 'font-medium', 'text-gray-700', 'mb-2')
    })
  })

  describe('Error States', () => {
    it('renders error message when provided', () => {
      render(<Select options={defaultOptions} error="This field is required" />)
      expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('applies error styling to select', () => {
      const { container } = render(<Select options={defaultOptions} error="Invalid selection" />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('border-red-500', 'focus:ring-red-500')
    })

    it('does not show error when not provided', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const error = container.querySelector('.text-red-600')
      expect(error).not.toBeInTheDocument()
    })

    it('error message has correct styling', () => {
      render(<Select options={defaultOptions} error="Error message" />)
      const errorElement = screen.getByText('Error message')
      expect(errorElement).toHaveClass('text-sm', 'text-red-600', 'mt-1')
    })
  })

  describe('Focus States', () => {
    it('applies focus ring on normal state', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('focus:ring-2', 'focus:ring-blue-500')
    })

    it('applies focus ring on error state', () => {
      const { container } = render(<Select options={defaultOptions} error="Error" />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('focus:ring-2', 'focus:ring-red-500')
    })
  })

  describe('Custom Dropdown Arrow', () => {
    it('has background image for dropdown arrow', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select') as HTMLSelectElement
      expect(select.style.backgroundImage).toBeTruthy()
    })

    it('positions arrow on the right', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select') as HTMLSelectElement
      expect(select.style.backgroundPosition).toBe('right 0.75rem center')
    })

    it('sets arrow size', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select') as HTMLSelectElement
      expect(select.style.backgroundSize).toBe('1.5em 1.5em')
    })

    it('uses no-repeat for arrow', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select')
      expect(select).toHaveClass('bg-no-repeat')
    })
  })

  describe('HTML Select Attributes', () => {
    it('forwards name attribute', () => {
      const { container } = render(<Select options={defaultOptions} name="category" />)
      const select = container.querySelector('select')
      expect(select).toHaveAttribute('name', 'category')
    })

    it('forwards disabled attribute', () => {
      const { container } = render(<Select options={defaultOptions} disabled />)
      const select = container.querySelector('select')
      expect(select).toBeDisabled()
    })

    it('forwards required attribute', () => {
      const { container } = render(<Select options={defaultOptions} required />)
      const select = container.querySelector('select')
      expect(select).toBeRequired()
    })

    it('forwards value attribute', () => {
      const { container } = render(<Select options={defaultOptions} value="option2" onChange={() => {}} />)
      const select = container.querySelector('select') as HTMLSelectElement
      expect(select.value).toBe('option2')
    })

    it('forwards defaultValue attribute', () => {
      const { container } = render(<Select options={defaultOptions} defaultValue="option1" />)
      const select = container.querySelector('select') as HTMLSelectElement
      expect(select.value).toBe('option1')
    })

    it('forwards id attribute', () => {
      const { container } = render(<Select options={defaultOptions} id="category-select" />)
      const select = container.querySelector('select')
      expect(select).toHaveAttribute('id', 'category-select')
    })
  })

  describe('Interaction', () => {
    it('calls onChange when selection changes', () => {
      const handleChange = jest.fn()
      const { container } = render(<Select options={defaultOptions} onChange={handleChange} />)
      const select = container.querySelector('select') as HTMLSelectElement

      fireEvent.change(select, { target: { value: 'option2' } })

      expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it('calls onFocus when select is focused', () => {
      const handleFocus = jest.fn()
      const { container } = render(<Select options={defaultOptions} onFocus={handleFocus} />)
      const select = container.querySelector('select') as HTMLSelectElement

      fireEvent.focus(select)

      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('calls onBlur when select loses focus', () => {
      const handleBlur = jest.fn()
      const { container } = render(<Select options={defaultOptions} onBlur={handleBlur} />)
      const select = container.querySelector('select') as HTMLSelectElement

      fireEvent.blur(select)

      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('updates value on selection', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select') as HTMLSelectElement

      fireEvent.change(select, { target: { value: 'option3' } })

      expect(select.value).toBe('option3')
    })
  })

  describe('Ref Forwarding', () => {
    it('forwards ref to select element', () => {
      const ref = createRef<HTMLSelectElement>()
      render(<Select options={defaultOptions} ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLSelectElement)
    })

    it('allows ref to focus select', () => {
      const ref = createRef<HTMLSelectElement>()
      render(<Select options={defaultOptions} ref={ref} />)

      ref.current?.focus()

      expect(document.activeElement).toBe(ref.current)
    })

    it('allows ref to access select value', () => {
      const ref = createRef<HTMLSelectElement>()
      const { container } = render(<Select options={defaultOptions} defaultValue="option2" ref={ref} />)

      expect(ref.current?.value).toBe('option2')
    })
  })

  describe('Accessibility', () => {
    it('supports aria-label', () => {
      const { container } = render(<Select options={defaultOptions} aria-label="Category selector" />)
      const select = container.querySelector('select')
      expect(select).toHaveAttribute('aria-label', 'Category selector')
    })

    it('supports aria-describedby', () => {
      const { container } = render(<Select options={defaultOptions} aria-describedby="help-text" />)
      const select = container.querySelector('select')
      expect(select).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('select is keyboard navigable', () => {
      const { container } = render(<Select options={defaultOptions} />)
      const select = container.querySelector('select')
      expect(select?.tabIndex).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Complex Use Cases', () => {
    it('renders with label, placeholder, and error', () => {
      render(
        <Select
          options={defaultOptions}
          label="Category"
          placeholder="Select category"
          error="Please select a category"
        />
      )

      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Select category')).toBeInTheDocument()
      expect(screen.getByText('Please select a category')).toBeInTheDocument()
    })

    it('handles many options', () => {
      const manyOptions = Array.from({ length: 50 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i + 1}`,
      }))

      const { container } = render(<Select options={manyOptions} />)
      const options = container.querySelectorAll('option')
      expect(options).toHaveLength(50)
    })

    it('works in controlled mode', () => {
      const handleChange = jest.fn()
      const { container, rerender } = render(
        <Select options={defaultOptions} value="option1" onChange={handleChange} />
      )

      const select = container.querySelector('select') as HTMLSelectElement
      expect(select.value).toBe('option1')

      fireEvent.change(select, { target: { value: 'option2' } })
      expect(handleChange).toHaveBeenCalled()

      rerender(<Select options={defaultOptions} value="option2" onChange={handleChange} />)
      expect(select.value).toBe('option2')
    })
  })
})
