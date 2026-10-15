/**
 * @file ProjectMaterialDialog.tsx
 * @description Modal form for Adding/Editing a specific material entry in a project.
 * 
 * @functionality
 * - Material Lookup: Searchable dropdown to select base materials from catalog.
 * - Calculations: Real-time estimate of Total Emissions and Cost based on input quantity.
 * - Fields: Quantity, Phase association, Waste %, Cost, Supplier info.
 * - CRUD: Handles POST (add) and PUT (edit) for `project_materials`.
 * 
 * @dependencies
 * - API: Fetches `/api/materials` for selection list.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProjectMaterial, EmissionFactor, ProjectPhase } from "@shared/schema";
import { Search, Package, Calculator, Truck } from "lucide-react";

const TRANSPORT_MODES = ["Road", "Rail", "Ship", "Air"] as const;
type TransportMode = typeof TRANSPORT_MODES[number];

// Alias for migration ease, or replace Usage
type Material = EmissionFactor;

const formSchema = z.object({
  materialId: z.string().min(1, "Material selection is required"),
  quantity: z.number().min(0, "Quantity must be positive"),
  phaseId: z.string().optional(),
  notes: z.string().optional(),
  costPerUnit: z.number().min(0).optional(),
  supplierInfo: z.string().optional(),
  deliveryDate: z.string().optional(),
  wastePercentage: z.number().min(0).max(100).optional(),
  installationMethod: z.string().optional(),
  // P1b: Transport fields
  transportMode: z.enum(["Road", "Rail", "Ship", "Air"]).default("Road"),
  supplierDistance: z.number().min(0).max(10000).optional(),
});

const INSTALLATION_METHODS = [
  "Manual",
  "Mechanical Fixings",
  "Adhesive/Glue",
  "Welding",
  "Mortar/Cement",
  "Floating/Loose Lay",
  "Nailing"
];

type FormData = z.infer<typeof formSchema>;

interface ProjectMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectMaterial?: ProjectMaterial & { emissionFactor: EmissionFactor | null; phase?: ProjectPhase };
  onSuccess?: () => void;
}

export default function ProjectMaterialDialog({
  open,
  onOpenChange,
  projectId,
  projectMaterial,
  onSuccess,
}: ProjectMaterialDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<EmissionFactor | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // API returns EmissionFactor[] now
  const { data: materials = [] } = useQuery<EmissionFactor[]>({
    queryKey: ["/api/materials"],
  });

  const { data: phases = [] } = useQuery<ProjectPhase[]>({
    queryKey: ["/api/projects", projectId, "phases"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialId: "",
      quantity: 0,
      phaseId: "",
      notes: "",
      costPerUnit: 0,
      supplierInfo: "",
      deliveryDate: "",
      wastePercentage: 5,
      installationMethod: "Manual",
    },
  });

  // Filter materials based on search
  const filteredMaterials = materials.filter((material: EmissionFactor) =>
    (material.materialName || "").toLowerCase().includes(materialSearch.toLowerCase()) ||
    (material.materialCategory || "").toLowerCase().includes(materialSearch.toLowerCase())
  );

  useEffect(() => {
    if (projectMaterial) {
      // For existing items, we use the linked EmissionFactor
      // (Note: backend returns 'emissionFactor' relation, not 'material')
      // Map it if the prop persists as 'material' in parent, but here props say 'emissionFactor'

      const factor = projectMaterial.emissionFactor || null;

      form.reset({
        materialId: projectMaterial.emissionFactorId || "", // Use explicit FK
        quantity: projectMaterial.quantity,
        phaseId: projectMaterial.phaseId || "",
        notes: projectMaterial.notes || "",
        costPerUnit: projectMaterial.costPerUnit || 0,
        supplierInfo: projectMaterial.supplier || "",
        deliveryDate: projectMaterial.deliveryDate ? new Date(projectMaterial.deliveryDate).toISOString().split('T')[0] : "",
        wastePercentage: (projectMaterial.wasteFactor || 0) * 100,
        installationMethod: projectMaterial.installationMethod || "Manual",
        transportMode: (projectMaterial.transportMode as TransportMode) || "Road",
        supplierDistance: projectMaterial.supplierDistance || 0,
      });
      setSelectedMaterial(factor);
    } else {
      form.reset({
        materialId: "",
        quantity: 0,
        phaseId: "",
        notes: "",
        costPerUnit: 0,
        supplierInfo: "",
        deliveryDate: "",
        wastePercentage: 5,
        installationMethod: "Manual",
        transportMode: "Road",
        supplierDistance: 0,
      });
      setSelectedMaterial(null);
    }
  }, [projectMaterial, form]);

  const handleMaterialSelect = (materialId: string) => {
    const material = materials.find((m: Material) => m.id === materialId);
    setSelectedMaterial(material || null);
    form.setValue("materialId", materialId);
  };

  const calculateEmissions = () => {
    if (!selectedMaterial) return 0;
    const quantity = form.watch("quantity");
    const wastePercentage = form.watch("wastePercentage") || 0;
    const actualQuantity = quantity * (1 + wastePercentage / 100);
    return actualQuantity * selectedMaterial.emissionFactor;
  };

  const calculateCost = () => {
    const quantity = form.watch("quantity");
    const costPerUnit = form.watch("costPerUnit") || 0;
    return quantity * costPerUnit;
  };

  const createMaterialMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedMaterial) throw new Error("No material selected");

      const payload = {
        projectId,
        emissionFactorId: data.materialId, // Backend expects emissionFactorId
        quantity: data.quantity,
        phaseId: (data.phaseId === "_none" || data.phaseId === "") ? null : data.phaseId,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString() : null,
        wasteFactor: (data.wastePercentage || 0) / 100,
        supplier: data.supplierInfo,
        installationMethod: data.installationMethod,
        notes: data.notes,
        costPerUnit: data.costPerUnit,
        // P1b: Transport fields
        transportMode: data.transportMode || "Road",
        supplierDistance: data.supplierDistance || 0,

        // Snapshot fields required by backend
        snapshotEmissionValue: selectedMaterial.emissionFactor,
        snapshotSource: selectedMaterial.sourceReference || "Global",
      };

      if (projectMaterial) {
        await apiRequest("PUT", `/api/projects/${projectId}/materials/${projectMaterial.id}`, payload);
      } else {
        await apiRequest("POST", `/api/projects/${projectId}/materials`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "emissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Success",
        description: projectMaterial ? "Material updated successfully" : "Material added successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: projectMaterial ? "Failed to update material" : "Failed to add material",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createMaterialMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {projectMaterial ? "Edit Material" : "Add Material to Project"}
          </DialogTitle>
          <DialogDescription>
            {projectMaterial?.customName && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs">
                <strong>Original BOQ Description:</strong> {projectMaterial.customName}
              </div>
            )}
            <div className="mt-2">
              {projectMaterial
                ? "Update the material details and quantities."
                : "Select a material and specify quantities for your project."
              }
            </div>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              onSubmit,
              (errors) => {
                toast({
                  title: "Validation Error",
                  description: `Please fix: ${Object.keys(errors).join(", ")}`,
                  variant: "destructive",
                });
                console.error("Material Form Invalid:", errors);
              }
            )}
            className="space-y-4"
          >
            {/* Material Selection */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="materialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Select Material
                    </FormLabel>
                    <div className="space-y-3">
                      {(!projectMaterial || !projectMaterial.emissionFactorId) && (
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search materials by name, category, or ID..."
                            value={materialSearch}
                            onChange={(e) => setMaterialSearch(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      )}

                      <FormControl>
                        <Select
                          onValueChange={handleMaterialSelect}
                          value={field.value}
                          disabled={!!projectMaterial && !!projectMaterial.emissionFactorId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a material" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredMaterials.map((material: EmissionFactor) => (
                              <SelectItem key={material.id} value={material.id}>
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <span className="font-medium">{material.materialName}</span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                      ({material.sourceReference || "Global"})
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {material.materialCategory || "Other"}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedMaterial && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <p className="font-medium">{selectedMaterial.materialCategory || "Other"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unit:</span>
                      <p className="font-medium">{selectedMaterial.unit}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Emission Factor:</span>
                      <p className="font-medium">{selectedMaterial.emissionFactor} kg CO₂e/{selectedMaterial.unit}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Density:</span>
                      <p className="font-medium">{selectedMaterial.density || "N/A"} kg/m³</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Quantity {selectedMaterial && `(${selectedMaterial.unit})`}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Transport Mode and Supplier Distance (P1b) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>Transport to Site</span>
                <span className="text-xs text-muted-foreground font-normal">(A4 — affects transport emissions)</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transportMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRANSPORT_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplierDistance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distance from Supplier (km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="10000"
                          step="1"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Installation Method and Phase */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="installationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installation Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INSTALLATION_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Phase (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "_none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select phase" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">No specific phase</SelectItem>
                        {phases.map((phase: ProjectPhase) => (
                          <SelectItem key={phase.id} value={phase.id}>
                            {phase.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cost and Waste */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="costPerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Unit ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wastePercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waste Percentage (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="5"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Supplier and Delivery */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplierInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Information</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Supplier name or contact"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this material usage..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Calculations Summary */}
            {selectedMaterial && (
              <>
                <Separator />

                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4" />
                    <span className="font-medium">Impact Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total CO₂ Emissions:</span>
                      <p className="font-medium text-lg">
                        {calculateEmissions().toFixed(2)} kg CO₂e
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estimated Cost:</span>
                      <p className="font-medium text-lg">
                        ${calculateCost().toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedMaterial}>
                {isSubmitting ? (projectMaterial ? "Updating..." : "Adding...") : (projectMaterial ? "Update Material" : "Add Material")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}