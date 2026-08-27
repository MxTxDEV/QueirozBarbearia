"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function BarberComparisonChart({ data }: { data: { name: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="name" stroke="rgba(154,161,172,0.9)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="rgba(154,161,172,0.9)" fontSize={12} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)" }}
          contentStyle={{
            background: "#101114",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#f7f8fa",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Bar dataKey="revenue" fill="#38bdf8" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
