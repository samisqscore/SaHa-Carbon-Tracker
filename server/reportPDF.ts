/**
 * @file reportPDF.ts
 * @description Server-side PDF generator using @react-pdf/renderer.
 * Pure Node.js — no browser required. Compatible with Railway.app.
 *
 * Sections:
 *   1. Report Header (E6: richer metadata)
 *   2. Key Metrics (E1: intensity context, mapping status)
 *   3. Hotspot Analysis (E1: dynamic named insight)
 *   4. Lifecycle Stage Breakdown (E2: renamed, per-stage insights)
 *   4B. Project Phase Breakdown (E2: new)
 *   5. Material Breakdown (E3: Phase + Stage columns)
 *   5B. Transport Emissions A4 (E8: new)
 *   6. Reduction Opportunities
 *   7. Benchmark Comparison (E5: gap narrative)
 *   8. Methodology & Assumptions (E11: corrected transport wording)
 *   9. Recommended Next Steps (E10: new)
 */

import React from "react";
import {
    Document, Page, Text, View, StyleSheet, renderToBuffer
} from "@react-pdf/renderer";

// ── Styles ──────────────────────────────────────────────────────────────────
const BRAND = {
    primary: "#0F62FE",
    green: "#198038",
    amber: "#F59E0B",
    red: "#DA1E28",
    slate: "#1E293B",
    gray: "#6B7280",
    lightGray: "#F1F5F9",
    border: "#E2E8F0",
    white: "#FFFFFF",
    violet: "#7C3AED",
    indigo: "#4F46E5",
};

const styles = StyleSheet.create({
    page: {
        fontFamily: "Helvetica",
        fontSize: 9,
        color: BRAND.slate,
        paddingTop: 40,
        paddingBottom: 50,
        paddingHorizontal: 40,
        backgroundColor: BRAND.white,
    },
    pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BRAND.border },
    pageFooter: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: BRAND.border, paddingTop: 6 },
    footerText: { fontSize: 7, color: BRAND.gray },
    section: { marginBottom: 18 },
    sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BRAND.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: BRAND.border, paddingBottom: 4 },
    card: { backgroundColor: BRAND.lightGray, borderRadius: 4, padding: 10, marginBottom: 8 },
    cardrow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND.slate, marginBottom: 2 },
    label: { fontSize: 7, color: BRAND.gray, marginBottom: 2 },
    value: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND.primary },
    valueSub: { fontSize: 7, color: BRAND.gray, marginTop: 2 },
    body: { fontSize: 8, color: BRAND.slate, lineHeight: 1.5 },
    bodyGray: { fontSize: 7.5, color: BRAND.gray, lineHeight: 1.5 },
    tableHeader: { flexDirection: "row", backgroundColor: BRAND.border, padding: "4 6", fontFamily: "Helvetica-Bold", fontSize: 7, color: BRAND.slate },
    tableRow: { flexDirection: "row", padding: "3 6", borderBottomWidth: 1, borderBottomColor: BRAND.border },
    tableRowHighlight: { flexDirection: "row", padding: "3 6", borderBottomWidth: 1, borderBottomColor: BRAND.border, backgroundColor: "#FFF7ED" },
    barBg: { height: 7, backgroundColor: BRAND.border, borderRadius: 4, marginTop: 3, marginBottom: 2 },
    barFill: { height: 7, borderRadius: 4 },
    badge: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5, fontSize: 7, fontFamily: "Helvetica-Bold" },
    row: { flexDirection: "row" },
    col2: { flex: 1 },
    insightBox: { backgroundColor: "#EFF6FF", borderLeftWidth: 3, borderLeftColor: BRAND.primary, padding: 6, marginTop: 6, borderRadius: 2 },
    insightBoxGreen: { backgroundColor: "#F0FDF4", borderLeftWidth: 3, borderLeftColor: BRAND.green, padding: 6, marginTop: 6, borderRadius: 2 },
    insightBoxViolet: { backgroundColor: "#F5F3FF", borderLeftWidth: 3, borderLeftColor: BRAND.violet, padding: 6, marginTop: 6, borderRadius: 2 },
    insightBoxAmber: { backgroundColor: "#FFFBEB", borderLeftWidth: 3, borderLeftColor: BRAND.amber, padding: 6, marginTop: 6, borderRadius: 2 },
    insightText: { fontSize: 7.5, color: "#1D4ED8", lineHeight: 1.5 },
    insightTextGreen: { fontSize: 7.5, color: BRAND.green, lineHeight: 1.5 },
    insightTextViolet: { fontSize: 7.5, color: BRAND.violet, lineHeight: 1.5 },
    insightTextAmber: { fontSize: 7.5, color: "#B45309", lineHeight: 1.5 },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function kgToTonnes(kg: number) { return kg / 1000; }
