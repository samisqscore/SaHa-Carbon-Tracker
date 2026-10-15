
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Extend Express Request type to include organizationId
declare global {
    namespace Express {
        interface Request {
            organizationId?: string;
            organizationRole?: string;
        }
    }
}

export async function organizationMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated() || !req.user) {
        return next();
    }

    const organizationId = req.headers['x-organization-id'] as string;
    const userId = req.user.id;

    if (organizationId) {
        // Validate UUID format to prevent DB crash (Error 22P02)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(organizationId)) {
            console.warn(`[Middleware] Invalid organization ID format: ${organizationId}`);
            return res.status(400).json({ message: "Invalid organization ID format" });
        }

        // 1. Verify user belongs to this specific organization
        const membership = await storage.getUserOrganizationMembership(userId, organizationId);

        if (membership) {
            req.organizationId = membership.organizationId;
            req.organizationRole = membership.role;
            return next();
        } else {
            // User tried to access an org they don't belong to
            return res.status(403).json({ message: "Access denied to this organization" });
        }
    }

    // 2. Fallback: If no header, try to fetch the "default" or first valid org for the user
    // This maintains backward compatibility for now
    const defaultOrg = await storage.getUserOrganization(userId);
    if (defaultOrg) {
        req.organizationId = defaultOrg.organizationId;
        req.organizationRole = defaultOrg.role;
    }

    next();
}
