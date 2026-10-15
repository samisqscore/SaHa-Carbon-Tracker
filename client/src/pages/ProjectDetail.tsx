/**
 * @file ProjectDetail.tsx
 * @description Project Details Wrapper Page.
 * Acts as the container for comprehensive project data, switching between Overview, Phases, Materials, and Emissions tabs.
 * 
 * @functionality
 * - Routing: Validates project ID from URL.
 * - Project Context: Fetches core project data once for header and status.
 * - Tabs: Manages state for sub-components (Overview, Phases, Materials, Emissions).
 * 
 * @dependencies
 * - Components/Projects/*: Dedicated components for each tab functionality.
 * - useQuery: Fetches project metadata.
 * 
 * @breaking-changes
 * - Tab Keys: Internal tab keys ('overview', 'phases', etc.) are used for state; renaming breaks default selection.
 */

import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Settings, BarChart3, Package, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";

// Import tab components
import ProjectOverviewTab from "@/components/Projects/ProjectOverviewTab";
import ProjectPhasesTab from "@/components/Projects/ProjectPhasesTab";
import ProjectMaterialsTab from "@/components/Projects/ProjectMaterialsTab";
import ProjectEmissionsTab from "@/components/Projects/ProjectEmissionsTab";
import ProjectReportTab from "@/components/Projects/ProjectReportTab";
import ProjectDialog from "@/components/Projects/ProjectDialog";

export default function ProjectDetail() {
  const { projectId: id } = useParams<{ projectId: string }>();
  const params = useParams();
  console.log("params in ProjectDetail:", params);
  console.log("projectId (id) in ProjectDetail:", id);

  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState("overview");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.has("tab")) {
      setActiveTab(params.get("tab")!);
    }
  }, [searchString]);

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });

  const { data: emissionsData } = useQuery<any>({
    queryKey: ["/api/projects", id, "emissions"],
    enabled: !!id,
  });

  const { data: lifecycleRaw } = useQuery<any>({
    queryKey: ["/api/projects", id, "emissions", "by-lifecycle"],
    enabled: !!id,
  });

  const lifecycleData = lifecycleRaw?.stages || [];

  const { data: phasesData = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "phases"],
    enabled: !!id,
  });

  // Set default tab to "report" for empty projects, "overview" for existing projects with data
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (!params.has("tab") && emissionsData) {
      const materialCount = emissionsData?.materials?.length || 0;
      if (materialCount === 0) {
        setActiveTab("report");
      }
    }
  }, [emissionsData, searchString]);

  if (!id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Invalid project ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <Skeleton className="h-10 w-full" />

        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>

        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive mb-2">Project Not Found</h3>
              <p className="text-muted-foreground mb-4">
                The project you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <Button onClick={() => setLocation("/projects")}>
                Return to Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "active":
        return "default";
      case "completed":
        return "secondary";
      case "planning":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} t CO₂e`;
    }
    return `${value.toFixed(2)} kg CO₂e`;
  };

  const isEditable = user?.role === "admin" || user?.role === "estimator";

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge variant={getStatusBadgeVariant(project.status)}>
                {project.status || "Unknown"}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="capitalize">{project.type} • {project.location}</span>
              <span>Created {formatDate(project.createdAt)}</span>
            </div>
          </div>
        </div>

        {isEditable && (
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Project Settings
          </Button>
        )}
      </div>

      {/* Project Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Badge variant={getStatusBadgeVariant(project.status)}>
              {project.status || "Unknown"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.status === "active" ? "In Progress" :
                project.status === "completed" ? "Complete" :
                  project.status === "planning" ? "Planning" : "Unknown"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emissionsData?.totalEmissions ? formatEmissions(emissionsData.totalEmissions) : "0 kg CO₂e"}
            </div>
            {lifecycleData.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-2 text-muted-foreground">
                {lifecycleData.filter((item: any) => item.totalEmissions > 0).map((stage: any) => {
                  const grandTotal = lifecycleRaw?.grandTotal || 1;
                  const pct = ((stage.totalEmissions / grandTotal) * 100).toFixed(0);
                  return (
                    <span key={stage.stage} className="font-medium whitespace-nowrap">
                      {stage.stage}: {pct}%
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Calculate emissions in Materials tab
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emissionsData?.materials?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {emissionsData?.materials?.length > 0 ? "Materials evaluated" : "No materials assigned yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phases</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {phasesData?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {phasesData?.length === 5 ? "5 (default)" : phasesData?.length > 0 ? "Phases created" : "No phases created yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="report" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Report
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="phases" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Phases
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Materials
          </TabsTrigger>
          <TabsTrigger value="emissions" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Emissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-6">
          <ProjectReportTab project={project} onNavigateTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <ProjectOverviewTab project={project} isEditable={isEditable} onNavigateTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="phases" className="space-y-6">
          <ProjectPhasesTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          <ProjectMaterialsTab projectId={id} />
        </TabsContent>

        <TabsContent value="emissions" className="space-y-6">
          <ProjectEmissionsTab projectId={project.id} />
        </TabsContent>
      </Tabs>

      <ProjectDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        project={project}
      />
    </div>
  );
}