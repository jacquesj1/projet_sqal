'use client';

import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: 'blue' | 'green' | 'orange' | 'red';
  subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'blue',
  subtitle,
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  const trendColorClasses = {
    up: trend && trend.value >= 0 ? 'text-green-600' : 'text-red-600',
    down: trend && trend.value < 0 ? 'text-green-600' : 'text-red-600',
  };

  return (
    <div className={`border rounded-lg p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>

          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}

          {trend && (
            <div className="flex items-center mt-2">
              <span
                className={`text-sm font-medium ${
                  trendColorClasses[trend.direction]
                }`}
              >
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500 ml-2">vs période précédente</span>
            </div>
          )}
        </div>

        {icon && (
          <div className="ml-4">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
