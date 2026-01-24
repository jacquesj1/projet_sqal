"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

export function LiveChart() {
  const [data, setData] = useState<{ time: string; avg: number }[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5000/socket.io/?EIO=4&transport=websocket");
    
    ws.onmessage = (event) => {
      if (event.data.includes("new_data")) {
        try {
          const parsed = JSON.parse(event.data.split("42")[1])[1];
          const avg = parsed?.object_avg_distance || 0;
          setData((d) => [...d.slice(-20), { time: new Date().toLocaleTimeString(), avg }]);
        } catch (e) {
          console.error("Parse error", e);
        }
      }
    };
    return () => ws.close();
  }, []);

  return (
    <LineChart width={600} height={300} data={data}>
      <Line type="monotone" dataKey="avg" stroke="#2563eb" strokeWidth={2} />
      <CartesianGrid stroke="#ccc" />
      <XAxis dataKey="time" />
      <YAxis />
      <Tooltip />
    </LineChart>
  );
}
