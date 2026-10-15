/**
 * @file ProjectPhaseDialog.tsx
 * @description Modal form for managing Project Phases.
 * 
 * @functionality
 * - Form: Create or Edit a phase.
 * - Fields: Name, Description, Status (Planned/Active/Completed), Date Range, Completion %.
 * - CRUD: Handles POST and PUT to `/api/projects/:id/phases`.
 * 
 * @dependencies
 * - react-hook-form, zod: Form validation.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProjectPhase } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "Phase name is required"),
  projectId: z.string(),
  status: z.enum(["planned", "active", "completed"]).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  phasePercentage: z.number().min(0).max(100).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ProjectPhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phase?: ProjectPhase;
  onSuccess?: () => void;
}

export default function ProjectPhaseDialog({
  open,
  onOpenChange,
  projectId,
  phase,
  onSuccess,
}: ProjectPhaseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  console.log("ProjectPhaseDialog: Received projectId:", projectId);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      projectId: projectId,
      status: "planned",
      description: "",
      startDate: "",
      endDate: "",
      phasePercentage: 0,
    },
  });

  useEffect(() => {
    if (phase) {
      form.reset({
        name: phase.name,
        projectId: phase.projectId,
        status: (phase.status || "planned") as "planned" | "active" | "completed",
        description: phase.description || "",
        startDate: phase.startDate ? new Date(phase.startDate).toISOString().split('T')[0] : "",
        endDate: phase.endDate ? new Date(phase.endDate).toISOString().split('T')[0] : "",
        phasePercentage: phase.phasePercentage || 0,
      });
    } else {
      form.reset({
        name: "",
        projectId: projectId,
        status: "planned",
        description: "",
        startDate: "",
        endDate: "",
        phasePercentage: 0,
      });
    }
  }, [phase, projectId, form]);

  const createPhaseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };

      if (phase) {
        await apiRequest("PUT", `/api/projects/${projectId}/phases/${phase.id}`, payload);
      } else {
        await apiRequest("POST", `/api/projects/${projectId}/phases`, payload);
      }
    },
    onSuccess: () => {
      onOpenChange(false); // Close immediately for better UX
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "phases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Success",
        description: phase ? "Phase updated successfully" : "Phase created successfully",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: phase ? "Failed to update phase" : "Failed to create phase",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createPhaseMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{phase ? "Edit Phase" : "Add New Phase"}</DialogTitle>
          <DialogDescription>
            {phase
              ? "Update the details of this project phase."
              : "Add a new phase to organize your project timeline and materials."
            }
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
                console.error("Phase Form Invalid:", errors);
              }
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Foundation, Framing, Finishing"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this phase of the project..."
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

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select phase status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phasePercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Completion Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (phase ? "Updating..." : "Creating...") : (phase ? "Update Phase" : "Create Phase")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}