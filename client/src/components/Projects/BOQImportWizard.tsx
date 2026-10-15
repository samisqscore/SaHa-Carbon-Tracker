import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Upload, AlertTriangle, CheckCircle, FileText, Image as ImageIcon, ChevronsUpDown, Check, Download, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { downloadProjectReport } from "@/lib/report-utils";
import { Project } from "@shared/schema";
import { useLocation } from "wouter";

interface BOQImportWizardProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    embedded?: boolean; // When true: renders inline (no Dialog shell) for use inside ProjectDialog Step 2
}

type Material = {
    id: string;
    name: string;
    category: string;
    unit: string;
    emissionFactor: number;
};

type PhaseSuggestion = {
    sheetName: string;
    suggestedPhase: string;
    confidence: number;
};

type BOQItem = {
    item: string;
    description: string;
    quantity: number;
    unit: string;
    mapped_material_hint?: string;
    confidence?: number;
    sheetName?: string;
    rowIndex?: number;
    // Client-side mapping state
    mappedMaterialId?: string;
};

/**
 * BOQ Import Wizard
 * 
 * Features:
 * - File Upload (Excel/CSV/PDF)
 * - Multi-Step Wizard Pattern (Upload -> Preview/Edit -> Success)
 * - Editable Preview: Users can modify Quantity/Unit before import.
 * - Source Context: Displays Sheet Name and Row Index for each item (Audit Trail).
 * - Smart Mapping: Auto-maps items to materials using backend matching results.
 */