function fmt(kg: number) {
    if (kg >= 1000) return `${kgToTonnes(kg).toFixed(2)} tCO₂e`;
    return `${kg.toFixed(2)} kgCO₂e`;
}
function pct(part: number, total: number) {
    if (!total) return "0%";
    return `${((part / total) * 100).toFixed(1)}%`;
}
function pctNum(part: number, total: number) {
    if (!total) return 0;
    return (part / total) * 100;
}

// E1: Per-stage insight text (EN 15804)
function getStageInsight(stageName: string, stagePct: number): string {
    const p = stagePct;
    if (stageName === "A1-A3") {
        if (p >= 80) return `Product stage dominates at ${p.toFixed(0)}% — typical for material-intensive buildings. Focus substitution efforts on materials in this stage for the highest impact.`;
        return `Product stage (A1-A3) accounts for ${p.toFixed(0)}% of emissions. Material specification is the primary lever to reduce this.`;
    }
    if (stageName === "A4-A5") {
        if (p < 1) return `A4-A5 (Construction) shows near-zero emissions — this typically means supplier distances have not been entered. Add distances to the Materials tab to capture transport emissions.`;
        return `Construction stage (A4-A5) represents ${p.toFixed(0)}% of total. Review supplier sourcing distances and on-site methods to reduce this.`;
    }
    if (stageName === "B") return `In-use stage (B) is ${p.toFixed(0)}% — reflects embodied impacts of in-use replacements only.`;
    if (stageName === "C1-C4") return `End-of-life stage (C1-C4) is ${p.toFixed(0)}%. Design for disassembly and material recovery can reduce downstream impacts.`;
    if (stageName === "D") return `Module D (${p.toFixed(0)}%) — potential benefits beyond system boundary; shown separately and not included in the total.`;
    return "";
}

const BENCHMARKS: Record<string, { low: number; mid: number; high: number; label: string }> = {
    "Residential": { low: 300, mid: 500, high: 800, label: "Residential" },
    "Office": { low: 350, mid: 600, high: 950, label: "Office" },
    "Industrial Building": { low: 200, mid: 400, high: 700, label: "Industrial" },
    "Commercial": { low: 400, mid: 650, high: 1000, label: "Commercial" },
    "Mixed Use": { low: 350, mid: 580, high: 900, label: "Mixed Use" },
    "Education": { low: 300, mid: 500, high: 750, label: "Education" },
};
const DEFAULT_BENCHMARK = { low: 300, mid: 550, high: 900, label: "General Building" };

// ── Report Document Component ─────────────────────────────────────────────────
interface ReportProps {
    project: any;
    emissions: any;
    lifecycleData: any;
    generatedAt: string;
}

