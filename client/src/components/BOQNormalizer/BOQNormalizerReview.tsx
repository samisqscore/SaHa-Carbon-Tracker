import { useState, useMemo } from "react";
import {
    CheckCircle2, AlertTriangle, XCircle, Pencil,
    SlidersHorizontal, Loader2, ArrowUpRight, Plus, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { EnrichedBoqRow } from "./boqNormalizerTypes";
import { MATERIAL_CATEGORIES, LIFECYCLE_STAGES } from "./boqNormalizerTypes";

type FilterMode = "all" | "high" | "needs_review" | "qro";

interface BOQNormalizerReviewProps {
    rows: EnrichedBoqRow[];
    onRowsChange: (rows: EnrichedBoqRow[]) => void;
    pushing: boolean;
    onPushingChange: (pushing: boolean) => void;
    onPushComplete: (projectId: string, projectName: string, insertedCount: number) => void;
}

// ─── Confidence Chip ─────────────────────────────────────────
function ConfidenceChip({ value }: { value: number }) {
    if (value >= 0.8) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                {(value * 100).toFixed(0)}%
            </span>
        );
    }
    if (value >= 0.5) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                {(value * 100).toFixed(0)}%
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
            <XCircle className="h-3 w-3" />
            {(value * 100).toFixed(0)}%
        </span>
    );
}

/**
 * BOQ Normalizer — Review Table + Push Panel
 *
 * 10-column editable table with:
 * - Filter bar (All / High Confidence / Needs Review / QRO Only)
 * - Bulk actions (Select All / Deselect Low Confidence / Deselect QRO)
 * - Inline editing with editedByUser flag
 * - QRO row amber tint + required qty validation
 * - Sticky bottom push panel with project selector
 */
