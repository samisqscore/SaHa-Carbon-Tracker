/**
 * @file UnmappedMaterialsTable.tsx
 * @description Band 4 Dashboard component highlighting data quality gaps.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { getQualityColor } from "@/lib/emissions";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";

interface UnmappedSummary {
    projectId: string;
    projectName: string;
    totalMaterials: number;
    unmappedMaterials: number;
    qualityPercent: number;
}

export default function UnmappedMaterialsTable() {
    const { data: summary, isLoading } = useQuery<UnmappedSummary[]>({
        queryKey: ['/api/dashboard/unmapped-summary'],
    });

    if (isLoading) {
        return <Skeleton className="h-[300px] w-full rounded-xl" />;
    }

    const hasGaps = summary && summary.length > 0;

    const stats = summary?.reduce((acc, item) => ({
        total: acc.total + item.totalMaterials,
        unmapped: acc.unmapped + item.unmappedMaterials,
        mapped: acc.mapped + (item.totalMaterials - item.unmappedMaterials)
    }), { total: 0, unmapped: 0, mapped: 0 }) || { total: 0, unmapped: 0, mapped: 0 };

    const chartData = [
        { name: 'Mapped', value: stats.mapped, color: '#10b981' },
        { name: 'Unmapped', value: stats.unmapped, color: '#ef4444' }
    ];

    return (
        <Card className="h-full flex flex-col min-h-[400px]">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-amber-100 p-2 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold">Data Quality Gaps</CardTitle>
                            <CardDescription className="text-[10px]">Material mapping status summary</CardDescription>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 font-medium">Total Items</p>
                        <p className="text-sm font-bold">{stats.total}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-2 min-h-0">
                <div className="mb-4 shrink-0">
                    {/* Stacked progress bar — no chart library needed */}
                    <div className="relative h-6 w-full rounded-full overflow-hidden bg-gray-100 shadow-inner">
                        {stats.total > 0 ? (
                            <>
                                {/* Mapped segment */}
                                <div
                                    className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-500 ease-out flex items-center justify-end"
                                    style={{ width: `${(stats.mapped / stats.total) * 100}%` }}
                                >
                                    {stats.mapped > 0 && (
                                        <span className="text-[10px] font-bold text-white pr-2 drop-shadow">
                                            {stats.mapped}
                                        </span>
                                    )}
                                </div>
                                {/* Unmapped segment */}
                                {stats.unmapped > 0 && (
                                    <div
                                        className="absolute top-0 h-full bg-red-400 transition-all duration-500 ease-out flex items-center justify-start"
                                        style={{
                                            left: `${(stats.mapped / stats.total) * 100}%`,
                                            width: `${(stats.unmapped / stats.total) * 100}%`
                                        }}
                                    >
                                        <span className="text-[10px] font-bold text-white pl-2 drop-shadow">
                                            {stats.unmapped}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-full w-full bg-gray-200 rounded-full" />
                        )}
                    </div>
                    {/* Labels row */}
                    <div className="flex items-center justify-between mt-1.5 px-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 flex-shrink-0" />
                            <span className="text-[10px] text-gray-500 font-medium">{stats.mapped} Mapped</span>
                        </div>
                        {stats.unmapped > 0 ? (
                            <div className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400 flex-shrink-0" />
                                <span className="text-[10px] text-gray-500 font-medium">{stats.unmapped} Unmapped</span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold">
                                100% Complete ✓
                            </span>
                        )}
                    </div>
                </div>


                <div className="flex-1 overflow-auto border-t">
                    {(summary ?? []).filter(i => i.unmappedMaterials > 0).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400">
                            <div className="bg-green-50 p-4 rounded-full mb-3">
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Perfect Score</Badge>
                            </div>
                            <p className="text-sm font-medium">All materials are correctly mapped!</p>
                            <p className="text-[10px] mt-1 text-gray-400 font-mono italic">Validated across {stats.total} items</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-b">
                                    <TableHead className="text-[11px] font-medium h-8">Project</TableHead>
                                    <TableHead className="text-[11px] font-medium h-8 text-center text-red-600">Missing</TableHead>
                                    <TableHead className="text-[11px] font-medium h-8 text-right">Quality</TableHead>
                                    <TableHead className="text-[11px] font-medium h-8 w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(summary ?? []).filter(i => i.unmappedMaterials > 0).map((item) => (
                                    <TableRow key={item.projectId} className="hover:bg-gray-50 border-b last:border-0 group">
                                        <TableCell className="py-2.5">
                                            <span className="font-medium text-gray-900 text-[11px] truncate max-w-[120px] block">
                                                {item.projectName}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2.5 text-center">
                                            <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-red-100 italic">
                                                {item.unmappedMaterials}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right font-mono text-[11px]">
                                            <span style={{ color: getQualityColor(item.qualityPercent) }} className="font-bold">
                                                {item.qualityPercent}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right px-0">
                                            <Link href={`/project/${item.projectId}/materials`}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
