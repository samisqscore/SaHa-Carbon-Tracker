/**
 * @file ProjectMaterialsTab.tsx
 * @description Main interface for managing materials within a project.
 * 
 * @functionality
 * - List View: Displays all project materials with sorting and filtering (search, category, phase).
 * - Actions: Add new material, Edit existing, Delete material, Import BOQ, Auto-Map Materials.
 * - Calculations: dynamic calculation of total emissions including waste factors.
 * 
 * @dependencies
 * - ProjectMaterialDialog: For single item add/edit.
 * - BOQImportDialog: For bulk CSV import.
 * - API: `/api/projects/:id/materials` CRUD.
 */

import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Edit, Trash2, Search, Filter, Calculator, TrendingUp, Upload, Zap, ArrowRight, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProjectMaterial, EmissionFactor, ProjectPhase } from "@shared/schema";
import ProjectMaterialDialog from "./ProjectMaterialDialog";
import { BOQImportWizard } from "./BOQImportWizard";
import AutomapModal from "./AutomapModal";

interface ProjectMaterialsTabProps {
  projectId: string;
}

export default function ProjectMaterialsTab({ projectId }: ProjectMaterialsTabProps) {
  const [selectedMaterial, setSelectedMaterial] = useState<(ProjectMaterial & { emissionFactor: EmissionFactor | null; phase?: ProjectPhase }) | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBOQDialogOpen, setIsBOQDialogOpen] = useState(false);
  const [isAutomapOpen, setIsAutomapOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("action") === "import-boq") {
      setIsBOQDialogOpen(true);
      // Clean up URL to prevent reopening on refresh
      const newParams = new URLSearchParams(searchString);
      newParams.delete("action");
      const newSearch = newParams.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (params.get("action") === "automap") {
      setIsAutomapOpen(true);
      const newParams = new URLSearchParams(searchString);
      newParams.delete("action");
      const newSearch = newParams.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchString]);

  const { data: materials = [], isLoading } = useQuery<(ProjectMaterial & { emissionFactor: EmissionFactor | null; phase?: ProjectPhase })[]>({
    queryKey: ["/api/projects", projectId, "materials"],
    enabled: !!projectId,
    refetchOnWindowFocus: true
  });



  const { data: phases = [] } = useQuery<ProjectPhase[]>({
    queryKey: ["/api/projects", projectId, "phases"],
    enabled: !!projectId,
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/materials/${materialId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "emissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Success",
        description: "Material removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove material",
        variant: "destructive",
      });
    },
  });

  // Ensure materials have valid structure - No longer filtering out null factors
  const safeMaterials = materials.filter(m => m);

  // Get unique categories from materials
  const categories = Array.from(new Set(safeMaterials.map(m => m.emissionFactor?.materialCategory || "Other")));

  // Filter materials based on search and filters
  const filteredMaterials = safeMaterials.filter(material => {
    const searchStr = (material.customName || material.emissionFactor?.materialName || "").toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase()) ||
      (material.emissionFactor?.sourceReference || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || (material.emissionFactor?.materialCategory || "Other") === categoryFilter;
    const matchesPhase = phaseFilter === "all" ||
      (phaseFilter === "none" && !material.phaseId) ||
      material.phaseId === phaseFilter;

    return matchesSearch && matchesCategory && matchesPhase;
  }).sort((a, b) => {
    // 1. Group by Mapping Status: Mapped (emissionFactor exists) first, then Unmapped
    const aIsMapped = !!a.emissionFactor;
    const bIsMapped = !!b.emissionFactor;

    if (aIsMapped !== bIsMapped) {
      return aIsMapped ? -1 : 1;
    }

    // 2. Sort alphabetically within groups
    const aName = (a.customName || a.emissionFactor?.materialName || "").toLowerCase();
    const bName = (b.customName || b.emissionFactor?.materialName || "").toLowerCase();

    return aName.localeCompare(bName);
  });

  const handleEditMaterial = (material: ProjectMaterial & { emissionFactor: EmissionFactor | null; phase?: ProjectPhase }) => {
    setSelectedMaterial(material as any);
    setIsDialogOpen(true);
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (confirm("Are you sure you want to remove this material from the project?")) {
      await deleteMaterialMutation.mutateAsync(materialId);
    }
  };

  const handleAddMaterial = () => {
    setSelectedMaterial(undefined);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedMaterial(undefined);
  };

  const calculateTotalEmissions = () => {
    return filteredMaterials.reduce((total, material) => {
      if (!material.emissionFactor) return total;
      // wasteFactor is stored as decimal (e.g. 0.1 for 10%)
      const wasteMultiplier = 1 + (material.wasteFactor || 0);
      const emissionValue = material.emissionFactor?.emissionFactor || 0;
      return total + (material.quantity * wasteMultiplier * emissionValue);
    }, 0);
  };

  const calculateTotalCost = () => {
    // Cost tracking to be implemented in future phase
    return 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>

        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Project Materials</h2>
          <p className="text-muted-foreground">
            Manage materials and track emissions for your construction project
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAutomapOpen(true)}>
            <Zap className="h-4 w-4 mr-2 text-amber-500" />
            Auto-Map Materials
          </Button>
          <Button variant="default" onClick={() => setIsBOQDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import BOQ
          </Button>
          <Button variant="secondary" onClick={handleAddMaterial}>
            <Plus className="h-4 w-4 mr-2" />
            Add Material
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMaterials.length}</div>
            <p className="text-xs text-muted-foreground">
              {materials.length !== filteredMaterials.length && `${materials.length} total`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculateTotalEmissions().toFixed(1)} kg CO₂e
            </div>
            <p className="text-xs text-muted-foreground">
              Including waste factor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(calculateTotalCost())}
            </div>
            <p className="text-xs text-muted-foreground">
              Cost tracking coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                <SelectItem value="none">No Phase</SelectItem>
                {phases.map(phase => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("all");
                setPhaseFilter("all");
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      {filteredMaterials.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {materials.length === 0 ? "No Materials Yet" : "No Materials Match Filters"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {materials.length === 0
                  ? "Add materials to start tracking emissions and costs for your project."
                  : "Try adjusting your search terms or filters to find materials."
                }
              </p>
              {materials.length === 0 && (
                <Button onClick={handleAddMaterial}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Material
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Materials List</CardTitle>
            <CardDescription>
              {filteredMaterials.length} of {materials.length} materials shown
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
                  <TableHead className="text-right">Emissions</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => {
                  const wasteMultiplier = 1 + (material.wasteFactor || 0);
                  const totalEmissions = material.emissionFactor
                    ? material.quantity * wasteMultiplier * material.emissionFactor.emissionFactor
                    : 0;

                  // Cost placeholder
                  const totalCost = 0;

                  return (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{material.customName || material.emissionFactor?.materialName || "Unknown Material"}</div>
                          <div className="text-sm text-muted-foreground">
                            {material.emissionFactor?.sourceReference || "No source mapped"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={material.emissionFactor ? "outline" : "destructive"}>
                          {material.emissionFactor?.materialCategory || "Unmapped"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.phase ? (
                          <Badge variant="secondary">
                            {material.phase.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No phase</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div className="font-medium">
                            {material.quantity.toLocaleString()} {material.emissionFactor?.unit || "---"}
                          </div>
                          {material.wasteFactor && material.wasteFactor > 0 && (
                            <div className="text-xs text-muted-foreground">
                              +{(material.wasteFactor * 100).toFixed(0)}% waste
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {material.emissionFactor ? (
                          <>
                            <div className="font-medium">
                              {totalEmissions.toFixed(2)} kg CO₂e
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {material.emissionFactor?.emissionFactor || 0} kg/unit
                            </div>
                          </>
                        ) : (
                          <div className="text-muted-foreground italic">---</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">---</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 hover:bg-amber-100" onClick={() => setLocation(`/projects/${projectId}?tab=materials&action=automap`)}>
                            Map Materials
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMaterial(material)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMaterial(material.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <ProjectMaterialDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        projectId={projectId}
        projectMaterial={selectedMaterial}
        onSuccess={handleDialogClose}
      />



      <BOQImportWizard
        open={isBOQDialogOpen}
        onOpenChange={setIsBOQDialogOpen}
        projectId={projectId}
      />

      <AutomapModal
        open={isAutomapOpen}
        onOpenChange={setIsAutomapOpen}
        projectId={projectId}
      />
    </div>
  );
}