export function BOQImportWizard({ projectId, open, onOpenChange, embedded = false }: BOQImportWizardProps) {
    const [step, setStep] = useState<"upload" | "preview" | "phases" | "success">("upload");
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<BOQItem[]>([]);
    const [suggestedPhases, setSuggestedPhases] = useState<PhaseSuggestion[]>([]);
    const [phaseAssignments, setPhaseAssignments] = useState<Record<string, string>>({});
    const [confidence, setConfidence] = useState<number>(0);
    const [importId, setImportId] = useState<string | null>(null);

    // UI state for mapping
    const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
    const [showWarningDialog, setShowWarningDialog] = useState(false);

    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();

    // Fetch project details for the name (used in report download)
    const { data: project } = useQuery<Project>({
        queryKey: ["/api/projects", projectId],
        enabled: open && !!projectId,
    });

    // Fetch materials for mapping
    const { data: materials = [] } = useQuery<Material[]>({
        queryKey: ["/api/materials"],
        enabled: open, // Only fetch when wizard is open
    });

    // Fetch phases for AI mapping
    const { data: projectPhases = [] } = useQuery<any[]>({
        queryKey: ["/api/projects", projectId, "phases"],
        enabled: open && !!projectId,
    });

    // Mock tier check (same as backend)
    const isEnterprise = user?.role === "admin";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    /** Download the standard DMBoD BOQ template — generated client-side, no server call needed */
    const handleDownloadTemplate = () => {
        // Generate CSV entirely in the browser — avoids auth, CSP, and network issues
        const BOM = '\uFEFF'; // UTF-8 BOM ensures Excel opens file correctly without encoding errors
        const csvRows = [
            '"Material","Quantity","Unit","LifecycleStage"',
            '"Ready Mix Concrete M25","250","m3","A1-A3"',
            '"Structural Steel","15","tonne","A1-A3"',
            '"Reinforcement Bar","8","tonne","A1-A3"',
            '"Hollow Block Masonry","1200","nr","A1-A3"',
            '"Float Glass 6mm","80","m2","A1-A3"',
        ];
        const csvContent = BOM + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `DMBoD_BoQ_Template_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpload = async () => {
        if (!file) return;

        // Client-side tier validation
        const ext = file.name.split(".").pop()?.toLowerCase();
        const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext || "");

        if (!isEnterprise && !isSpreadsheet) {
            setError("Free plan supports Excel/CSV only. Upgrade to Enterprise for AI PDF import.");
            return;
        }

        if (!projectId) {
            setError("Project ID is missing. Please refresh and try again.");
            return;
        }

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            // credentials: "include" is required to send the session cookie
            const res = await fetch(`/api/projects/${projectId}/boq/upload`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            const data = await res.json();

            if (!res.ok) {
                const errorMessage = data.error
                    ? `${data.message}: ${data.error}`
                    : (data.message || "Upload failed");
                throw new Error(errorMessage);
            }

            const rawItems: BOQItem[] = data.data || [];

            // Backend now provides smart matching!
            // Map backend 'matchedMaterialId' to the UI state 'mappedMaterialId'
            const enhancedItems = rawItems.map((item: any) => ({
                ...item,
                mappedMaterialId: item.matchedMaterialId || undefined
            }));

            setPreviewData(enhancedItems);
            setConfidence(data.confidence || 0);
            setImportId(data.importId); // Save ID for confirmation

            // Handle AI Phase Suggestions
            const suggestions: PhaseSuggestion[] = data.suggestedPhases || [];
            setSuggestedPhases(suggestions);

            const initialAssignments: Record<string, string> = {};
            suggestions.forEach((s) => {
                const matchedPhase = projectPhases.find((p: any) => p.name.toLowerCase() === s.suggestedPhase.toLowerCase());
                if (matchedPhase) {
                    initialAssignments[s.sheetName] = matchedPhase.id;
                }
            });
            setPhaseAssignments(initialAssignments);

            setStep("preview");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const commitMutation = useMutation({
        mutationFn: async (items: BOQItem[]) => {
            if (!importId) throw new Error("Missing Import ID");

            const confirmPayload = {
                importId,
                items: items.map(i => ({
                    ...i,
                    // If user mapped it in UI, ensure it overrides/sets the matchedID
                    matchedMaterialId: i.mappedMaterialId
                })),
                phaseAssignments
            };

            // credentials: "include" is required to send the session cookie
            const res = await fetch(`/api/projects/${projectId}/boq/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(confirmPayload),
                credentials: "include",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Import confirmation failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/projects`, projectId, `materials`] });
            queryClient.invalidateQueries({ queryKey: [`/api/projects`, projectId, `emissions`] });
            setStep("success");
            setFile(null);
            setPreviewData([]);
            setImportId(null);
        },
        onError: (err: any) => {
            setError(err.message);
        }
    });

    const handleConfirm = () => {
        const unmappedCount = previewData.length - mappedItems;
        if (unmappedCount > 0 && !showWarningDialog) {
            setShowWarningDialog(true);
            return;
        }
        setShowWarningDialog(false);
        commitMutation.mutate(previewData);
    };

    const updateMapping = (index: number, field: "mappedMaterialId" | "quantity" | "unit", value: any) => {
        const newData = [...previewData];
        if (field === "mappedMaterialId") {
            newData[index].mappedMaterialId = value;
        } else if (field === "quantity") {
            newData[index].quantity = value;
        } else if (field === "unit") {
            newData[index].unit = value;
        }
        setPreviewData(newData);
    };

    const filteredPreviewData = showOnlyUnmapped
        ? previewData.filter(i => !i.mappedMaterialId)
        : previewData;

    // Calculations for summary
    const totalItems = previewData.length;
    const mappedItems = previewData.filter(i => i.mappedMaterialId).length;

    // Inline (embedded) mode — no Dialog wrapper
    if (embedded) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex-1 overflow-y-auto">
                    {step === "upload" && (
                        <div className="space-y-6 py-4">
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center space-y-4 hover:bg-gray-50 transition-colors">
                                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Upload className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium">Upload your BOQ file</h3>
                                    <p className="text-sm text-gray-500 mt-1">Drag and drop or click to browse</p>
                                </div>
                                <Input id="file-upload-embedded" type="file" className="hidden" onChange={handleFileChange}
                                    accept={isEnterprise ? ".csv,.xlsx,.xls,.pdf,.jpg,.png" : ".csv,.xlsx,.xls"} />
                                <Button variant="secondary" onClick={() => document.getElementById("file-upload-embedded")?.click()}>Select File</Button>
                            </div>
                            {file && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border">
                                    <FileText className="h-8 w-8 text-green-600" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-medium truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
                                </div>
                            )}
                            {error && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button onClick={handleUpload} disabled={!file || isUploading}>
                                    {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Analyze BOQ
                                </Button>
                            </div>
                        </div>
                    )}
                    {step === "preview" && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">{mappedItems} of {totalItems} items mapped. Review and confirm.</p>
                            <div className="border rounded-md max-h-[300px] overflow-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[100px]">Qty</TableHead>
                                        <TableHead className="w-[80px]">Unit</TableHead>
                                        <TableHead className="min-w-[200px]">Mapped Material</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {previewData.map((row, i) => (
                                            <TableRow key={i} className={!row.mappedMaterialId ? "bg-red-50/30" : ""}>
                                                <TableCell className="text-sm">{row.description}</TableCell>
                                                <TableCell><Input type="number" className="h-8 w-20" value={row.quantity} onChange={(e) => updateMapping(i, "quantity", Number(e.target.value))} /></TableCell>
                                                <TableCell><Input className="h-8 w-16" value={row.unit} onChange={(e) => updateMapping(i, "unit", e.target.value)} /></TableCell>
                                                <TableCell><MaterialCombobox materials={materials} value={row.mappedMaterialId} onChange={(val) => updateMapping(i, "mappedMaterialId", val)} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {error && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
                                <Button onClick={() => setStep("phases")} disabled={mappedItems === 0}>Next: Assign Phases</Button>
                            </div>
                        </div>
                    )}
                    {step === "phases" && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">Review AI phase suggestions and confirm.</p>
                            <div className="flex justify-between gap-2">
                                <Button variant="outline" onClick={() => setStep("preview")}>Back</Button>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => { setPhaseAssignments({}); handleConfirm(); }} disabled={commitMutation.isPending}>Skip &amp; Import</Button>
                                    <Button onClick={handleConfirm} disabled={commitMutation.isPending}>
                                        {commitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Confirm &amp; Import {mappedItems} Items
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === "success" && (
                        <div className="flex flex-col items-center justify-center py-6 space-y-4">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold">Import Submitted!</h3>
                            <p className="text-center text-gray-500">Materials imported. View them in the Project Materials tab.</p>
                            <div className="flex flex-col w-full gap-2 pt-2">
                                <Button
                                    className="w-full gap-2"
                                    onClick={() => project && downloadProjectReport(project.id, project.name)}
                                >
                                    <Download className="h-4 w-4" />
                                    Download PDF Report
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={() => {
                                        setLocation(`/projects/${projectId}?tab=report`);
                                        onOpenChange(false);
                                    }}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    View Detailed Analysis
                                </Button>
                                <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Standard Dialog mode
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Import Bill of Quantities</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {step === "upload" && (
                        <div className="space-y-6 py-4">
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center space-y-4 hover:bg-gray-50 transition-colors">
                                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Upload className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium">Upload your BOQ file</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Drag and drop or click to browse
                                    </p>
                                </div>

                                <Input
                                    id="file-upload"
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept={isEnterprise ? ".csv,.xlsx,.xls,.pdf,.jpg,.png" : ".csv,.xlsx,.xls"}
                                />
                                <Button variant="secondary" onClick={() => document.getElementById("file-upload")?.click()}>
                                    Select File
                                </Button>
                            </div>

                            {file && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border">
                                    {["csv", "xlsx", "xls"].some(ext => file.name.endsWith(ext)) ? (
                                        <FileText className="h-8 w-8 text-green-600" />
                                    ) : (
                                        <ImageIcon className="h-8 w-8 text-purple-600" />
                                    )}
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-medium truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
                                </div>
                            )}

                            {/* Phase 3: Template-based import guide */}
                            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200 text-sm mt-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className="font-semibold mb-2">Standard Import — DMBoD Template</h4>
                                        <ul className="list-disc pl-4 space-y-1 text-gray-600">
                                            <li>Download the template below and fill in your materials.</li>
                                            <li>Required columns: <strong>Material, Quantity, Unit</strong></li>
                                            <li>Optional: <strong>LifecycleStage</strong> — defaults to <code>A1-A3</code> if omitted.</li>
                                            <li>Upload the completed file as <code>.xlsx</code> or <code>.csv</code>.</li>
                                        </ul>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 border-blue-400 text-blue-700 hover:bg-blue-100"
                                        onClick={handleDownloadTemplate}
                                    >
                                        <Download className="h-4 w-4 mr-1" />
                                        Download Template
                                    </Button>
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button onClick={handleUpload} disabled={!file || isUploading}>
                                    {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Analyze BOQ
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === "preview" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="font-medium">Review & Map Materials</h3>
                                    <p className="text-sm text-gray-500">Review the parsed data. Click on Quantity or Unit to edit if needed.</p>
                                </div>
                                {isEnterprise && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">AI Confidence:</span>
                                        <Badge className={`${confidence > 80 ? "bg-green-500" : confidence > 50 ? "bg-yellow-500" : "bg-red-500"}`}>
                                            {confidence}%
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md border">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium">Summary:</span>
                                    <span>{mappedItems} of {totalItems} items mapped</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-600 flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showOnlyUnmapped}
                                            onChange={(e) => setShowOnlyUnmapped(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        Show unmapped only
                                    </label>
                                </div>
                            </div>

                            <div className="border rounded-md max-h-[500px] overflow-auto relative">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-[120px]">Location</TableHead>
                                            <TableHead className="w-[80px]">Item</TableHead>
                                            <TableHead className="min-w-[200px]">Description</TableHead>
                                            <TableHead className="w-[100px]">Qty</TableHead>
                                            <TableHead className="w-[80px]">Unit</TableHead>
                                            {isEnterprise && <TableHead className="w-[120px]">AI Hint</TableHead>}
                                            <TableHead className="min-w-[250px]">Mapped Material (Required)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPreviewData.map((row, i) => {
                                            const originalIndex = previewData.indexOf(row);
                                            return (
                                                <TableRow key={originalIndex} className={!row.mappedMaterialId ? "bg-red-50/30" : ""}>
                                                    <TableCell className="text-xs text-gray-500">
                                                        {row.sheetName || "Sheet1"}
                                                        <br />
                                                        Avg Row: {row.rowIndex || "-"}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{row.item}</TableCell>
                                                    <TableCell className="text-sm">{row.description}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            className="h-8 w-20 text-right"
                                                            value={row.quantity}
                                                            onChange={(e) => updateMapping(originalIndex, "quantity", Number(e.target.value))}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            className="h-8 w-16"
                                                            value={row.unit}
                                                            onChange={(e) => updateMapping(originalIndex, "unit", e.target.value)}
                                                        />
                                                    </TableCell>
                                                    {isEnterprise && (
                                                        <TableCell>
                                                            {row.mapped_material_hint && <Badge variant="outline" className="text-xs">{row.mapped_material_hint}</Badge>}
                                                        </TableCell>
                                                    )}
                                                    <TableCell>
                                                        <MaterialCombobox
                                                            materials={materials}
                                                            value={row.mappedMaterialId}
                                                            onChange={(val) => updateMapping(originalIndex, "mappedMaterialId", val)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {filteredPreviewData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                                    No items found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Import Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {step === "phases" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="font-medium flex items-center gap-2">Map Sheets to Phases <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">AI Suggested</Badge></h3>
                                    <p className="text-sm text-gray-500">AI has suggested phases for your BOQ sheets. Review and confirm.</p>
                                </div>
                            </div>

                            <div className="border rounded-md max-h-[500px] overflow-auto relative">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead>Sheet Name</TableHead>
                                            <TableHead>AI Suggestion</TableHead>
                                            <TableHead>Confidence</TableHead>
                                            <TableHead>Assigned Phase</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {suggestedPhases.map((s, i) => (
                                            <TableRow key={i} className={s.confidence < 70 ? "bg-amber-50" : ""}>
                                                <TableCell className="font-medium">{s.sheetName}</TableCell>
                                                <TableCell>{s.suggestedPhase}</TableCell>
                                                <TableCell>
                                                    <Badge className={s.confidence > 80 ? "bg-green-500" : s.confidence > 50 ? "bg-yellow-500" : "bg-red-500"}>
                                                        {s.confidence}%
                                                    </Badge>
                                                    {s.confidence < 70 && <span className="ml-2 text-xs text-amber-600">Needs review</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <select
                                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm hover:border-blue-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        value={phaseAssignments[s.sheetName] || ""}
                                                        onChange={(e) => setPhaseAssignments(prev => ({ ...prev, [s.sheetName]: e.target.value }))}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {projectPhases.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {suggestedPhases.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                                                    No AI suggestions available. Skip this step or check sheets.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Import Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {step === "success" && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold">Import Submitted!</h3>
                            <p className="text-center text-gray-500 max-w-sm">
                                The items have been imported. You can now download the official report or view the detailed analysis.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 w-full justify-center">
                                <Button
                                    className="gap-2"
                                    onClick={() => project && downloadProjectReport(project.id, project.name)}
                                >
                                    <Download className="h-4 w-4" />
                                    Download PDF Report
                                </Button>
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => {
                                        setLocation(`/projects/${projectId}?tab=report`);
                                        onOpenChange(false);
                                    }}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    View Detailed Analysis
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-gray-50">
                    {step === "preview" && (
                        <div className="flex justify-end gap-2 w-full">
                            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
                            <Button
                                onClick={() => setStep("phases")}
                                disabled={mappedItems === 0}
                            >
                                Next: Assign Phases
                            </Button>
                        </div>
                    )}
                    {step === "phases" && (
                        <div className="flex justify-between gap-2 w-full">
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep("preview")}>Back</Button>
                                <Button variant="ghost" onClick={() => {
                                    setPhaseAssignments({});
                                    handleConfirm();
                                }} disabled={commitMutation.isPending}>
                                    Skip & Import Without Phases
                                </Button>
                            </div>
                            <Button
                                onClick={handleConfirm}
                                disabled={commitMutation.isPending}
                            >
                                {commitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm & Import {mappedItems} Items
                            </Button>
                        </div>
                    )}
                    {(step === "upload" || step === "success") && (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {step === "success" ? "Close" : "Cancel"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>

            {/* Warning Dialog for Unmapped Items */}
            <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                            Data Gap Warning
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="text-sm font-medium">
                            Warning: You are about to import {totalItems - mappedItems} items without a material match.
                        </p>
                        <p className="text-sm text-gray-500">
                            In the absence of mapping, the emission factor for these items will be <strong>0</strong>.
                            You can map them later in the Materials tab or upload your own emission factor dataset to provide values.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
                            Back to Mapping
                        </Button>
                        <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={handleConfirm}>
                            Proceed with 0 Emissions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}

function MaterialCombobox({ materials, value, onChange }: { materials: Material[], value?: string, onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false)

    const selectedMaterial = materials.find(m => m.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
                    size="sm"
                >
                    {selectedMaterial ? selectedMaterial.name : "Select material..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search material..." />
                    <CommandEmpty>No material found.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {materials.map((material) => (
                            <CommandItem
                                key={material.id}
                                value={material.name}
                                onSelect={() => {
                                    onChange(material.id)
                                    setOpen(false)
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === material.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span>{material.name}</span>
                                    <span className="text-xs text-gray-500">{material.category} • {material.emissionFactor} kgCO2e/{material.unit}</span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
