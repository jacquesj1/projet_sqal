/**
 * Jest setup file for SQAL Frontend
 * Configures global test environment and mocks
 */

import '@testing-library/jest-dom'

// Mock import.meta (Vite-specific)
Object.defineProperty(globalThis, 'import.meta', {
  value: {
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000',
      VITE_WS_URL: 'ws://localhost:8000',
      MODE: 'test',
      DEV: true,
      PROD: false,
    },
  },
})

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const mockIcon = (props: any) => null
  return {
    Search: mockIcon,
    X: mockIcon,
    Download: mockIcon,
    FileText: mockIcon,
    FileSpreadsheet: mockIcon,
    FileJson: mockIcon,
    Activity: mockIcon,
    AlertCircle: mockIcon,
    CheckCircle: mockIcon,
    Info: mockIcon,
    Loader: mockIcon,
    TrendingUp: mockIcon,
    TrendingDown: mockIcon,
  }
})

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
  Toaster: (props: any) => props,
}))

// Mock recharts
jest.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => ({ children, ...props }),
  AreaChart: ({ children, ...props }: any) => ({ children, ...props }),
  BarChart: ({ children, ...props }: any) => ({ children, ...props }),
  Line: (props: any) => props,
  Area: (props: any) => props,
  Bar: (props: any) => props,
  XAxis: (props: any) => props,
  YAxis: (props: any) => props,
  CartesianGrid: (props: any) => props,
  Tooltip: (props: any) => props,
  Legend: (props: any) => props,
  ResponsiveContainer: ({ children, ...props }: any) => ({ children, ...props }),
  Cell: (props: any) => props,
}))

// Mock @radix-ui/react-slot
jest.mock('@radix-ui/react-slot', () => ({
  Slot: ({ children, ...props }: any) => children,
}))

// Mock class-variance-authority
jest.mock('class-variance-authority', () => ({
  cva: () => () => '',
  cx: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock HTMLCanvasElement.getContext for charts
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
})) as any

// Mock WebSocket
global.WebSocket = class WebSocket {
  constructor(public url: string) {}
  send = jest.fn()
  close = jest.fn()
  addEventListener = jest.fn()
  removeEventListener = jest.fn()
  CONNECTING = 0
  OPEN = 1
  CLOSING = 2
  CLOSED = 3
  readyState = 1
} as any

// Mock WebGL for Three.js (used in ToF 3D visualization)
HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return {
      getExtension: jest.fn(),
      getParameter: jest.fn(),
      createProgram: jest.fn(),
      createShader: jest.fn(),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      useProgram: jest.fn(),
      deleteShader: jest.fn(),
      deleteProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      getShaderParameter: jest.fn(() => true),
      getProgramInfoLog: jest.fn(() => ''),
      getShaderInfoLog: jest.fn(() => ''),
      viewport: jest.fn(),
      clear: jest.fn(),
      clearColor: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      depthFunc: jest.fn(),
      blendFunc: jest.fn(),
      createBuffer: jest.fn(),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      createTexture: jest.fn(),
      bindTexture: jest.fn(),
      texImage2D: jest.fn(),
      texParameteri: jest.fn(),
      activeTexture: jest.fn(),
      drawArrays: jest.fn(),
      drawElements: jest.fn(),
      getAttribLocation: jest.fn(() => 0),
      getUniformLocation: jest.fn(() => ({})),
      vertexAttribPointer: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      uniform1f: jest.fn(),
      uniform2f: jest.fn(),
      uniform3f: jest.fn(),
      uniform4f: jest.fn(),
      uniformMatrix4fv: jest.fn(),
    }
  }
  return null
}) as any

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
)

// Suppress console errors in tests (optional, only use for known warnings)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Not implemented: HTMLCanvasElement.prototype.getContext'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
