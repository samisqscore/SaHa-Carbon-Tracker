import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface PhaseEmission {
    phaseName: string;
    tm: number; // Transport Emissions
    me: number; // Material Emissions (Production)
    total: number;
}

interface MaterialEmission {
    category: string;
    value: number;
}

interface ScopeSummary {
    scope1: number;
    scope2: number;
    scope3: number;
}

interface ReportChartsProps {
    phaseData: PhaseEmission[];
    materialData: MaterialEmission[];
    topMaterials?: { name: string; value: number }[];
    scopeSummary?: ScopeSummary;
}

export function ReportCharts({ phaseData, materialData, topMaterials = [], scopeSummary }: ReportChartsProps) {
    const scopeChartData = scopeSummary ? [
        { name: 'Scope 1 (Direct)', value: scopeSummary.scope1, color: '#ef4444' }, // Red
        { name: 'Scope 2 (Energy)', value: scopeSummary.scope2, color: '#eab308' }, // Yellow
        { name: 'Scope 3 (Value Chain)', value: scopeSummary.scope3, color: '#3b82f6' } // Blue
    ].filter(d => d.value > 0) : [];

    return (
        <div className="space-y-8">
            {/* Scope Breakdown (Featured if available) */}
            {scopeChartData.length > 0 && (
                <Card className="border-l-4 border-l-purple-500">
                    <CardHeader>
                        <CardTitle>Emissions by GHG Scope</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px] flex items-center justify-around">
                        <div className="w-1/2 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={scopeChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {scopeChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-4">
                            {scopeChartData.map(s => (
                                <div key={s.name} className="flex items-center justify-between p-2 rounded bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                                        <span className="font-medium text-sm">{s.name}</span>
                                    </div>
                                    <span className="font-bold">{(s.value).toFixed(1)} <span className="text-xs text-gray-500 font-normal">kgCO2e</span></span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Emissions by Phase (Stacked) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Emissions by Phase (kgCO2e)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={phaseData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="phaseName" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Legend />
                                <Bar dataKey="me" name="Material Production" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="tm" name="Transportation" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Emissions by Category (Donut) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Material Category Impact</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={materialData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {materialData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Top 5 Contributors (Horizontal Bar) */}
            <Card>
                <CardHeader>
                    <CardTitle>Top 5 High Impact Materials</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={topMaterials}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]}>
                                {topMaterials.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? "#ef4444" : "#f97316"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
