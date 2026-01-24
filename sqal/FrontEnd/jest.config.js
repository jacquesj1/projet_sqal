/**
 * Jest configuration for SQAL Frontend (React + Vite)
 */

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Transform files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.test.(ts|tsx)',
    '**/*.test.(ts|tsx)',
  ],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.tsx',
    '!src/**/__tests__/**',
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Test timeout
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}
