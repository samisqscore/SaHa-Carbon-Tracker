/**
 * @file Reports.tsx
 * @description Report Generation Hub.
 * (Currently Placeholder) Intended interface for generating and downloading PDF/CSV reports.
 * 
 * @functionality
 * - Report Cards: Options for Project Summary, Portfolio Analysis, etc.
 * - Action Handling: Currently shows a toast notification for unimplemented features.
 * 
 * @dependencies
 * - UI Components: Cards, Buttons.
 * - Toaster: Feedback.
 */

import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useError } from "@/hooks/use-error";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, BarChart3, Loader2, ArrowLeft, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { downloadCSV } from "@/lib/csv-utils";
import { downloadProjectReport } from "@/lib/report-utils";
import { ReportCharts } from "@/components/Reports/ReportCharts";
import { ReportHeader } from "@/components/Reports/ReportHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Project } from "@shared/schema";

interface ReportSummary {
  projectName: string;
  projectDetails: any; // Type Project
  totalEmissions: number;
  emissionIntensity: number;
  materialCount: number;
  topContributor: { name: string; percentage: number };
  topMaterials: { name: string; value: number }[];
  phaseData: any[];
  materialData: any[];
  scopeSummary: { scope1: number; scope2: number; scope3: number };
}

export default function Reports() {
  const { toast } = useToast();
  const { showError } = useError();
  const { isAuthenticated, isLoading } = useAuth();

  // State
  const [viewMode, setViewMode] = useState<'hub' | 'project'>('hub');
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportSummary | null>(null);

  // Fetch projects
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isProjectDialogOpen,
  });

  const generateProjectReport = async () => {
    if (!selectedProjectId) return;

    try {
      setIsGenerating(true);
      // Fetch Summary Data for Dashboard
      const res = await apiRequest("GET", `/api/reports/project/${selectedProjectId}/summary`);
      if (!res.ok) throw new Error("Failed to fetch report data");
      const data = await res.json();

      setReportData(data);
      setViewMode('project');
      setIsProjectDialogOpen(false);
    } catch (error) {
      console.error("Report error:", error);
      showError({
        title: "Report Generation Failed",
        message: "Failed to generate project report.",
        details: error
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!selectedProjectId) return;
    try {
      // Re-using the logic, but usually we might assume reportData has what we need?
      // Actually the csv endpoint returns detailed rows, summary only returns aggregate.
      // So call the csv endpoint.
      const res = await apiRequest("GET", `/api/projects/${selectedProjectId}/emissions`);
      const data = await res.json();

      const csvRows = data.materials.map((m: any) => ({
        Material: m.materialName,
        Category: m.category,
        Quantity: m.quantity,
        Phase: m.phase,
        "Emission Factor": m.emissionFactor,
        "Transport (kgCO2e)": m.transportEmissions.toFixed(2),
        "Waste (kgCO2e)": m.wasteEmissions.toFixed(2),
        "Total (kgCO2e)": m.totalEmissions.toFixed(2)
      }));

      downloadCSV(csvRows, `project_emissions_${reportData?.projectName || 'report'}.csv`);
      toast({ title: "CSV Downloaded", description: "Report data exported successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const handlePrint = async () => {
    if (!selectedProjectId || !reportData) {
      window.print();
      return;
    }

    try {
      setIsGenerating(true);
      await downloadProjectReport(selectedProjectId, reportData.projectName);
    } catch (err) {
      // Fallback to local print
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex bg-gray-100 print:bg-white">
      <Sidebar />
      <main className="flex-1 lg:ml-0">
        <Header
          title={viewMode === 'hub' ? "Reports Center" : (reportData?.projectName || "Project Report")}
          subtitle={viewMode === 'hub' ? "Generate and analyze carbon footprint reports" : "Detailed emissions breakdown"}
          className="print:hidden"
        />

        <div className="p-4 lg:p-6 space-y-6">
          {viewMode === 'hub' ? (
            /* HUB VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsProjectDialogOpen(true)}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle>Project Analysis</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Detailed breakdown of emissions by phase and material category for a specific project.
                  </p>
                  <Button className="w-full">Select Project</Button>
                </CardContent>
              </Card>

              {/* Other cards placeholders */}
              <Card className="opacity-75">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-green-600" />
                    </div>
                    <CardTitle>Portfolio Overview</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">Aggregate analysis across all projects (Coming Soon).</p>
                  <Button variant="outline" className="w-full" disabled>Coming Soon</Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* REPORT VIEW */
            <div className="space-y-8 animate-in fade-in duration-500 bg-white p-8 shadow-sm rounded-lg max-w-5xl mx-auto print:shadow-none print:p-0 print:max-w-none">

              {/* HEADER SECTION (Manifesto Section 1) */}
              {reportData && <ReportHeader project={reportData.projectDetails} />}

              {/* Toolbar (Hidden in Print) */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden border-b pb-4 mb-4">
                <Button variant="ghost" onClick={() => setViewMode('hub')} className="pl-0 hover:bg-transparent hover:text-primary">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Hub
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" /> Print / Save PDF
                  </Button>
                  <Button variant="outline" onClick={handleDownloadCSV} className="gap-2">
                    <Download className="h-4 w-4" /> Export Data CSV
                  </Button>
                </div>
              </div>

              {/* Summary Stats (Manifesto Section 2) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Card className="bg-primary/5 border-none shadow-none">
                  <CardContent className="pt-6">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Carbon</div>
                    <div className="text-2xl font-bold mt-2 text-primary">
                      {reportData?.totalEmissions ? (reportData.totalEmissions / 1000).toFixed(1) : 0} <span className="text-sm font-normal text-gray-500">tCO2e</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-none shadow-none">
                  <CardContent className="pt-6">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Carbon Intensity</div>
                    <div className="text-2xl font-bold mt-2 text-blue-700">
                      {reportData?.emissionIntensity.toFixed(1)} <span className="text-sm font-normal text-gray-500">kgCO2e/m²</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50/50 border-none shadow-none">
                  <CardContent className="pt-6">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Materials Analyzed</div>
                    <div className="text-2xl font-bold mt-2 text-orange-700">
                      {reportData?.materialCount || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50 border-none shadow-none">
                  <CardContent className="pt-6">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Top Contributor</div>
                    <div className="text-lg font-bold mt-2 text-gray-700 truncate" title={reportData?.topContributor?.name}>
                      {reportData?.topContributor?.name || "N/A"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {reportData?.topContributor?.percentage}% of total
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts (Manifesto Sections 3 & 4) */}
              {reportData && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 border-l-4 border-primary pl-3">Emission Analysis</h3>
                  <ReportCharts
                    phaseData={reportData.phaseData}
                    materialData={reportData.materialData}
                    topMaterials={reportData.topMaterials}
                    scopeSummary={reportData.scopeSummary}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Project Selection Dialog */}
        <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Project for Analysis</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>Cancel</Button>
              <Button onClick={generateProjectReport} disabled={!selectedProjectId || isGenerating}>
                {isGenerating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Generate Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
