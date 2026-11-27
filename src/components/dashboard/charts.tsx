"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stats } from "@/server/stats";

// Mid-tone categorical palette: readable on both the white and the dark theme.
const PALETTE = ["#3b82f6", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#94a3b8", "#ef4444", "#6366f1"];
/** Same colours as the status badges everywhere else (sky, violet, amber, emerald, slate). */
const STATUS_COLOR: Record<string, string> = { Open: "#0ea5e9", "In review": "#8b5cf6", "On hold": "#f59e0b", Resolved: "#10b981", Closed: "#94a3b8" };
const AXIS = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false };
const TIP = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" },
  cursor: { fill: "var(--accent)", opacity: 0.4 },
};

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">
        {empty ? <div className="grid h-full place-items-center rounded-md border border-dashed text-sm text-muted-foreground">No data in this period</div> : children}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ stats, showDepartments = true }: { stats: Stats; showDepartments?: boolean }) {
  const anim = !useReducedMotion();
  const none = stats.total === 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard title="Monthly trend" empty={none}>
          <ResponsiveContainer>
            <AreaChart data={stats.monthly} margin={{ left: -20, right: 8 }}>
              <defs>
                <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={PALETTE[0]} stopOpacity={0.35} /><stop offset="1" stopColor={PALETTE[0]} stopOpacity={0} /></linearGradient>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={PALETTE[1]} stopOpacity={0.3} /><stop offset="1" stopColor={PALETTE[1]} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TIP} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="submitted" name="Submitted" stroke={PALETTE[0]} fill="url(#gS)" strokeWidth={2} isAnimationActive={anim} />
              <Area type="monotone" dataKey="resolved" name="Resolved" stroke={PALETTE[1]} fill="url(#gR)" strokeWidth={2} isAnimationActive={anim} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="By category" empty={none}>
        <ResponsiveContainer>
          <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 0, right: 16 }}>
            <XAxis type="number" allowDecimals={false} {...AXIS} />
            <YAxis type="category" dataKey="name" width={130} {...AXIS} />
            <Tooltip {...TIP} />
            <Bar dataKey="value" name="Feedback" radius={[0, 4, 4, 0]} fill={PALETTE[0]} isAnimationActive={anim} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="By status" empty={none}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={stats.byStatus} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none" isAnimationActive={anim}>
              {stats.byStatus.map((s, i) => <Cell key={i} fill={STATUS_COLOR[s.name] ?? PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...TIP} />
            <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="By priority" empty={none}>
        <ResponsiveContainer>
          <BarChart data={stats.byPriority} margin={{ left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip {...TIP} />
            <Bar dataKey="value" name="Feedback" radius={[4, 4, 0, 0]} isAnimationActive={anim}>
              {stats.byPriority.map((p, i) => <Cell key={i} fill={["#94a3b8", "#3b82f6", "#f59e0b", "#dc2626"][Math.max(0, p.rank - 1)]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {showDepartments && (
        <ChartCard title="By department" empty={none}>
          <ResponsiveContainer>
            <BarChart data={stats.byDepartment} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" {...AXIS} interval={0} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TIP} />
              <Bar dataKey="value" name="Feedback" radius={[4, 4, 0, 0]} fill={PALETTE[1]} isAnimationActive={anim} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
