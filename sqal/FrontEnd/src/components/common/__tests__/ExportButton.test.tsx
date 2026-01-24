/**
 * Tests - ExportButton Component
 * Tests unitaires pour le bouton d'export
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportButton, ExportFormat } from '../ExportButton'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

import { toast } from 'sonner'

describe('ExportButton Component', () => {
  const mockOnExport = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders export button with default label', () => {
    render(<ExportButton onExport={mockOnExport} />)

    expect(screen.getByText('Exporter')).toBeInTheDocument()
  })

  it('renders export button with custom label', () => {
    render(<ExportButton onExport={mockOnExport} label="Download Data" />)

    expect(screen.getByText('Download Data')).toBeInTheDocument()
  })

  it('renders download icon', () => {
    const { container } = render(<ExportButton onExport={mockOnExport} />)

    const downloadIcon = container.querySelector('.lucide-download')
    expect(downloadIcon).toBeInTheDocument()
  })

  it('is enabled by default', () => {
    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ExportButton onExport={mockOnExport} disabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('renders all export formats by default', () => {
    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Exporter en CSV')).toBeInTheDocument()
    expect(screen.getByText('Exporter en Excel')).toBeInTheDocument()
    expect(screen.getByText('Exporter en JSON')).toBeInTheDocument()
    expect(screen.getByText('Exporter en PDF')).toBeInTheDocument()
  })

  it('renders only specified formats', () => {
    render(<ExportButton onExport={mockOnExport} formats={['csv', 'excel']} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Exporter en CSV')).toBeInTheDocument()
    expect(screen.getByText('Exporter en Excel')).toBeInTheDocument()
    expect(screen.queryByText('Exporter en JSON')).not.toBeInTheDocument()
    expect(screen.queryByText('Exporter en PDF')).not.toBeInTheDocument()
  })

  it('calls onExport with correct format when CSV is clicked', async () => {
    mockOnExport.mockResolvedValue(undefined)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith('csv')
    })
  })

  it('calls onExport with correct format when Excel is clicked', async () => {
    mockOnExport.mockResolvedValue(undefined)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const excelOption = screen.getByText('Exporter en Excel')
    fireEvent.click(excelOption)

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith('excel')
    })
  })

  it('shows success toast on successful export', async () => {
    mockOnExport.mockResolvedValue(undefined)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Export CSV réussi')
    })
  })

  it('shows error toast on export failure', async () => {
    mockOnExport.mockRejectedValue(new Error('Export failed'))

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Erreur lors de l'export CSV")
    })
  })

  it('shows loading state during export', async () => {
    let resolveExport: () => void
    const exportPromise = new Promise<void>((resolve) => {
      resolveExport = resolve
    })
    mockOnExport.mockReturnValue(exportPromise)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(screen.getByText('Export en cours...')).toBeInTheDocument()
    })

    resolveExport!()
  })

  it('disables button during export', async () => {
    let resolveExport: () => void
    const exportPromise = new Promise<void>((resolve) => {
      resolveExport = resolve
    })
    mockOnExport.mockReturnValue(exportPromise)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      const buttonElement = screen.getByText('Export en cours...').closest('button')
      expect(buttonElement).toBeDisabled()
    })

    resolveExport!()
  })

  it('disables menu items during export', async () => {
    let resolveExport: () => void
    const exportPromise = new Promise<void>((resolve) => {
      resolveExport = resolve
    })
    mockOnExport.mockReturnValue(exportPromise)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      const menuItem = screen.getByText('Exporter en CSV')
      expect(menuItem.closest('div[role="menuitem"]')).toHaveClass('disabled')
    })

    resolveExport!()
  })

  it('handles synchronous onExport', async () => {
    const syncOnExport = jest.fn()

    render(<ExportButton onExport={syncOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(syncOnExport).toHaveBeenCalledWith('csv')
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('renders icons for all export formats', () => {
    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const { container } = render(<ExportButton onExport={mockOnExport} />)
    fireEvent.click(screen.getAllByRole('button')[0])

    expect(document.querySelector('.lucide-file-text')).toBeInTheDocument()
    expect(document.querySelector('.lucide-file-spreadsheet')).toBeInTheDocument()
    expect(document.querySelector('.lucide-file-json')).toBeInTheDocument()
  })

  it('handles multiple sequential exports', async () => {
    mockOnExport.mockResolvedValue(undefined)

    render(<ExportButton onExport={mockOnExport} />)

    // First export
    let button = screen.getByRole('button')
    fireEvent.click(button)
    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith('csv')
    })

    // Second export
    button = screen.getByRole('button')
    fireEvent.click(button)
    const excelOption = screen.getByText('Exporter en Excel')
    fireEvent.click(excelOption)

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith('excel')
    })

    expect(mockOnExport).toHaveBeenCalledTimes(2)
  })

  it('logs error to console on export failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    const error = new Error('Export failed')
    mockOnExport.mockRejectedValue(error)

    render(<ExportButton onExport={mockOnExport} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    const csvOption = screen.getByText('Exporter en CSV')
    fireEvent.click(csvOption)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Export error:', error)
    })

    consoleErrorSpy.mockRestore()
  })

  it('handles single format', () => {
    render(<ExportButton onExport={mockOnExport} formats={['pdf']} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Exporter en PDF')).toBeInTheDocument()
    expect(screen.queryByText('Exporter en CSV')).not.toBeInTheDocument()
  })
})
