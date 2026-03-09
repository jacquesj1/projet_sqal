/**
 * Tests - Utility Functions
 * Tests unitaires pour les fonctions utilitaires
 */

import { cn } from '../utils'

describe('cn() - ClassName Utility', () => {
  it('merges class names', () => {
    const result = cn('class1', 'class2')

    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  it('handles conditional classes with clsx', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')

    expect(result).toContain('base')
    expect(result).toContain('active')
  })

  it('filters out false conditions', () => {
    const isActive = false
    const result = cn('base', isActive && 'active')

    expect(result).toContain('base')
    expect(result).not.toContain('active')
  })

  it('merges Tailwind classes correctly', () => {
    const result = cn('p-4', 'p-8')

    // twMerge should keep only the last padding class
    expect(result).toBe('p-8')
  })

  it('handles array of classes', () => {
    const result = cn(['class1', 'class2', 'class3'])

    expect(result).toContain('class1')
    expect(result).toContain('class2')
    expect(result).toContain('class3')
  })

  it('handles object with boolean values', () => {
    const result = cn({
      base: true,
      active: true,
      disabled: false,
    })

    expect(result).toContain('base')
    expect(result).toContain('active')
    expect(result).not.toContain('disabled')
  })

  it('handles empty input', () => {
    const result = cn()

    expect(result).toBe('')
  })

  it('handles null and undefined', () => {
    const result = cn('base', null, undefined, 'end')

    expect(result).toContain('base')
    expect(result).toContain('end')
  })

  it('merges conflicting Tailwind classes', () => {
    // Should keep only the last value for conflicting utilities
    const result = cn('text-red-500', 'text-blue-500')

    expect(result).toBe('text-blue-500')
    expect(result).not.toContain('text-red-500')
  })

  it('preserves non-conflicting Tailwind classes', () => {
    const result = cn('text-red-500', 'bg-blue-500')

    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('handles complex Tailwind class combinations', () => {
    const result = cn(
      'px-4 py-2',
      'bg-blue-500 hover:bg-blue-600',
      'text-white font-bold',
      'rounded-lg shadow-md'
    )

    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('hover:bg-blue-600')
    expect(result).toContain('text-white')
    expect(result).toContain('font-bold')
    expect(result).toContain('rounded-lg')
    expect(result).toContain('shadow-md')
  })

  it('handles responsive Tailwind classes', () => {
    const result = cn('w-full', 'md:w-1/2', 'lg:w-1/3')

    expect(result).toContain('w-full')
    expect(result).toContain('md:w-1/2')
    expect(result).toContain('lg:w-1/3')
  })

  it('merges dark mode classes', () => {
    const result = cn('bg-white', 'dark:bg-gray-900')

    expect(result).toContain('bg-white')
    expect(result).toContain('dark:bg-gray-900')
  })

  it('handles state variants', () => {
    const result = cn(
      'bg-blue-500',
      'hover:bg-blue-600',
      'focus:bg-blue-700',
      'active:bg-blue-800'
    )

    expect(result).toContain('bg-blue-500')
    expect(result).toContain('hover:bg-blue-600')
    expect(result).toContain('focus:bg-blue-700')
    expect(result).toContain('active:bg-blue-800')
  })

  it('handles arbitrary values', () => {
    const result = cn('w-[32px]', 'h-[32px]')

    expect(result).toContain('w-[32px]')
    expect(result).toContain('h-[32px]')
  })

  it('merges conflicting arbitrary values', () => {
    const result = cn('w-[32px]', 'w-[64px]')

    expect(result).toBe('w-[64px]')
    expect(result).not.toContain('w-[32px]')
  })

  it('handles real-world component example', () => {
    const variant = 'primary'
    const size = 'lg'
    const isDisabled = false

    const result = cn(
      'inline-flex items-center justify-center',
      'rounded-md font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2',
      variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
      variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      size === 'sm' && 'h-9 px-3 text-sm',
      size === 'lg' && 'h-11 px-8 text-base',
      isDisabled && 'opacity-50 cursor-not-allowed'
    )

    expect(result).toContain('inline-flex')
    expect(result).toContain('bg-blue-600')
    expect(result).toContain('h-11')
    expect(result).toContain('px-8')
    expect(result).not.toContain('opacity-50')
  })
})
