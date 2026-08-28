"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ServiceBreakdownItem } from "@/lib/data/dashboard-insights";

const COLORS = ["#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#f472b6", "#fb923c"];

export function ServiceDonut({ data }: { data: ServiceBreakdownItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="revenue" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#101114",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#f7f8fa",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          formatter={(value) => formatCurrency(Number(value))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export { COLORS as SERVICE_DONUT_COLORS };
