/**
 * @file ProjectDialog.tsx
 * @description Modal form for creating and editing Projects.
 * 
 * @functionality
 * - Form Management: Uses react-hook-form with Zod validation.
 * - CRUD: Handles both creation (POST) and updates (PUT) of project details.
 * - Fields: Covers basic info (name, location), status, and technical specs (building area, floors, et.c).
 * - Datasets: Allows selection of preferred emission datasets.
 * 
 * @dependencies
 * - react-hook-form, zod: Form state and validation.
 * - API: /api/projects endpoints.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { insertProjectSchema, type Project, type EmissionDataset } from "@shared/schema";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useError } from "@/hooks/use-error";
import { BOQImportWizard } from "@/components/Projects/BOQImportWizard";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}

const formSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Project name must be less than 100 characters"),
  location: z.string().min(1, "Location is required").max(200, "Location must be less than 200 characters"),
  type: z.string().min(1, "Project type is required"),
  status: z.enum(["planning", "active", "completed", "cancelled"]),

  // Building specifications
  buildingArea: z.number().positive().optional().or(z.literal(0)).or(z.nan()),
  floors: z.number().int().positive().optional().or(z.literal(0)),
  buildingHeight: z.number().positive().optional().or(z.literal(0)).or(z.nan()),
  climateZone: z.string().optional(),
  constructionMethod: z.enum(["traditional", "prefab", "modular", "hybrid"]).optional(),
  expectedDuration: z.number().int().positive().optional().or(z.literal(0)),
  soilConditions: z.string().optional(),
  buildingCode: z.string().optional(),

  // Emission Settings
  preferredDatasetId: z.string().optional(),
  allowMixedDatasets: z.boolean().default(true),

  userId: z.string().optional(), // Make userId optional for form validation
});

type FormData = z.infer<typeof formSchema>;

export default function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const { toast } = useToast();
  const { showError } = useError();
  const [, setLocation] = useLocation();
  // Phase 0 Option A: 2-step creation flow
  const [dialogStep, setDialogStep] = useState<"info" | "boq">("info");
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [pendingBOQUpload, setPendingBOQUpload] = useState(false);


  const { data: emissionDatasets } = useQuery<EmissionDataset[]>({
    queryKey: ["/api/emission-datasets"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      location: "",
      type: "commercial",
      status: "planning" as const,
      buildingArea: undefined,
      floors: undefined,
      buildingHeight: undefined,
      climateZone: "",
      constructionMethod: undefined,
      expectedDuration: undefined,
      soilConditions: "",
      buildingCode: "",
      preferredDatasetId: "",
      allowMixedDatasets: true,
      userId: "",
    },
  });

  // Reset form + step when dialog opens/closes
  useEffect(() => {
    if (open) {
      setDialogStep("info");
      setNewProjectId(null);
      setPendingBOQUpload(false);

      if (project) {
        form.reset({
          name: project.name || "",
          location: project.location || "",
          type: project.type || "commercial",
          status: project.status || "planning",
          buildingArea: project.buildingArea || undefined,
          floors: project.floors || undefined,
          buildingHeight: project.buildingHeight || undefined,
          climateZone: project.climateZone || "",
          constructionMethod: project.constructionMethod || undefined,
          expectedDuration: project.expectedDuration || undefined,
          soilConditions: project.soilConditions || "",
          buildingCode: project.buildingCode || "",
          preferredDatasetId: project.preferredDatasetId || "",
          allowMixedDatasets: project.allowMixedDatasets ?? true,
          userId: project.userId || "",
        });
      } else {
        form.reset({
          name: "",
          location: "",
          type: "commercial",
          status: "planning",
          buildingArea: undefined,
          floors: undefined,
          buildingHeight: undefined,
          climateZone: "",
          constructionMethod: undefined,
          expectedDuration: undefined,
          soilConditions: "",
          buildingCode: "",
          preferredDatasetId: "",
          allowMixedDatasets: true,
          userId: "",
        });
      }
    }
  }, [open, project]);

  const createProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("Creating project:", data.name);

      try {
        const response = await apiRequest('POST', '/api/projects', data);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Project creation failed:", errorText);

          let errorJson;
          try {
            errorJson = JSON.parse(errorText);
          } catch (e) {
            // Not JSON
          }

          throw new Error(errorJson?.message || `HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Project creation error:", error);
        throw error;
      }
    },
    onSuccess: (newProject: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      if (pendingBOQUpload) {
        // Phase 0 Option A: transition to Step 2 (BOQ upload)
        setPendingBOQUpload(false);
        setNewProjectId(newProject.id);
        setDialogStep("boq");
        form.reset();
      } else {
        toast({
          title: "Success",
          description: "Project created successfully",
        });
        onOpenChange(false);
        form.reset();
        if (newProject?.id) {
          setLocation(`/projects/${newProject.id}`);
        }
      }
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }

      showError({
        title: "Project Creation Failed",
        message: error.message || "An unexpected error occurred while creating the project.",
        details: error
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest('PUT', `/api/projects/${project!.id}`, data);
      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) { }
        throw new Error(errorJson?.message || `HTTP ${response.status}: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      showError({
        title: "Project Update Failed",
        message: error.message || "An unexpected error occurred while updating the project.",
        details: error
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    console.log("Submitting project form:", project ? "UPDATE" : "CREATE");

    // Clean up empty strings for optional fields to avoid validation errors
    const cleanedData = {
      ...data,
      climateZone: data.climateZone === "" ? undefined : data.climateZone,
      preferredDatasetId: data.preferredDatasetId === "" ? undefined : data.preferredDatasetId,
      soilConditions: data.soilConditions === "" ? undefined : data.soilConditions,
      buildingCode: data.buildingCode === "" ? undefined : data.buildingCode,
    };

    try {
      if (project) {
        await updateProjectMutation.mutateAsync(cleanedData);
      } else {
        await createProjectMutation.mutateAsync(cleanedData);
      }
    } catch (error) {
      console.error("Project form submission error:", error);
    }
  };

  const isLoading = createProjectMutation.isPending || updateProjectMutation.isPending;



  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setDialogStep("info"); setNewProjectId(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dialogStep === "boq" ? "Step 2 — Upload BOQ (Optional)" : project ? "Edit Project" : "Create New Project"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 2: BOQ Import Wizard */}
        {dialogStep === "boq" && newProjectId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your Bill of Quantities now to instantly import materials. You can also skip and do this later from the project's Materials tab.
            </p>
            <BOQImportWizard
              projectId={newProjectId}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  // Wizard closed (success or cancel) — navigate to project
                  setDialogStep("info");
                  onOpenChange(false);
                  setLocation(`/projects/${newProjectId}`);
                }
              }}
              embedded={true}
            />
            <div className="flex justify-between pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogStep("info")}
              >
                ← Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDialogStep("info");
                  onOpenChange(false);
                  setLocation(`/projects/${newProjectId}`);
                }}
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {dialogStep === "info" && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(
                onSubmit,
                (errors) => {
                  const errorFields = Object.keys(errors);
                  toast({
                    title: "Form Validation Failed",
                    description: `Errors in: ${errorFields.join(", ")}`,
                    variant: "destructive",
                  });
                  console.error("Phase Form Errors:", errors);
                }
              )}
              className="space-y-4"
            >
              {/* UX Manifesto Compliance Note */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> BOQ upload and material management are available inside the project workspace under "Open Project".
                </p>
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Type <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Commercial Building">Commercial Building</SelectItem>
                        <SelectItem value="Residential Building">Residential Building</SelectItem>
                        <SelectItem value="Industrial Building">Industrial Building</SelectItem>
                        <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                        <SelectItem value="Renovation">Renovation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advanced Settings - Only show when editing an existing project */}
              {project && (
                <>
                  {/* Emission Settings Section */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Emission Settings (Manifesto Compliance)</h3>
                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="preferredDatasetId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Emission Dataset</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select preferred dataset" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {/* We need to fetch datasets here. Assuming useQuery is added in component body */}
                                {emissionDatasets?.map((dataset) => (
                                  <SelectItem key={dataset.id} value={dataset.id}>
                                    {dataset.name} {dataset.version && `(${dataset.version})`} {dataset.isDefault ? "(Default)" : ""}
                                  </SelectItem>
                                ))}
                                {(!emissionDatasets || emissionDatasets.length === 0) && <SelectItem value="default" disabled>Loading or No Datasets...</SelectItem>}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="allowMixedDatasets"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Allow Mixed Datasets</FormLabel>
                              <div className="text-[0.8rem] text-muted-foreground">
                                If strict factor is not found, fallback to default (ICE) instead of error.
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Building Specifications Section */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Building Specifications</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="buildingArea"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Building Area (sq ft)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="floors"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Floors</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="buildingHeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Building Height (m)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="expectedDuration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration (months)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name="climateZone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Climate Zone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select climate zone" />
                                </SelectTrigger>
                              </FormControl>
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="constructionMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Construction Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="traditional">Traditional</SelectItem>
                                <SelectItem value="prefab">Prefabricated</SelectItem>
                                <SelectItem value="modular">Modular</SelectItem>
                                <SelectItem value="hybrid">Hybrid</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name="soilConditions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Soil Conditions</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Sandy, Clay, Rock" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="buildingCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Building Code</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., IBC 2021, NFPA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Footer — Step 1 only */}
              {dialogStep === "info" && (
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  {/* For new projects only: offer the BOQ upload path */}
                  {!project && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isLoading}
                      onClick={form.handleSubmit(async (data) => {
                        setPendingBOQUpload(true);
                        const cleaned = {
                          ...data,
                          climateZone: data.climateZone === "" ? undefined : data.climateZone,
                          preferredDatasetId: data.preferredDatasetId === "" ? undefined : data.preferredDatasetId,
                          soilConditions: data.soilConditions === "" ? undefined : data.soilConditions,
                          buildingCode: data.buildingCode === "" ? undefined : data.buildingCode,
                        };
                        try { await createProjectMutation.mutateAsync(cleaned); } catch (e) { setPendingBOQUpload(false); }
                      })}
                    >
                      {isLoading && pendingBOQUpload ? "Creating..." : "Create & Upload BOQ →"}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading && !pendingBOQUpload ? "Saving..." : project ? "Update Project" : "Create Project"}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )} {/* end dialogStep === "info" */}

      </DialogContent>
    </Dialog>
  );
}