/**
 * @file Dashboard.tsx
 * @description Main Dashboard Page - Restructured for Phase 3 (4-Band Layout).
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useError } from "@/hooks/use-error";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import StatsCards from "@/components/Dashboard/StatsCards";
import EmissionsTrend from "@/components/Dashboard/EmissionsTrend";
import PortfolioBarChart from "@/components/Dashboard/PortfolioBarChart";
import IntensityScatterChart from "@/components/Dashboard/IntensityScatterChart";
import CategoryDrillDown from "@/components/Dashboard/CategoryDrillDown";
import StageWiseEmissions from "@/components/Dashboard/StageWiseEmissions";
import UnmappedMaterialsTable from "@/components/Dashboard/UnmappedMaterialsTable";
import QuickActions from "@/components/Dashboard/QuickActions";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, Filter } from "lucide-react";

export default function Dashboard() {
  const { showError } = useError();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showError({
        title: "Unauthorized",
        message: "You are logged out. Redirecting to login...",
        details: "Session expired or invalid."
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, showError]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 overflow-y-auto">
        <Header
          title="Organization Overview"
          subtitle="Real-time carbon footprint analytics and material data quality tracking"
        />

        <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">

          {/* Band 1: KPI Stat Cards */}
          <section>
            <StatsCards />
          </section>

          {/* Band 1.5: Emissions Trend & Portfolio Heading */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <EmissionsTrend />
            </div>
            <div className="flex flex-col justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Data Quality Objective</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Maintain a 95%+ data quality score by ensuring all materials are mapped to relevant emission factors.
              </p>
              <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[85%]"></div>
              </div>
              <p className="text-[10px] text-right mt-1 text-gray-400">Current Average: 85%</p>
            </div>
          </div>

          {/* Band 2: Portfolio & Intensity */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <PortfolioBarChart />
            </div>
            <div className="lg:col-span-2">
              <IntensityScatterChart />
            </div>
          </section>

          {/* Band 3: Material & Stage Breakdown (Project Specific Filter) */}
          <section className="space-y-6 pt-6 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Project Deep-Dive</h2>
                  <p className="text-xs text-gray-500">Analyze specific project distributions</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                <div className="pl-2">
                  <Filter className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger className="w-full sm:w-[280px] border-0 focus:ring-0 h-9">
                    <SelectValue placeholder="All Projects (Aggregate)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-bold">Organizational Aggregate</SelectItem>
                    {projects?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CategoryDrillDown projectId={selectedProjectId === 'all' ? undefined : selectedProjectId} />
              <StageWiseEmissions projectId={selectedProjectId === 'all' ? undefined : selectedProjectId} />
            </div>
          </section>

          {/* Band 4: Data Quality & Actions */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 pt-8 border-t">
            <div className="lg:col-span-3">
              <UnmappedMaterialsTable />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <QuickActions />
              <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
                <div className="relative z-10">
                  <h4 className="font-bold mb-1">Need specialized help?</h4>
                  <p className="text-xs text-blue-100 mb-4">Our carbon consultants can help you map complex materials.</p>
                  <a href="mailto:support@placeholder-domain.com">
                    <Button variant="secondary" size="sm" className="w-full text-blue-700 font-bold">Contact Support</Button>
                  </a>
                </div>
                <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Building2 size={120} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
