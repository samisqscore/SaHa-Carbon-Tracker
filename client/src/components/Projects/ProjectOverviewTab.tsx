/**
 * @file ProjectOverviewTab.tsx
 * @description Comprehensive view and editor for Project details and specifications.
 * 
 * @functionality
 * - View/Edit Mode: Toggles between read-only display and editable form.
 * - Sections:
 *   - Basic Info: Name, Status, Type, Location.
 *   - Building Specs: Area, Floors, Height, Code.
 *   - Environmental: Climate Zone, Construction Complexity (calculated).
 *   - Settings: Preferred Emission Dataset, Mixed Dataset allowance.
 * - BOQ Status: entry point for Bulk Import if no materials exist.
 * 
 * @dependencies
 * - API: PATCH/PUT `/api/projects/:id`.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Save, X, Building, Calendar, FileText, Ruler, Wind, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useError } from "@/hooks/use-error";
import { apiRequest } from "@/lib/queryClient";
import { getRegionalFactor, getClimateZoneLabel, CLIMATE_ZONE_CODES, CLIMATE_ZONE_LABELS } from "@shared/climateFactors"; // P3: shared constants

import { Project, EmissionDataset } from "@shared/schema";


interface ProjectOverviewTabProps {
  project: Project;
  isEditable?: boolean;
  onNavigateTab?: (tab: string) => void;
}

// getClimateZoneFactor imported from @shared/climateFactors (p3 fix — single source of truth)
// The local helper below has been REMOVED to prevent backend/frontend divergence.


const getConstructionComplexity = (height: number | null, floors: number | null) => {
  if (!height && !floors) return "Not determined";

  const heightComplexity = height ? (height > 30 ? "High" : height > 15 ? "Medium" : "Low") : "";
  const floorComplexity = floors ? (floors > 10 ? "High" : floors > 5 ? "Medium" : "Low") : "";

  if (heightComplexity === "High" || floorComplexity === "High") return "High complexity";
  if (heightComplexity === "Medium" || floorComplexity === "Medium") return "Medium complexity";
  return "Low complexity";
};

export default function ProjectOverviewTab({ project, isEditable = false, onNavigateTab }: ProjectOverviewTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState(project);
  const [, setLocation] = useLocation();

  const { toast } = useToast();
  const { showError } = useError();
  const queryClient = useQueryClient();

  const { data: emissionDatasets } = useQuery<EmissionDataset[]>({
    queryKey: ["/api/emission-datasets"],
  });

  const { data: materials } = useQuery<any[]>({
    queryKey: ["/api/projects", project.id, "materials"],
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (updatedData: Partial<Project>) => {
      // Clean up the data before sending: 
      // 1. Zod expects real numbers, but input is string
      // 2. Optional strings should be null if empty
      const cleaned = {
        ...updatedData,
        buildingArea: updatedData.buildingArea ? Number(updatedData.buildingArea) : null,
        floors: updatedData.floors ? Number(updatedData.floors) : null,
        buildingHeight: updatedData.buildingHeight ? Number(updatedData.buildingHeight) : null,
        expectedDuration: updatedData.expectedDuration ? Number(updatedData.expectedDuration) : null,
        climateZone: updatedData.climateZone === "" ? null : updatedData.climateZone,
        preferredDatasetId: updatedData.preferredDatasetId === "" ? null : updatedData.preferredDatasetId,
      };

      const response = await apiRequest('PUT', `/api/projects/${project.id}`, cleaned);
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        throw new Error(errorData.message || (errorData.errors ? "Validation Error" : "Update failed"));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      console.error("Project Update Failure:", error);
      showError({
        title: "Project Update Failed",
        message: error.message || "An unexpected error occurred while updating the project.",
        details: error
      });
    },
  });

  const handleSave = () => {
    updateProjectMutation.mutate(editedProject);
  };

  const handleCancel = () => {
    setEditedProject(project);
    setIsEditing(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

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



  const isProjectEmpty = materials && materials.length === 0;

  return (
    <div className="space-y-6">

      {/* Smart Empty State (Phase 0B) */}
      {isProjectEmpty && (
        <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                  🚀 Ready to measure emissions?
                </h3>
                <p className="text-emerald-700">
                  Upload your Bill of Quantities to instantly import materials and generate your first emissions report.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 min-w-max">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                  onClick={() => setLocation(`/projects/${project.id}?tab=materials&action=import-boq`)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload BOQ
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-emerald-600 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setLocation(`/projects/${project.id}?tab=materials`)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Manually
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Project Overview</h2>
          <p className="text-muted-foreground">
            Basic project information and specifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Debug badge removed - verify with console/box */}
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateProjectMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Project
            </Button>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Core project details and identification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Project Name <span className="text-red-500">*</span></label>
              {isEditing ? (
                <Input
                  value={editedProject.name}
                  onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 font-medium">{project.name}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              {isEditing ? (
                <Select
                  value={editedProject.status || ""}
                  onValueChange={(value) => setEditedProject({
                    ...editedProject,
                    status: value as "planning" | "active" | "completed" | "cancelled"
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(project.status)}>
                    {project.status || "Unknown"}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground"
              >Project Type <span className="text-red-500">*</span></label>
              {isEditing ? (
                <Select
                  value={editedProject.type}
                  onValueChange={(value) => setEditedProject({ ...editedProject, type: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium capitalize">{project.type}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground"
              >Location <span className="text-red-500">*</span></label>
              {isEditing ? (
                <Input
                  value={editedProject.location}
                  onChange={(e) => setEditedProject({ ...editedProject, location: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 font-medium">{project.location}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Project Timeline
          </CardTitle>
          <CardDescription>
            Important dates and project schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="mt-1 font-medium">{formatDate(project.createdAt)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="mt-1 font-medium">{formatDate(project.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Building Specifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Building Specifications
          </CardTitle>
          <CardDescription>
            Detailed building characteristics and specifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Building Area (m²)</label>
              {isEditing ? (
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editedProject.buildingArea || ""}
                  onChange={(e) => setEditedProject({
                    ...editedProject,
                    buildingArea: e.target.value ? parseFloat(e.target.value) : null
                  })}
                  className="mt-1"
                  placeholder="Enter building area"
                />
              ) : (
                <p className="mt-1 font-medium">
                  {project.buildingArea ? `${Number(project.buildingArea).toLocaleString()} m²` : "Not specified"}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Number of Floors</label>
              {isEditing ? (
                <Input
                  type="number"
                  min="1"
                  value={editedProject.floors || ""}
                  onChange={(e) => setEditedProject({
                    ...editedProject,
                    floors: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="mt-1"
                  placeholder="Enter number of floors"
                />
              ) : (
                <p className="mt-1 font-medium">
                  {project.floors || "Not specified"}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Building Height (m)</label>
              {isEditing ? (
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editedProject.buildingHeight || ""}
                  onChange={(e) => setEditedProject({
                    ...editedProject,
                    buildingHeight: e.target.value ? parseFloat(e.target.value) : null
                  })}
                  className="mt-1"
                  placeholder="Enter building height"
                />
              ) : (
                <p className="mt-1 font-medium">
                  {project.buildingHeight ? `${project.buildingHeight} m` : "Not specified"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              {/* Climate Zone warning when not set or legacy value */}
              {!project.climateZone || !/^[1-8][A-C]$/.test(project.climateZone) ? (
                <div className="mb-1 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <span>⚠️</span>
                  <span>
                    {project.climateZone && !/^[1-8][A-C]$/.test(project.climateZone)
                      ? `Legacy climate zone value "${project.climateZone}" detected — please select a valid ASHRAE zone to ensure accurate emissions.`
                      : "Climate zone not set — please select a zone to enable accurate regional emission calculations."
                    }
                  </span>
                </div>
              ) : null}
              <label className="text-sm font-medium text-muted-foreground">Climate Zone</label>
              {isEditing ? (
                <Select
                  value={editedProject.climateZone || ""}
                  onValueChange={(value) => setEditedProject({ ...editedProject, climateZone: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select climate zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1A">1A - Very Hot, Humid</SelectItem>
                    <SelectItem value="2A">2A - Hot, Humid</SelectItem>
                    <SelectItem value="3A">3A - Warm, Humid</SelectItem>
                    <SelectItem value="4A">4A - Mixed, Humid</SelectItem>
                    <SelectItem value="5A">5A - Cool, Humid</SelectItem>
                    <SelectItem value="6A">6A - Cold, Humid</SelectItem>
                    <SelectItem value="7A">7A - Very Cold</SelectItem>
                    <SelectItem value="8A">8A - Subarctic</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">
                  {project.climateZone
                    ? {
                      '1A': '1A — Very Hot, Humid', '1B': '1B — Very Hot, Dry',
                      '2A': '2A — Hot, Humid', '2B': '2B — Hot, Dry',
                      '3A': '3A — Warm, Humid', '3B': '3B — Warm, Dry', '3C': '3C — Warm, Marine',
                      '4A': '4A — Mixed, Humid', '4B': '4B — Mixed, Dry', '4C': '4C — Mixed, Marine',
                      '5A': '5A — Cool, Humid', '5B': '5B — Cool, Dry', '5C': '5C — Cool, Marine',
                      '6A': '6A — Cold, Humid', '6B': '6B — Cold, Dry',
                      '7A': '7A — Very Cold', '8A': '8A — Subarctic',
                    }[project.climateZone] || project.climateZone
                    : "Not specified"}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Construction Method</label>
              {isEditing ? (
                <Select
                  value={editedProject.constructionMethod || ""}
                  onValueChange={(value) => setEditedProject({
                    ...editedProject,
                    constructionMethod: value as any
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select construction method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traditional">Traditional</SelectItem>
                    <SelectItem value="prefab">Prefabricated</SelectItem>
                    <SelectItem value="modular">Modular</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">
                  {project.constructionMethod?.replace('_', ' ') || "Not specified"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Expected Duration (months)</label>
              {isEditing ? (
                <Input
                  type="number"
                  min="1"
                  value={editedProject.expectedDuration || ""}
                  onChange={(e) => setEditedProject({
                    ...editedProject,
                    expectedDuration: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="mt-1"
                  placeholder="Enter expected duration"
                />
              ) : (
                <p className="mt-1 font-medium">
                  {project.expectedDuration ? `${project.expectedDuration} months` : "Not specified"}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Soil Conditions</label>
              {isEditing ? (
                <Select
                  value={editedProject.soilConditions || ""}
                  onValueChange={(value) => setEditedProject({ ...editedProject, soilConditions: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select soil conditions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="soft">Soft</SelectItem>
                    <SelectItem value="rocky">Rocky</SelectItem>
                    <SelectItem value="sandy">Sandy</SelectItem>
                    <SelectItem value="clay">Clay</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium capitalize">
                  {project.soilConditions || "Not specified"}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Building Code</label>
            {isEditing ? (
              <Input
                value={editedProject.buildingCode || ""}
                onChange={(e) => setEditedProject({ ...editedProject, buildingCode: e.target.value })}
                className="mt-1"
                placeholder="Enter applicable building code (e.g., IBC 2021, Eurocode)"
              />
            ) : (
              <p className="mt-1 font-medium">
                {project.buildingCode || "Not specified"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Environmental Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            Environmental Factors
          </CardTitle>
          <CardDescription>
            Climate and environmental considerations affecting emissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Regional Climate Factor</label>
              <p className="mt-1 font-medium">
                {project.climateZone ?
                  `${project.climateZone} (Regional factor: ×${getRegionalFactor(project.climateZone).toFixed(2)})` :
                  "Not specified"
                }
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Construction Complexity</label>
              <p className="mt-1 font-medium">
                {getConstructionComplexity(project.buildingHeight, project.floors)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emission Standards Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Emission Standards (Manifesto Compliance)
          </CardTitle>
          <CardDescription>
            Configuration for emission factor selection and dataset compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Preferred Dataset</label>
              {isEditing ? (
                <Select
                  value={editedProject.preferredDatasetId || "default"}
                  onValueChange={(value) => setEditedProject({ ...editedProject, preferredDatasetId: value === "default" ? null : value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select preferred dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {emissionDatasets?.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name} {dataset.version && `(${dataset.version})`} {dataset.isDefault ? "(Default)" : ""}
                      </SelectItem>
                    ))}
                    {!emissionDatasets && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">
                  {emissionDatasets?.find(d => d.id === project.preferredDatasetId)?.name || "Default (ICE)"}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Allow Mixed Datasets
              </label>
              {isEditing ? (
                <div className="flex items-center space-x-2 mt-2">
                  <Switch
                    id="allow-mixed"
                    checked={editedProject.allowMixedDatasets ?? true}
                    onCheckedChange={(checked) => setEditedProject({ ...editedProject, allowMixedDatasets: checked })}
                  />
                  <label htmlFor="allow-mixed" className="text-sm text-muted-foreground">
                    {editedProject.allowMixedDatasets ?? true ? "Enabled" : "Disabled"}
                  </label>
                </div>
              ) : (
                <p className="mt-1 font-medium">
                  {project.allowMixedDatasets ?? true ? "Yes" : "No"}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                If enabled, system falls back to default dataset when preferred factor is missing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOQ Import Status (Manifesto Compliance) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bill of Quantities (BOQ)
          </CardTitle>
          <CardDescription>
            Manage project materials via bulk import
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">BOQ Status</h4>
              <p className="text-sm text-muted-foreground">
                {materials && materials.length > 0
                  ? `${materials.length} materials loaded in this project.`
                  : "No materials uploaded yet. Use the Materials tab to import a BOQ."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Additional Information
          </CardTitle>
          <CardDescription>
            Extra project details and notes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Project ID</label>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{project.id}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Owner</label>
              <p className="mt-1 font-medium">{project.userId}</p>
            </div>
          </div>
        </CardContent>
      </Card>


    </div >
  );
}