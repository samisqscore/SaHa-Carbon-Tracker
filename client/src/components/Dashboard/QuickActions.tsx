/**
 * @file QuickActions.tsx
 * @description Dashboard widget for frequent user actions.
 * Provides shortcuts to create projects, add materials, or generate reports.
 * 
 * @functionality
 * - Navigation/Modals: Opens ProjectDialog or MaterialDialog.
 * - Role-Based Access: Disables 'Add Material' for non-privileged users.
 * - Placeholders: 'Generate Report' is currently a toast notification.
 * 
 * @dependencies
 * - ProjectDialog, MaterialDialog: Modal components.
 * - useAuth: For permission checks.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProjectDialog from "@/components/Projects/ProjectDialog";
import MaterialDialog from "@/components/Materials/MaterialDialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { downloadProjectReport } from "@/lib/report-utils";
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
import { Loader2 } from "lucide-react";

export default function QuickActions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: reportDialogOpen,
  });

  const handleGenerateReport = async () => {
    if (!selectedProjectId) return;

    const project = projects?.find(p => p.id === selectedProjectId);
    if (!project) return;

    try {
      setIsGenerating(true);
      await downloadProjectReport(project.id, project.name);
      setReportDialogOpen(false);
      setSelectedProjectId("");
    } catch (err) {
      // Error handled in utility
    } finally {
      setIsGenerating(false);
    }
  };

  const canAddMaterials = user?.role === 'admin' || user?.role === 'estimator';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <Button
              variant="outline"
              className="flex items-center p-6 h-auto border-2 hover:border-blue-500 hover:bg-blue-50 transition-colors"
              onClick={() => setProjectDialogOpen(true)}
            >
              <div className="bg-blue-100 p-3 rounded-lg mr-4 flex-shrink-0">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-gray-900">New Project</p>
                <p className="text-xs text-gray-500">Create a new construction project</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className={`flex items-center p-6 h-auto border-2 transition-colors ${canAddMaterials
                ? 'hover:border-green-500 hover:bg-green-50'
                : 'opacity-50 cursor-not-allowed'
                }`}
              onClick={() => canAddMaterials && setMaterialDialogOpen(true)}
              disabled={!canAddMaterials}
            >
              <div className="bg-green-100 p-3 rounded-lg mr-4 flex-shrink-0">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-gray-900">Add Material</p>
                <p className="text-xs text-gray-500">Add new material to catalog</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex items-center p-6 h-auto border-2 hover:border-orange-500 hover:bg-orange-50 transition-colors"
              onClick={() => setReportDialogOpen(true)}
            >
              <div className="bg-orange-100 p-3 rounded-lg mr-4 flex-shrink-0">
                <FileDown className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-gray-900">Generate Report</p>
                <p className="text-xs text-gray-500">Export emissions report</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
      />

      {canAddMaterials && (
        <MaterialDialog
          open={materialDialogOpen}
          onOpenChange={setMaterialDialogOpen}
        />
      )}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Project for Report</DialogTitle>
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
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerateReport} disabled={!selectedProjectId || isGenerating}>
              {isGenerating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
