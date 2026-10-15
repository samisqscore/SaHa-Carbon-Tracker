/**
 * @file ProjectReportTab.tsx
 * @description Full 8-Section Embodied Carbon Report
 *
 * Section 1 — Report Header (project name, location, area, type, date, disclaimer)
 * Section 2 — Key Carbon Metrics (4 stat cards)
 * Section 3 — Emission Hotspot Analysis (top 3 + insight text)
 * Section 4 — Phase-wise Emissions (chart + insight text per phase)
 * Section 5 — Material-Level Table (sorted desc, top-20% highlighted, CSV export)
 * Section 6 — Reduction Opportunities (rule-based suggestions)
 * Section 7 — Benchmark Comparison (static typology ranges)
 * Section 8 — Methodology & Assumptions
 */

import { downloadProjectReport } from "@/lib/report-utils";
import { useQuery } from "@tanstack/react-query";
import {
    BarChart3, Package, ArrowRight, AlertTriangle, FileText,
    Download, Loader2, TrendingDown, Shield, Leaf, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Project } from "@shared/schema";
import { useLocation } from "wouter";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import AIRecommendations from "@/components/Reports/AIRecommendations";
import { kgToTonnes, formatTonnes, LIFECYCLE_COLORS as STAGE_COLORS } from "@/lib/emissions";

interface ProjectReportTabProps {
    project: Project;
    onNavigateTab: (tab: string) => void;
}

// Static typology benchmarks (kgCO2e/m²) per EN 15804
const BENCHMARKS: Record<string, { low: number; mid: number; high: number; label: string }> = {
    "Residential": { low: 300, mid: 500, high: 800, label: "Residential" },
    "Office": { low: 350, mid: 600, high: 950, label: "Office" },
    "Industrial Building": { low: 200, mid: 400, high: 700, label: "Industrial" },
    "Commercial": { low: 400, mid: 650, high: 1000, label: "Commercial" },
    "Mixed Use": { low: 350, mid: 580, high: 900, label: "Mixed Use" },
    "Education": { low: 300, mid: 500, high: 750, label: "Education" },
};
const DEFAULT_BENCHMARK = { low: 300, mid: 550, high: 900, label: "General Building" };

// Data-conditional reduction suggestions
function getRuleBasedSuggestions(
    materials: any[],
    totalEmissions: number,
    phases: any[]
) {
    const suggestions: { icon: any; title: string; description: string; saving: string }[] = [];
    if (!materials.length) return suggestions;

    const mapped = materials.filter(m => m.category !== 'Unmapped');
    const sorted = [...mapped].sort((a, b) => b.totalEmissions - a.totalEmissions);
    const top = sorted[0];
    const topPct = totalEmissions > 0 && top ? (top.totalEmissions / totalEmissions) * 100 : 0;

    // S1: Top material dominates
    if (top && topPct > 25) {
        suggestions.push({
            icon: TrendingDown,
            title: `Review specification for "${top.materialName}"`,
            description: `This single material accounts for ${topPct.toFixed(0)}% of total embodied carbon (${formatTonnes(kgToTonnes(top.totalEmissions))}). Specifying a lower-carbon alternative, recycled-content variant, or reducing quantities here will have the highest single-item impact.`,
            saving: `Up to ${formatTonnes(kgToTonnes(top.totalEmissions * 0.3))} potential saving`,
        });
    }

    // S2: Concrete/cement heavy — only show if they actually exist
    const concreteMaterials = mapped.filter(m => /concrete|cement|rebar|reinforc/i.test(m.materialName));
    const concreteTot = concreteMaterials.reduce((s, m) => s + m.totalEmissions, 0);
    const concretePct = totalEmissions > 0 ? (concreteTot / totalEmissions) * 100 : 0;
    if (concretePct > 30) {
        suggestions.push({
            icon: Leaf,
            title: `Specify lower-carbon concrete mixes (${concretePct.toFixed(0)}% of total)`,
            description: `Concrete and cement materials account for ${concretePct.toFixed(0)}% of embodied carbon. Switching to CEM II/B or using supplementary cementitious materials (GGBS or PFA) can reduce concrete's embodied carbon by 20–40% with equivalent structural performance.`,
            saving: `Up to ${formatTonnes(kgToTonnes(concreteTot * 0.35))} potential saving`,
        });
    }

    // S3: Steel heavy — only show if steel is significant
    const steelMaterials = mapped.filter(m => /steel|rebar|metal|galvanised/i.test(m.materialName));
    const steelTot = steelMaterials.reduce((s, m) => s + m.totalEmissions, 0);
    const steelPct = totalEmissions > 0 ? (steelTot / totalEmissions) * 100 : 0;
    if (steelPct > 15) {
        suggestions.push({
            icon: Shield,
            title: `Optimise structural steel (${steelPct.toFixed(0)}% of total)`,
            description: `Steel elements represent ${steelPct.toFixed(0)}% of embodied carbon. EAF (electric arc furnace) recycled-content steel can reduce embodied carbon by 30–60% vs. BOF primary steel. Structural optimisation to reduce member sizes also yields direct savings.`,
            saving: `Up to ${formatTonnes(kgToTonnes(steelTot * 0.45))} potential saving`,
        });
    }

    // S4: Fallback — local sourcing advice (always useful)
    if (suggestions.length < 2) {
        suggestions.push({
            icon: CheckCircle2,
            title: "Source materials locally and reduce waste",
            description: "Sourcing materials from suppliers within 50–100 km reduces A4 transport emissions significantly. Lean delivery scheduling and on-site waste management can also reduce A5 construction emissions by 10–20%. Enter supplier distances in the Materials tab to quantify this opportunity.",
            saving: "Varies by project logistics",
        });
    }

    return suggestions;
}


