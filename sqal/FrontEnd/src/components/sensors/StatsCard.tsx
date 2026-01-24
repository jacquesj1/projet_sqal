import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatsCard({ title, value, unit }: { title: string; value: number | string; unit?: string }) {
  return (
    <Card className="w-full shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          {value} {unit}
        </p>
      </CardContent>
    </Card>
  );
}
