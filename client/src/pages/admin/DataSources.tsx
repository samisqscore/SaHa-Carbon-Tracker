/**
 * @file DataSources.tsx
 * @description Admin page for managing emission data sources and datasets.
 * Provides a split view for Global (platform) and Private (organization) datasets.
 * 
 * @functionality
 * - Dataset Listing: Displays datasets categorized by scope and status.
 * - Multi-tenancy: Filters datasets based on user organisation membership.
 * - Creation: Allows Org Admins and System Admins to initialize new datasets.
 * - Lifecycle Visibility: Visual cues/tooltips for status (Archived, Draft) and environment (Test/Prod).
 * 
 * @dependencies
 * - @tanstack/react-query: For fetching and caching dataset collections.
 * - @/components/ui: Shadcn components for tables, badges, and tooltips.
 * - useAuth: For determining user roles and tenant organization.
 * 
 * @breaking-changes
 * - Tab Navigation: The "Global" vs "My Organization" logic assumes precise organizational tagging.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Loader2, Plus, Database, Globe, Lock, ArrowLeft,
    AlertTriangle, Calendar, CheckCircle2, Archive, Beaker, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";

type Dataset = {
    id: string;
    name: string;
    region: string;
    description: string;
    isDefault: boolean;
    organizationId: string | null;
    status: "draft" | "active" | "archived";
    environment: "production" | "test";
    validityStart: string;
    validityEnd: string | null;
    activeFactorCount: number;
    createdAt: string;
    isExpiringSoon?: boolean;
    isExpired?: boolean;
};

export default function DataSources() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newDataset, setNewDataset] = useState({
        name: "", region: "Global", description: "", environment: "production"
    });

    const { data: datasets, isLoading } = useQuery<Dataset[]>({
        queryKey: ["/api/datasets"],
    });

    const handleCreate = async () => {
        try {
            const res = await apiRequest("POST", "/api/datasets", newDataset);

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || "Failed to create dataset");
            }

            toast({ title: "Success", description: "Draft dataset created successfully" });
            setIsCreateOpen(false);
            setNewDataset({ name: "", region: "Global", description: "", environment: "production" });
            queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to create dataset",
                variant: "destructive"
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const orgDatasets = datasets?.filter(d => d.organizationId !== null) || [];
    const globalDatasets = datasets?.filter(d => d.organizationId === null) || [];

    const DatasetTable = ({ data, isOrgTab }: { data: Dataset[], isOrgTab?: boolean }) => (
        <TooltipProvider>
            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Validity</TableHead>
                            <TableHead>Factors</TableHead>
                            <TableHead>Region</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                                    No datasets found in this category.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((ds) => (
                                <Tooltip key={ds.id}>
                                    <TooltipTrigger asChild>
                                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => {
                                            window.location.href = `/admin/data-sources/${ds.id}`
                                        }}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Database className="w-4 h-4 text-primary" />
                                                        {ds.name}
                                                        {ds.isDefault && <Badge variant="secondary" className="text-[10px] h-4">Default</Badge>}
                                                        {isOrgTab && <Info size={12} className="text-muted-foreground animate-pulse" />}
                                                    </div>
                                                    {ds.isExpiringSoon && (
                                                        <span className="text-[10px] text-amber-600 flex items-center gap-1 mt-1 font-bold">
                                                            <AlertTriangle size={10} /> Expiring Soon
                                                        </span>
                                                    )}
                                                    {ds.isExpired && (
                                                        <span className="text-[10px] text-red-600 flex items-center gap-1 mt-1 font-bold">
                                                            <AlertTriangle size={10} /> Expired
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {ds.environment === 'test' ? (
                                                    <Badge variant="outline" className="gap-1 border-purple-200 bg-purple-50 text-purple-700">
                                                        <Beaker size={12} /> Test
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
                                                        <Globe size={12} /> Production
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {ds.status === 'active' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1"><CheckCircle2 size={12} /> Active</Badge>}
                                                {ds.status === 'draft' && <Badge variant="secondary" className="gap-1"><Plus size={12} /> Draft</Badge>}
                                                {ds.status === 'archived' && <Badge variant="outline" className="bg-gray-100 text-gray-500 gap-1"><Archive size={12} /> Archived</Badge>}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(ds.validityStart).toLocaleDateString()}
                                                    {ds.validityEnd ? ` - ${new Date(ds.validityEnd).toLocaleDateString()}` : " (No Expiry)"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {ds.activeFactorCount?.toLocaleString() || 0}
                                            </TableCell>
                                            <TableCell className="text-sm">{ds.region}</TableCell>
                                        </TableRow>
                                    </TooltipTrigger>
                                    {isOrgTab && (
                                        <TooltipContent className="max-w-xs p-3 space-y-2">
                                            <p className="font-bold text-sm">Organization Dataset Control</p>
                                            <p className="text-xs text-muted-foreground">
                                                Metadata including **Environment, Status, Validity, and Region** is fully editable.
                                            </p>
                                            <div className="flex gap-2 items-start bg-amber-50 p-2 rounded border border-amber-100">
                                                <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                                                <p className="text-[10px] text-amber-800">
                                                    **Impact Alert:** Changing environment to **Test** will exclude these factors from all emission calculations.
                                                </p>
                                            </div>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
                        <p className="text-muted-foreground mt-2">
                            Manage emission lifecycle and environment-specific datasets.
                        </p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            New Dataset
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Dataset (Draft)</DialogTitle>
                            <DialogDescription>
                                Datasets are created in **Draft** mode. You must upload factors before activation.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Dataset Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. India Grid Mix 2025"
                                    value={newDataset.name}
                                    onChange={(e) => setNewDataset({ ...newDataset, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="region">Region</Label>
                                    <Input
                                        id="region"
                                        value={newDataset.region}
                                        onChange={(e) => setNewDataset({ ...newDataset, region: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="env">Environment</Label>
                                    <select
                                        id="env"
                                        className="w-full border rounded-md h-10 px-3 text-sm"
                                        value={newDataset.environment}
                                        onChange={(e) => setNewDataset({ ...newDataset, environment: e.target.value })}
                                    >
                                        <option value="production">Production</option>
                                        <option value="test">Test</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc">Description</Label>
                                <Input
                                    id="desc"
                                    placeholder="Source reference, methodology..."
                                    value={newDataset.description}
                                    onChange={(e) => setNewDataset({ ...newDataset, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={!newDataset.name}>Create Draft</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="organization" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="organization" className="gap-2">
                        <Lock size={14} /> My Organization
                    </TabsTrigger>
                    <TabsTrigger value="global" className="gap-2">
                        <Globe size={14} /> Global System
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="organization">
                    <DatasetTable data={orgDatasets} isOrgTab={true} />
                </TabsContent>

                <TabsContent value="global">
                    <DatasetTable data={globalDatasets} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
