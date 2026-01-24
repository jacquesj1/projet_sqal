"use client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ResponsiveLine } from "@nivo/line"

type Props = {
  bins: number[]
  binSize: number
  label: string
}

export default function PixelHistogram({ bins, binSize, label }: Props) {
  const data = [
    {
      id: "hist",
      data: bins.map((v, i) => ({ x: i*binSize, y: v })),
    },
  ]
  return (
    <Card>
      <CardHeader>{label}</CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveLine
          data={data}
          margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
          axisBottom={{ legend: "Distance (mm)", legendOffset: 36, legendPosition: "middle" }}
          axisLeft={{ legend: "Counts", legendOffset: -40, legendPosition: "middle" }}
          colors={["#2563eb"]}
        />
      </CardContent>
    </Card>
  )
}