export function BOQNormalizerReview({
    rows,
    onRowsChange,
    pushing,
    onPushingChange,
    onPushComplete,
}: BOQNormalizerReviewProps) {
    const { toast } = useToast();
    const [filter, setFilter] = useState<FilterMode>("all");
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // Push panel state
    const [pushTarget, setPushTarget] = useState<"existing" | "new">("existing");
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectLocation, setNewProjectLocation] = useState("");
    const [newProjectType, setNewProjectType] = useState("commercial");

    // Fetch existing projects
    const { data: projectsData } = useQuery<any[]>({
        queryKey: ["/api/projects"],
        queryFn: async () => {
            const res = await fetch("/api/projects", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch projects");
            return res.json();
        },
    });

    // ─── Filter Counts ──────────────────────────────────────────
    const counts = useMemo(() => ({
        all: rows.length,
        high: rows.filter(r => r.confidence >= 0.8).length,
        needs_review: rows.filter(r => r.confidence < 0.8).length,
        qro: rows.filter(r => r.isQro).length,
    }), [rows]);

    // ─── Filtered Rows ──────────────────────────────────────────
    const filteredRows = useMemo(() => {
        switch (filter) {
            case "high": return rows.filter(r => r.confidence >= 0.8);
            case "needs_review": return rows.filter(r => r.confidence < 0.8);
            case "qro": return rows.filter(r => r.isQro);
            default: return rows;
        }
    }, [rows, filter]);

    // ─── Row Update ──────────────────────────────────────────────
    const updateRow = (rowIndex: number, field: keyof EnrichedBoqRow, value: any) => {
        onRowsChange(rows.map(r =>
            r.rowIndex === rowIndex
                ? { ...r, [field]: value, editedByUser: true }
                : r
        ));
    };

    const toggleRow = (rowIndex: number) => {
        onRowsChange(rows.map(r =>
            r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r
        ));
    };

    // ─── Bulk Actions ────────────────────────────────────────────
    const selectAll = () => onRowsChange(rows.map(r => ({ ...r, selected: true })));
    const deselectLowConfidence = () =>
        onRowsChange(rows.map(r => r.confidence < 0.8 ? { ...r, selected: false } : r));
    const deselectQro = () =>
        onRowsChange(rows.map(r => r.isQro ? { ...r, selected: false } : r));

    // ─── Push Validation ─────────────────────────────────────────
    const selectedRows = rows.filter(r => r.selected);
    const selectedCount = selectedRows.length;
    const qroMissingQty = selectedRows.filter(r => r.isQro && (r.quantity === null || r.quantity === "QRO"));

    const canPush = selectedCount > 0
        && qroMissingQty.length === 0
        && (pushTarget === "existing" ? !!selectedProjectId : !!newProjectName.trim());

    let pushDisabledReason = "";
    if (selectedCount === 0) pushDisabledReason = "No rows selected";
    else if (qroMissingQty.length > 0) pushDisabledReason = `${qroMissingQty.length} QRO row(s) need quantities`;
    else if (pushTarget === "existing" && !selectedProjectId) pushDisabledReason = "Select a project";
    else if (pushTarget === "new" && !newProjectName.trim()) pushDisabledReason = "Enter project name";

    // ─── Push Handler ────────────────────────────────────────────
    // ─── Download Handler ────────────────────────────────────────
    const handleDownload = () => {
        if (selectedRows.length === 0) return;

        // Header
        const headers = ["Material", "Quantity", "Unit", "LifecycleStage"];
        const rows_csv = selectedRows.map(r => [
            `"${(r.matchedMaterialName || r.description).replace(/"/g, '""')}"`,
            r.quantity,
            `"${(r.unit || "nr").replace(/"/g, '""')}"`,
            `"${(r.lifecycleStage || "A1-A3").replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(","),
            ...rows_csv.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dm_bod_normalized_boq_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "Download Started",
            description: `Exporting ${selectedRows.length} items to CSV.`,
        });
    };

    const handlePush = async () => {
        if (!canPush) return;
        onPushingChange(true);

        try {
            const body: any = {
                rows: selectedRows,
            };

            if (pushTarget === "existing") {
                body.projectId = selectedProjectId;
            } else {
                body.newProject = {
                    name: newProjectName.trim(),
                    location: newProjectLocation.trim(),
                    type: newProjectType,
                };
            }

            const response = await fetch("/api/boq/normalizer/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                credentials: "include",
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Push failed");
            }

            const result = await response.json();
            toast({
                title: "Materials pushed successfully",
                description: `${result.inserted} materials added to ${result.projectName}`,
            });
            onPushComplete(result.projectId, result.projectName, result.inserted);
        } catch (err: any) {
            toast({
                title: "Push failed",
                description: err.message,
                variant: "destructive",
            });
            onPushingChange(false);
        }
    };

    return (
        <div className="space-y-4 pb-36"> {/* Bottom padding for sticky footer */}
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
                {(["all", "high", "needs_review", "qro"] as FilterMode[]).map(f => {
                    const labels: Record<FilterMode, string> = {
                        all: "All", high: "High Confidence", needs_review: "Needs Review", qro: "QRO Only",
                    };
                    const isActive = filter === f;
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${isActive
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            {labels[f]} ({counts[f]})
                        </button>
                    );
                })}

                <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                    <Button variant="outline" size="sm" onClick={deselectLowConfidence}>
                        <SlidersHorizontal className="h-3 w-3 mr-1" />
                        Deselect Low
                    </Button>
                    {counts.qro > 0 && (
                        <Button variant="outline" size="sm" onClick={deselectQro}>Deselect QRO</Button>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div className="text-xs text-gray-500">
                {selectedCount} of {rows.length} rows selected
                {qroMissingQty.length > 0 && (
                    <span className="text-amber-600 font-medium ml-2">
                        • {qroMissingQty.length} QRO row(s) need quantities
                    </span>
                )}
            </div>

            {/* Review Table */}
            <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="w-10 px-2 py-2.5 text-center">
                                <Checkbox
                                    checked={filteredRows.every(r => r.selected)}
                                    onCheckedChange={(checked) => {
                                        const filteredIndices = new Set(filteredRows.map(r => r.rowIndex));
                                        onRowsChange(rows.map(r =>
                                            filteredIndices.has(r.rowIndex) ? { ...r, selected: !!checked } : r
                                        ));
                                    }}
                                />
                            </th>
                            <th className="w-16 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Sl.No</th>
                            <th className="w-36 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Building Element</th>
                            <th className="w-36 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Work Section</th>
                            <th className="min-w-[200px] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Item Description</th>
                            <th className="w-48 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Material Category</th>
                            <th className="w-20 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th className="w-20 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                            <th className="w-28 px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Lifecycle</th>
                            <th className="w-24 px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Confidence</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredRows.map(row => {
                            const isQroMissing = row.isQro && (row.quantity === null || row.quantity === "QRO");
                            return (
                                <tr
                                    key={`${row.sheetName}-${row.rowIndex}`}
                                    className={`hover:bg-gray-50 transition-colors ${isQroMissing ? "bg-amber-50" : ""
                                        } ${row.editedByUser ? "bg-blue-50/30" : ""}`}
                                >
                                    {/* Checkbox */}
                                    <td className="px-2 py-2 text-center">
                                        <Checkbox
                                            checked={row.selected}
                                            onCheckedChange={() => toggleRow(row.rowIndex)}
                                        />
                                    </td>

                                    {/* Sl.No */}
                                    <td className="px-2 py-2 text-gray-600 text-xs font-mono">{row.slNo || "–"}</td>

                                    {/* Building Element (= sheetName) */}
                                    <td className="px-2 py-2">
                                        <span className="text-xs text-gray-600 truncate block max-w-[140px]" title={row.sheetName}>
                                            {row.sheetName}
                                        </span>
                                    </td>

                                    {/* Work Section (= sectionHeader) */}
                                    <td className="px-2 py-2">
                                        <span className="text-xs text-gray-600 truncate block max-w-[140px]" title={row.sectionHeader}>
                                            {row.sectionHeader || "–"}
                                        </span>
                                    </td>

                                    {/* Item Description */}
                                    <td className="px-2 py-2">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-xs text-gray-800 truncate block max-w-[200px] cursor-help">
                                                    {row.description}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-sm">
                                                <p className="text-xs whitespace-pre-wrap">{row.description}</p>
                                                {row.parentDescription && (
                                                    <p className="text-xs text-gray-400 mt-1">Parent: {row.parentDescription}</p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>

                                    {/* Material Category (editable dropdown) */}
                                    <td className="px-2 py-2 relative">
                                        <Select
                                            value={row.materialCategory}
                                            onValueChange={(val) => updateRow(row.rowIndex, "materialCategory", val)}
                                        >
                                            <SelectTrigger className="h-7 text-xs border-gray-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MATERIAL_CATEGORIES.map(cat => (
                                                    <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {row.editedByUser && (
                                            <Pencil className="absolute top-1 right-1 h-3 w-3 text-blue-500" />
                                        )}
                                    </td>

                                    {/* Qty (editable) */}
                                    <td className="px-2 py-2">
                                        <Input
                                            type="number"
                                            value={row.quantity === null || row.quantity === "QRO" ? "" : row.quantity}
                                            placeholder={isQroMissing ? "Enter" : ""}
                                            onChange={(e) => updateRow(row.rowIndex, "quantity", e.target.value ? Number(e.target.value) : null)}
                                            className={`h-7 text-xs w-18 ${isQroMissing ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                                        />
                                    </td>

                                    {/* Unit (editable) */}
                                    <td className="px-2 py-2">
                                        <Input
                                            type="text"
                                            value={row.unit}
                                            onChange={(e) => updateRow(row.rowIndex, "unit", e.target.value)}
                                            className="h-7 text-xs w-18 border-gray-200"
                                        />
                                    </td>

                                    {/* Lifecycle Stage (editable dropdown) */}
                                    <td className="px-2 py-2">
                                        <Select
                                            value={row.lifecycleStageEn15804}
                                            onValueChange={(val) => updateRow(row.rowIndex, "lifecycleStageEn15804", val)}
                                        >
                                            <SelectTrigger className="h-7 text-xs border-gray-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LIFECYCLE_STAGES.map(stage => (
                                                    <SelectItem key={stage} value={stage} className="text-xs">{stage}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>

                                    {/* Confidence */}
                                    <td className="px-2 py-2 text-center">
                                        <ConfidenceChip value={row.confidence} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredRows.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No rows match the current filter.
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
          Sticky Push Panel
          ═══════════════════════════════════════════════════════════ */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Selected Count */}
                        <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            {selectedCount} of {rows.length} rows selected
                        </div>

                        <div className="h-6 w-px bg-gray-200" />

                        {/* Project Target */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPushTarget("existing")}
                                    className={`text-xs px-2 py-1 rounded ${pushTarget === "existing" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
                                >
                                    Existing project
                                </button>
                                <button
                                    onClick={() => setPushTarget("new")}
                                    className={`text-xs px-2 py-1 rounded ${pushTarget === "new" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
                                >
                                    <Plus className="h-3 w-3 inline mr-0.5" /> New
                                </button>
                            </div>

                            {pushTarget === "existing" ? (
                                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                    <SelectTrigger className="h-8 text-xs w-56 border-gray-200">
                                        <SelectValue placeholder="Select project..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projectsData?.map((p: any) => (
                                            <SelectItem key={p.id} value={p.id} className="text-xs">
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Project name *"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        className="h-8 text-xs w-40"
                                    />
                                    <Input
                                        placeholder="Location"
                                        value={newProjectLocation}
                                        onChange={(e) => setNewProjectLocation(e.target.value)}
                                        className="h-8 text-xs w-32"
                                    />
                                    <Select value={newProjectType} onValueChange={setNewProjectType}>
                                        <SelectTrigger className="h-8 text-xs w-32 border-gray-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="commercial" className="text-xs">Commercial</SelectItem>
                                            <SelectItem value="residential" className="text-xs">Residential</SelectItem>
                                            <SelectItem value="industrial" className="text-xs">Industrial</SelectItem>
                                            <SelectItem value="infrastructure" className="text-xs">Infrastructure</SelectItem>
                                            <SelectItem value="mixed_use" className="text-xs">Mixed Use</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={handleDownload}
                                disabled={selectedCount === 0 || pushing}
                                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download Cleaned BOQ
                            </Button>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <Button
                                            onClick={handlePush}
                                            disabled={!canPush || pushing}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                                        >
                                            {pushing ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Pushing...
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowUpRight className="h-4 w-4 mr-1" />
                                                    Push to Project
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                {!canPush && pushDisabledReason && (
                                    <TooltipContent>
                                        <p className="text-xs">{pushDisabledReason}</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
