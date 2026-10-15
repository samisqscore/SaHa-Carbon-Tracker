/**
 * @file RecentProjects.tsx
 * @description Dashboard widget listing the most recently active projects.
 * 
 * @functionality
 * - List View: Displays top 5 recent projects in a table.
 * - Quick Actions: View details (Link) or Edit (Modal) directly from table.
 * 
 * @dependencies
 * - React Query: Fetches all projects (client-side slicing).
 * - ProjectDialog: For editing projects.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building, Home, Factory, Eye, Edit, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { Project } from "@shared/schema";
import ProjectDialog from "@/components/Projects/ProjectDialog";

export default function RecentProjects() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setIsDialogOpen(true);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'planning': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'residential building':
      case 'residential':
        return <Home className="h-5 w-5 text-green-600" />;
      case 'industrial building':
      case 'industrial':
        return <Factory className="h-5 w-5 text-red-600" />;
      default:
        return <Building className="h-5 w-5 text-blue-600" />;
    }
  };

  const getIconBgColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'residential building':
      case 'residential':
        return 'bg-green-100';
      case 'industrial building':
      case 'industrial':
        return 'bg-red-100';
      default:
        return 'bg-blue-100';
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    const now = new Date();
    const projectDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - projectDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return projectDate.toLocaleDateString();
  };

  // Show only the 5 most recent projects
  const recentProjects = projects?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 animate-pulse">
                <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Projects</CardTitle>
          <Link href="/projects">
            <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {recentProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProjects.map((project: Project) => (
                  <TableRow key={project.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${getIconBgColor(project.type)}`}>
                          {getProjectIcon(project.type)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-sm text-gray-600">{project.type}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-gray-700">{project.location}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.status ?? '')}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-gray-600">{formatDate(project.updatedAt)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-blue-600">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-blue-600"
                          onClick={() => handleEdit(project)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600">
              Create your first project to see it appear here.
            </p>
          </div>
        )}
      </CardContent>

      <ProjectDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        project={selectedProject}
      />
    </Card>
  );
}
