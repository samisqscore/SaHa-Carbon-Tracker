/**
 * @file ProjectEmissionsTab.tsx
 * @description Dashboard tab for viewing project emission analytics.
 * 
 * @functionality
 * - Overview: Total emissions, carbon efficiency (avg per material), and breakdown cards.
 * - Charts: Pie chart (by category) and Bar chart (by phase).
 * - Table: Detailed material-level emissions ranked by impact.
 * - Recommendations: Dynamic advice based on emission data (currently static heuristics).
 * 
 * @dependencies
 * - Recharts: For data visualization.
 * - API: Fetches aggregated emission stats via `/api/projects/:id/emissions`.
 */

import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, PieChart, Leaf, AlertTriangle, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from "recharts";

interface ProjectEmissionsTabProps {
  projectId: string;
}

interface EmissionData {
  totalEmissions: number;
  breakdownByCategory: Record<string, number>;
  breakdownByPhase: Record<string, number>;
  breakdownByScope: Record<string, number>;
  materials: Array<{
    materialName: string;
    quantity: number;
    emissionFactor: number;
    totalEmissions: number;
    category: string;
    phase?: string;
  }>;
}

export default function ProjectEmissionsTab({ projectId }: ProjectEmissionsTabProps) {
  const { data: emissionsData = {
    totalEmissions: 0,
    breakdownByCategory: {},
    breakdownByPhase: {},
    breakdownByScope: {},
    materials: []
  } as EmissionData, isLoading } = useQuery<EmissionData>({
    queryKey: ["/api/projects", projectId, "emissions"],
    enabled: !!projectId,
  });

  const { data: lifecycleRaw, isLoading: lifecycleLoading } = useQuery<any>({
    queryKey: ["/api/projects", projectId, "emissions", "by-lifecycle"],
    enabled: !!projectId,
  });

  const lifecycleData = lifecycleRaw?.stages || [];
  const lifecycleGrandTotal = lifecycleRaw?.grandTotal || 0;

  // Prepare chart data for categories
  const categoryChartData = Object.entries(emissionsData.breakdownByCategory || {}).map(([category, emissions]) => ({
    name: category,
    value: emissions,
    percentage: ((emissions / (emissionsData.totalEmissions || 1)) * 100).toFixed(1),
  }));

  const STAGE_COLORS: Record<string, string> = {
    "A1-A3": "#2563eb",
    "A4-A5": "#0891b2",
    "B": "#16a34a",
    "C1-C4": "#d97706",
    "D": "#7c3aed",
  };

  // Prepare chart data for lifecycle stages
  const lifecycleChartData = lifecycleData.map((item: any) => ({
    name: item.stage,
    emissions: item.totalEmissions,
    percentage: lifecycleGrandTotal > 0 ? ((item.totalEmissions / lifecycleGrandTotal) * 100).toFixed(1) : "0",
    color: STAGE_COLORS[item.stage] || "#8884d8"
  })).sort((a: any, b: any) => {
    const order = ["A1-A3", "A4-A5", "B", "C1-C4", "D"];
    return order.indexOf(a.name) - order.indexOf(b.name);
  });

  // Prepare materials table data
  const materialsTableData = (emissionsData.materials || []).map(material => ({
    ...material,
    emissionPercentage: ((material.totalEmissions / (emissionsData.totalEmissions || 1)) * 100).toFixed(1),
  }));

  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7300'];

  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} t CO\u2082e`;
    }
    return `${value.toFixed(2)} kg CO\u2082e`;
  };

  // Consistent tCO₂e formatter for chart axes (always in tonnes for large numbers)
  const formatYAxisTick = (value: number) => {
    if (value === 0) return "0";
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}t`;
    }
    return `${value.toFixed(0)}`;
  };

  // Compact scope formatter — always t CO₂e for consistency (prevents mixed kg/t display)
  const formatScopeValue = (value: number) => {
    if (value === 0) return "0.00 t";
    if (value >= 1000) return `${(value / 1000).toFixed(2)} t`;
    return `${value.toFixed(2)} kg`;
  };

  // Custom pie label renderer — only show for slices > 5% to avoid clutter
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage, name }: any) => {
    const pct = parseFloat(percentage);
    if (pct < 4) return null; // skip tiny slices
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 28;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#374151" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11}>
        {`${pct.toFixed(0)}%`}
      </text>
    );
  };

  const getEmissionLevelBadge = (emissions: number) => {
    if (emissions < 1000) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Low Impact</Badge>;
    } else if (emissions < 5000) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium Impact</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">High Impact</Badge>;
    }
  };

  // Info banner: lifecycle stages always shown, phases optional
  const showPhaseInfoBanner = !isLoading && (emissionsData?.materials?.length || 0) > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Emissions Analysis</h2>
          <p className="text-muted-foreground">
            Comprehensive carbon footprint analysis for your construction project
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Phase 1 Info Banner */}
      {showPhaseInfoBanner && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800">
          <Info className="h-4 w-4 shrink-0" />
          <p>Phase-level breakdown available once phases are created. Lifecycle stage data is always shown.</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatEmissions(emissionsData.totalEmissions || 0)}
            </div>
            <div className="mt-2">
              {getEmissionLevelBadge(emissionsData.totalEmissions || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Material Categories</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(emissionsData.breakdownByCategory || {}).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Different material types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carbon Efficiency</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(emissionsData.materials || []).length > 0
                ? ((emissionsData.totalEmissions || 0) / (emissionsData.materials || []).length).toFixed(1)
                : "0"
              } kg CO₂e
            </div>
            <p className="text-xs text-muted-foreground">
              Average per material
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scope Breakdown</CardTitle>
            <div className="h-4 w-4 text-muted-foreground font-bold text-xs">S1-3</div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="space-y-2">
              {([
                { label: 'Scope 1', key: 'scope1', color: 'text-red-600' },
                { label: 'Scope 2', key: 'scope2', color: 'text-orange-500' },
                { label: 'Scope 3', key: 'scope3', color: 'text-blue-600' },
              ] as const).map(({ label, key, color }) => {
                const val = emissionsData.breakdownByScope?.[key] || 0;
                return (
                  <div key={key} className="flex items-baseline justify-between gap-2">
                    <span className={`text-xs font-medium shrink-0 ${color}`}>{label}</span>
                    <div className="flex-1 border-b border-dotted border-muted-foreground/30 mb-0.5" />
                    <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
                      {formatScopeValue(val)}
                      <span className="text-muted-foreground font-normal"> CO₂e</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {Object.keys(emissionsData.breakdownByCategory || {}).length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Category Breakdown Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Emissions by Category
              </CardTitle>
              <CardDescription>
                Distribution of carbon emissions across material categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <RechartsPieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="45%"
                    outerRadius={95}
                    innerRadius={40}
                    dataKey="value"
                    labelLine
                    label={renderPieLabel}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${formatEmissions(value)} (${props.payload.percentage}%)`, ""
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 11, color: '#374151' }}>{value}</span>}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Lifecycle Stage Breakdown Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Emissions by Lifecycle Stage
              </CardTitle>
              <CardDescription>
                Carbon emissions distribution (EN 15804 Stages)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lifecycleLoading ? (
                <div className="flex justify-center items-center h-[300px]">
                  <Skeleton className="h-[250px] w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={lifecycleChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={formatYAxisTick}
                      label={{ value: 't CO\u2082e', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#6b7280' } }}
                      tick={{ fontSize: 11 }}
                      width={55}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatEmissions(value), "Emissions"]}
                      labelFormatter={(label) => `Stage: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="emissions" name="CO\u2082e Emissions" radius={[4, 4, 0, 0]}>
                      {lifecycleChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Emissions Data Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add materials to your project to start tracking carbon emissions and environmental impact.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Materials Table */}
      {(emissionsData.materials || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              Material-Level Emissions
            </CardTitle>
            <CardDescription>
              Detailed breakdown of emissions by individual materials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Emission Factor</TableHead>
                  <TableHead className="text-right">Total Emissions</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialsTableData
                  .sort((a, b) => b.totalEmissions - a.totalEmissions)
                  .map((material, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {material.materialName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {material.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.phase ? (
                          <Badge variant="secondary">
                            {material.phase}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No phase</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {material.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {material.emissionFactor.toFixed(2)} kg CO₂e/unit
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatEmissions(material.totalEmissions)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={parseFloat(material.emissionPercentage)}
                            className="w-12 h-2"
                          />
                          <span className="text-sm font-medium">
                            {material.emissionPercentage}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {(emissionsData.totalEmissions || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Emission Reduction Recommendations
            </CardTitle>
            <CardDescription>
              Suggestions to reduce the carbon footprint of your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <Leaf className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Consider Low-Carbon Alternatives</h4>
                <p className="text-sm text-green-700 mt-1">
                  Look for materials with lower emission factors in the same categories.
                  Recycled content and locally sourced materials can significantly reduce emissions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Optimize Material Quantities</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Review material specifications and reduce waste factors where possible.
                  Precise planning can reduce both emissions and costs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-900">Phase-Based Optimization</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Focus emission reduction efforts on phases with the highest carbon footprint.
                  Strategic substitutions in high-impact phases yield the best results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}