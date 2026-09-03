"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { RevenuePoint } from "@/lib/data/dashboard-insights";
import { useChartTheme } from "./chart-theme";

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chart = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chart.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chart.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          stroke={chart.axis}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => formatCurrency(Number(v)).replace("R$", "").trim()}
        />
        <Tooltip
          cursor={{ stroke: chart.cursor }}
          contentStyle={{
            background: chart.tooltipBg,
            border: `1px solid ${chart.tooltipBorder}`,
            borderRadius: 12,
            color: chart.tooltipText,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          formatter={(value) => [formatCurrency(Number(value)), "Faturamento"]}
        />
        <Area type="monotone" dataKey="amount" name="Faturamento" stroke={chart.accent} strokeWidth={2.5} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
