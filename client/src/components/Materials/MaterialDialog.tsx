import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect, useMemo } from "react";
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
import { insertEmissionFactorSchema, type EmissionFactor } from "@shared/schema";
import { z } from "zod";

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: EmissionFactor | null;
}

const formSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  category: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  emissionFactor: z.coerce.number().min(0, "Emission factor must be positive"),
  source: z.string().optional(),
  displayId: z.string().optional(), // Make displayId optional for form validation
});

type FormData = z.infer<typeof formSchema>;

export default function MaterialDialog({ open, onOpenChange, material }: MaterialDialogProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      category: "Concrete",
      unit: "m³",
      emissionFactor: 0,
      source: "",
      displayId: "", // Add displayId to prevent validation errors
    },
  });

  // Reset form when material prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (material) {
        form.reset({
          name: material.materialName || "",
          category: material.materialCategory || "Concrete",
          unit: material.unit || "m³",
          emissionFactor: material.emissionFactor || 0,
          source: material.sourceReference || "",
          displayId: "", // Legacy displayId removed
        });
      } else {
        form.reset({
          name: "",
          category: "Concrete",
          unit: "m³",
          emissionFactor: 0,
          source: "",
          displayId: "",
        });
      }
    }
  }, [open, material]);

  // Generate preview ID based on current form values
  const previewId = useMemo(() => {
    const name = form.watch("name");
    const category = form.watch("category");

    if (!name || !category) return null;

    const namePrefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    const categoryPrefix = category.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();

    return `${namePrefix}_${categoryPrefix}_XXX`;
  }, [form.watch("name"), form.watch("category")]);

  const createMaterialMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("Creating material:", data.name);

      try {
        // Map form data to backend schema (EmissionFactor)
        const payload = {
          ...data,
          materialName: data.name,
          materialCategory: data.category,
          sourceReference: data.source
        };
        const response = await apiRequest('POST', '/api/materials', payload);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Material creation failed:", errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Material creation error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      toast({
        title: "Success",
        description: "Material created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
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
      toast({
        title: "Error",
        description: "Failed to create material",
        variant: "destructive",
      });
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        materialName: data.name, // Map UI 'name' to DB 'materialName'
        materialCategory: data.category, // Map UI 'category' to DB 'materialCategory'
        sourceReference: data.source
      };
      const response = await apiRequest('PUT', `/api/materials/${material!.id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      toast({
        title: "Success",
        description: "Material updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
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
      toast({
        title: "Error",
        description: "Failed to update material",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    console.log("Submitting material form:", material ? "UPDATE" : "CREATE");

    try {
      if (material) {
        await updateMaterialMutation.mutateAsync(data);
      } else {
        await createMaterialMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Material form submission error:", error);
    }
  };

  const isLoading = createMaterialMutation.isPending || updateMaterialMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {material ? "Edit Material" : "Add New Material"}
          </DialogTitle>
          {material && (
            <p className="text-sm text-gray-500 mt-1">
              Source: {material.sourceReference || "Global"}
            </p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              onSubmit,
              (errors) => {
                console.log("Material form validation failed:", Object.keys(errors));

                const errorFields = Object.keys(errors);
                toast({
                  title: "Validation Failed",
                  description: `Please check: ${errorFields.join(", ")}`,
                  variant: "destructive",
                });
              }
            )}
            className="space-y-4"
          >
            {!material && previewId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Generated ID:</strong> {previewId}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This ID will be automatically generated with sequential numbering (XXX will be replaced with next number)
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter material name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Concrete">Concrete</SelectItem>
                      <SelectItem value="Steel">Steel</SelectItem>
                      <SelectItem value="Timber">Timber</SelectItem>
                      <SelectItem value="Insulation">Insulation</SelectItem>
                      <SelectItem value="Masonry">Masonry</SelectItem>
                      <SelectItem value="Glass">Glass</SelectItem>
                      <SelectItem value="Aluminium">Aluminium</SelectItem>
                      <SelectItem value="Roofing">Roofing</SelectItem>
                      <SelectItem value="Finishing">Finishing</SelectItem>
                      <SelectItem value="Plastic">Plastic</SelectItem>
                      <SelectItem value="Aggregate">Aggregate</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="emissionFactor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emission Factor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
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
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="m³">m³</SelectItem>
                        <SelectItem value="m²">m²</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="tonne">tonne</SelectItem>
                        <SelectItem value="unit">unit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Data source or reference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : material ? "Update Material" : "Add Material"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
