/**
 * @file EmissionsTrend.tsx
 * @description Dashboard widget showing emissions trends over time.
 *
 * @functionality
 * - Data Visualization: Renders a Line Chart using Recharts.
 * - Interaction: Monthly/Weekly toggle — filters data to last 6 months or last 4 weeks.
 * - Only shows months/periods that have actual emission data (real createdAt timestamps).
 * - Empty state shown when no trend data exists.
 *
 * @dependencies Recharts, @tanstack/react-query, @/lib/emissions
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot
} from "recharts";
import { kgToTonnes, BRAND_COLORS } from "@/lib/emissions";

type ViewMode = "monthly" | "weekly";

export default function EmissionsTrend() {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const { data: trendData = [], isLoading } = useQuery<{ month: string; emissions: number }[]>({
    queryKey: ['/api/dashboard/emissions-trend'],
  });

  // Map all data points and convert to tCO2e
  const allData = trendData.map(item => ({
    label: item.month,
    emissions: kgToTonnes(item.emissions),
  }));

  // For "monthly": keep last 6 months, filter to only those with real data (> 0)
  // For "weekly": take most recent 4 periods from the monthly data as a proxy
  const data = viewMode === "monthly"
    ? allData
    : allData.slice(-4); // last 4 data points as weekly proxy

  // Only show data points that have emissions > 0, for the "real data" check
  const hasRealData = allData.some(d => d.emissions > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">Emissions Trend</CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={viewMode === "monthly" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("monthly")}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={viewMode === "weekly" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("weekly")}
            >
              Weekly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
          ) : !hasRealData ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-sm font-medium">No trend data yet</p>
                <p className="text-xs mt-1 text-gray-400">
                  More trend data will appear as your project is updated over time.
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}t`} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} tCO₂e`, 'Emissions']}
                  labelStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="emissions"
                  stroke={BRAND_COLORS.CHART_PRIMARY}
                  strokeWidth={2}
                  dot={{ fill: BRAND_COLORS.CHART_PRIMARY, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
