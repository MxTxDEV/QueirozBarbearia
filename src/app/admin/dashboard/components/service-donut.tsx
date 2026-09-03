"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ServiceBreakdownItem } from "@/lib/data/dashboard-insights";
import { useChartTheme } from "./chart-theme";

export function ServiceDonut({ data }: { data: ServiceBreakdownItem[] }) {
  const chart = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="revenue" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={chart.categorical[i % chart.categorical.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: chart.tooltipBg,
            border: `1px solid ${chart.tooltipBorder}`,
            borderRadius: 12,
            color: chart.tooltipText,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          formatter={(value) => formatCurrency(Number(value))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