function downloadCSV(rows: any[], filename: string) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(",");
    const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export default function ProjectReportTab({ project, onNavigateTab }: ProjectReportTabProps) {
    const [, setLocation] = useLocation();
    const [isExporting, setIsExporting] = useState(false);
    const [viewMode, setViewMode] = useState<"executive" | "detailed">("executive");

    const { data: emissionsData, isLoading: isEmissionsLoading } = useQuery<any>({
        queryKey: ["/api/projects", project.id, "emissions"],
        enabled: !!project.id,
    });

    const { data: lifecycleRaw, isLoading: isLifecycleLoading } = useQuery<any>({
        queryKey: ["/api/projects", project.id, "emissions", "by-lifecycle"],
        enabled: !!project.id,
    });

    const lifecycleData = lifecycleRaw?.stages || [];
    const lifecycleGrandTotal = lifecycleRaw?.grandTotal || 0;

    const unmappedCount = emissionsData?.materials?.filter((m: any) => m.category === "Unmapped").length || 0;
    const isLoading = isEmissionsLoading || isLifecycleLoading;

    // Phase 18C: Calculation quality/confidence score
    const totalMaterialCount = emissionsData?.materials?.length || 0;
    const mappedCount = totalMaterialCount - unmappedCount;
    const mappedPct = totalMaterialCount > 0 ? Math.round((mappedCount / totalMaterialCount) * 100) : 0;
    const qualityLevel: 'high' | 'medium' | 'low' = mappedPct >= 85 ? 'high' : mappedPct >= 60 ? 'medium' : 'low';
    const qualityConfig = {
        high:   { label: 'High Confidence', colour: 'bg-emerald-50 border-emerald-300 text-emerald-800', dot: 'bg-emerald-500', note: 'Most materials are mapped. Results are reliable for design-stage decision making.' },
        medium: { label: 'Medium Confidence', colour: 'bg-amber-50 border-amber-300 text-amber-800', dot: 'bg-amber-500', note: 'Some materials lack emission factors. Map remaining items to improve accuracy.' },
        low:    { label: 'Low Confidence', colour: 'bg-red-50 border-red-300 text-red-800', dot: 'bg-red-500', note: 'Many materials are unmapped. Run Auto-Map before relying on these figures.' },
    }[qualityLevel];

    const formatEmissions = (value: number) => {
        if (value >= 1000) return formatTonnes(kgToTonnes(value));
        return `${value.toFixed(2)} kg CO₂e`;
    };

    const lifecycleChartData = [...lifecycleData]
        .sort((a: any, b: any) => {
            const order = ["A1-A3", "A4-A5", "B", "C1-C4", "D"];
            return order.indexOf(a.stage) - order.indexOf(b.stage);
        })
        .map((item: any) => ({
            name: item.stage,
            emissions: item.totalEmissions,
            percentage: lifecycleGrandTotal > 0 ? ((item.totalEmissions / lifecycleGrandTotal) * 100).toFixed(1) : "0",
            color: STAGE_COLORS[item.stage] || "#8884d8"
        }));

    // Top materials sorted desc
    const allMaterials: any[] = emissionsData?.materials || [];
    const sortedMaterials = [...allMaterials].sort((a, b) => b.totalEmissions - a.totalEmissions);
    const topMaterials = sortedMaterials.slice(0, 3);
    const top20Threshold = sortedMaterials.length > 0
        ? sortedMaterials[Math.floor(sortedMaterials.length * 0.2)]?.totalEmissions ?? 0
        : 0;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    const hasMaterials = allMaterials.length > 0;

    if (!hasMaterials) {
        return (
            <Card className="border-dashed border-2">
                <CardContent className="pt-10 pb-10 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Emissions Report Yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                        Map valid materials to calculate the carbon report. Upload a BOQ to extract and match materials, or add them manually.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Button onClick={() => setLocation(`/projects/${project.id}?tab=materials&action=import-boq`)}>
                            Upload BOQ
                        </Button>
                        <Button variant="outline" onClick={() => onNavigateTab("materials")}>
                            Add Manually
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const totalEmissions = emissionsData?.totalEmissions || 0;
    const intensity = project.buildingArea && project.buildingArea > 0
        ? totalEmissions / project.buildingArea
        : 0;

    const benchmark = BENCHMARKS[project.type || ""] || DEFAULT_BENCHMARK;
    const benchmarkStatus = intensity === 0 ? null
        : intensity <= benchmark.low ? "excellent"
            : intensity <= benchmark.mid ? "good"
                : intensity <= benchmark.high ? "average"
                    : "high";
    const benchmarkLabel: Record<string, string> = {
        excellent: "Well Below Industry Average ✓",
        good: "Below Industry Average ✓",
        average: "Near Industry Average",
        high: "Above Industry Average — Review Opportunities",
    };

    // ── E1: Narrative insight helpers ──────────────────────────────────────────
    // S2: Intensity context
    const intensityInsight = (() => {
        if (!intensity || !benchmarkStatus) return null;
        const gap = Math.abs(intensity - benchmark.mid);
        const dir = intensity < benchmark.mid ? 'below' : 'above';
        const pct = benchmark.mid > 0 ? ((gap / benchmark.mid) * 100).toFixed(0) : '0';
        return `At ${intensity.toFixed(0)} kgCO₂e/m², this project is ${pct}% ${dir} the ${benchmark.label.toLowerCase()} average (${benchmark.mid} kgCO₂e/m²).`;
    })();

    // S3: Dynamic hotspot narrative
    const hotspotInsight = (() => {
        if (topMaterials.length === 0) return '';
        const names = topMaterials.map((m: any) => m.materialName);
        const combinedPct = totalEmissions > 0
            ? ((topMaterials.reduce((s: number, m: any) => s + m.totalEmissions, 0) / totalEmissions) * 100).toFixed(0)
            : '0';
        const nameList = names.length === 1 ? names[0]
            : names.length === 2 ? `${names[0]} and ${names[1]}`
            : `${names[0]}, ${names[1]}, and ${names[2]}`;
        return `${nameList} together account for ${combinedPct}% of total embodied carbon. Prioritising specification changes or material substitution for ${names.length === 1 ? 'this material' : 'these materials'} will deliver the most significant reduction in this project's footprint.`;
    })();

    // S4: Per-stage insights (EN 15804)
    function getStageInsight(stageName: string, stagePct: string): string {
        const p = parseFloat(stagePct);
        if (stageName === 'A1-A3') {
            if (p >= 80) return `Product stage dominates at ${stagePct}% — typical for material-intensive buildings. Focus substitution efforts on materials in this stage for the highest impact.`;
            return `Product stage (A1-A3) accounts for ${stagePct}% of emissions. Material specification is the primary lever to reduce this.`;
        }
        if (stageName === 'A4-A5') {
            if (p < 1) return `A4-A5 (Construction) shows near-zero emissions — this usually means supplier distances have not been entered. Add distances in the Materials tab to capture transport emissions accurately.`;
            return `Construction stage (A4-A5) represents ${stagePct}% of total. Review supplier sourcing distances and on-site construction methods to reduce this.`;
        }
        if (stageName === 'B') return `In-use stage (B) is ${stagePct}%. Note: operational energy is not tracked here — this reflects embodied impacts of in-use replacements only.`;
        if (stageName === 'C1-C4') return `End-of-life stage (C1-C4) is ${stagePct}%. Design for disassembly and material recovery can reduce downstream impacts.`;
        if (stageName === 'D') return `Module D (${stagePct}%) represents potential benefits beyond system boundary — shown separately and not included in the total figure.`;
        return '';
    }

    // S4B: Project phase breakdown
    const phaseBreakdown: Record<string, number> = {};
    for (const m of allMaterials) {
        const phaseName = m.phase || 'Unassigned';
        phaseBreakdown[phaseName] = (phaseBreakdown[phaseName] || 0) + (m.totalEmissions || 0);
    }
    const phaseChartData = Object.entries(phaseBreakdown)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({
            name,
            emissions: value,
            percentage: totalEmissions > 0 ? ((value / totalEmissions) * 100).toFixed(1) : '0',
        }));
    const dominantPhase = phaseChartData[0];
    const phaseInsightText = dominantPhase
        ? `${dominantPhase.name} is the most carbon-intensive phase at ${dominantPhase.percentage}% (${formatEmissions(dominantPhase.emissions)}). ${dominantPhase.name === 'Unassigned' ? 'Consider assigning materials to specific project phases in the Materials tab to enable more granular phase analysis.' : 'Focus value-engineering and design reviews on this phase for the greatest carbon reduction opportunity.'}`
        : '';

    // S7: Benchmark gap narrative
    const benchmarkGapInsight = (() => {
        if (!benchmarkStatus || !intensity) return null;
        if (benchmarkStatus === 'excellent' || benchmarkStatus === 'good') {
            return `This project is performing in the top tier for ${benchmark.label.toLowerCase()} buildings. Maintaining this performance through detailed design and procurement will be key.`;
        }
        const gap = intensity - benchmark.low;
        const gapTonnes = project.buildingArea ? kgToTonnes(gap * project.buildingArea) : null;
        return `To reach best-practice target of ${benchmark.low} kgCO₂e/m², a reduction of ${gap.toFixed(0)} kgCO₂e/m² is required${gapTonnes ? ` — approximately ${formatTonnes(gapTonnes)} from this project` : ''}. Review the reduction opportunities below to identify the most actionable steps.`;
    })();
    // ──────────────────────────────────────────────────────────────────────────

    const ruleSuggestions = getRuleBasedSuggestions(allMaterials, totalEmissions, phaseChartData);

    // Phase insight text (lifecycle stage dominant)
    const dominantStage = [...lifecycleChartData].sort((a, b) => b.emissions - a.emissions)[0];
    const legacyPhaseInsight = dominantStage
        ? getStageInsight(dominantStage.name, dominantStage.percentage)
        : '';

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            await downloadProjectReport(project.id, project.name);
        } catch (err) {
            // Fallback: open print dialog if utility fails (though utility already toasts)
            window.print();
        } finally {
            setIsExporting(false);
        }
    };

    const handleCSVExport = () => {
        const rows = sortedMaterials.map((m: any) => ({
            Material: m.materialName,
            Category: m.category || "Uncategorised",
            "Lifecycle Stage": m.lifecycleStage || "A1-A3",
            "Quantity": m.quantity,
            "Unit": m.unit || "",
            "Emission Factor (kgCO2e/unit)": m.emissionFactor?.toFixed(4) || "0",
            "Total kgCO2e": m.totalEmissions?.toFixed(2) || "0",
            "Total tCO2e": kgToTonnes(m.totalEmissions || 0).toFixed(4),
            "% of Total": totalEmissions > 0 ? ((m.totalEmissions / totalEmissions) * 100).toFixed(1) : "0",
        }));
        downloadCSV(rows, `DMBoD_Carbon_Data_${project.name.replace(/\s+/g, "_")}.csv`);
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        SaHa Carbon Intelligence & Embodied Emissions Summary Report
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Indicative analysis based on uploaded quantities and material matches.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* Executive / Detailed toggle */}
                    <div className="flex rounded-md border overflow-hidden">
                        <button
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "executive" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50"}`}
                            onClick={() => setViewMode("executive")}
                        >Executive</button>
                        <button
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "detailed" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50"}`}
                            onClick={() => setViewMode("detailed")}
                        >Detailed</button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCSVExport}>
                        <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Download PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onNavigateTab("emissions")}>
                        <BarChart3 className="w-4 h-4 mr-2" /> View Analytics
                    </Button>
                </div>
            </div>

            {/* Phase 18C: Calculation quality banner */}
            {totalMaterialCount > 0 && (
                <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${qualityConfig.colour}`}>
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${qualityConfig.dot}`} />
                    <div className="flex-1">
                        <span className="font-semibold">{qualityConfig.label}</span>
                        <span className="mx-2 text-xs opacity-60">·</span>
                        <span className="text-xs">{mappedPct}% of materials mapped ({mappedCount}/{totalMaterialCount})</span>
                        <p className="text-xs mt-0.5 opacity-80">{qualityConfig.note}</p>
                    </div>
                    {unmappedCount > 0 && (
                        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                            onClick={() => {
                                onNavigateTab("materials");
                                setTimeout(() => setLocation(`/projects/${project.id}?tab=materials&action=automap`), 50);
                            }}>
                            Auto-Map
                        </Button>
                    )}
                </div>
            )}

            {/* Unmapped warning (kept for visibility when items are missing) */}
            {unmappedCount > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Report Incomplete</AlertTitle>
                    <AlertDescription className="text-amber-700 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <span>
                            <strong>{unmappedCount} materials</strong> are unmapped and contributing zero emissions.
                        </span>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 hover:bg-amber-100"
                            onClick={() => {
                                onNavigateTab("materials");
                                setTimeout(() => setLocation(`/projects/${project.id}?tab=materials&action=automap`), 50);
                            }}>
                            Auto-Map Materials
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div id="report-container" className="space-y-8">

                {/* ── SECTION 1: Report Header ── */}
                <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-white">
                    <CardContent className="pt-5 pb-4">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">Embodied Carbon Assessment</p>
                                <h1 className="text-2xl font-black text-slate-900">{project.name}</h1>
                                {/* E6: Core project metadata */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-xs text-gray-500">
                                    {project.location && <span>📍 <strong>Location:</strong> {project.location}</span>}
                                    {project.type && <span>🏗️ <strong>Type:</strong> {project.type}</span>}
                                    {project.buildingArea && <span>📏 <strong>GFA:</strong> {project.buildingArea.toLocaleString()} m²</span>}
                                    {(project as any).climateZone && <span>🌡️ <strong>Climate Zone:</strong> {(project as any).climateZone}</span>}
                                    {(project as any).floors && <span>🏢 <strong>Floors:</strong> {(project as any).floors}</span>}
                                    {(project as any).constructionMethod && <span>🔨 <strong>Method:</strong> {(project as any).constructionMethod}</span>}
                                    {(project as any).expectedDuration && <span>📅 <strong>Duration:</strong> {(project as any).expectedDuration}</span>}
                                    {project.status && <span>🔵 <strong>Status:</strong> {project.status}</span>}
                                </div>
                            </div>
                            <div className="text-right text-xs text-gray-400 shrink-0">
                                <p>Generated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                                <p className="mt-1">DMBoD Carbon Platform</p>
                                <p className="italic mt-2 max-w-xs text-right">Indicative only. Does not replace a verified LCA or EPD certification.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── SECTION 2: Key Carbon Metrics ── */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Key Carbon Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-5">
                                <p className="text-xs text-muted-foreground font-medium">Total Embodied Carbon</p>
                                <p className="text-3xl font-black text-primary mt-1">{formatEmissions(totalEmissions)}</p>
                                <p className="text-xs text-gray-400 mt-1">all lifecycle stages combined</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-5">
                                <p className="text-xs text-muted-foreground font-medium">Carbon Intensity</p>
                                {intensity > 0 ? (
                                    <>
                                        <p className="text-3xl font-black text-slate-800 mt-1">{intensity.toFixed(0)}<span className="text-sm font-normal text-gray-400"> kg/m²</span></p>
                                        {intensityInsight && <p className="text-xs text-gray-500 mt-1 leading-snug">{intensityInsight}</p>}
                                    </>
                                ) : (
                                    <p className="text-sm text-yellow-600 mt-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Set building area in project settings to enable intensity benchmarking</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-5">
                                <p className="text-xs text-muted-foreground font-medium">Materials Analysed</p>
                                <p className="text-3xl font-black text-slate-800 mt-1">{allMaterials.length}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {unmappedCount > 0
                                        ? <span className="text-amber-600">{unmappedCount} unmapped — emissions understated</span>
                                        : <span className="text-emerald-600">All materials mapped ✓</span>
                                    }
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-5">
                                <p className="text-xs text-muted-foreground font-medium">Top Contributor</p>
                                <p className="text-sm font-bold text-slate-800 mt-1 line-clamp-2" title={topMaterials[0]?.materialName}>
                                    {topMaterials[0]?.materialName || "—"}
                                </p>
                                {topMaterials[0] && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {((topMaterials[0].totalEmissions / totalEmissions) * 100).toFixed(0)}% of total · {topMaterials[0].category || 'Uncategorised'}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    {/* E4: Extra stat cards (Detailed mode only) */}
                    {viewMode === 'detailed' && (() => {
                        const mappedMats = allMaterials.filter((m: any) => m.category !== 'Unmapped');
                        const catTotals: Record<string, number> = {};
                        for (const m of mappedMats) {
                            const cat = m.category || 'Uncategorised';
                            catTotals[cat] = (catTotals[cat] || 0) + (m.totalEmissions || 0);
                        }
                        const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
                        const lifecycleData = lifecycleChartData;
                        const a4a5 = lifecycleData.find((d: any) => d.name === 'A4-A5');
                        const transportShare = totalEmissions > 0 && a4a5 ? (a4a5.emissions / totalEmissions * 100).toFixed(1) : null;
                        return (
                            <div className="grid grid-cols-2 gap-4 mt-3">
                                <Card className="border-dashed">
                                    <CardContent className="pt-4">
                                        <p className="text-xs text-muted-foreground font-medium">A4–A5 Transport & Construction Share</p>
                                        {transportShare !== null ? (
                                            <>
                                                <p className="text-2xl font-black text-slate-700 mt-1">{transportShare}<span className="text-sm font-normal text-gray-400">%</span></p>
                                                <p className="text-xs text-gray-400 mt-1">{a4a5 ? formatEmissions(a4a5.emissions) : ''} of total embodied carbon</p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-2">No A4-A5 emissions recorded — add supplier distances to capture transport.</p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="border-dashed">
                                    <CardContent className="pt-4">
                                        <p className="text-xs text-muted-foreground font-medium">Dominant Material Category</p>
                                        {topCat ? (
                                            <>
                                                <p className="text-lg font-black text-slate-700 mt-1 truncate" title={topCat[0]}>{topCat[0]}</p>
                                                <p className="text-xs text-gray-400 mt-1">{totalEmissions > 0 ? ((topCat[1] / totalEmissions) * 100).toFixed(0) : 0}% of total · {formatEmissions(topCat[1])}</p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-2">No mapped categories yet.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })()}
                </div>

                {/* E9: Scope 1/2/3 clarification */}
                {viewMode === 'detailed' && totalEmissions > 0 && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex gap-4 items-start">
                        <span className="font-semibold text-slate-700 shrink-0 mt-0.5">GHG Scope Breakdown</span>
                        <div className="flex gap-6 flex-wrap">
                            <div><p className="text-gray-400">Scope 1</p><p className="font-bold text-slate-700">0 kgCO₂e</p></div>
                            <div><p className="text-gray-400">Scope 2</p><p className="font-bold text-slate-700">0 kgCO₂e</p></div>
                            <div><p className="text-gray-400">Scope 3</p><p className="font-bold text-slate-700">{formatEmissions(totalEmissions)}</p></div>
                        </div>
                        <p className="text-gray-400 ml-auto hidden md:block max-w-xs text-right">All embodied carbon is classified as Scope 3 (upstream purchased goods &amp; services) per GHG Protocol.</p>
                    </div>
                )}

                {/* ── SECTION 3: Hotspot Analysis ── */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Emission Hotspot Analysis</h3>
                    <Card>
                        <CardContent className="pt-5">
                            <div className="space-y-4">
                                {topMaterials.length === 0 && <p className="text-gray-400 text-sm">No mapped materials yet.</p>}
                                {topMaterials.map((m: any, idx: number) => {
                                    const pct = totalEmissions > 0 ? (m.totalEmissions / totalEmissions) * 100 : 0;
                                    const colours = ["bg-red-500", "bg-orange-400", "bg-amber-400"];
                                    return (
                                        <div key={idx} className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="font-semibold text-sm text-slate-800 truncate pr-2">{m.materialName}</p>
                                                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{formatEmissions(m.totalEmissions)}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className={`${colours[idx]} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {pct.toFixed(1)}% of total · {m.category || 'Uncategorised'} · {m.lifecycleStage || 'A1-A3'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {topMaterials.length > 0 && hotspotInsight && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <p className="text-xs text-blue-700">
                                            <strong>Insight:</strong> {hotspotInsight}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── SECTION 4: Lifecycle Stage Breakdown (EN 15804) ── */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Lifecycle Stage Breakdown (EN 15804)</h3>
                    <Card>
                        <CardContent className="pt-5">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={lifecycleChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={v => v >= 1000 ? `${kgToTonnes(v).toFixed(0)}t` : `${v}`} tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(value: number) => [formatEmissions(value), "Emissions"]} />
                                    <Bar dataKey="emissions" radius={[4, 4, 0, 0]}>
                                        {lifecycleChartData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            {/* Per-stage insights */}
                            <div className="mt-4 space-y-2">
                                {lifecycleChartData.map((entry: any) => {
                                    const insight = getStageInsight(entry.name, entry.percentage);
                                    if (!insight) return null;
                                    return (
                                        <div key={entry.name} className="flex gap-2 text-xs">
                                            <span className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                                            <p className="text-slate-600"><strong>{entry.name}:</strong> {insight}</p>
                                        </div>
                                    );
                                })}
                                {lifecycleChartData.length === 0 && (
                                    <p className="text-xs text-gray-400">No lifecycle stage data available. Map materials to see breakdown.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── SECTION 4B: Project Phase Breakdown ── */}
                {phaseChartData.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Project Phase Breakdown</h3>
                        <Card>
                            <CardContent className="pt-5">
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={phaseChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tickFormatter={v => v >= 1000 ? `${kgToTonnes(v).toFixed(0)}t` : `${v}`} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(value: number) => [formatEmissions(value), "Emissions"]} />
                                        <Bar dataKey="emissions" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                            {phaseChartData.map((_: any, index: number) => (
                                                <Cell key={`phase-cell-${index}`}
                                                    fill={["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#64748b"][index % 6]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                {phaseInsightText && (
                                    <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                                        <p className="text-xs text-violet-700"><strong>Insight:</strong> {phaseInsightText}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── SECTION 5: Material Table (Detailed mode only) ── */}
                {viewMode === "detailed" && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Material Breakdown</h3>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleCSVExport}>
                                <Download className="h-3 w-3 mr-1" /> Export CSV
                            </Button>
                        </div>
                        <Card>
                            <CardContent className="pt-3 px-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs min-w-[640px]">
                                        <thead>
                                            <tr className="border-b text-gray-400">
                                                <th className="text-left py-2 px-4 font-medium">Material</th>
                                                <th className="text-left py-2 px-2 font-medium">Category</th>
                                                <th className="text-left py-2 px-2 font-medium">Phase</th>
                                                <th className="text-left py-2 px-2 font-medium">Stage</th>
                                                <th className="text-right py-2 px-4 font-medium">Emissions</th>
                                                <th className="text-right py-2 px-4 font-medium">% Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedMaterials.map((m: any, i: number) => {
                                                const pct = totalEmissions > 0 ? (m.totalEmissions / totalEmissions) * 100 : 0;
                                                const isTopPct = m.totalEmissions >= top20Threshold && top20Threshold > 0;
                                                return (
                                                    <tr key={i} className={`border-b last:border-0 ${isTopPct ? "bg-amber-50/60" : "hover:bg-gray-50"}`}>
                                                        <td className="py-2.5 px-4">
                                                            <div className="flex items-center gap-2">
                                                                {isTopPct && <span className="text-amber-500 text-[9px] font-bold uppercase tracking-wide">HIGH</span>}
                                                                <span className="font-medium text-gray-800 truncate max-w-[180px]" title={m.materialName}>{m.materialName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-gray-400 whitespace-nowrap">{m.category || "—"}</td>
                                                        <td className="py-2.5 px-2 text-gray-400 whitespace-nowrap">{m.phase || 'Unassigned'}</td>
                                                        <td className="py-2.5 px-2">
                                                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">
                                                                {m.lifecycleStage || 'A1-A3'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-medium">{formatEmissions(m.totalEmissions)}</td>
                                                        <td className="py-2.5 px-4 text-right text-gray-500">{pct.toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* E8: Transport Breakdown Panel (Detailed mode) */}
                {viewMode === 'detailed' && (() => {
                    const withDistance = allMaterials.filter((m: any) => m.supplierDistance > 0 || m.transportEmissions > 0);
                    return (
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Transport Emissions (A4)</h3>
                            <Card>
                                <CardContent className="pt-4">
                                    {withDistance.length === 0 ? (
                                        <div className="text-center py-6">
                                            <p className="text-sm text-gray-400">No supplier distances recorded.</p>
                                            <p className="text-xs text-gray-400 mt-1">Add distances in the Materials tab to enable transport emission analysis.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs min-w-[480px]">
                                                    <thead>
                                                        <tr className="border-b text-gray-400">
                                                            <th className="text-left py-2 px-3 font-medium">Material</th>
                                                            <th className="text-right py-2 px-3 font-medium">Distance (km)</th>
                                                            <th className="text-left py-2 px-3 font-medium">Mode</th>
                                                            <th className="text-right py-2 px-3 font-medium">Transport kgCO₂e</th>
                                                            <th className="text-right py-2 px-3 font-medium">% of Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {withDistance
                                                            .sort((a: any, b: any) => (b.transportEmissions || 0) - (a.transportEmissions || 0))
                                                            .slice(0, 10)
                                                            .map((m: any, i: number) => {
                                                                const tPct = totalEmissions > 0 ? ((m.transportEmissions || 0) / totalEmissions * 100).toFixed(2) : '0';
                                                                return (
                                                                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                                                        <td className="py-2 px-3 font-medium text-gray-800 truncate max-w-[160px]">{m.materialName}</td>
                                                                        <td className="py-2 px-3 text-right text-gray-500">{(m.supplierDistance || 0).toLocaleString()}</td>
                                                                        <td className="py-2 px-3">
                                                                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600">
                                                                                {m.transportMode || 'Road'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 px-3 text-right font-mono">{((m.transportEmissions || 0)).toFixed(2)} kg</td>
                                                                        <td className="py-2 px-3 text-right text-gray-500">{tPct}%</td>
                                                                    </tr>
                                                                );
                                                            })
                                                        }
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                <p className="text-xs text-blue-700">
                                                    <strong>Insight:</strong> Transport emissions are calculated using mode-specific factors (Road 0.062 · Rail 0.022 · Ship 0.015 · Air 0.602 kgCO₂e/tonne-km). Consider local sourcing for the highest-distance materials to reduce A4 stage emissions.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    );
                })()}

                {/* ── SECTION 6: Reduction Opportunities ── */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Reduction Opportunities</h3>
                    <div className="space-y-3">
                        {ruleSuggestions.map((s, i) => (
                            <Card key={i} className="border-l-4 border-l-emerald-400">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-emerald-50 p-2 rounded-lg">
                                            <s.icon className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800">{s.title}</p>
                                            <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                                            <Badge variant="outline" className="mt-2 text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                                                {s.saving}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {/* AI suggestions below rule-based */}
                        <AIRecommendations projectId={project.id} />
                    </div>
                </div>

                {/* ── SECTION 7: Benchmark Comparison ── */}
                {intensity > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Benchmark Comparison</h3>
                        <Card>
                            <CardContent className="pt-5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-slate-700">{benchmark.label} Typology (kgCO₂e/m²)</p>
                                    {benchmarkStatus && (
                                        <Badge className={
                                            benchmarkStatus === "excellent" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                                                benchmarkStatus === "good" ? "bg-blue-100 text-blue-700 border-blue-300" :
                                                    benchmarkStatus === "average" ? "bg-amber-100 text-amber-700 border-amber-300" :
                                                        "bg-red-100 text-red-700 border-red-300"
                                        } variant="outline">
                                            {benchmarkLabel[benchmarkStatus]}
                                        </Badge>
                                    )}
                                </div>
                                {/* Benchmark scale bar */}
                                <div className="relative mt-4 mb-6">
                                    <div className="h-4 w-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-red-400" />
                                    {/* Markers */}
                                    {[
                                        { label: `${benchmark.low}`, position: 5, desc: "Best Practice" },
                                        { label: `${benchmark.mid}`, position: 47, desc: "Average" },
                                        { label: `${benchmark.high}`, position: 88, desc: "High" },
                                    ].map((m, i) => (
                                        <div key={i} className="absolute top-5 text-center" style={{ left: `${m.position}%`, transform: "translateX(-50%)" }}>
                                            <div className="w-px h-2 bg-gray-400 mx-auto" />
                                            <p className="text-[9px] text-gray-500 mt-0.5">{m.label}</p>
                                            <p className="text-[9px] text-gray-400">{m.desc}</p>
                                        </div>
                                    ))}
                                    {/* This project marker */}
                                    {(() => {
                                        const clamped = Math.min(Math.max(intensity, 0), benchmark.high * 1.2);
                                        const pos = (clamped / (benchmark.high * 1.2)) * 100;
                                        return (
                                            <div className="absolute -top-2 text-center" style={{ left: `${Math.min(pos, 96)}%`, transform: "translateX(-50%)" }}>
                                                <div className="text-[9px] font-bold text-white bg-slate-800 rounded px-1 py-0.5 whitespace-nowrap">
                                                    This project: {intensity.toFixed(0)}
                                                </div>
                                                <div className="w-0.5 h-6 bg-slate-800 mx-auto" />
                                            </div>
                                        );
                                    })()}
                                </div>
                                {/* E5: Gap narrative */}
                                {benchmarkGapInsight && (
                                    <div className="mt-8 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-600">{benchmarkGapInsight}</p>
                                    </div>
                                )}
                                <p className="text-[10px] text-gray-400 mt-3">
                                    Benchmarks sourced from LETI Embodied Carbon Primer (2020) and RIBA 2030 Climate Challenge. Values are indicative ranges for {benchmark.label.toLowerCase()} typology in the UK market.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── SECTION 8: Methodology & Assumptions ── */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Methodology & Assumptions</h3>
                    <Card className="bg-slate-50 border-slate-200">
                        <CardContent className="pt-5 text-xs text-slate-600 space-y-3">
                            <div>
                                <p className="font-semibold text-slate-700 mb-1">Calculation Methodology</p>
                                <p>Embodied carbon is calculated using the formula: <em>Quantity (unit) × Emission Factor (kgCO₂e/unit)</em>. Transport (A4) emissions use mode-specific factors: Road 0.062 · Rail 0.022 · Ship 0.015 · Air 0.602 kgCO₂e/tonne-km, applied to the supplier distance entered per material. Installation (A5) emissions use category-level energy benchmarks per EN 15804. Waste uplift is only applied when explicitly set on a material — no silent defaults are applied.</p>
                                <p className="mt-1">Calculation confidence: <strong>{mappedPct}% of materials mapped</strong>. Figures for unmapped materials are excluded and shown as zero.</p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700 mb-1">Emission Factor Source</p>
                                <p>Emission factors are sourced from the DMBoD dataset, which aggregates data from: ICE Database v3.0 (Bath University), Ecoinvent v3.x (where available), and Environmental Product Declarations (EPDs) via the DMBoD EPD Sync. Factors are reviewed periodically. Dataset version and validity window are visible in the Data Sources module.</p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700 mb-1">Lifecycle Scope</p>
                                <p>This assessment covers stages A1–A3 (product stage: raw material extraction, transport to manufacturer, manufacturing) as a minimum. Where data is available, A4–A5 (construction process), B (in-use), and C1–C4 (end-of-life) stages are also included. Module D (beyond boundary) benefits are shown separately and not added to the total.</p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700 mb-1">Exclusions & Limitations</p>
                                <p>This report does not include: operational carbon (energy in use), embodied carbon of MEP systems unless explicitly added, or carbon sequestration in biogenic materials unless the selected EPD includes it. AI-generated material matches are indicative and should be verified by a qualified sustainability consultant before use in formal submissions.</p>
                            </div>
                            <div className="pt-2 border-t border-slate-200">
                                <p className="italic text-slate-400">
                                    This assessment is generated by the DMBoD Carbon Intelligence Platform. It does not constitute a verified LCA, EPD, or BREEAM/LEED submission document. All figures are indicative only.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* E10: Next Steps Action Panel */}
                {(() => {
                    const actions: { icon: string; label: string; detail: string; cta?: string; ctaAction?: () => void }[] = [];
                    if (unmappedCount > 0) actions.push({ icon: '🔗', label: `Map ${unmappedCount} unmapped material${unmappedCount > 1 ? 's' : ''}`, detail: 'Unmapped materials contribute zero to the total — run Auto-Map to resolve these.', cta: 'Auto-Map', ctaAction: () => { onNavigateTab('materials'); setTimeout(() => setLocation(`/projects/${project.id}?tab=materials&action=automap`), 50); } });
                    if (!project.buildingArea) actions.push({ icon: '📏', label: 'Set building area', detail: 'Required to calculate carbon intensity (kgCO₂e/m²) and compare against industry benchmarks.' });
                    if (!project.type) actions.push({ icon: '🏗️', label: 'Set project type', detail: 'Required for accurate benchmark comparison (Office, Residential, Industrial, etc.).' });
                    const hasDistances = allMaterials.some((m: any) => (m.supplierDistance || 0) > 0);
                    if (!hasDistances) actions.push({ icon: '🚚', label: 'Add supplier distances', detail: 'Transport (A4) emissions are not captured. Add distances per material to quantify transport carbon.' });
                    if ((benchmarkStatus === 'high' || benchmarkStatus === 'average') && topMaterials.length > 0) {
                        actions.push({ icon: '🔍', label: 'Review top emitters for substitution', detail: `${topMaterials[0]?.materialName || 'Top material'} is the highest single emitter. Evaluate lower-carbon alternatives or reduced quantities.` });
                    }
                    if (actions.length === 0) return null;
                    return (
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Recommended Next Steps</h3>
                            <div className="space-y-2">
                                {actions.map((action, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                                        <span className="text-lg shrink-0 mt-0.5">{action.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{action.detail}</p>
                                        </div>
                                        {action.cta && action.ctaAction && (
                                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={action.ctaAction}>
                                                {action.cta}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}