function ReportDocument({ project, emissions, lifecycleData, generatedAt }: ReportProps) {
    const materials: any[] = emissions?.materials || [];
    const totalEmissions: number = emissions?.totalEmissions || 0;
    const sortedMats = [...materials].sort((a, b) => b.totalEmissions - a.totalEmissions);
    const topMaterials = sortedMats.slice(0, 3);
    const top20Threshold = sortedMats.length
        ? sortedMats[Math.floor(sortedMats.length * 0.2)]?.totalEmissions ?? 0
        : 0;

    const mappedMats = materials.filter(m => m.category !== "Unmapped" && m.category !== null);
    const unmappedCount = materials.length - mappedMats.length;
    const mappedPct = materials.length > 0 ? Math.round((mappedMats.length / materials.length) * 100) : 0;

    const intensity = project.buildingArea > 0 ? totalEmissions / project.buildingArea : 0;
    const benchmark = BENCHMARKS[project.type || ""] || DEFAULT_BENCHMARK;

    const stages: any[] = lifecycleData?.stages || [];
    const grandTotal: number = lifecycleData?.grandTotal || totalEmissions;
    const stageOrder = ["A1-A3", "A4-A5", "B", "C1-C4", "D"];
    const sortedStages = [...stages].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));
    const dominantStage = [...stages].sort((a, b) => b.totalEmissions - a.totalEmissions)[0];

    // Benchmark status
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

    // E1: Intensity insight
    const intensityInsight = (() => {
        if (!intensity || !benchmarkStatus) return null;
        const gap = Math.abs(intensity - benchmark.mid);
        const dir = intensity < benchmark.mid ? "below" : "above";
        const p = benchmark.mid > 0 ? ((gap / benchmark.mid) * 100).toFixed(0) : "0";
        return `At ${intensity.toFixed(0)} kgCO₂e/m², this project is ${p}% ${dir} the ${benchmark.label.toLowerCase()} average (${benchmark.mid} kgCO₂e/m²).`;
    })();

    // E1: Hotspot insight
    const hotspotInsight = (() => {
        if (topMaterials.length === 0) return "";
        const names = topMaterials.map((m: any) => m.materialName?.slice(0, 28));
        const combinedPct = pct(topMaterials.reduce((s: number, m: any) => s + m.totalEmissions, 0), totalEmissions);
        const nameList = names.length === 1 ? names[0]
            : names.length === 2 ? `${names[0]} and ${names[1]}`
            : `${names[0]}, ${names[1]}, and ${names[2]}`;
        return `${nameList} together account for ${combinedPct} of total embodied carbon. Prioritising specification changes or material substitution for ${names.length === 1 ? "this material" : "these materials"} will deliver the most significant reduction.`;
    })();

    // E5: Benchmark gap narrative
    const benchmarkGapInsight = (() => {
        if (!benchmarkStatus || !intensity) return null;
        if (benchmarkStatus === "excellent" || benchmarkStatus === "good") {
            return `This project is performing in the top tier for ${benchmark.label.toLowerCase()} buildings. Maintaining this performance through detailed design and procurement will be key.`;
        }
        const gap = intensity - benchmark.low;
        const gapTonnes = project.buildingArea ? kgToTonnes(gap * project.buildingArea) : null;
        return `To reach best-practice target of ${benchmark.low} kgCO₂e/m², a reduction of ${gap.toFixed(0)} kgCO₂e/m² is required${gapTonnes ? ` — approximately ${gapTonnes.toFixed(1)} tCO₂e from this project` : ""}. Review the reduction opportunities section for the most actionable steps.`;
    })();

    // S4B: Project Phase Breakdown
    const phaseBreakdown: Record<string, number> = {};
    for (const m of materials) {
        const phaseName = m.phase || "Unassigned";
        phaseBreakdown[phaseName] = (phaseBreakdown[phaseName] || 0) + (m.totalEmissions || 0);
    }
    const phaseChartData = Object.entries(phaseBreakdown)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);
    const dominantPhase = phaseChartData[0];
    const phaseInsightText = dominantPhase
        ? `${dominantPhase[0]} is the most carbon-intensive phase at ${pct(dominantPhase[1], totalEmissions)} (${fmt(dominantPhase[1])}). ${dominantPhase[0] === "Unassigned" ? "Consider assigning materials to specific project phases to enable granular phase analysis." : "Focus value-engineering and design reviews on this phase for the greatest carbon reduction opportunity."}`
        : "";

    // E8: Transport materials
    const withTransport = materials
        .filter((m: any) => (m.supplierDistance || 0) > 0 || (m.transportEmissions || 0) > 0)
        .sort((a: any, b: any) => (b.transportEmissions || 0) - (a.transportEmissions || 0))
        .slice(0, 8);

    // E10: Next Steps
    const nextSteps: string[] = [];
    if (unmappedCount > 0) nextSteps.push(`Map ${unmappedCount} unmapped material${unmappedCount > 1 ? "s" : ""} via Auto-Map in the Materials tab to improve report accuracy.`);
    if (!project.buildingArea) nextSteps.push("Set building GFA (m²) in Project Settings to enable carbon intensity (kgCO₂e/m²) calculation and benchmarking.");
    if (!project.type) nextSteps.push("Set project type (Office, Residential, Industrial…) for accurate benchmark comparison.");
    if (withTransport.length === 0) nextSteps.push("Add supplier distances per material in the Materials tab to quantify A4 transport emissions.");
    if (benchmarkStatus === "high" || benchmarkStatus === "average") {
        if (topMaterials[0]) nextSteps.push(`Review specification for "${topMaterials[0].materialName?.slice(0, 40)}" — the highest single emitter. Evaluate lower-carbon alternatives or reduced quantities.`);
    }

    // ── Document ──────────────────────────────────────────────────────────────
    return React.createElement(Document, { title: `SaHa Carbon Report — ${project.name}` },
        React.createElement(Page, { size: "A4", style: styles.page },

            // ── Page Header (fixed) ──
            React.createElement(View, { style: styles.pageHeader, fixed: true },
                React.createElement(Text, { style: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BRAND.primary } }, "DMBoD Carbon Intelligence Platform"),
                React.createElement(Text, { style: styles.footerText }, generatedAt)
            ),

            // ── Section 1: Report Header (E6) ──
            React.createElement(View, { style: [styles.section, { backgroundColor: "#EFF6FF", padding: 14, borderRadius: 4, borderLeftWidth: 4, borderLeftColor: BRAND.primary }] },
                React.createElement(Text, { style: { fontSize: 7, color: BRAND.primary, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 4 } }, "EMBODIED CARBON ASSESSMENT"),
                React.createElement(Text, { style: styles.h1 }, project.name),
                React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 } },
                    ...[
                        project.location && `Location: ${project.location}`,
                        project.type && `Type: ${project.type}`,
                        project.buildingArea && `GFA: ${project.buildingArea.toLocaleString()} m²`,
                        project.status && `Status: ${project.status}`,
                        (project as any).floors && `Floors: ${(project as any).floors}`,
                        (project as any).constructionMethod && `Method: ${(project as any).constructionMethod}`,
                    ].filter(Boolean).map((txt, i) =>
                        React.createElement(Text, { key: i, style: styles.bodyGray }, txt as string)
                    )
                ),
                React.createElement(Text, { style: { ...styles.bodyGray, marginTop: 6, fontStyle: "italic" } },
                    "Indicative only. Does not constitute a verified LCA or EPD certification."
                )
            ),

            // ── Section 2: Key Metrics (E1) ──
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Key Carbon Metrics"),
                React.createElement(View, { style: styles.cardrow },
                    ...[
                        {
                            label: "Total Embodied Carbon",
                            val: fmt(totalEmissions),
                            sub: "all lifecycle stages combined"
                        },
                        {
                            label: "Carbon Intensity",
                            val: intensity > 0 ? `${intensity.toFixed(0)} kg/m²` : "Set building area",
                            sub: intensityInsight || (intensity > 0 ? `${benchmark.label} avg: ${benchmark.mid} kg/m²` : "Add GFA in project settings")
                        },
                        {
                            label: "Materials Analysed",
                            val: `${materials.length}`,
                            sub: unmappedCount > 0 ? `${unmappedCount} unmapped — emissions understated` : `All ${materials.length} mapped ✓`
                        },
                        {
                            label: "Top Contributor",
                            val: topMaterials[0]?.materialName?.slice(0, 20) || "—",
                            sub: topMaterials[0] ? `${pct(topMaterials[0].totalEmissions, totalEmissions)} of total · ${topMaterials[0].category || "Uncategorised"}` : ""
                        },
                    ].map((c, i) =>
                        React.createElement(View, { key: i, style: [styles.card, { flex: 1 }] },
                            React.createElement(Text, { style: styles.label }, c.label),
                            React.createElement(Text, { style: { ...styles.value, fontSize: i === 0 ? 12 : 10 } }, c.val),
                            c.sub ? React.createElement(Text, { style: styles.valueSub }, c.sub) : null
                        )
                    )
                ),
                // Scope note
                React.createElement(View, { style: { flexDirection: "row", gap: 16, backgroundColor: "#F8FAFC", borderRadius: 3, padding: "6 10", marginTop: 0 } },
                    React.createElement(Text, { style: { ...styles.bodyGray, fontFamily: "Helvetica-Bold" } }, "GHG Scopes: "),
                    React.createElement(Text, { style: styles.bodyGray }, "Scope 1: 0 kgCO₂e"),
                    React.createElement(Text, { style: styles.bodyGray }, "Scope 2: 0 kgCO₂e"),
                    React.createElement(Text, { style: { ...styles.bodyGray, fontFamily: "Helvetica-Bold" } }, `Scope 3: ${fmt(totalEmissions)}`),
                    React.createElement(Text, { style: { ...styles.bodyGray, color: BRAND.gray, fontSize: 7 } }, "(All embodied carbon = Scope 3 per GHG Protocol)")
                )
            ),

            // ── Section 3: Hotspot Analysis (E1) ──
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Emission Hotspot Analysis — Top 3 Materials"),
                ...topMaterials.map((m, i) =>
                    React.createElement(View, { key: i, style: { marginBottom: 7 } },
                        React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 } },
                            React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold" } }, `${i + 1}. ${m.materialName?.slice(0, 55)}`),
                            React.createElement(Text, { style: { ...styles.body, color: BRAND.primary } }, fmt(m.totalEmissions))
                        ),
                        React.createElement(View, { style: styles.barBg },
                            React.createElement(View, { style: { ...styles.barFill, width: `${pctNum(m.totalEmissions, totalEmissions)}%`, backgroundColor: i === 0 ? BRAND.red : i === 1 ? BRAND.amber : "#F97316" } })
                        ),
                        React.createElement(Text, { style: styles.bodyGray }, `${pct(m.totalEmissions, totalEmissions)} of total · ${m.category || "Uncategorised"} · ${m.lifecycleStage || "A1-A3"} · Phase: ${m.phase || "Unassigned"}`)
                    )
                ),
                hotspotInsight ? React.createElement(View, { style: styles.insightBox },
                    React.createElement(Text, { style: styles.insightText }, `Insight: ${hotspotInsight}`)
                ) : null
            ),

            // ── Section 4: Lifecycle Stage Breakdown EN 15804 (E2 renamed) ──
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Lifecycle Stage Breakdown (EN 15804)"),
                ...sortedStages.map((s, i) => {
                    const w = grandTotal > 0 ? (s.totalEmissions / grandTotal) * 100 : 0;
                    const insight = getStageInsight(s.stage, w);
                    return React.createElement(View, { key: i, style: { marginBottom: 7 } },
                        React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between" } },
                            React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold", width: 50 } }, s.stage),
                            React.createElement(Text, { style: styles.body }, fmt(s.totalEmissions)),
                            React.createElement(Text, { style: styles.bodyGray }, `${w.toFixed(1)}%`)
                        ),
                        React.createElement(View, { style: styles.barBg },
                            React.createElement(View, { style: { ...styles.barFill, width: `${Math.min(w, 100)}%`, backgroundColor: BRAND.primary } })
                        ),
                        insight ? React.createElement(Text, { style: { ...styles.bodyGray, marginTop: 2, fontStyle: "italic" } }, insight) : null
                    );
                })
            ),

            // ── Section 4B: Project Phase Breakdown (E2 new) ──
            phaseChartData.length > 0 ? React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Project Phase Breakdown"),
                ...phaseChartData.map(([name, value], i) => {
                    const w = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
                    const colors = ["#6366F1", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE", "#64748B"];
                    return React.createElement(View, { key: i, style: { marginBottom: 5 } },
                        React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between" } },
                            React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold", flex: 2 } }, name),
                            React.createElement(Text, { style: styles.body }, fmt(value)),
                            React.createElement(Text, { style: styles.bodyGray }, `${w.toFixed(1)}%`)
                        ),
                        React.createElement(View, { style: styles.barBg },
                            React.createElement(View, { style: { ...styles.barFill, width: `${Math.min(w, 100)}%`, backgroundColor: colors[i % colors.length] } })
                        )
                    );
                }),
                phaseInsightText ? React.createElement(View, { style: styles.insightBoxViolet },
                    React.createElement(Text, { style: styles.insightTextViolet }, `Insight: ${phaseInsightText}`)
                ) : null
            ) : null,

            // ── Section 5: Material Breakdown (E3: Phase + Stage columns) ──
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Material Breakdown (Top 20, sorted by emissions)"),
                React.createElement(View, { style: styles.tableHeader },
                    React.createElement(Text, { style: { flex: 3 } }, "Material"),
                    React.createElement(Text, { style: { flex: 1.2 } }, "Category"),
                    React.createElement(Text, { style: { flex: 1 } }, "Phase"),
                    React.createElement(Text, { style: { flex: 0.7 } }, "Stage"),
                    React.createElement(Text, { style: { flex: 1, textAlign: "right" } }, "Emissions"),
                    React.createElement(Text, { style: { flex: 0.6, textAlign: "right" } }, "% Total"),
                ),
                ...sortedMats.slice(0, 20).map((m, i) => {
                    const isHigh = m.totalEmissions >= top20Threshold && top20Threshold > 0;
                    return React.createElement(View, { key: i, style: isHigh ? styles.tableRowHighlight : styles.tableRow },
                        React.createElement(Text, { style: { flex: 3, fontSize: 7, color: BRAND.slate } }, m.materialName?.slice(0, 35) || "—"),
                        React.createElement(Text, { style: { flex: 1.2, fontSize: 6.5, color: BRAND.gray } }, (m.category || "—").slice(0, 14)),
                        React.createElement(Text, { style: { flex: 1, fontSize: 6.5, color: BRAND.gray } }, (m.phase || "Unassigned").slice(0, 14)),
                        React.createElement(Text, { style: { flex: 0.7, fontSize: 6.5, color: BRAND.primary } }, m.lifecycleStage || "A1-A3"),
                        React.createElement(Text, { style: { flex: 1, fontSize: 7.5, textAlign: "right", fontFamily: "Helvetica-Bold" } }, fmt(m.totalEmissions)),
                        React.createElement(Text, { style: { flex: 0.6, fontSize: 7, textAlign: "right", color: BRAND.gray } }, pct(m.totalEmissions, totalEmissions)),
                    );
                })
            ),

            // ── Section 5B: Transport Emissions A4 (E8) ──
            withTransport.length > 0 ? React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Transport Emissions (A4) — Materials with Supplier Distances"),
                React.createElement(View, { style: styles.tableHeader },
                    React.createElement(Text, { style: { flex: 3 } }, "Material"),
                    React.createElement(Text, { style: { flex: 1, textAlign: "right" } }, "Distance (km)"),
                    React.createElement(Text, { style: { flex: 1 } }, "Mode"),
                    React.createElement(Text, { style: { flex: 1, textAlign: "right" } }, "Transport CO₂e"),
                    React.createElement(Text, { style: { flex: 0.8, textAlign: "right" } }, "% of Total"),
                ),
                ...withTransport.map((m: any, i: number) =>
                    React.createElement(View, { key: i, style: styles.tableRow },
                        React.createElement(Text, { style: { flex: 3, fontSize: 7, color: BRAND.slate } }, m.materialName?.slice(0, 35) || "—"),
                        React.createElement(Text, { style: { flex: 1, fontSize: 7, textAlign: "right", color: BRAND.gray } }, (m.supplierDistance || 0).toLocaleString()),
                        React.createElement(Text, { style: { flex: 1, fontSize: 7, color: BRAND.primary } }, m.transportMode || "Road"),
                        React.createElement(Text, { style: { flex: 1, fontSize: 7, textAlign: "right", fontFamily: "Helvetica-Bold" } }, `${((m.transportEmissions || 0)).toFixed(2)} kg`),
                        React.createElement(Text, { style: { flex: 0.8, fontSize: 7, textAlign: "right", color: BRAND.gray } }, pct(m.transportEmissions || 0, totalEmissions)),
                    )
                ),
                React.createElement(View, { style: styles.insightBox },
                    React.createElement(Text, { style: styles.insightText },
                        "Transport factors: Road 0.062 · Rail 0.022 · Ship 0.015 · Air 0.602 kgCO₂e/tonne-km. Consider local sourcing for high-distance materials to reduce A4 stage emissions."
                    )
                )
            ) : React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Transport Emissions (A4)"),
                React.createElement(View, { style: { ...styles.card, borderLeftWidth: 3, borderLeftColor: BRAND.amber } },
                    React.createElement(Text, { style: { ...styles.bodyGray, fontStyle: "italic" } },
                        "No supplier distances recorded. Add distances in the Materials tab to enable transport emission analysis and capture A4 stage emissions."
                    )
                )
            ),

            // ── Section 7: Benchmark Comparison (E5: gap narrative) ──
            intensity > 0 ? React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Benchmark Comparison"),
                React.createElement(View, { style: styles.card },
                    React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold", marginBottom: 3 } },
                        `${benchmark.label} Typology — Best Practice: ${benchmark.low} · Average: ${benchmark.mid} · High: ${benchmark.high} kgCO₂e/m²`
                    ),
                    React.createElement(Text, { style: { ...styles.body, marginBottom: 2 } },
                        `This project: ${intensity.toFixed(0)} kgCO₂e/m²`
                    ),
                    React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold", color: benchmarkStatus === "excellent" || benchmarkStatus === "good" ? BRAND.green : benchmarkStatus === "average" ? BRAND.amber : BRAND.red } },
                        benchmarkStatus ? benchmarkLabel[benchmarkStatus] : ""
                    ),
                    benchmarkGapInsight ? React.createElement(View, { style: { ...styles.insightBoxGreen, marginTop: 6 } },
                        React.createElement(Text, { style: styles.insightTextGreen }, benchmarkGapInsight)
                    ) : null,
                    React.createElement(Text, { style: { ...styles.bodyGray, marginTop: 4, fontStyle: "italic" } },
                        "Benchmarks: LETI Embodied Carbon Primer (2020) and RIBA 2030 Climate Challenge. Indicative ranges for UK market."
                    )
                )
            ) : null,

            // ── Section 8: Methodology (E11: corrected transport factor) ──
            React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Methodology & Assumptions"),
                React.createElement(View, { style: styles.card },
                    ...[
                        ["Calculation", "Embodied carbon = Quantity × Emission Factor (kgCO₂e/unit). Transport (A4) emissions use mode-specific factors: Road 0.062 · Rail 0.022 · Ship 0.015 · Air 0.602 kgCO₂e/tonne-km, applied to supplier distance per material. Installation (A5) uses category-level energy benchmarks per EN 15804. Waste uplift applied only when explicitly set — no silent defaults."],
                        ["Calculation Confidence", `${mappedPct}% of materials are mapped to emission factors (${mappedMats.length}/${materials.length}). Unmapped materials contribute zero and are excluded from totals.`],
                        ["Factor Source", "DMBoD dataset aggregating ICE Database v3.0 (Bath University), Ecoinvent v3.x, and Environmental Product Declarations (EPDs) via the DMBoD EPD Sync."],
                        ["Lifecycle Scope", "A1–A3 as minimum (product stage). A4–A5 (construction), B (in-use replacements), C1–C4 (end-of-life) included where data available. Module D shown separately, not added to total."],
                        ["Exclusions", "Operational carbon, MEP systems unless added, biogenic sequestration unless included in EPD. AI material matches are indicative — verify before formal submission."],
                        ["Disclaimer", "This report does not constitute a verified LCA, EPD, BREEAM/LEED submission document. All figures are indicative only."],
                    ].map(([title, body], i) =>
                        React.createElement(View, { key: i, style: { marginBottom: 5 } },
                            React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold", marginBottom: 1 } }, title),
                            React.createElement(Text, { style: styles.bodyGray }, body)
                        )
                    )
                )
            ),

            // ── Section 9: Recommended Next Steps (E10) ──
            nextSteps.length > 0 ? React.createElement(View, { style: styles.section },
                React.createElement(Text, { style: styles.sectionTitle }, "Recommended Next Steps"),
                ...nextSteps.map((step, i) =>
                    React.createElement(View, { key: i, style: { flexDirection: "row", gap: 8, marginBottom: 5, padding: "5 8", backgroundColor: BRAND.lightGray, borderRadius: 3 } },
                        React.createElement(Text, { style: { ...styles.body, fontFamily: "Helvetica-Bold", color: BRAND.primary } }, `${i + 1}.`),
                        React.createElement(Text, { style: { ...styles.bodyGray, flex: 1 } }, step)
                    )
                )
            ) : null,

            // ── Page Footer (fixed) ──
            React.createElement(View, { style: styles.pageFooter, fixed: true },
                React.createElement(Text, { style: styles.footerText }, `${project.name} — SaHa Carbon Intelligence & Embodied Emissions Summary Report`),
                React.createElement(Text, { style: styles.footerText, render: ({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}` })
            )
        )
    );
}

// ── Export: Generate PDF Buffer ───────────────────────────────────────────────
export async function generateProjectReportPDF(
    project: any,
    emissions: any,
    lifecycleData: any
): Promise<Buffer> {
    const generatedAt = new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric"
    });

    const element = React.createElement(ReportDocument, {
        project,
        emissions,
        lifecycleData,
        generatedAt,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await renderToBuffer(element as any);
}
