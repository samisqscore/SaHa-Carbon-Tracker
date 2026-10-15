/**
 * @file DatasetDetails.tsx
 * @description Detailed management view for individual emission datasets.
 * Handles metadata refinement, bulk factor imports, and individual factor metadata editing.
 * 
 * @functionality
 * - Metadata Management: Editing dataset name, region, environment, and validity dates.
 * - Bulk Import: Atomic CSV/Excel upload with row-level error reporting (Phase 2/5).
 * - Lifecycle Control: Activation/Archiving with backend data safety checks.
 * - Factor Refinement: Individual editing of factor category, stage, and scope (Phase 8).
 * - Audit Trail: Visibility into past upload attempts and outcomes.
 * 
 * @dependencies
 * - @tanstack/react-query: For managing server state for datasets, factors, and logs.
 * - wouter: For route parameter extraction and navigation.
 * - useAuth: For permission guarding (canModify/isSystemAdmin).
 * 
 * @breaking-changes
 * - Atomic Uploads: Re-uploading replaces all factors for the dataset (append is not supported by design).
 * - Permission Guards: Crucial that system admin logic syncs with the Global Dataset definition.
 */

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Loader2, Plus, ArrowLeft, Download, Upload,
    CheckCircle2, Archive, AlertTriangle, Calendar,
    History, FileText, Database, ShieldCheck, Info,
    Globe, Beaker, Edit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { format } from "date-fns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type EmissionFactor = {
    id: string;
    materialName: string;
    materialCategory: string;
    emissionFactor: number;
    unit: string;
    sourceReference: string;
    scope: 'platform' | 'organization';
    ghgScope: 'scope1' | 'scope2' | 'scope3';
    lifecycleStage: string;
};

type Dataset = {
    id: string;
    name: string;
    region: string;
    description: string;
    status: "draft" | "active" | "archived";
    environment: "production" | "test";
    validityStart: string;
    validityEnd: string | null;
    organizationId: string | null;
    activeFactorCount: number;
};

type UploadLog = {
    id: string;
    filename: string;
    status: "in_progress" | "success" | "failed";
    totalRows: number;
    validRows: number;
    errorRows: number;
    errorDetail: any[] | null;
    createdAt: string;
};

