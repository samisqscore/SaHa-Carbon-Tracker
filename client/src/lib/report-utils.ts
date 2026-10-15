/**
 * @file report-utils.ts
 * @description Shared utilities for report generation and downloads.
 */

import { toast } from "@/hooks/use-toast";

/**
 * Downloads the server-side generated PDF report for a project.
 * 
 * @param projectId The UUID of the project
 * @param projectName The name of the project (for the filename)
 */
export async function downloadProjectReport(projectId: string, projectName: string) {
    try {
        const response = await fetch(`/api/projects/${projectId}/report/pdf`, {
            method: "GET",
            // Include credentials to send the session cookie
            credentials: "include",
        });

        if (!response.ok) {
            // Attempt to get error message from response
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Server PDF generation failed");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `SaHa_Carbon_Report_${projectName.replace(/\s+/g, "_")}_${dateStr}.pdf`;

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        toast({
            title: "Report Downloaded",
            description: `Report for ${projectName} has been generated and downloaded.`,
        });
    } catch (err: any) {
        console.error("PDF export failed:", err);
        toast({
            title: "Export Failed",
            description: err.message || "Failed to generate PDF report. Please try the browser print option instead.",
            variant: "destructive",
        });
        // Fallback if needed could be implemented here, but we usually want to know why it failed.
        throw err;
    }
}
