"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { format, parseISO } from "date-fns"
import { it } from "date-fns/locale"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DailyPoint } from "@/lib/dashboard/admin-stats"

// Grafico ad area (impilata) degli eventi del registro di audit per giorno:
// riusciti vs falliti. È un segnale di sicurezza/operatività a colpo d'occhio.
// I fallimenti usano il colore `destructive` (semantico), non uno arbitrario.

const chartConfig = {
  auditOk: { label: "Riusciti", color: "var(--chart-1)" },
  auditFail: { label: "Falliti", color: "var(--destructive)" },
} satisfies ChartConfig

export function ActivityChart({ data }: { data: DailyPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value) => format(parseISO(value), "d MMM", { locale: it })}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                payload?.[0]
                  ? format(parseISO(payload[0].payload.date), "EEEE d MMMM", {
                      locale: it,
                    })
                  : ""
              }
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="auditOk"
          type="natural"
          stackId="a"
          fill="var(--color-auditOk)"
          fillOpacity={0.4}
          stroke="var(--color-auditOk)"
        />
        <Area
          dataKey="auditFail"
          type="natural"
          stackId="a"
          fill="var(--color-auditFail)"
          fillOpacity={0.4}
          stroke="var(--color-auditFail)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