export default function DatasetDetails() {
    const { id } = useParams();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [_, setLocation] = useLocation();

    // UI States
    const { user } = useAuth();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditMetadataOpen, setIsEditMetadataOpen] = useState(false);
    const [isEditFactorOpen, setIsEditFactorOpen] = useState(false);
    const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadErrors, setUploadErrors] = useState<any[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingFactor, setEditingFactor] = useState<EmissionFactor | null>(null);

    // Form States
    const [newFactor, setNewFactor] = useState({
        materialName: "",
        materialCategory: "Concrete",
        emissionFactor: "",
        unit: "kgCO2e/unit",
        sourceReference: ""
    });

    const [metadata, setMetadata] = useState<Partial<Dataset>>({});

    // Queries
    const { data: dataset, isLoading: isDatasetLoading } = useQuery<Dataset>({
        queryKey: ["dataset", id],
        queryFn: async () => {
            const res = await fetch("/api/datasets");
            const all: Dataset[] = await res.json();
            const found = all.find(d => d.id === id);
            if (!found) throw new Error("Dataset not found");
            setMetadata(found);
            return found;
        },
        enabled: !!id
    });

    const isSystemAdmin = user?.role === 'admin';
    const isGlobalDataset = dataset && dataset.organizationId === null;
    const canModify = isSystemAdmin || !isGlobalDataset;

    const { data: factors, isLoading: isFactorsLoading } = useQuery<EmissionFactor[]>({
        queryKey: ["dataset-factors", id],
        queryFn: async () => {
            const res = await fetch(`/api/datasets/${id}/factors`);
            if (!res.ok) throw new Error("Failed to fetch factors");
            return res.json();
        },
        enabled: !!id
    });

    const { data: logs } = useQuery<UploadLog[]>({
        queryKey: ["dataset-logs", id],
        queryFn: async () => {
            const res = await fetch(`/api/datasets/${id}/logs`);
            if (!res.ok) throw new Error("Failed to fetch logs");
            return res.json();
        },
        enabled: !!id
    });

    const handleUpdateStatus = async (newStatus: "active" | "archived") => {
        try {
            const res = await fetch(`/api/datasets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "Status Updated", description: `Dataset is now ${newStatus}.` });
            queryClient.invalidateQueries({ queryKey: ["dataset", id] });
            queryClient.invalidateQueries({ queryKey: ["datasets"] });
        } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        }
    };

    const handleUpdateMetadata = async () => {
        try {
            const res = await fetch(`/api/datasets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(metadata)
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "Success", description: "Metadata updated." });
            setIsEditMetadataOpen(false);
            queryClient.invalidateQueries({ queryKey: ["dataset", id] });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleUpdateFactorMetadata = async () => {
        if (!editingFactor) return;
        try {
            const res = await fetch(`/api/factors/${editingFactor.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    materialCategory: editingFactor.materialCategory,
                    ghgScope: editingFactor.ghgScope,
                    lifecycleStage: editingFactor.lifecycleStage,
                    sourceReference: editingFactor.sourceReference
                }),
            });

            if (!res.ok) throw new Error(await res.text());

            toast({
                title: "Updated",
                description: "Emission factor metadata updated successfully.",
            });
            setIsEditFactorOpen(false);
            queryClient.invalidateQueries({ queryKey: ["dataset-factors", id] });
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            setIsUploading(true);
            setUploadErrors(null);
            const res = await fetch(`/api/datasets/${id}/upload`, {
                method: "POST",
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                if (result.errors) {
                    setUploadErrors(result.errors);
                }
                throw new Error(result.message || "Upload failed");
            }

            toast({
                title: "Import Successful",
                description: `Imported ${result.stats?.inserted} factors.`
            });

            queryClient.invalidateQueries({ queryKey: ["dataset-factors", id] });
            queryClient.invalidateQueries({ queryKey: ["dataset-logs", id] });
        } catch (error: any) {
            toast({
                title: "Import Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleAddFactor = async () => {
        try {
            const res = await fetch(`/api/datasets/${id}/factors`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newFactor)
            });

            if (!res.ok) throw new Error(await res.text());

            toast({ title: "Success", description: "Factor added." });
            setIsAddOpen(false);
            setNewFactor({ materialName: "", materialCategory: "Concrete", emissionFactor: "", unit: "kgCO2e/unit", sourceReference: "" });
            queryClient.invalidateQueries({ queryKey: ["dataset-factors", id] });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    if (isDatasetLoading || isFactorsLoading) {
        return <div className="flex justify-center h-96 items-center"><Loader2 className="animate-spin" /></div>;
    }

    if (!dataset) return <div>Dataset not found</div>;

    const canEdit = dataset.status !== 'archived';

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header with Navigation and Metadata */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Link href="/data-sources">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight">{dataset.name}</h1>
                            {dataset.status === 'active' && <Badge className="bg-green-100 text-green-700"><CheckCircle2 size={12} className="mr-1" /> Active</Badge>}
                            {dataset.status === 'draft' && <Badge variant="secondary"><Plus size={12} className="mr-1" /> Draft</Badge>}
                            {dataset.status === 'archived' && <Badge variant="outline" className="bg-gray-100"><Archive size={12} className="mr-1" /> Archived</Badge>}
                        </div>
                        <p className="text-muted-foreground mt-1 flex items-center gap-4">
                            <span className="flex items-center gap-1"><Globe size={14} /> {dataset.region}</span>
                            <span className="flex items-center gap-1">
                                {dataset.environment === 'production' ? <ShieldCheck size={14} className="text-blue-500" /> : <Beaker size={14} className="text-purple-500" />}
                                {dataset.environment.charAt(0).toUpperCase() + dataset.environment.slice(1)} Mode
                            </span>
                            <span className="flex items-center gap-1"><Calendar size={14} /> {format(new Date(dataset.validityStart), 'MMM d, yyyy')} {dataset.validityEnd ? `- ${format(new Date(dataset.validityEnd), 'MMM d, yyyy')}` : '(Perpetual)'}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {canEdit && (
                            <>
                                <Button variant="outline" onClick={() => canModify ? setIsEditMetadataOpen(true) : setIsPermissionDialogOpen(true)}>Edit Metadata</Button>
                                {dataset.status === 'draft' && (
                                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => canModify ? handleUpdateStatus('active') : setIsPermissionDialogOpen(true)}>
                                        <CheckCircle2 size={16} className="mr-2" /> Activate Dataset
                                    </Button>
                                )}
                                {dataset.status === 'active' && (
                                    <Button variant="destructive" onClick={() => canModify ? handleUpdateStatus('archived') : setIsPermissionDialogOpen(true)}>
                                        <Archive size={16} className="mr-2" /> Archive Dataset
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {dataset.status === 'draft' && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                        <Info className="text-amber-600 mt-0.5" size={18} />
                        <div>
                            <p className="text-amber-800 font-semibold text-sm">Draft Mode</p>
                            <p className="text-amber-700 text-sm">
                                This dataset is not yet visible to estimators. Use **Bulk Import** to populate it with factors, then **Activate** it when ready.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <Tabs defaultValue="factors" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="factors" className="gap-2"><FileText size={16} /> Factors ({factors?.length || 0})</TabsTrigger>
                    <TabsTrigger value="history" className="gap-2"><History size={16} /> Upload History</TabsTrigger>
                </TabsList>

                <TabsContent value="factors" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">Emission Factors</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Info size={12} className="text-primary" />
                                To perform bulk edits or change values/units, please archive this dataset and re-upload the corrected file.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {canEdit && (
                                <>
                                    <Button variant="outline" asChild>
                                        <a href="/api/datasets/template">
                                            <Download className="w-4 h-4 mr-2" /> Download Template
                                        </a>
                                    </Button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                                    <Button variant="outline" onClick={() => canModify ? fileInputRef.current?.click() : setIsPermissionDialogOpen(true)} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                        {isUploading ? "Importing..." : "Bulk Import"}
                                    </Button>
                                    <Button onClick={() => canModify ? setIsAddOpen(true) : setIsPermissionDialogOpen(true)}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Single
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {uploadErrors && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
                                <AlertTriangle size={18} /> Import Errors Found
                            </div>
                            <div className="max-h-60 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">Row</TableHead>
                                            <TableHead>Error Description</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {uploadErrors.map((err, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono text-xs">{err.row || 'N/A'}</TableCell>
                                                <TableCell className="text-red-600 text-sm">{err.error}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <p className="mt-4 text-xs text-red-700">
                                **Note:** The entire upload was cancelled. Please fix these rows and try again.
                            </p>
                        </div>
                    )}

                    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Material Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Value (kgCO2e)</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Stage</TableHead>
                                    <TableHead>Scope</TableHead>
                                    <TableHead>Source Reference</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {factors?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No factors found. Upload a CSV to get started.</TableCell>
                                    </TableRow>
                                ) : (
                                    factors?.map(f => (
                                        <TableRow key={f.id}>
                                            <TableCell className="font-medium">{f.materialName}</TableCell>
                                            <TableCell><Badge variant="secondary">{f.materialCategory}</Badge></TableCell>
                                            <TableCell className="font-mono">{f.emissionFactor.toLocaleString()}</TableCell>
                                            <TableCell className="text-muted-foreground">{f.unit}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-[10px]">{f.lifecycleStage || "A1-A3"}</Badge></TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold
                                                    ${f.ghgScope === 'scope1' ? 'bg-red-100 text-red-800' :
                                                        f.ghgScope === 'scope2' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-blue-100 text-blue-800'}`}>
                                                    {f.ghgScope}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{f.sourceReference || "-"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-primary"
                                                    onClick={() => {
                                                        if (!canModify) {
                                                            setIsPermissionDialogOpen(true);
                                                        } else {
                                                            setEditingFactor(f);
                                                            setIsEditFactorOpen(true);
                                                        }
                                                    }}
                                                >
                                                    <Edit size={14} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>File</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Rows</TableHead>
                                    <TableHead>Outcome</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No upload history found.</TableCell>
                                    </TableRow>
                                ) : (
                                    logs?.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-sm">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</TableCell>
                                            <TableCell className="max-w-xs truncate font-medium text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Download size={14} className="text-muted-foreground" />
                                                    {log.filename}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {log.status === 'success' ? <Badge className="bg-green-100 text-green-700">Success</Badge> :
                                                    log.status === 'failed' ? <Badge variant="destructive">Failed</Badge> :
                                                        <Badge variant="secondary" className="animate-pulse">Processing</Badge>}
                                            </TableCell>
                                            <TableCell className="text-xs font-mono">
                                                {log.totalRows} tot / {log.validRows} ok
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {log.status === 'success' ? "Imported factors successfully" : "Validation errors found"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modals --- */}

            <Dialog open={isEditMetadataOpen} onOpenChange={setIsEditMetadataOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Dataset Metadata</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Dataset Name</Label>
                            <Input value={metadata.name || ""} onChange={e => setMetadata({ ...metadata, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Environment</Label>
                                <Select value={metadata.environment} onValueChange={(v: any) => setMetadata({ ...metadata, environment: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="production">Production</SelectItem>
                                        <SelectItem value="test">Test</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Region</Label>
                                <Input value={metadata.region || ""} onChange={e => setMetadata({ ...metadata, region: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Validity Start</Label>
                                <Input type="date" value={metadata.validityStart?.split('T')[0]} onChange={e => setMetadata({ ...metadata, validityStart: new Date(e.target.value).toISOString() })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Validity End (Optional)</Label>
                                <Input type="date" value={metadata.validityEnd?.split('T')[0] || ""} onChange={e => setMetadata({ ...metadata, validityEnd: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={metadata.description || ""} onChange={e => setMetadata({ ...metadata, description: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditMetadataOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateMetadata}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Emission Factor</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Manual factor inputs... (similar to previous version but cleaner) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Material Name</Label>
                                <Input value={newFactor.materialName} onChange={e => setNewFactor({ ...newFactor, materialName: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={newFactor.materialCategory} onValueChange={v => setNewFactor({ ...newFactor, materialCategory: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Concrete">Concrete</SelectItem>
                                        <SelectItem value="Steel">Steel</SelectItem>
                                        <SelectItem value="Timber">Timber</SelectItem>
                                        <SelectItem value="Masonry">Masonry</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Emission Value</Label>
                                <Input type="number" step="0.001" value={newFactor.emissionFactor} onChange={e => setNewFactor({ ...newFactor, emissionFactor: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit</Label>
                                <Input value={newFactor.unit} onChange={e => setNewFactor({ ...newFactor, unit: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddFactor}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Factor Metadata Dialog */}
            <Dialog open={isEditFactorOpen} onOpenChange={setIsEditFactorOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Factor Metadata</DialogTitle>
                        <DialogDescription>
                            Refining metadata for **{editingFactor?.materialName}**. Core figures (value/unit) are immutable.
                        </DialogDescription>
                    </DialogHeader>

                    {editingFactor && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select
                                        value={editingFactor.materialCategory}
                                        onValueChange={v => setEditingFactor({ ...editingFactor, materialCategory: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Concrete">Concrete</SelectItem>
                                            <SelectItem value="Steel">Steel</SelectItem>
                                            <SelectItem value="Timber">Timber</SelectItem>
                                            <SelectItem value="Masonry">Masonry</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>GHG Scope</Label>
                                    <Select
                                        value={editingFactor.ghgScope}
                                        onValueChange={(v: any) => setEditingFactor({ ...editingFactor, ghgScope: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="scope1">Scope 1</SelectItem>
                                            <SelectItem value="scope2">Scope 2</SelectItem>
                                            <SelectItem value="scope3">Scope 3</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Lifecycle Stage</Label>
                                    <Select
                                        value={editingFactor.lifecycleStage}
                                        onValueChange={v => setEditingFactor({ ...editingFactor, lifecycleStage: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="A1-A3">A1-A3 (Manufacturing)</SelectItem>
                                            <SelectItem value="A4-A5">A4-A5 (Construction)</SelectItem>
                                            <SelectItem value="B">B (Use)</SelectItem>
                                            <SelectItem value="C1-C4">C1-C4 (End of Life)</SelectItem>
                                            <SelectItem value="D">D (Beyond Life)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Source Reference</Label>
                                    <Input
                                        value={editingFactor.sourceReference || ""}
                                        onChange={e => setEditingFactor({ ...editingFactor, sourceReference: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-muted rounded-md text-[11px] text-muted-foreground">
                                <p className="font-semibold mb-1 flex items-center gap-1">
                                    <Info size={12} className="text-primary" /> Note:
                                </p>
                                Changing metadata affects categorization in reports but does not trigger a re-calculation of total CO2e values until the next report refresh.
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditFactorOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateFactorMetadata}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Permission Alert Dialog */}
            <AlertDialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
                <AlertDialogContent className="border-l-4 border-l-amber-500">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-2 text-amber-600 mb-2 font-bold uppercase tracking-wider text-xs">
                            <ShieldCheck className="h-4 w-4" />
                            Security Protocol Violation
                        </div>
                        <AlertDialogTitle className="text-xl">Authorization Error</AlertDialogTitle>
                        <AlertDialogDescription className="text-base py-2">
                            You are attempted to modify a **Global System Dataset**. Only system-wide administrators have write access to global defaults.
                            <div className="mt-4 p-3 bg-muted rounded-md text-sm border">
                                <p className="font-semibold mb-1 flex items-center gap-2">
                                    <Info size={14} className="text-primary" />
                                    Looking to manage your own data?
                                </p>
                                <p className="text-muted-foreground">
                                    Please switch to the **'My Organization'** tab and create or select a dataset specific to your organization.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setIsPermissionDialogOpen(false)}>I Understand</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
