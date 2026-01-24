// ============================================================================
// StatusIndicator Component
// Indicateur de statut avec animation
// ============================================================================

import { Badge } from '@components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

export type Status = 'success' | 'error' | 'warning' | 'pending' | 'loading' | 'info';

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  showIcon?: boolean;
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<Status, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  success: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
  },
  warning: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
  },
  pending: {
    icon: <Clock className="w-4 h-4" />,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  loading: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'bg-gray-500',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
  info: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
};

export function StatusIndicator({
  status,
  label,
  showIcon = true,
  showPulse = false,
  size = 'md',
}: StatusIndicatorProps) {
  const config = statusConfig[status];

  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }[size];

  if (label) {
    return (
      <Badge className={`${config.bgColor} ${config.textColor} border-0`}>
        <div className="flex items-center gap-2">
          {showIcon && config.icon}
          {label}
        </div>
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`${dotSize} rounded-full ${config.color}`} />
        {showPulse && (
          <div className={`absolute inset-0 ${dotSize} rounded-full ${config.color} animate-ping opacity-75`} />
        )}
      </div>
    </div>
  );
}
