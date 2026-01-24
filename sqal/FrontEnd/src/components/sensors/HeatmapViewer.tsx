"use client"
import { useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ResponsiveHeatMap } from "@nivo/heatmap"

interface HeatmapDataPoint {
  x: string
  y: number | null
}

interface HeatmapSeries {
  id: string
  data: HeatmapDataPoint[]
}

type Props = {
  data: number[][],
  label: string
}

export default function HeatmapViewer({ data, label }: Props) {
  // Transform data for Nivo heatmap
  const series: HeatmapSeries[] = useMemo(() => {
    return data.map((row, i) => ({
      id: `row-${i}`,
      data: row.map((value, j) => ({
        x: `col-${j}`,
        y: value ?? null
      }))
    }))
  }, [data])

  // Calculate min and max for color scaling
  const { min, max } = useMemo(() => {
    if (!data.length || !data[0]?.length) return { min: 0, max: 100 }

    const flatData = data.flat().filter((val): val is number => val !== null && val !== undefined)
    return {
      min: Math.min(...flatData, 0),
      max: Math.max(...flatData, 1)
    }
  }, [data])

  // Generate unique key to force re-render when data changes
  const dataKey = useMemo(() => {
    return JSON.stringify(data.flat().slice(0, 5)); // Use first 5 values as key
  }, [data]);

  return (
    <Card className="w-full h-full">
      <CardHeader className="p-4 pb-2">
        <h3 className="text-lg font-medium">{label}</h3>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-60px)]">
        <div className="w-full h-full" key={dataKey}>
          <ResponsiveHeatMap
            data={series}
            margin={{ top: 10, right: 30, bottom: 40, left: 60 }}
            axisTop={null}
            axisRight={null}
            colors={{
              type: 'sequential',
              scheme: 'reds',
              minValue: min,
              maxValue: max
            }}
            emptyColor="#f8f9fa"
            borderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
            enableGridX={false}
            enableGridY={false}
            hoverTarget="cell"
            animate={false}
            isInteractive={true}
            valueFormat={value => `${value?.toFixed(2)}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}
