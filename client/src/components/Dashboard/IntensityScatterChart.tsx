/**
 * @file IntensityScatterChart.tsx
 * @description Band 2 Dashboard component for intensity benchmarking.
 * 
 * @functionality
 * - Scatter Plot: X-axis = Building Area (m²), Y-axis = Intensity (kgCO2e/m²).
 * - Visualizes project efficiency relative to size.
 * - Legend/Tooltip: Reveals project names on hover.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid } from "recharts";
import { kgToTonnes, BRAND_COLORS } from "@/lib/emissions";
import { AlertTriangle, ArrowRight, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioProject {
    id: string;
    name: string;
    totalEmissions: number;
    dataQualityPercent: number;
    buildingArea: number | null;
    intensity: number | null;
}

export default function IntensityScatterChart() {
    const { data: portfolio, isLoading } = useQuery<PortfolioProject[]>({
        queryKey: ['/api/dashboard/portfolio'],
    });

    if (isLoading) {
        return (
            <Card className="h-[400px]">
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4 mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[250px] w-full" />
                </CardContent>
            </Card>
        );
    }

    const chartData = portfolio?.filter(p => !!p.buildingArea && !!p.intensity).map(p => ({
        name: p.name,
        area: p.buildingArea,
        intensity: p.intensity,
        emissions: kgToTonnes(p.totalEmissions)
    })) || [];

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">Intensity Benchmarking</CardTitle>
                <CardDescription>Intensity (kgCO2e/m²) vs Area (m²)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pt-0 relative">
                {chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 pb-8 px-4 text-center">
                        <div className="p-3 bg-gray-50 rounded-full">
                            <Building2 className="h-8 w-8 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium">No Intensity Data</p>
                        <p className="text-[10px] leading-relaxed max-w-[200px]">
                            Define <strong>Building Area (m²)</strong> in Project Settings to enable benchmarking.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                            margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                type="number"
                                dataKey="area"
                                name="Area"
                                unit="m²"
                                fontSize={11}
                                label={{ value: 'Area (m²)', position: 'bottom', offset: 0, fontSize: 10 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="intensity"
                                name="Intensity"
                                unit="kg/m²"
                                fontSize={11}
                                label={{ value: 'Intensity', angle: -90, position: 'insideLeft', fontSize: 10 }}
                            />
                            <ZAxis type="number" dataKey="emissions" range={[60, 400]} name="Total Emissions" unit="t" />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 border rounded shadow-lg text-xs">
                                                <p className="font-bold mb-1 border-b pb-1">{data.name}</p>
                                                <p className="flex justify-between gap-4">
                                                    <span className="text-gray-500">Area:</span>
                                                    <span className="font-mono">{data.area} m²</span>
                                                </p>
                                                <p className="flex justify-between gap-4 mt-1">
                                                    <span className="text-gray-500">Intensity:</span>
                                                    <span className="font-mono text-blue-600 font-bold">
                                                        {Math.round(data.intensity)} kg/m²
                                                    </span>
                                                </p>
                                                <p className="flex justify-between gap-4 mt-1 italic text-[10px] text-gray-400">
                                                    <span>Total Emissions:</span>
                                                    <span>{Math.round(data.emissions)} tCO2e</span>
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Scatter
                                name="Projects"
                                data={chartData}
                                fill={BRAND_COLORS.CHART_PRIMARY}
                                fillOpacity={0.6}
                                stroke={BRAND_COLORS.CHART_PRIMARY}
                                strokeWidth={1}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
