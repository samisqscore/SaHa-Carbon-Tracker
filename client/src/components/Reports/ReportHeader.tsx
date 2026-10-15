import { Card } from "@/components/ui/card";
import { Project } from "@shared/schema";
import { format } from "date-fns";
import { Leaf } from "lucide-react";

interface ReportHeaderProps {
    project: Project;
    reportDate?: Date;
}

export function ReportHeader({ project, reportDate = new Date() }: ReportHeaderProps) {
    return (
        <div className="w-full bg-white border-b-2 border-primary mb-8 pb-6">
            <div className="flex justify-between items-start">
                {/* Left: Branding */}
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-lg">
                        <Leaf className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            DMBoD Carbon Intelligence
                        </h1>
                        <p className="text-sm text-gray-500 font-medium">
                            DMBoD · Embodied Carbon Intelligence Report
                        </p>
                    </div>
                </div>

                <div className="text-right space-y-1">
                    {/* Organization context for Report Identity */}
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Prepared For</div>
                    <div className="font-bold text-lg text-primary">{(project as any).organizationName || "Client Organization"}</div>

                    <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-2">Report Generated</div>
                    <div className="font-medium text-gray-900">{format(reportDate, "MMMM d, yyyy")}</div>
                </div>
            </div>

            {/* Project Context Bar */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Project Name</div>
                    <div className="font-bold text-gray-900 truncate" title={project.name}>{project.name}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Location</div>
                    <div className="font-medium text-gray-700 truncate">{project.location}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Gross Floor Area</div>
                    <div className="font-medium text-gray-700">
                        {project.buildingArea ? `${project.buildingArea.toLocaleString()} m²` : "N/A"}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Construction Type</div>
                    <div className="font-medium text-gray-700 capitalize">
                        {project.constructionMethod || project.type || "Standard"}
                    </div>
                </div>
            </div>

            {/* Mandatory Disclaimer (Manifesto Section 1) */}
            <div className="mt-4 text-xs text-gray-400 italic">
                “This report provides an estimate of embodied carbon emissions based on available material quantities and emission factors at the time of analysis.”
            </div>
        </div>
    );
}
