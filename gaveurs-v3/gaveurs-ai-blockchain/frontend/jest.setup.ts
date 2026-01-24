import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => props,
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const mockIcon = (props: any) => null
  return {
    Menu: mockIcon,
    X: mockIcon,
    ChevronDown: mockIcon,
    ChevronUp: mockIcon,
    Home: mockIcon,
    Users: mockIcon,
    Activity: mockIcon,
    Settings: mockIcon,
    LogOut: mockIcon,
    Bell: mockIcon,
    Search: mockIcon,
    Plus: mockIcon,
    Edit: mockIcon,
    Trash: mockIcon,
    Check: mockIcon,
    CheckCircle: mockIcon,
    AlertCircle: mockIcon,
    AlertTriangle: mockIcon,
    Info: mockIcon,
    Camera: mockIcon,
    QrCode: mockIcon,
    Download: mockIcon,
    Upload: mockIcon,
    Calendar: mockIcon,
    Clock: mockIcon,
    TrendingUp: mockIcon,
    TrendingDown: mockIcon,
    BarChart: mockIcon,
    PieChart: mockIcon,
    FileText: mockIcon,
    Shield: mockIcon,
    Wifi: mockIcon,
    WifiOff: mockIcon,
    Loader2: mockIcon,
    XCircle: mockIcon,
  }
})

// Mock recharts
jest.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => ({ children, ...props }),
  AreaChart: ({ children, ...props }: any) => ({ children, ...props }),
  BarChart: ({ children, ...props }: any) => ({ children, ...props }),
  PieChart: ({ children, ...props }: any) => ({ children, ...props }),
  Line: (props: any) => props,
  Area: (props: any) => props,
  Bar: (props: any) => props,
  Pie: (props: any) => props,
  XAxis: (props: any) => props,
  YAxis: (props: any) => props,
  CartesianGrid: (props: any) => props,
  Tooltip: (props: any) => props,
  Legend: (props: any) => props,
  ResponsiveContainer: ({ children, ...props }: any) => ({ children, ...props }),
  Cell: (props: any) => props,
}))

// Mock fetch globally
global.fetch = jest.fn()

// Mock WebSocket
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  send = jest.fn()
  close = jest.fn()
}

global.WebSocket = MockWebSocket as any
