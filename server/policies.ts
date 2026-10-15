import { User, Project } from "@shared/schema";

export type Action = "create" | "read" | "update" | "delete" | "manage";
export type ResourceType = "project" | "organization" | "user" | "admin_panel" | "org_settings";

/**
 * Centralized Permission Logic
 * @param user The user attempting the action
 * @param action The action being attempted (create, read, update, delete)
 * @param resourceType The type of resource (project, organization, etc.)
 * @param resource (Optional) The specific resource entity (e.g., the project object)
 */
export function can(
    user: User | undefined,
    action: Action,
    resourceType: ResourceType,
    resource?: any
): boolean {
    if (!user) return false;

    const isPlatformAdmin = user.role === "admin";
    const isOrgAdmin = (user.role as string) === "org_admin";

    // --- Platform Admin Overrides ---
    // Platform Admins can do almost everything, except maybe manage specific Org data if we want strict privacy.
    // For now, let's assume they have super-access OR we restrict them to platform tasks.
    if (isPlatformAdmin) {
        return true; // Simple "Super Admin" model for now
    }

    // --- General Rules ---

    switch (resourceType) {
        case "admin_panel":
            return isPlatformAdmin;

        case "org_settings":
            return isPlatformAdmin || isOrgAdmin;

        case "project":
            return canProject(user, action, resource);

        case "organization":
            // Only Platform Admins can create new Organizations (for now)
            if (action === "create") return isPlatformAdmin;
            // Org Admins can update their own org
            if (action === "update" && resource?.id) {
                // We would need to check if resource.id === user.organizationId
                // But user.organizationId isn't on the User type directly in some versions, ensuring via checks
                // Assuming 'resource' is the organization object
                // This is tricky without strict typing on 'resource', but workable.
                return isOrgAdmin;
            }
            return false;

        default:
            return false;
    }
}

function canProject(user: User, action: Action, project?: Project, activeOrgId?: string): boolean {
    if (action === "create") return true; // Any authenticated user can create a project
    if (action === "read") return true;   // Filtered by storage query

    // For Update/Delete, we need the project to check ownership
    if (!project) return false;

    const isOwner = project.userId === user.id;

    // SEC-03 Fix: Enforce org boundary check.
    // An org_admin may only modify projects that belong to their active organization.
    const isInSameOrg = activeOrgId
        ? project.organizationId === activeOrgId
        : false; // If no org context, deny by default for non-owners

    if (action === "update" || action === "delete") {
        if (isOwner) return true;
        if ((user.role as string) === "org_admin" && isInSameOrg) return true;
    }

    return false;
}
