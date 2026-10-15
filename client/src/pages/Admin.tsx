/**
 * @file Admin.tsx
 * @description Admin Dashboard for User Management and Emission Datasets.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useError } from "@/hooks/use-error";
import { CheckCircle, XCircle, Clock, Users, UserCheck, UserX, ArrowLeft, Plus, Upload, Loader2, RefreshCw, Database } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import Sidebar from "@/components/Layout/Sidebar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: "admin" | "estimator" | "viewer";
  status: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function Admin() {
  const { toast } = useToast();
  const { showError } = useError();
  const queryClient = useQueryClient();
  const [isCreateDatasetOpen, setIsCreateDatasetOpen] = useState(false);
  const [isAddFactorOpen, setIsAddFactorOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  // --- Users Query ---
  const { data: pendingUsers = [], isLoading: isPendingLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/pending-users"],
  });

  const { data: allUsers = [], isLoading: isAllUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/all-users"],
  });

  // --- Datasets Query ---
  const { data: datasets = [], isLoading: isDatasetsLoading } = useQuery<any[]>({
    queryKey: ["/api/datasets"],
  });

  // --- EPD Sync Status Query ---
  const { data: epdSyncStatus } = useQuery<{ configured: boolean; message: string }>({
    queryKey: ["/api/admin/sync-epd/status"],
  });
  const [epdSyncResult, setEpdSyncResult] = useState<{ message: string; inserted: number; updated: number; skipped: number; errors: string[] } | null>(null);

  // --- EPD Sync Mutation ---
  const epdSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/sync-epd");
      return await res.json();
    },
    onSuccess: (data) => {
      setEpdSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      toast({ title: "EPD Sync Complete", description: data.message });
    },
    onError: (err: any) => showError({ title: "EPD Sync Failed", message: err.message, details: err })
  });

  // --- My Organization Query ---
  const { data: userOrgs = [] } = useQuery<{ id: string, name: string, role: string }[]>({
    queryKey: ["/api/user/organizations"],
  });
  const currentOrg = userOrgs.length > 0 ? userOrgs[0] : null;
  const isOrgAdmin = currentOrg?.role === 'org_admin' || currentOrg?.role === 'admin';

  // --- Organization Members Query ---
  const { data: orgMembers = [], isLoading: isMembersLoading } = useQuery<any[]>({
    queryKey: [`/api/organizations/${currentOrg?.id}/members`],
    enabled: !!currentOrg?.id
  });

  // --- Organization Factors Query ---
  const { data: orgFactors = [], isLoading: isOrgFactorsLoading } = useQuery<any[]>({
    queryKey: ["/api/organization/factors"],
  });

  // --- Add Factor Mutation ---
  const addFactorMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/organization/factors", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Factor added successfully" });
      setIsAddFactorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/organization/factors"] });
    },
    onError: (err) => showError({ title: "Error", message: "Failed to add factor", details: err })
  });

  const handleAddFactor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addFactorMutation.mutate({
      materialName: formData.get("materialName"),
      emissionFactor: formData.get("emissionFactor"),
      unit: formData.get("unit"),
      source: formData.get("source"),
    });
  };

  // --- User Mutations ---
  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/approve-user/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (error) => showError({ title: "Approval Failed", message: "Failed to approve user.", details: error }),
  });

  const rejectUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/reject-user/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User rejected successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (error) => showError({ title: "Rejection Failed", message: "Failed to reject user.", details: error }),
  });

  // --- Member Manage Mutation ---
  const addMemberMutation = useMutation({
    mutationFn: async (data: { email: string, role: string, organizationId: string }) => {
      return await apiRequest("POST", `/api/organizations/${data.organizationId}/members`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member added successfully" });
      setIsManageMembersOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrg?.id}/members`] });
    },
    onError: (err) => showError({ title: "Error", message: "Failed to add member", details: err })
  });

  const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const targetOrgId = formData.get("organizationId") as string || currentOrg?.id;

    if (!targetOrgId) {
      toast({ title: "Error", description: "No organization selected", variant: "destructive" });
      return;
    }

    addMemberMutation.mutate({
      email: formData.get("email") as string,
      role: formData.get("role") as string,
      organizationId: targetOrgId
    });
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User role updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err) => showError({ title: "Error", message: "Failed to update role", details: err })
  });

  const updateOrgRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      if (!currentOrg?.id) throw new Error("No organization selected");
      return await apiRequest("PATCH", `/api/organizations/${currentOrg.id}/members/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member role updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrg?.id}/members`] });
    },
    onError: (err) => showError({ title: "Error", message: "Failed to update role", details: err })
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentOrg?.id) throw new Error("No organization selected");
      return await apiRequest("DELETE", `/api/organizations/${currentOrg.id}/members/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member removed" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrg?.id}/members`] });
    },
    onError: (err) => showError({ title: "Error", message: "Failed to remove member", details: err })
  });

  // --- Dataset Mutations ---
  const createDatasetMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/datasets", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Dataset created successfully" });
      setIsCreateDatasetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
    },
    onError: (err) => showError({ title: "Error", message: "Failed to create dataset", details: err })
  });

  const handleCreateDataset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createDatasetMutation.mutate({
      name: formData.get("name"),
      region: formData.get("region"),
      version: formData.get("version"),
      description: formData.get("description"),
    });
  };

  const handleDatasetUpload = async (datasetId: string, file: File | null) => {
    if (!file) return;

    setIsUploading(datasetId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/datasets/${datasetId}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Upload failed");

      toast({
        title: "Import Successful",
        description: `Processed: ${data.stats.processed}, Inserted: ${data.stats.inserted}, Updated: ${data.stats.updated}`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
    } catch (err: any) {
      showError({ title: "Import Failed", message: err.message });
    } finally {
      setIsUploading(null);
      // reset file input
      const input = document.getElementById(`upload-${datasetId}`) as HTMLInputElement;
      if (input) input.value = "";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved": return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge variant="default" className="bg-purple-100 text-purple-800">Admin</Badge>;
      case "estimator": return <Badge variant="outline">Estimator</Badge>;
      case "viewer": return <Badge variant="secondary">Viewer</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  const pendingCount = pendingUsers.length;
  const approvedCount = allUsers.filter((user: User) => user.status === "approved").length;
  const rejectedCount = allUsers.filter((user: User) => user.status === "rejected").length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">
        <div className="p-3 sm:p-4 lg:p-6 overflow-y-auto">
          {/* Header with Back Navigation */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-4 mb-2">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 touch-manipulation">
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm sm:text-base text-gray-600">Manage user registrations and emission datasets</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total Users</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{allUsers.length}</p>
                  </div>
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Pending</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-yellow-600 truncate">{pendingCount}</p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-yellow-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Approved</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 truncate">{approvedCount}</p>
                  </div>
                  <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-green-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Rejected</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 truncate">{rejectedCount}</p>
                  </div>
                  <UserX className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-red-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management Tabs */}
          <Tabs defaultValue="datasets" className="space-y-6">
            <TabsList>
              <TabsTrigger value="pending">Pending Approvals ({pendingCount})</TabsTrigger>
              <TabsTrigger value="all">All Users ({allUsers.length})</TabsTrigger>
              <TabsTrigger value="datasets">Emission Datasets</TabsTrigger>
              <TabsTrigger value="organization">Organization</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Pending User Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  {isPendingLoading ? (
                    <div className="text-center py-8">Loading pending users...</div>
                  ) : pendingUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No pending user approvals</div>
                  ) : (
                    <div className="space-y-4">
                      {pendingUsers.map((user: User) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            {user.profileImageUrl && (
                              <img src={user.profileImageUrl} alt={`${user.firstName} ${user.lastName}`} className="w-10 h-10 rounded-full object-cover" />
                            )}
                            <div>
                              <div className="font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                {getRoleBadge(user.role)}
                                {getStatusBadge(user.status)}
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="default" size="sm" onClick={() => approveUserMutation.mutate(user.id)} disabled={approveUserMutation.isPending} className="bg-green-600 hover:bg-green-700">
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => rejectUserMutation.mutate(user.id)} disabled={rejectUserMutation.isPending}>
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                </CardHeader>
                <CardContent>
                  {isAllUsersLoading ? (
                    <div className="text-center py-8">Loading users...</div>
                  ) : (
                    <div className="space-y-4">
                      {allUsers.map((user: User) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            {user.profileImageUrl ? (
                              <img src={user.profileImageUrl} alt={`${user.firstName} ${user.lastName}`} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <select
                                  value={user.role}
                                  onChange={(e) => updateRoleMutation.mutate({ userId: user.id, role: e.target.value })}
                                  className="text-xs border rounded px-1 bg-white"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="estimator">Estimator</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                {getStatusBadge(user.status)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Joined: {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="datasets">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Emission Datasets</CardTitle>
                  <Button size="sm" onClick={() => setIsCreateDatasetOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Dataset
                  </Button>
                </CardHeader>
                <CardContent>
                  {isDatasetsLoading ? (
                    <div className="text-center py-8">Loading datasets...</div>
                  ) : datasets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No emission datasets found. Create one to get started.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {datasets.map((ds: any) => (
                        <div key={ds.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{ds.name}</span>
                              <Badge variant="outline">{ds.region}</Badge>
                              {ds.isDefault && <Badge variant="secondary">Default</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {ds.description} • v{ds.version}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {ds.materialCount || 0} materials linked
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id={`upload-${ds.id}`}
                              className="hidden"
                              accept=".csv,.xlsx"
                              onChange={(e) => handleDatasetUpload(ds.id, e.target.files?.[0] || null)}
                              disabled={isUploading === ds.id}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUploading === ds.id}
                              onClick={() => document.getElementById(`upload-${ds.id}`)?.click()}
                            >
                              {isUploading === ds.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              Import CSV
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* EPD Sync Card */}
              <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-base">EPD Data Sync</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Mirror approved GWP factors from the EPD Extractor database (read-only)
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => epdSyncMutation.mutate()}
                    disabled={epdSyncMutation.isPending || !epdSyncStatus?.configured}
                    className="min-w-[120px]"
                  >
                    {epdSyncMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now</>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className={`flex items-center gap-2 text-sm p-3 rounded-lg mb-3 ${epdSyncStatus?.configured
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                    {epdSyncStatus?.configured
                      ? <CheckCircle className="h-4 w-4 shrink-0" />
                      : <Clock className="h-4 w-4 shrink-0" />
                    }
                    <span>{epdSyncStatus?.message ?? "Checking connection..."}</span>
                  </div>

                  {epdSyncResult && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border text-sm space-y-2">
                      <p className="font-medium text-gray-700">{epdSyncResult.message}</p>
                      <div className="flex gap-4 text-xs">
                        <span className="text-green-600">✓ {epdSyncResult.inserted} inserted</span>
                        <span className="text-blue-600">↻ {epdSyncResult.updated} updated</span>
                        <span className="text-gray-500">— {epdSyncResult.skipped} skipped</span>
                        {epdSyncResult.errors.length > 0 && (
                          <span className="text-red-500">✗ {epdSyncResult.errors.length} errors</span>
                        )}
                      </div>
                      {epdSyncResult.errors.length > 0 && (
                        <ul className="text-xs text-red-600 list-disc list-inside mt-1 max-h-24 overflow-y-auto">
                          {epdSyncResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {!epdSyncStatus?.configured && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Set <code className="bg-gray-100 px-1 rounded">EPD_DATABASE_URL</code> in your environment variables to enable sync.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="organization">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>My Organization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Details</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">{currentOrg?.name || "Loading..."}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Industry</span>
                          <span>Climate Tech</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Country</span>
                          <span>Global</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Your Role</span>
                          <Badge variant="secondary">Admin</Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">Members</h3>
                      {orgMembers.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {orgMembers.map(m => (
                            <div key={m.id} className="flex justify-between items-center text-xs border p-2 rounded bg-white">
                              <div className="flex flex-col">
                                <span>{m.firstName} {m.lastName}</span>
                                <span className="text-muted-foreground">{m.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={m.orgRole}
                                  onChange={(e) => updateOrgRoleMutation.mutate({ userId: m.id, role: e.target.value })}
                                  className="text-[10px] border rounded px-1 bg-white h-6"
                                >
                                  <option value="org_admin">Org Admin</option>
                                  <option value="estimator">Estimator</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => removeMemberMutation.mutate(m.id)}
                                >
                                  <UserX className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" className="w-full" onClick={() => setIsManageMembersOpen(true)} disabled={!currentOrg}>
                        <Users className="w-4 h-4 mr-2" />
                        Manage Members
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Organization Emission Factors</CardTitle>
                  <Button size="sm" onClick={() => setIsAddFactorOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom Factor
                  </Button>
                </CardHeader>
                <CardContent>
                  {isOrgFactorsLoading ? (
                    <div className="text-center py-8">Loading factors...</div>
                  ) : orgFactors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No custom factors yet. Add one to override platform defaults.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orgFactors.map((factor: any) => (
                        <div key={factor.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <div className="font-medium">{factor.materialName}</div>
                            <div className="text-sm text-muted-foreground">{factor.source}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              {factor.emissionFactor} <span className="text-xs font-normal text-muted-foreground">kgCO2e/{factor.unit}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">Org Override</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isCreateDatasetOpen} onOpenChange={setIsCreateDatasetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Dataset</DialogTitle>
            <DialogDescription>
              Define a container for emission factors (e.g., ICE v3, India BEI).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDataset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Dataset Name</Label>
              <Input id="name" name="name" placeholder="e.g. ICE v3 (2019)" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input id="region" name="region" placeholder="Global / India" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input id="version" name="version" placeholder="1.0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Short description..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateDatasetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createDatasetMutation.isPending}>
                {createDatasetMutation.isPending ? "Creating..." : "Create Dataset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
        <Dialog open={isAddFactorOpen} onOpenChange={setIsAddFactorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Emission Factor</DialogTitle>
              <DialogDescription>
                This factor will override platform defaults for your organization.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddFactor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="materialName">Material Name</Label>
                <Input id="materialName" name="materialName" placeholder="e.g. Concrete M25" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emissionFactor">Emission Factor</Label>
                  <Input id="emissionFactor" name="emissionFactor" type="number" step="0.001" placeholder="0.0" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" name="unit" placeholder="kg/m3" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source / Reference</Label>
                <Input id="source" name="source" placeholder="e.g. Supplier EPD (2024)" />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsAddFactorOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addFactorMutation.isPending}>
                  {addFactorMutation.isPending ? "Adding..." : "Add Factor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isManageMembersOpen} onOpenChange={setIsManageMembersOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Member to Organization</DialogTitle>
              <DialogDescription>
                Add an existing user to an organization. They must already be registered on the platform.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationId">Target Organization</Label>
                <select
                  id="organizationId"
                  name="organizationId"
                  defaultValue={currentOrg?.id}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select Organization</option>
                  {userOrgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">User Email</Label>
                <Input id="email" name="email" type="email" placeholder="colleague@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Org Role</Label>
                <select id="role" name="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="viewer">Viewer</option>
                  <option value="estimator">Estimator</option>
                  <option value="org_admin">Organization Admin</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsManageMembersOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addMemberMutation.isPending}>
                  {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Dialog>
    </div>
  );
}