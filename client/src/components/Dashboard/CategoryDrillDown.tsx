/**
 * @file CategoryDrillDown.tsx
 * @description Band 3 Dashboard component for interactive material analysis.
 * 
 * @functionality
 * - Pie Chart: Shows organizational or project emissions by material category (max 8 + "Other").
 * - Drill-Down: Clicking a slice (except "Other") reveals material breakdown table.
 * - "Other" segment: Non-drillable — shows informational tooltip only (Manifesto V3/V6).
 * - Donut centre label: Shows total tCO2e for current scope (Manifesto Phase 4).
 * - Breadcrumb navigation in drill-down state.
 * - Smooth fade transition between views.
 * 
 * @dependencies Recharts, @tanstack/react-query, @/lib/emissions
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Label
} from "recharts";

import {
    Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from "@/components/ui/table";
import { kgToTonnes, getCategoryColor, formatTonnes } from "@/lib/emissions";
import { ChevronLeft, ListFilter, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface CategoryData {
    category: string;
    value: number;
}

interface MaterialDrilldown {
    materialName: string;
    totalEmissions: number;
    unit: string;
    lifecycleStage: string;
    source: string;
}

interface CategoryDrillDownProps {
    projectId?: string;
}

const MAX_SEGMENTS = 8;
const OTHER_LABEL = "Other";

// Removed: DonutCentreLabel standalone component — using Recharts <Label> child instead

export default function CategoryDrillDown({ projectId }: CategoryDrillDownProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { toast } = useToast();

    const { data: categories, isLoading: loadingCats } = useQuery<CategoryData[]>({
        queryKey: ['/api/dashboard/emissions-by-category', projectId],
    });

    const { data: drilldown, isLoading: loadingDrill } = useQuery<MaterialDrilldown[]>({
        queryKey: ['/api/dashboard/category-drilldown', selectedCategory, projectId],
        enabled: !!selectedCategory && selectedCategory !== OTHER_LABEL,
    });

    if (loadingCats) {
        return <Skeleton className="h-[400px] w-full rounded-xl" />;
    }

    // Sort by emissions desc, then split into top-7 + "Other" bucket
    const sorted = (categories?.filter(c => c.value > 0) || [])
        .sort((a, b) => b.value - a.value);

    const top = sorted.slice(0, MAX_SEGMENTS - 1);
    const rest = sorted.slice(MAX_SEGMENTS - 1);
    const otherValue = rest.reduce((sum, c) => sum + c.value, 0);
    const otherCount = rest.length;
    const totalKg = sorted.reduce((sum, c) => sum + c.value, 0);
    const totalTonnes = kgToTonnes(totalKg);

    const chartData = [
        ...top.map(c => ({
            name: c.category,
            category: c.category,
            value: kgToTonnes(c.value),
            isOther: false,
        })),
        ...(otherCount > 0 ? [{
            name: `Other (${otherCount} more)`,
            category: OTHER_LABEL,
            value: kgToTonnes(otherValue),
            isOther: true,
        }] : [])
    ];

    const handleSliceClick = (data: any) => {
        if (!data || !data.category) return;
        if (data.category === OTHER_LABEL || data.isOther) {
            toast({
                title: "Grouped Categories",
                description: `This segment contains ${otherCount} smaller categories. See the full breakdown table below for details.`,
            });
            return;
        }
        setSelectedCategory(data.category);
    };

    const emptyState = (
        <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
            <Info className="h-8 w-8 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No emission data yet</p>
            <p className="text-xs mt-1">Import a BOQ or map materials to see this chart.</p>
        </div>
    );

    return (
        <Card className="h-full flex flex-col min-h-[400px]">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {selectedCategory ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedCategory(null)}
                                className="h-8 w-8 -ml-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        ) : (
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <ListFilter className="h-5 w-5 text-orange-600" />
                            </div>
                        )}
                        <div>
                            <CardTitle className="text-base font-bold">
                                {selectedCategory ? (
                                    <span className="flex items-center gap-1 text-sm">
                                        <span className="text-gray-400 font-normal cursor-pointer hover:text-blue-500" onClick={() => setSelectedCategory(null)}>All Categories</span>
                                        <ChevronLeft className="h-3 w-3 text-gray-400 rotate-180" />
                                        <span>{selectedCategory}</span>
                                    </span>
                                ) : "Emissions by Category"}
                            </CardTitle>
                            <CardDescription className="text-[10px]">
                                {selectedCategory ? "Material level breakdown" : "Click a slice to drill down"}
                            </CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 pt-2 h-full">
                {chartData.length === 0 ? emptyState : (
                    !selectedCategory ? (
                        // State A — Category donut view
                        <div className="h-full" style={{ animation: "fadeIn 0.25s ease-in-out" }}>
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={58}
                                        outerRadius={82}
                                        paddingAngle={3}
                                        dataKey="value"
                                        onClick={handleSliceClick}
                                        className="cursor-pointer"
                                    >
                                        <Label
                                            content={({ viewBox }: any) => {
                                                if (!viewBox) return null;
                                                const { cx, cy } = viewBox;
                                                const formatted = totalTonnes >= 1000
                                                    ? `${(totalTonnes / 1000).toFixed(1)}k`
                                                    : totalTonnes.toFixed(1);
                                                return (
                                                    <g>
                                                        <text x={cx} y={cy - 5} textAnchor="middle" fill="#111827" style={{ fontSize: 13, fontWeight: 700 }}>
                                                            {formatted}t
                                                        </text>
                                                        <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" style={{ fontSize: 9 }}>
                                                            tCO₂e
                                                        </text>
                                                    </g>
                                                );
                                            }}
                                        />
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={getCategoryColor(entry.category)}
                                                className="stroke-background hover:opacity-80 transition-opacity"
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const entry = payload[0];
                                                return (
                                                    <div className="bg-white p-2 border rounded shadow text-xs">
                                                        <p className="font-bold">{entry.name}</p>
                                                        <p>{formatTonnes(entry.value as number)}</p>
                                                        {(entry.payload as any)?.isOther && (
                                                            <p className="text-gray-400 mt-1 italic">Click for info</p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 border-t pt-3">
                                {chartData.map((c) => (
                                    <div
                                        key={c.name}
                                        className={`flex items-center justify-between text-[11px] group ${c.isOther ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
                                        onClick={() => !c.isOther && setSelectedCategory(c.category)}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <div
                                                className="w-3 h-3 rounded-full mt-1 shrink-0"
                                                style={{ backgroundColor: getCategoryColor(c.category) }}
                                            />
                                            <span className={`truncate uppercase tracking-tight ${c.isOther ? 'text-gray-400 italic' : 'text-gray-500 group-hover:text-blue-600 transition-colors'}`}>
                                                {c.name}
                                            </span>
                                        </div>
                                        <span className="font-bold text-gray-900 ml-2">{Math.round(c.value)}t</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // State B — Material drill-down view
                        <div className="overflow-auto max-h-[340px]" style={{ animation: "fadeIn 0.25s ease-in-out" }}>
                            {loadingDrill ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ) : !drilldown || drilldown.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <p className="text-sm">No materials in this category.</p>
                                </div>
                            ) : (
                                <div className="text-[11px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b text-gray-400 font-medium">
                                                <th className="pb-2 font-normal">Material</th>
                                                <th className="pb-2 font-normal text-right">Emissions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {drilldown?.map((m, i) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-gray-50 group">
                                                    <td className="py-2 pr-2">
                                                        <p className="font-medium text-gray-900 line-clamp-1">{m.materialName}</p>
                                                        <p className="text-[9px] text-gray-400 capitalize">{m.lifecycleStage} • {m.source}</p>
                                                    </td>
                                                    <td className="py-2 text-right align-top">
                                                        <span className="font-mono text-gray-600 font-medium">{formatTonnes(kgToTonnes(m.totalEmissions))}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )
                )}
            </CardContent>
        </Card>
    );
}
