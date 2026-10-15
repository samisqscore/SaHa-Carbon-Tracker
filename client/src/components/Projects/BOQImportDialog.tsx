/**
 * @file BOQImportDialog.tsx
 * @description Dialog for bulk importing materials via CSV (Bill of Quantities).
 * 
 * @functionality
 * - File Parsing: Uses PapaParse to read client-side CSV files.
 * - Validation/Preview: Sends parsed data to backend for validation and factor matching (`/api/projects/:id/materials/batch-preview`).
 * - Commit: Submits validated data to create multiple project materials at once.
 * - Error Handling: Displays row-level warnings and errors.
 * 
 * @dependencies
 * - PapaParse: CSV parsing library.
 * - API: Batch preview and commit endpoints.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useError } from "@/hooks/use-error";
import Papa from "papaparse";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { BatchPreviewResponse, BatchMaterial } from "@shared/schema";

interface BOQImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

export default function BOQImportDialog({ open, onOpenChange, projectId }: BOQImportDialogProps) {
    const { toast } = useToast();
    const { showError } = useError();
    const queryClient = useQueryClient();

    const [step, setStep] = useState<"upload" | "preview" | "working">("upload");
    const [parsedData, setParsedData] = useState<BatchMaterial[]>([]);
    const [previewResults, setPreviewResults] = useState<BatchPreviewResponse[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);

    // Parse CSV
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setParseError(null);
        Papa.parse(file, {
            header: true, // Expect headers
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    setParseError(`Parse error: ${results.errors[0].message}`);
                    return;
                }

                // Basic Validation & Mapping
                // Expect columns: Name, Quantity, Unit, [Category], [Supplier]
                const materials: BatchMaterial[] = [];
                try {
                    results.data.forEach((row: any, index: number) => {
                        // Heuristic mapping
                        const name = row['Name'] || row['Material'] || row['Item'] || row['Description'];
                        const quantity = parseFloat(row['Quantity'] || row['Qty'] || row['Amount'] || '0');
                        const unit = row['Unit'] || row['UOM'] || 'each';
                        const category = row['Category'] || row['Type'];

                        if (!name || isNaN(quantity)) {
                            // Skip invalid rows? Or throw
                            console.warn(`Skipping invalid row ${index}`, row);
                            return;
                        }

                        materials.push({
                            name,
                            quantity,
                            unit,
                            category,
                            supplier: row['Supplier']
                        });
                    });

                    if (materials.length === 0) {
                        setParseError("No valid materials found. Check CSV headers (Name, Quantity, Unit).");
                        return;
                    }

                    setParsedData(materials);
                    // Auto-trigger preview
                    previewMutation.mutate(materials);

                } catch (err) {
                    setParseError("Failed to map CSV data. Ensure headers are correct.");
                }
            },
            error: (error) => {
                setParseError(`File read error: ${error.message}`);
            }
        });
    };

    const previewMutation = useMutation({
        mutationFn: async (data: BatchMaterial[]) => {
            const res = await apiRequest("POST", `/api/projects/${projectId}/materials/batch-preview`, data);
            return await res.json() as BatchPreviewResponse[];
        },
        onSuccess: (data) => {
            setPreviewResults(data);
            setStep("preview");
        },
        onError: (err: Error) => {
            showError({
                title: "Analysis Failed",
                message: "Failed to analyze the uploaded file.",
                details: err
            });
            // Also keep local error for visibility?
            setParseError(err.message);
        }
    });

    const commitMutation = useMutation({
        mutationFn: async () => {
            // Prepare data for commit
            // We map the preview results to the InsertProjectMaterial format
            const payload = previewResults
                .filter(p => !p.resolvedFactor?.isFallback || confirmFallback(p)) // Optional filter? currently committing allvalid
                .map(p => {
                    // For now, we only commit if we found a match? 
                    // Or if we didn't match, do we create a new material? 
                    // Current backend logic requires materialId or creating new.
                    // The simple logic: Only commit matched materials.
                    if (!p.matchedFactorId) return null;

                    return {
                        projectId,
                        emissionFactorId: p.matchedFactorId,
                        quantity: p.original.quantity,
                        selectedEmissionFactor: p.resolvedFactor?.value,
                        selectedDatasetSource: p.resolvedFactor?.source
                    };
                })
                .filter(Boolean); // Remote nulls

            if (payload.length === 0) {
                throw new Error("No valid materials matched to commit.");
            }

            const res = await apiRequest("POST", `/api/projects/${projectId}/materials/batch`, payload);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Import Successful", description: "Materials added to project." });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/materials`] });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/emissions`] });
            onOpenChange(false);
            setStep("upload");
            setParsedData([]);
        },
        onError: (err: Error) => {
            showError({
                title: "Import Failed",
                message: "Failed to save materials to the project.",
                details: err
            });
        }
    });

    // Helper just to ignore
    const confirmFallback = (p: any) => true;

    // Stats
    const validCount = previewResults.filter(r => !r.warnings.length).length;
    const warningsCount = previewResults.filter(r => r.warnings.length > 0).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Bill of Quantities (BOQ)</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-1">
                    {step === "upload" && (
                        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg bg-muted/50 gap-4">
                            <Upload className="h-10 w-10 text-muted-foreground" />
                            <div className="text-center space-y-2">
                                <h3 className="font-semibold text-lg">Upload CSV File</h3>
                                <p className="text-sm text-muted-foreground">Headers required: Name, Quantity, Unit</p>
                            </div>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="max-w-xs"
                                disabled={previewMutation.isPending}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const csvContent = "data:text/csv;charset=utf-8,Name,Quantity,Unit,Category,Supplier\nSample Item,10,pcs,Materials,Local Supplier";
                                        const encodedUri = encodeURI(csvContent);
                                        const link = document.createElement("a");
                                        link.setAttribute("href", encodedUri);
                                        link.setAttribute("download", "boq_template.csv");
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Template
                                </Button>
                            </div>
                            {previewMutation.isPending && (
                                <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analyzing Emission Factors...
                                </div>
                            )}
                            {parseError && (
                                <Alert variant="destructive" className="max-w-md mt-4">
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{parseError}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {step === "preview" && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <Alert className="flex-1 bg-green-50 border-green-200">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <AlertTitle>Valid Matches</AlertTitle>
                                    <AlertDescription>{validCount} items ready to import</AlertDescription>
                                </Alert>
                                <Alert className="flex-1 bg-amber-50 border-amber-200">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertTitle>Warnings</AlertTitle>
                                    <AlertDescription>{warningsCount} items need attention</AlertDescription>
                                </Alert>
                            </div>

                            <ScrollArea className="h-[400px] border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Imported Item</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Resolved Factor</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewResults.map((row, idx) => (
                                            <TableRow key={idx} className={row.warnings.length ? "bg-amber-50/30" : ""}>
                                                <TableCell className="font-medium">{row.original.name}</TableCell>
                                                <TableCell>{row.original.quantity} {row.original.unit}</TableCell>
                                                <TableCell>
                                                    {row.resolvedFactor ?
                                                        `${row.resolvedFactor.value.toFixed(4)} kgCO2e/${row.resolvedFactor.unit}`
                                                        : <span className="text-muted-foreground">-</span>
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                                                        {row.resolvedFactor?.source || "N/A"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {row.warnings.length > 0 ? (
                                                        <ul className="text-xs text-amber-600 list-disc list-inside">
                                                            {row.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-xs text-green-600 font-medium">Verified</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    {step === "preview" && (
                        <>
                            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
                            <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
                                {commitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Import ({previewResults.filter(p => !!p.matchedFactorId).length} Items)
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
