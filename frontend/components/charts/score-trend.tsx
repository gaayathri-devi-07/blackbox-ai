"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface TooltipEntry {
  dataKey?: unknown;
  value?: unknown;
  color?: string;
  payload?: unknown;
}

export interface TrendPoint {
  at: string;
  score: number;
  kind: "interview" | "discussion";
}

const SERIES = [
  { key: "interview", label: "Mock interviews", color: "var(--chart-1)" },
  { key: "discussion", label: "Group discussions", color: "var(--chart-4)" },
] as const;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TrendTooltip({ active, payload }: { active?: boolean; payload?: readonly TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { at: string };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 text-muted-foreground">{fmtDate(row.at)}</p>
      {payload
        .filter((p) => typeof p.value === "number")
        .map((p) => (
          <p key={p.dataKey as string} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="text-muted-foreground">{SERIES.find((s) => s.key === p.dataKey)?.label}</span>
            <span className="ml-auto pl-3 font-medium tabular text-foreground">{p.value as number}</span>
          </p>
        ))}
    </div>
  );
}

/** Score history across interviews and discussions, one line per activity type. */
export function ScoreTrend({ points, height = 220 }: { points: TrendPoint[]; height?: number }) {
  const rows = points.map((p, i) => ({ i, at: p.at, [p.kind]: p.score }));
  const present = SERIES.filter((s) => points.some((p) => p.kind === s.key));

  return (
    <figure>
      {present.length > 1 && (
        <figcaption className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {present.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="at"
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={(props) => <TrendTooltip active={props.active} payload={props.payload as readonly TooltipEntry[]} />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
            {present.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: s.color }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Score history</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Activity</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{fmtDate(p.at)}</td>
              <td>{p.kind === "interview" ? "Mock interview" : "Group discussion"}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
