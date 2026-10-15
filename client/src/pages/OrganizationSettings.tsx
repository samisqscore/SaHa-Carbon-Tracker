import React, { useEffect, useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Users, UserX, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const organizationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    industry: z.string().min(1, "Industry is required"),
    country: z.string().min(1, "Country is required"),
});

type OrganizationValues = z.infer<typeof organizationSchema>;

export default function OrganizationSettings() {
    const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [isAddFactorOpen, setIsAddFactorOpen] = useState(false);

    // --- Organization Members Query ---
    const { data: orgMembers = [], isLoading: isMembersLoading } = useQuery<any[]>({
        queryKey: [`/api/organizations/${currentOrganization?.id}/members`],
        enabled: !!currentOrganization?.id
    });

    // --- Organization Factors Query ---
    const { data: orgFactors = [], isLoading: isOrgFactorsLoading } = useQuery<any[]>({
        queryKey: ["/api/organization/factors"],
        enabled: !!currentOrganization?.id
    });

    const form = useForm<OrganizationValues>({
        resolver: zodResolver(organizationSchema),
        defaultValues: {
            name: "",
            industry: "",
            country: "",
        },
    });

    // Load current organization data into form
    useEffect(() => {
        if (currentOrganization) {
            form.reset({
                name: currentOrganization.name,
                industry: currentOrganization.industry || "",
                country: currentOrganization.country || "",
            });
        }
    }, [currentOrganization, form]);

    const updateMutation = useMutation({
        mutationFn: async (values: OrganizationValues) => {
            if (!currentOrganization) throw new Error("No active organization");
            const res = await apiRequest("PUT", `/api/organizations/${currentOrganization.id}`, values);
            return res.json();
        },
        onSuccess: (updatedOrg) => {
            toast({
                title: "Organization updated",
                description: "Your organization details have been saved.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/user/organizations"] });
        },
        onError: (error: any) => {
            toast({
                title: "Update failed",
                description: error.message || "Could not update organization details",
                variant: "destructive",
            });
        },
    });

    // --- Member Mutations ---
    const addMemberMutation = useMutation({
        mutationFn: async (data: { email: string, role: string, organizationId: string }) => {
            return await apiRequest("POST", `/api/organizations/${data.organizationId}/members`, data);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Member added successfully" });
            setIsManageMembersOpen(false);
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrganization?.id}/members`] });
        },
        onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to add member", variant: "destructive" })
    });

    const updateOrgRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
            if (!currentOrganization?.id) throw new Error("No organization selected");
            return await apiRequest("PATCH", `/api/organizations/${currentOrganization.id}/members/${userId}/role`, { role });
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Member role updated" });
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrganization?.id}/members`] });
        },
        onError: (err: any) => toast({ title: "Error", description: "Failed to update role", variant: "destructive" })
    });

    const removeMemberMutation = useMutation({
        mutationFn: async (userId: string) => {
            if (!currentOrganization?.id) throw new Error("No organization selected");
            return await apiRequest("DELETE", `/api/organizations/${currentOrganization.id}/members/${userId}`);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Member removed" });
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrganization?.id}/members`] });
        },
        onError: (err: any) => toast({ title: "Error", description: "Failed to remove member", variant: "destructive" })
    });

    // --- Factor Mutation ---
    const addFactorMutation = useMutation({
        mutationFn: async (data: any) => {
            return await apiRequest("POST", "/api/organization/factors", data);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Factor added successfully" });
            setIsAddFactorOpen(false);
            queryClient.invalidateQueries({ queryKey: ["/api/organization/factors"] });
        },
        onError: (err: any) => toast({ title: "Error", description: "Failed to add factor", variant: "destructive" })
    });


    const onSubmit = (values: OrganizationValues) => {
        updateMutation.mutate(values);
    };

    const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        if (!currentOrganization) return;

        addMemberMutation.mutate({
            email: formData.get("email") as string,
            role: formData.get("role") as string,
            organizationId: currentOrganization.id
        });
    };

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

    if (isOrgLoading) return <div>Loading organization details...</div>;

    if (!currentOrganization) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <h2 className="text-xl font-semibold mb-2">No Active Organization</h2>
                <p className="text-gray-500">Please select an organization to view settings.</p>
            </div>
        );
    }

    const isOrgAdmin = currentOrganization.role === 'org_admin' || user?.role === 'admin'; // Allow platform admin too

    if (!isOrgAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
                <p className="text-gray-500">You do not have permission to edit organization settings.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Organization Dashboard</h1>
                    <p className="text-muted-foreground">Manage {currentOrganization.name}</p>
                </div>
            </div>

            <Tabs defaultValue="details" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="details">General Details</TabsTrigger>
                    <TabsTrigger value="members">Team Members</TabsTrigger>
                    <TabsTrigger value="factors">Emission Factors</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Information</CardTitle>
                            <CardDescription>
                                Update your organization's public profile and details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Organization Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Acme Inc." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="industry"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Industry</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Construction" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="country"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Country / Region</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="United States" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="flex justify-end">
                                        <Button type="submit" disabled={updateMutation.isPending}>
                                            {updateMutation.isPending ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="members">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Team Members</CardTitle>
                                <CardDescription>Manage access to your organization.</CardDescription>
                            </div>
                            <Button onClick={() => setIsManageMembersOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Member
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isMembersLoading ? (
                                <div className="text-center py-8">Loading members...</div>
                            ) : (
                                <div className="space-y-4">
                                    {orgMembers.map((m) => (
                                        <div key={m.id} className="flex justify-between items-center p-4 border rounded-lg bg-white">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {m.firstName?.[0]}{m.lastName?.[0] || m.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{m.firstName} {m.lastName}</div>
                                                    <div className="text-sm text-muted-foreground">{m.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <select
                                                    value={m.orgRole}
                                                    onChange={(e) => updateOrgRoleMutation.mutate({ userId: m.id, role: e.target.value })}
                                                    className="text-sm border rounded px-2 py-1 bg-white h-8"
                                                >
                                                    <option value="org_admin">Org Admin</option>
                                                    <option value="estimator">Estimator</option>
                                                    <option value="viewer">Viewer</option>
                                                </select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => removeMemberMutation.mutate(m.id)}
                                                >
                                                    <UserX className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="factors">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Custom Emission Factors</CardTitle>
                                <CardDescription>Override platform defaults with organization-specific factors.</CardDescription>
                            </div>
                            <Button onClick={() => setIsAddFactorOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Factor
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
                                <div className="space-y-3">
                                    {orgFactors.map((factor: any) => (
                                        <div key={factor.id} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div>
                                                <div className="font-medium">{factor.materialName}</div>
                                                <div className="text-sm text-muted-foreground">{factor.source}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">
                                                    {factor.emissionFactor} <span className="text-sm font-normal text-muted-foreground">kgCO2e/{factor.unit}</span>
                                                </div>
                                                <Badge variant="outline">Org Override</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <Dialog open={isManageMembersOpen} onOpenChange={setIsManageMembersOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Member to Organization</DialogTitle>
                        <DialogDescription>
                            Add an existing user to {currentOrganization.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddMember} className="space-y-4">
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

            <Dialog open={isAddFactorOpen} onOpenChange={setIsAddFactorOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Custom Emission Factor</DialogTitle>
                        <DialogDescription>
                            This factor will override platform defaults for {currentOrganization.name}.
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
        </div>
    );
}
