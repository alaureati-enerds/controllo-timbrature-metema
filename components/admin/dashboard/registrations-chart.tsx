"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { format, parseISO } from "date-fns"
import { it } from "date-fns/locale"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { DailyPoint } from "@/lib/dashboard/admin-stats"

// Grafico a barre delle nuove registrazioni utenti per giorno: il segnale di
// crescita più immediato per un admin.

const chartConfig = {
  registrations: { label: "Registrazioni", color: "var(--chart-1)" },
} satisfies ChartConfig

export function RegistrationsChart({ data }: { data: DailyPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: 12, right: 12 }}>
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
          cursor={false}
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
        <Bar dataKey="registrations" fill="var(--color-registrations)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
