// components/admin/AdminCharts.tsx
"use client"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatsData {
  registrations: { date: string; count: number }[]
  personsOverTime: { date: string; count: number }[]
  relationshipTypes: { type: string; count: number }[]
  treesPerUser: { name: string; count: number }[]
}

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function AdminCharts({ data }: { data: StatsData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">User Registrations (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Registrations", color: "var(--chart-1)" } }} className="h-[200px]">
            <AreaChart data={data.registrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="count" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.2} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Persons Added (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Persons", color: "var(--chart-2)" } }} className="h-[200px]">
            <LineChart data={data.personsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="count" stroke="var(--chart-2)" dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Relationship Types</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{} as any} className="h-[200px]">
            <PieChart>
              <Pie
                data={data.relationshipTypes}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.relationshipTypes.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trees per User (top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: "Trees", color: "var(--chart-3)" } }} className="h-[200px]">
            <BarChart data={data.treesPerUser} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-3)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
