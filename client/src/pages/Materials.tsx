/**
 * @file Materials.tsx
 * @description Material Catalog Page.
 * Manages the library of construction materials and their associated emission factors.
 * 
 * @functionality
 * - Material Grid: Displays cards for each material with category colors and emission details.
 * - CRUD: 'Add Material' dialog, 'Edit' action, and 'Delete' confirmation.
 * - Role Checks: Reduces functionality for non-admin/non-estimator users.
 * 
 * @dependencies
 * - @tanstack/react-query: Fetches material catalog.
 * - MaterialDialog: Modal for creating/editing materials.
 * - useAuth: Permissions handling.
 * 
 * @breaking-changes
 * - Category Colors: Hardcoded color mapping for categories; adding new categories requires updating `getCategoryColor`.
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
import { Plus, Package, Trash2, Edit } from "lucide-react";
import MaterialDialog from "@/components/Materials/MaterialDialog";
import type { EmissionFactor } from "@shared/schema";

export default function Materials() {
  const { toast } = useToast();
  const { showError } = useError();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<EmissionFactor | null>(null);

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

  const { data: materials, isLoading: materialsLoading } = useQuery<EmissionFactor[]>({
    queryKey: ['/api/materials'],
    enabled: isAuthenticated,
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      await apiRequest('DELETE', `/api/materials/${materialId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      toast({
        title: "Success",
        description: "Material deleted successfully",
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
        message: "Failed to delete material.",
        details: error
      });
    },
  });

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Concrete': 'bg-blue-100 text-blue-800',
      'Steel': 'bg-gray-100 text-gray-800',
      'Timber': 'bg-green-100 text-green-800',
      'Insulation': 'bg-yellow-100 text-yellow-800',
      'Other': 'bg-purple-100 text-purple-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const handleEdit = (material: EmissionFactor) => {
    setEditingMaterial(material);
    setIsDialogOpen(true);
  };

  const handleDelete = (materialId: string) => {
    if (confirm('Are you sure you want to delete this material?')) {
      deleteMaterialMutation.mutate(materialId);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMaterial(null);
  };

  const canModify = user?.role === 'admin' || user?.role === 'estimator';
  const canDelete = user?.role === 'admin';

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
          title="Material Catalog"
          subtitle="Manage construction materials and their emission factors"
          action={
            canModify ? (
              <Button onClick={() => setIsDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            ) : undefined
          }
        />

        <div className="p-4 lg:p-6">
          {materialsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
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
          ) : materials && materials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.map((material: EmissionFactor) => (
                <Card key={material.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Package className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{material.materialName}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge className={getCategoryColor(material.materialCategory || "Other")}>
                              {material.materialCategory || "Other"}
                            </Badge>
                            <span className="text-xs text-gray-400 font-mono">
                              Source: {material.sourceReference || "Global"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {(canModify || canDelete) && (
                        <div className="flex space-x-1">
                          {canModify && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(material)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(material.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Emission Factor:</span>
                        <span className="font-semibold">{material.emissionFactor} kgCO₂e/{material.unit}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Unit:</span>
                        <span className="font-medium">{material.unit}</span>
                      </div>
                      {material.sourceReference && (
                        <div className="text-xs text-gray-500 border-t pt-2">
                          Source: {material.sourceReference}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Package className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No materials yet</h3>
                <p className="text-gray-600 text-center mb-6 max-w-md">
                  Start building your material catalog by adding construction materials with their emission factors.
                </p>
                {canModify && (
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Material
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {canModify && (
        <MaterialDialog
          open={isDialogOpen}
          onOpenChange={handleCloseDialog}
          material={editingMaterial}
        />
      )}
    </div>
  );
}
