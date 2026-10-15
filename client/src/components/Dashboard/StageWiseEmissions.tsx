/**
 * @file StageWiseEmissions.tsx
 * @description Band 3 Dashboard Widget — EN 15804 Lifecycle Stage Emissions Chart.
 *
 * @functionality
 * - Fetches project-level emissions data.
 * - Supports Absolute (tCO2e) and Relative (%) toggles.
 * - Supports project-level filtering.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layers3, AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { kgToTonnes, LIFECYCLE_COLORS as STAGE_COLORS, LIFECYCLE_LABELS as STAGE_LABELS } from "@/lib/emissions";

type StageBreakdown = {
    name: string; // Project Name
    breakdown: Record<string, number>;
};

interface StageWiseEmissionsProps {
    projectId?: string;
}

export default function StageWiseEmissions({ projectId }: StageWiseEmissionsProps) {
    const [viewMode, setViewMode] = useState<"absolute" | "relative">("absolute");

    const { data: results, isLoading, isError } = useQuery<StageBreakdown[]>({
        queryKey: ["/api/dashboard/emissions-by-stage", projectId],
        staleTime: 60_000,
    });

    // ── Aggregate Data for Chart ──────────────────────────────────────────
    const getChartData = () => {
        if (!results) return [];

        const totals: Record<string, number> = {
            "A1-A3": 0, "A4-A5": 0, "B": 0, "C1-C4": 0, "D": 0
        };

        results.forEach((res: StageBreakdown) => {
            Object.entries(res.breakdown).forEach(([stage, value]) => {
                const numericValue = value as number;
                if (totals.hasOwnProperty(stage)) {
                    totals[stage] += numericValue;
                }
            });
        });

        const grandTotal = Object.values(totals).reduce((sum: number, v: number) => sum + v, 0);

        return Object.entries(totals)
            .map(([stage, value]) => ({
                stage,
                label: STAGE_LABELS[stage] || stage,
                raw: value,
                value: viewMode === "absolute" ? kgToTonnes(value) : (grandTotal > 0 ? (value / grandTotal) * 100 : 0),
                color: STAGE_COLORS[stage] || "#6b7280",
            }))
            .sort((a, b) => {
                const order = ["A1-A3", "A4-A5", "B", "C1-C4", "D"];
                return order.indexOf(a.stage) - order.indexOf(b.stage);
            });
    };

    const chartData = getChartData();
    const hasData = chartData.some(d => d.raw > 0);

    return (
        <Card className="h-full flex flex-col min-h-[400px]">
            <CardHeader className="pb-2 space-y-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Layers3 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold">Lifecycle Breakdown</CardTitle>
                            <CardDescription className="text-[10px]">EN 15804 Standards</CardDescription>
                        </div>
                    </div>
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[140px]">
                        <TabsList className="grid w-full grid-cols-2 h-7 bg-gray-100">
                            <TabsTrigger value="absolute" className="text-[10px]">Abs</TabsTrigger>
                            <TabsTrigger value="relative" className="text-[10px]">Rel</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 pt-2 h-full">
                {isLoading ? (
                    <div className="h-48 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                ) : isError ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
                        <AlertCircle className="h-8 w-8" />
                        <p className="text-sm">Error loading data</p>
                    </div>
                ) : !hasData ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
                        <Layers3 className="h-8 w-8" />
                        <p className="text-sm text-center">No lifecycle data mapped yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="flex-1 min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <XAxis
                                        type="number"
                                        fontSize={10}
                                        tickFormatter={(v) => viewMode === 'absolute' ? `${Math.round(v)}t` : `${Math.round(v)}%`}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="stage"
                                        fontSize={10}
                                        width={40}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-2 border rounded shadow text-[11px]">
                                                        <p className="font-bold">{d.label}</p>
                                                        <p>{viewMode === 'absolute' ? `${d.value.toFixed(2)} tCO2e` : `${d.value.toFixed(1)}%`}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                                        {chartData.map((entry) => (
                                            <Cell key={entry.stage} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t mt-auto">
                            {chartData.map((s) => (
                                <div key={s.stage} className="flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                        <span className="text-gray-500 truncate uppercase tracking-tight">{s.stage}</span>
                                    </div>
                                    <span className="font-bold text-gray-900 ml-2">{viewMode === 'absolute' ? `${s.value.toFixed(1)}t` : `${s.value.toFixed(1)}%`}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
