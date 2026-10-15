/**
 * @file PortfolioBarChart.tsx
 * @description Band 2 Dashboard component displaying project-level emissions comparisons.
 * 
 * @functionality
 * - Horizontal Bar Chart: Projects sorted by total emissions.
 * - Quality Mapping: Bar colors reflect the data quality (mapped vs unmapped percentage).
 * - Interactive: Tooltips showing absolute tCO2e and quality metrics.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";
import { kgToTonnes, formatTonnes, getQualityColor } from "@/lib/emissions";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioProject {
    id: string;
    name: string;
    totalEmissions: number;
    dataQualityPercent: number;
}

export default function PortfolioBarChart() {
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

    const chartData = portfolio?.map(p => ({
        name: p.name,
        emissions: kgToTonnes(p.totalEmissions),
        quality: p.dataQualityPercent,
        originalEmissions: p.totalEmissions
    })) || [];

    return (
        <Card className="h-[400px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">Project Portfolio</CardTitle>
                <CardDescription>Emissions by project (tCO2e) | Colored by Data Quality</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pt-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        barSize={24}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                        <XAxis
                            type="number"
                            fontSize={11}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `${val}t`}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            fontSize={11}
                            width={100}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white p-3 border rounded shadow-lg text-xs">
                                            <p className="font-bold mb-1 border-b pb-1">{data.name}</p>
                                            <p className="flex justify-between gap-4">
                                                <span className="text-gray-500">Emissions:</span>
                                                <span className="font-mono">{formatTonnes(data.emissions)}</span>
                                            </p>
                                            <p className="flex justify-between gap-4 mt-1">
                                                <span className="text-gray-500">Data Quality:</span>
                                                <span className="font-mono" style={{ color: getQualityColor(data.quality) }}>
                                                    {data.quality}%
                                                </span>
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="emissions" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getQualityColor(entry.quality)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
