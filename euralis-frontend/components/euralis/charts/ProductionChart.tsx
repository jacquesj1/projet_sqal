'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ProductionChartProps {
  data: any[];
  type?: 'line' | 'area';
}

const ProductionChart: React.FC<ProductionChartProps> = ({
  data,
  type = 'area',
}) => {
  const siteColors = {
    LL: '#3B82F6', // blue
    LS: '#10B981', // green
    MT: '#F59E0B', // orange
  };

  const commonProps = {
    strokeWidth: 2,
  };

  const sites = [
    { key: 'LL', name: 'Bretagne (LL)', color: siteColors.LL },
    { key: 'LS', name: 'Pays de Loire (LS)', color: siteColors.LS },
    { key: 'MT', name: 'Maubourguet (MT)', color: siteColors.MT },
  ];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'area' ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={12}
              label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.375rem',
              }}
            />
            <Legend />
            {sites.map((site) => (
              <Area
                key={site.key}
                type="monotone"
                dataKey={site.key}
                name={site.name}
                stroke={site.color}
                fill={site.color}
                fillOpacity={0.6}
                {...commonProps}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={12}
              label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.375rem',
              }}
            />
            <Legend />
            {sites.map((site) => (
              <Line
                key={site.key}
                type="monotone"
                dataKey={site.key}
                name={site.name}
                stroke={site.color}
                fill={site.color}
                {...commonProps}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ProductionChart;
