/**
 * @file EmissionsByMaterial.tsx
 * @description Dashboard widget showing emissions breakdown by material category.
 * 
 * @functionality
 * - Data Visualization: Renders a Pie Chart using Recharts.
 * - Aggregation: Client-side calculation of emissions per category (demonstration implementation).
 * 
 * @dependencies
 * - Recharts: For Pie Chart rendering.
 * - React Query: Fetches materials and projects data.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LabelList } from "recharts";
import { kgToTonnes, CATEGORY_COLORS as COLORS } from "@/lib/emissions";

// COLORS removed, now importing from @/lib/emissions

interface EmissionFactor {
  category: string;
  emissionFactor: number;
}

export default function EmissionsByMaterial() {
  const { data: categoryData = [], isLoading } = useQuery<{ category: string, value: number }[]>({
    queryKey: ['/api/dashboard/emissions-by-category'],
  });

  const totalValue = categoryData.reduce((acc, curr) => acc + curr.value, 0);

  const data = categoryData.map(item => ({
    name: item.category,
    value: kgToTonnes(item.value),
    percentage: totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0
  })).sort((a, b) => b.value - a.value);

  // Decision V3: Group items beyond 8 into "Other"
  const processedData = data.length > 8
    ? [
      ...data.slice(0, 8),
      {
        name: "Other",
        value: data.slice(8).reduce((acc, curr) => acc + curr.value, 0),
        percentage: data.slice(8).reduce((acc, curr) => acc + curr.percentage, 0)
      }
    ]
    : data;

  // Custom label rendering function to avoid overlaps
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage, name }: any) => {
    if (percentage < 5) return null; // Don't show labels for very small slices

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="500"
      >
        {`${percentage}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Emissions by Material</CardTitle>
          <Select defaultValue="30days">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="1year">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {data.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={processedData}
                      cx="50%"
                      cy="45%"
                      outerRadius={85}
                      innerRadius={25}
                      fill="#8884d8"
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {processedData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name as keyof typeof COLORS] || '#6B7280'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(2)} tCO₂e`, 'Emissions']}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Custom Legend */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4 text-sm">
                {processedData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[entry.name as keyof typeof COLORS] || '#6B7280' }}
                    />
                    <span className="text-gray-700 truncate">
                      {entry.name}: {entry.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p>No emission data available</p>
                <p className="text-sm">Add projects and materials to see this chart</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
