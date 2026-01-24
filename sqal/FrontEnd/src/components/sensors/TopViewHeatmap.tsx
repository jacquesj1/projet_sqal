// In TopViewHeatmap.tsx
"use client"
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface TopViewHeatmapProps {
  matrix: number[][]
  width?: number | string
  height?: number | string
}

interface HeatMapDataPoint {
  x: string
  y: number | null
}

interface HeatMapSerie {
  id: string
  data: HeatMapDataPoint[]
}

const CustomTooltip = (props: { cell: { xKey: string; yKey: string; value: number | null } }) => {
  const { cell } = props
  if (!cell) return null
  
  const xPos = cell.xKey?.toString().replace('x', '') || '0'
  const yPos = cell.yKey?.toString().replace('y', '') || '0'
  
  return (
    <div className="bg-white p-2 text-sm shadow-lg rounded border border-gray-200">
      <div>X: {xPos}, Y: {yPos}</div>
      <div>Distance: {cell.value?.toFixed(2)} mm</div>
    </div>
  )
}

export default function TopViewHeatmap({ 
  matrix, 
  width = '100%', 
  height = '100%' 
}: TopViewHeatmapProps) {
  // Calculate min and max for color scaling
  const { min, max } = useMemo(() => {
    if (!matrix.length || !matrix[0]?.length) return { min: 0, max: 100 }
    
    const flatMatrix = matrix.flat().filter((val): val is number => val !== null && val !== undefined)
    return {
      min: Math.min(...flatMatrix, 0),
      max: Math.max(...flatMatrix, 1) // Ensure max is at least 1 to avoid division by zero
    }
  }, [matrix])

  // Transform matrix data for Nivo heatmap
  const data: HeatMapSerie[] = useMemo(() => {
    return matrix.map((row, y) => ({
      id: `y${y}`,
      data: row.map((value, x) => ({
        x: `x${x}`,
        y: value ?? null
      }))
    }))
  }, [matrix])

  return (
    <Card className="w-full h-full">
      <CardContent className="p-0 h-full">
        <div style={{ width, height }}>
          <ResponsiveHeatMap
            data={data}
            margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'X Position',
              legendOffset: 36,
              format: (value: string) => value.replace('x', '')
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Y Position',
              legendPosition: 'middle',
              legendOffset: -40,
              format: (value: string) => value.toString().replace('y', '')
            }}
            colors={{
              type: 'sequential',
              scheme: 'blues',
              minValue: min,
              maxValue: max
            }}
            emptyColor="#f8f9fa"
            borderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
            enableGridX={false}
            enableGridY={false}
            hoverTarget="cell"

            tooltip={({ cell }: { cell: { x: string | number; serieId: string; value: number | null } }) => {
              const xPos = String(cell.x).replace('x', '');
              const yPos = String(cell.serieId).replace('y', '');
              return (
                <CustomTooltip 
                  cell={{
                    xKey: xPos,
                    yKey: yPos,
                    value: cell.value
                  }} 
                />
              );
            }}
            valueFormat={(value) => `${value?.toFixed(2)} mm`}
            animate={false}
            isInteractive={true}
            onClick={(cell) => {
              console.log('Cell clicked:', cell)
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}