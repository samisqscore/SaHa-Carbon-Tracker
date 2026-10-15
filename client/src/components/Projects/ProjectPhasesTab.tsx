/**
 * @file ProjectPhasesTab.tsx
 * @description Dashboard tab for managing the Project Lifecycle/Timeline.
 * 
 * @functionality
 * - Phase Management: List, Add, Edit, Delete phases.
 * - progress Tracking: Visual progress bars for individual phases and overall project (averaged).
 * - Timeline: Displays start/end dates for each phase.
 * - Visualization: Status color coding (planned/active/completed).
 * 
 * @dependencies
 * - ProjectPhaseDialog: Form for phase manipulation.
 * - API: `/api/projects/:id/phases`.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, Percent, Edit, Trash2, CheckCircle2, GripVertical, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProjectPhase } from "@shared/schema";
import ProjectPhaseDialog from "./ProjectPhaseDialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProjectPhasesTabProps {
  projectId: string;
}

// Sub-component for Sortable Item
function SortablePhaseCard({
  phase,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusBadgeVariant,
  formatDate
}: {
  phase: ProjectPhase,
  onEdit: (p: ProjectPhase) => void,
  onDelete: (id: string) => void,
  getStatusColor: (s: string | null) => string,
  getStatusBadgeVariant: (s: string | null) => any,
  formatDate: (d: Date | null) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <Card className="relative">
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getStatusColor(phase.status)}`} />

        <CardHeader className="pb-3 pl-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Drag Handle */}
              <div {...attributes} {...listeners} className="cursor-grab hover:text-primary -ml-2 p-1">
                <GripVertical className="h-5 w-5 text-muted-foreground/50" />
              </div>

              <div>
                <CardTitle className="text-lg">{phase.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getStatusBadgeVariant(phase.status)}>
                    {phase.status || "planned"}
                  </Badge>
                  {phase.phasePercentage !== null && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {phase.phasePercentage}% complete
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(phase)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(phase.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pl-6">
          <div className="space-y-4">
            {phase.description && (
              <p className="text-sm text-muted-foreground">
                {phase.description}
              </p>
            )}

            {/* Progress Bar */}
            {phase.phasePercentage !== null && (
              <div className="space-y-1">
                <Progress value={phase.phasePercentage} className="h-2" />
              </div>
            )}

            {/* Timeline */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Start Date:</span>
                  <span className="ml-1 font-medium">{formatDate(phase.startDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">End Date:</span>
                  <span className="ml-1 font-medium">{formatDate(phase.endDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProjectPhasesTab({ projectId }: ProjectPhasesTabProps) {
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ProjectPhase[]>([]);

  const { data: phases = [], isLoading } = useQuery<ProjectPhase[]>({
    queryKey: ["/api/projects", projectId, "phases"],
    enabled: !!projectId,
  });

  // Sync items with phases when fetched
  useEffect(() => {
    if (phases.length > 0) {
      setItems(phases);
    }
  }, [phases]);

  // Use local items for rendering if available (optimistic UI), else server data
  // But strictly we should use 'items' and ensure it's synced.
  // The 'phases' from query are sorted by orderIndex from server.
  // When dragging, we modify 'items'.
  const sortedPhases = items.length > 0 ? items : phases;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reorderMutation = useMutation({
    mutationFn: async (newPhases: ProjectPhase[]) => {
      const payload = {
        phases: newPhases.map((p, index) => ({
          id: p.id,
          orderIndex: index
        }))
      };
      // Correct signature: method, url, data
      await apiRequest("PATCH", `/api/projects/${projectId}/phases/reorder`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "phases"] });
      toast({
        title: "Success",
        description: "Phase order updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update phase order",
        variant: "destructive",
      });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((prevItems) => {
        const oldIndex = prevItems.findIndex((item) => item.id === active.id);
        const newIndex = prevItems.findIndex((item) => item.id === over?.id);
        const newOrder = arrayMove(prevItems, oldIndex, newIndex);

        // Trigger API update
        reorderMutation.mutate(newOrder);

        return newOrder;
      });
    }
  };

  const deletePhaseMutation = useMutation({
    mutationFn: async (phaseId: string) => {
      // Correct signature: method, url
      await apiRequest("DELETE", `/api/projects/${projectId}/phases/${phaseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "phases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Success",
        description: "Phase deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete phase",
        variant: "destructive",
      });
    },
  });

  const handleEditPhase = (phase: ProjectPhase) => {
    setSelectedPhase(phase);
    setIsDialogOpen(true);
  };

  const handleDeletePhase = async (phaseId: string) => {
    if (confirm("Are you sure you want to delete this phase?")) {
      await deletePhaseMutation.mutateAsync(phaseId);
    }
  };

  const handleAddPhase = () => {
    setSelectedPhase(undefined);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedPhase(undefined);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "planned":
        return "bg-gray-400";
      default:
        return "bg-gray-300";
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "active":
        return "default";
      case "completed":
        return "secondary";
      case "planned":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

  const calculateOverallProgress = () => {
    if (phases.length === 0) return 0;
    const totalProgress = phases.reduce((sum, phase) => sum + (phase.phasePercentage || 0), 0);
    return Math.round(totalProgress / phases.length);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Project Phases</h2>
          <p className="text-muted-foreground">
            Organize your project timeline and track progress by phases
          </p>
        </div>
        <Button onClick={handleAddPhase}>
          <Plus className="h-4 w-4 mr-2" />
          Add Phase
        </Button>
      </div>

      <Alert className="bg-slate-50 border-slate-200 text-slate-700">
        <AlertDescription className="flex items-center gap-2">
          <Info className="h-4 w-4 text-slate-500" />
          Auto-generated default phases are provided. Customise as needed.
        </AlertDescription>
      </Alert>

      {/* Overall Progress */}
      {phases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Overall Progress
            </CardTitle>
            <CardDescription>
              Average completion across all project phases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Progress</span>
                <span className="font-medium">{calculateOverallProgress()}%</span>
              </div>
              <Progress value={calculateOverallProgress()} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phases List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedPhases.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedPhases.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Phases Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Break down your project into manageable phases to track progress and organize materials.
                  </p>
                  <Button onClick={handleAddPhase}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Phase
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedPhases.map((phase) => (
                <SortablePhaseCard
                  key={phase.id}
                  phase={phase}
                  onEdit={handleEditPhase}
                  onDelete={handleDeletePhase}
                  getStatusColor={getStatusColor}
                  getStatusBadgeVariant={getStatusBadgeVariant}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {/* Dialog */}
      <ProjectPhaseDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        projectId={projectId}
        phase={selectedPhase}
        onSuccess={handleDialogClose}
      />
    </div>
  );
}