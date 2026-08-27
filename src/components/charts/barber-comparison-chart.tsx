"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function BarberComparisonChart({ data }: { data: { name: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="name" stroke="rgba(168,169,173,0.8)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="rgba(168,169,173,0.8)" fontSize={12} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{
            background: "#17181a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#f4f3f1",
          }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Bar dataKey="revenue" fill="#c81e2c" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
