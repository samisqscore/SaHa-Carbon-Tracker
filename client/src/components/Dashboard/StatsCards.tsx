/**
 * @file StatsCards.tsx
 * @description Dashboard widget displaying high-level Key Performance Indicators (KPIs).
 * 
 * @functionality
 * - KPIs: Total Projects, Total Emissions, Active Projects, Average Emissions.
 * - Visuals: Color-coded icons and trend indicators (trends are hardcoded mocks).
 * 
 * @dependencies
 * - API: Fetches /api/dashboard/stats for real-time counters.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Building, TrendingUp, Play, BarChart3 } from "lucide-react";
import { kgToTonnes, formatTonnes } from "@/lib/emissions";

interface DashboardStats {
  totalProjects: number;
  totalEmissions: number;
  activeProjects: number;
  avgIntensity: number;
  dataQualityPercent: number;
}

import { ShieldCheck } from "lucide-react";
import { getQualityColor } from "@/lib/emissions";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const cards = [
    {
      title: "Total Projects",
      value: stats?.totalProjects || 0,
      change: "+12%",
      trend: "up",
      icon: Building,
      color: "blue",
    },
    {
      title: "Total Emissions",
      value: formatTonnes(kgToTonnes(stats?.totalEmissions || 0)),
      change: "+8%",
      trend: "up",
      icon: TrendingUp,
      color: "red",
    },
    {
      title: "Avg. Intensity",
      value: `${Math.round(stats?.avgIntensity || 0)} kg/m²`,
      change: "-15%",
      trend: "down",
      icon: BarChart3,
      color: "orange",
    },
    {
      title: "Data Quality",
      value: `${stats?.dataQualityPercent || 0}%`,
      change: "+5%",
      trend: "up",
      icon: ShieldCheck,
      color: "custom-quality",
      customColor: getQualityColor(stats?.dataQualityPercent || 0)
    },
  ];

  const getIconColor = (card: typeof cards[0]) => {
    if (card.color === "custom-quality") {
      return `text-white`; // We'll handle custom background below
    }
    const colors: { [key: string]: string } = {
      blue: "text-blue-600 bg-blue-100",
      red: "text-red-600 bg-red-100",
      green: "text-green-600 bg-green-100",
      orange: "text-orange-600 bg-orange-100",
    };
    return colors[card.color] || "text-gray-600 bg-gray-100";
  };

  const getTrendColor = (trend: string) => {
    return trend === "up" ? "text-emerald-600" : "text-amber-600";
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-20 sm:w-24 mb-2"></div>
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16 mb-2"></div>
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-16 sm:w-20"></div>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow touch-manipulation">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-gray-600 text-xs sm:text-sm font-medium truncate">{card.title}</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 sm:mt-2 truncate">{card.value}</p>
                <p className={`text-xs sm:text-sm mt-1 ${getTrendColor(card.trend)} truncate`}>
                  <span>{card.change}</span> from last month
                </p>
              </div>
              <div
                className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ml-3 ${card.color === 'custom-quality' ? '' : getIconColor(card)}`}
                style={card.color === 'custom-quality' ? { backgroundColor: card.customColor } : {}}
              >
                <card.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.color === 'custom-quality' ? 'text-white' : ''}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
