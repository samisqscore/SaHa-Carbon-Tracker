/**
 * @file AutomapModal.tsx
 * @description Dialog for on-demand material mapping against carbon datasets.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Loader2, CheckCircle2, AlertTriangle, XCircle, Info, Database, ArrowRight, Zap, TrendingUp, Calculator, Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmissionDataset } from "@shared/schema";

interface AutomapModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

interface MatchResult {
    projectMaterialId: string;
    originalName: string;
    matchedFactorId?: string;
    matchedFactorName?: string;
    confidence: number;
    method: string;
    currentFactorId?: string;
    currentFactorName?: string;
}

export default function AutomapModal({ open, onOpenChange, projectId }: AutomapModalProps) {
    const [step, setStep] = useState<"select" | "preview" | "done">("select");
    const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
    const [skipMapped, setSkipMapped] = useState(true);
    const [previewData, setPreviewData] = useState<{
        highConfidence: MatchResult[];
        lowConfidence: MatchResult[];
        noMatch: { projectMaterialId: string; originalName: string }[];
        conflicts: MatchResult[];
    } | null>(null);
    const [acceptedMappings, setAcceptedMappings] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<"high" | "low" | "conflicts" | "none">("high");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch production/active datasets
    const { data: datasets = [] } = useQuery<EmissionDataset[]>({
        queryKey: ["/api/datasets"],
        select: (data) => data.filter(d => (d.environment as string) === "production" || d.status === "active")
    });

    const previewMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/projects/${projectId}/automap/preview`, {
                datasetIds: selectedDatasets,
                skipMapped
            });
            return res.json();
        },
        onSuccess: (data) => {
            setPreviewData(data);
            // Auto-accept high confidence matches
            const initialAccepted: Record<string, string> = {};
            data.highConfidence.forEach((m: MatchResult) => {
                if (m.matchedFactorId) initialAccepted[m.projectMaterialId] = m.matchedFactorId;
            });
            setAcceptedMappings(initialAccepted);
            setStep("preview");
        },
        onError: (err: any) => {
            toast({ title: "Preview Failed", description: err.message, variant: "destructive" });
        }
    });

    const commitMutation = useMutation({
        mutationFn: async () => {
            const mappings = Object.entries(acceptedMappings).map(([pmId, efId]) => ({
                projectMaterialId: pmId,
                emissionFactorId: efId
            }));
            await apiRequest("POST", `/api/projects/${projectId}/automap/commit`, { mappings });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
            queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "materials"] });
            queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "emissions"] });
            setStep("done");
        },
        onError: (err: any) => {
            toast({ title: "Mapping Failed", description: err.message, variant: "destructive" });
        }
    });

    const handleToggleDataset = (id: string) => {
        setSelectedDatasets(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const handleToggleMapping = (pmId: string, efId: string) => {
        setAcceptedMappings(prev => {
            const next = { ...prev };
            if (next[pmId] === efId) {
                delete next[pmId];
            } else {
                next[pmId] = efId;
            }
            return next;
        });
    };

    const reset = () => {
        setStep("select");
        setPreviewData(null);
        setAcceptedMappings({});
        setActiveTab("high");
        setCurrentPage(1);
    };

    useEffect(() => {
        if (open) reset();
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Auto-Map Materials
                    </DialogTitle>
                    <DialogDescription>
                        Uses fuzzy matching and bracket normalization to find emission factors for your BOQ items.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden py-4">
                    {step === "select" && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <label className="text-sm font-semibold">1. Select Target Datasets</label>
                                <ScrollArea className="h-[250px] border rounded-md p-4">
                                    <div className="space-y-3">
                                        {datasets.map(ds => (
                                            <div key={ds.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md transition-colors">
                                                <Checkbox
                                                    id={`ds-${ds.id}`}
                                                    checked={selectedDatasets.includes(ds.id)}
                                                    onCheckedChange={() => handleToggleDataset(ds.id)}
                                                />
                                                <div className="flex-1 cursor-pointer" onClick={() => handleToggleDataset(ds.id)}>
                                                    <div className="text-sm font-medium">{ds.name}</div>
                                                    <div className="text-xs text-muted-foreground">{ds.region} • {ds.version}</div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px]">{ds.organizationId ? "Organization" : "Global"}</Badge>
                                            </div>
                                        ))}
                                        {datasets.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground italic">
                                                No production datasets available.
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold">2. Mapping Options</label>
                                <div className="flex items-center space-x-2 border p-3 rounded-md">
                                    <Checkbox
                                        id="skipMapped"
                                        checked={skipMapped}
                                        onCheckedChange={(checked) => setSkipMapped(!!checked)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor="skipMapped" className="text-sm font-medium leading-none cursor-pointer">
                                            Skip already mapped items
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            Only attempt to map items with "No source mapped".
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "preview" && previewData && (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="grid grid-cols-4 gap-2 text-center text-[10px] sm:text-xs">
                                <div
                                    className={`p-2 rounded-md border cursor-pointer transition-all ${activeTab === "high" ? "bg-green-100 border-green-300 ring-2 ring-green-200 ring-offset-1" : "bg-green-50 border-green-100 opacity-60 hover:opacity-100"}`}
                                    onClick={() => { setActiveTab("high"); setCurrentPage(1); }}
                                >
                                    <div className="font-bold text-green-700">{previewData.highConfidence.length}</div>
                                    <div className="text-green-600 truncate">High Confidence</div>
                                </div>
                                <div
                                    className={`p-2 rounded-md border cursor-pointer transition-all ${activeTab === "low" ? "bg-amber-100 border-amber-300 ring-2 ring-amber-200 ring-offset-1" : "bg-amber-50 border-amber-100 opacity-60 hover:opacity-100"}`}
                                    onClick={() => { setActiveTab("low"); setCurrentPage(1); }}
                                >
                                    <div className="font-bold text-amber-700">{previewData.lowConfidence.length}</div>
                                    <div className="text-amber-600 truncate">Suggested</div>
                                </div>
                                <div
                                    className={`p-2 rounded-md border cursor-pointer transition-all ${activeTab === "conflicts" ? "bg-red-100 border-red-300 ring-2 ring-red-200 ring-offset-1" : "bg-red-50 border-red-100 opacity-60 hover:opacity-100"}`}
                                    onClick={() => { setActiveTab("conflicts"); setCurrentPage(1); }}
                                >
                                    <div className="font-bold text-red-700">{previewData.conflicts.length}</div>
                                    <div className="text-red-600 truncate">Conflicts</div>
                                </div>
                                <div
                                    className={`p-2 rounded-md border cursor-pointer transition-all ${activeTab === "none" ? "bg-slate-200 border-slate-300 ring-2 ring-slate-200 ring-offset-1" : "bg-slate-50 border-slate-100 opacity-60 hover:opacity-100"}`}
                                    onClick={() => { setActiveTab("none"); setCurrentPage(1); }}
                                >
                                    <div className="font-bold text-slate-700">{previewData.noMatch.length}</div>
                                    <div className="text-slate-600 truncate">No Match</div>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 border rounded-md">
                                <div className="p-4 space-y-4">
                                    {(() => {
                                        let items: any[] = [];
                                        let title = "";
                                        let icon = <CheckCircle2 className="h-3 w-3" />;
                                        let colorClass = "text-green-700";
                                        let bgClass = "bg-green-50/30 border-green-100";

                                        if (activeTab === "high") {
                                            items = previewData.highConfidence;
                                            title = "High Confidence Matches";
                                        } else if (activeTab === "low") {
                                            items = previewData.lowConfidence;
                                            title = "Review Suggested Matches";
                                            icon = <AlertTriangle className="h-3 w-3" />;
                                            colorClass = "text-amber-700";
                                            bgClass = "bg-amber-50/30 border-amber-100";
                                        } else if (activeTab === "conflicts") {
                                            items = previewData.conflicts;
                                            title = "Potential Overwrites (Conflicts)";
                                            icon = <AlertTriangle className="h-3 w-3" />;
                                            colorClass = "text-red-700";
                                            bgClass = "bg-red-50/30 border-red-100";
                                        } else {
                                            items = previewData.noMatch;
                                            title = "No Matches Found";
                                            icon = <XCircle className="h-3 w-3" />;
                                            colorClass = "text-slate-500";
                                            bgClass = "bg-slate-50 border-slate-100";
                                        }

                                        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
                                        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                                        const paginatedItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                                        return (
                                            <>
                                                <div className="flex items-center justify-between sticky top-0 bg-white pb-2 z-10">
                                                    <h4 className={`text-xs font-bold uppercase tracking-tight flex items-center gap-1 ${colorClass}`}>
                                                        {icon} {title}
                                                    </h4>
                                                    {totalPages > 1 && (
                                                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                                                            <span>Page {currentPage} of {totalPages}</span>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-5 w-5"
                                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                                    disabled={currentPage === 1}
                                                                >
                                                                    {"<"}
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-5 w-5"
                                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                                    disabled={currentPage === totalPages}
                                                                >
                                                                    {">"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {items.length === 0 && (
                                                    <div className="text-center py-12 text-muted-foreground text-sm italic">
                                                        No items in this category.
                                                    </div>
                                                )}

                                                {paginatedItems.map(m => (
                                                    <div key={m.projectMaterialId}>
                                                        {activeTab === "conflicts" ? (
                                                            <div className={`p-3 border rounded-md text-sm ${bgClass}`}>
                                                                <div className="font-medium truncate mb-2">{m.originalName}</div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="p-2 border rounded bg-white relative cursor-pointer hover:border-blue-400 transition-colors" onClick={() => {
                                                                        const next = { ...acceptedMappings };
                                                                        delete next[m.projectMaterialId];
                                                                        setAcceptedMappings(next);
                                                                    }}>
                                                                        <div className="text-[10px] text-muted-foreground">CURRENT</div>
                                                                        <div className="text-xs truncate">{m.currentFactorName}</div>
                                                                        {acceptedMappings[m.projectMaterialId] !== m.matchedFactorId && (
                                                                            <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-blue-500" />
                                                                        )}
                                                                    </div>
                                                                    <div className="p-2 border rounded bg-white relative cursor-pointer hover:border-green-400 transition-colors" onClick={() => handleToggleMapping(m.projectMaterialId, m.matchedFactorId!)}>
                                                                        <div className="text-[10px] text-green-600">NEW MATCH</div>
                                                                        <div className="text-xs truncate">{m.matchedFactorName}</div>
                                                                        {acceptedMappings[m.projectMaterialId] === m.matchedFactorId && (
                                                                            <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-green-500" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : activeTab === "none" ? (
                                                            <div className="p-2 bg-slate-50 border border-slate-100 rounded text-xs text-muted-foreground truncate">
                                                                {m.originalName}
                                                            </div>
                                                        ) : (
                                                            <div className={`flex items-center justify-between p-3 border rounded-md text-sm ${bgClass}`}>
                                                                <div className="flex-1 min-w-0 pr-4">
                                                                    <div className="font-medium truncate">{m.originalName}</div>
                                                                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                                        <ArrowRight className="h-3 w-3" /> {m.matchedFactorName}
                                                                        {activeTab === "low" ? (
                                                                            <span className="text-[10px] text-amber-600 font-semibold ml-2">({Math.round(m.confidence)}% Match)</span>
                                                                        ) : (
                                                                            <Badge variant="outline" className="text-[10px] h-4 ml-1 capitalize">{m.method}</Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Checkbox
                                                                    checked={acceptedMappings[m.projectMaterialId] === m.matchedFactorId}
                                                                    onCheckedChange={() => handleToggleMapping(m.projectMaterialId, m.matchedFactorId!)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        );
                                    })()}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {step === "done" && (
                        <div className="py-12 text-center space-y-4">
                            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-bold">Auto-Mapping Complete!</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">
                                {Object.keys(acceptedMappings).length} materials have been successfully mapped and project emissions were recalculated.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    {step === "select" && (
                        <Button
                            onClick={() => previewMutation.mutate()}
                            disabled={selectedDatasets.length === 0 || previewMutation.isPending}
                        >
                            {previewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                            Scan Materials
                        </Button>
                    )}
                    {step === "preview" && (
                        <div className="flex gap-2 w-full">
                            <Button variant="ghost" onClick={() => setStep("select")}>Back</Button>
                            <div className="flex-1" />
                            <Button
                                onClick={() => commitMutation.mutate()}
                                disabled={Object.keys(acceptedMappings).length === 0 || commitMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {commitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Apply {Object.keys(acceptedMappings).length} Mappings
                            </Button>
                        </div>
                    )}
                    {step === "done" && (
                        <Button onClick={() => onOpenChange(false)} className="w-full">Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
