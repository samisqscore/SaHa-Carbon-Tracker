/**
 * @file Projects.tsx
 * @description Projects Listing Page.
 * Displays a grid of all projects belonging to the user, with Create/Edit/Delete capabilities.
 * 
 * @functionality
 * - List View: Grid of project cards with status badges and key metrics.
 * - Navigation: Click card to view details (implemented via Links).
 * - CRUD: 'New Project' dialog, 'Edit' dialog, and 'Delete' confirmation.
 * - Search/Filter: (Implicit via backend query defaults).
 * 
 * @dependencies
 * - @tanstack/react-query: Fetches project list.
 * - ProjectDialog: Modal for creating/editing projects.
 * - wouter: Routing for navigation.
 * 
 * @breaking-changes
 * - Card Click Behavior: Entire card is clickable; action buttons use stopPropagation.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useError } from "@/hooks/use-error";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building, MapPin, Calendar, Trash2, Edit, Eye } from "lucide-react";
import { Link } from "wouter";
import ProjectDialog from "@/components/Projects/ProjectDialog";
import type { Project } from "@shared/schema";

export default function Projects() {
  const { toast } = useToast();
  const { showError } = useError();
  const { isAuthenticated, isLoading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      showError({
        title: "Unauthorized",
        message: "You are logged out. Redirecting to login...",
        details: "Session expired or invalid."
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, showError]);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
  });

  const { data: orgSummary } = useQuery<any>({
    queryKey: ['/api/reports/organization/summary'],
    enabled: isAuthenticated,
  });

  const projectEmissionsMap = orgSummary?.projects?.reduce((acc: any, curr: any) => {
    acc[curr.projectId] = curr.totalEmissions;
    return acc;
  }, {}) || {};

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        showError({
          title: "Unauthorized",
          message: "You are logged out. Redirecting to login...",
          details: error
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      showError({
        title: "Deletion Failed",
        message: "Failed to delete project.",
        details: error
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'planning': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleDelete = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProject(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex-1 lg:ml-0">
        <Header
          title="Projects"
          subtitle="Manage your construction projects and track emissions"
          action={
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          }
        />

        <div className="p-4 lg:p-6">
          {projectsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project: Project) => (
                <Card
                  key={project.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer relative group"
                  onClick={() => window.location.href = `/projects/${project.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Building className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                            {project.name}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{project.type}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Link href={`/projects/${project.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Manage Project"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete Project"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        {project.location ?? ''}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className={getStatusColor(project.status ?? '')}>
                          {project.status}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {project.createdAt ? new Date(project.createdAt as unknown as string).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="text-sm">
                          <span className="text-gray-500">Emissions: </span>
                          <span className="font-semibold text-gray-900">
                            {projectEmissionsMap[project.id] > 0
                              ? `${(projectEmissionsMap[project.id] >= 1000 ? (projectEmissionsMap[project.id] / 1000).toFixed(2) + ' t' : projectEmissionsMap[project.id].toFixed(2) + ' kg')} CO₂e`
                              : '0 kg CO₂e'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Building className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
                <p className="text-gray-600 text-center mb-6 max-w-md">
                  Get started by creating your first construction project to track carbon emissions.
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Project
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <ProjectDialog
        open={isDialogOpen}
        onOpenChange={handleCloseDialog}
        project={editingProject}
      />
    </div>
  );
}
