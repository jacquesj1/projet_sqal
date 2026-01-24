/**
 * Tests - FilterBar Component
 * Tests unitaires pour la barre de filtres
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar, FilterOption } from '../FilterBar'

describe('FilterBar Component', () => {
  const mockOnChange = jest.fn()
  const mockOnReset = jest.fn()

  const mockFilters: FilterOption[] = [
    {
      key: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Search items...',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      placeholder: 'Select status...',
    },
    {
      key: 'date',
      label: 'Date',
      type: 'date',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all filter fields', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
  })

  it('renders text input with placeholder', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search items...')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveAttribute('type', 'text')
  })

  it('renders select input with options', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('Select status...')).toBeInTheDocument()
  })

  it('renders date input', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBeGreaterThan(0)
  })

  it('displays current values', () => {
    const values = {
      search: 'test query',
      status: 'active',
      date: '2024-12-25',
    }

    render(
      <FilterBar
        filters={mockFilters}
        values={values}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search items...') as HTMLInputElement
    expect(searchInput.value).toBe('test query')
  })

  it('calls onChange when text input changes', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search items...')
    fireEvent.change(searchInput, { target: { value: 'new search' } })

    expect(mockOnChange).toHaveBeenCalledWith('search', 'new search')
  })

  it('calls onChange when date input changes', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2024-12-25' } })

    expect(mockOnChange).toHaveBeenCalledWith('date', '2024-12-25')
  })

  it('shows reset button when filters are active', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{ search: 'test' }}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.getByRole('button')
    expect(resetButton).toBeInTheDocument()
  })

  it('hides reset button when no filters are active', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.queryByRole('button')
    expect(resetButton).not.toBeInTheDocument()
  })

  it('calls onReset when reset button is clicked', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{ search: 'test' }}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.getByRole('button')
    fireEvent.click(resetButton)

    expect(mockOnReset).toHaveBeenCalled()
  })

  it('hides reset button when showReset is false', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{ search: 'test' }}
        onChange={mockOnChange}
        onReset={mockOnReset}
        showReset={false}
      />
    )

    const resetButton = screen.queryByRole('button')
    expect(resetButton).not.toBeInTheDocument()
  })

  it('renders with empty filters array', () => {
    render(
      <FilterBar
        filters={[]}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const filterBar = document.querySelector('.flex.flex-wrap')
    expect(filterBar).toBeInTheDocument()
  })

  it('renders search icon for text inputs', () => {
    const { container } = render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const searchIcon = container.querySelector('.lucide-search')
    expect(searchIcon).toBeInTheDocument()
  })

  it('applies correct styling to filter inputs', () => {
    const { container } = render(
      <FilterBar
        filters={mockFilters}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const filterContainers = container.querySelectorAll('.min-w-\\[200px\\]')
    expect(filterContainers.length).toBe(mockFilters.length)
  })

  it('uses default placeholder when not provided', () => {
    const filtersNoPlaceholder: FilterOption[] = [
      {
        key: 'test',
        label: 'Test',
        type: 'text',
      },
    ]

    render(
      <FilterBar
        filters={filtersNoPlaceholder}
        values={{}}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument()
  })

  it('handles multiple active filters', () => {
    const values = {
      search: 'test',
      status: 'active',
      date: '2024-12-25',
    }

    render(
      <FilterBar
        filters={mockFilters}
        values={values}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const resetButton = screen.getByRole('button')
    expect(resetButton).toBeInTheDocument()
  })

  it('handles filter value clearing', () => {
    render(
      <FilterBar
        filters={mockFilters}
        values={{ search: 'test' }}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search items...')
    fireEvent.change(searchInput, { target: { value: '' } })

    expect(mockOnChange).toHaveBeenCalledWith('search', '')
  })
})
