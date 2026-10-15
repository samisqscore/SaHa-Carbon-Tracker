/**
 * @file adminAuth.ts
 * @description Middleware for Role-Based Access Control (RBAC) and User Status Verification.
 * Ensures only authorized users can access sensitive endpoints.
 * 
 * @functionality
 * - requireApprovedUser: Verifies user status is 'approved' (not pending/rejected).
 * - requireAdmin: Verifies user has 'admin' role AND 'approved' status.
 * 
 * @dependencies
 * - express: Types for Request/Response/NextFunction.
 * - storage: Database access to fetch fresh user data.
 * 
 * @breaking-changes
 * - User Object Structure: Expects `req.user.id` to exist (from Passport).
 * - Status Field: Relies on 'approved', 'pending', 'rejected' enum values in DB.
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Middleware to check if user is approved
export const requireApprovedUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;

    if (!user || !user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get latest user data from database
    const dbUser = await storage.getUser(user.id);

    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (dbUser.status === "pending") {
      return res.status(403).json({
        message: "Account pending approval",
        status: "pending",
        adminMessage: "Your account is awaiting admin approval. Please contact the administrator."
      });
    }

    if (dbUser.status === "rejected") {
      return res.status(403).json({
        message: "Account access denied",
        status: "rejected",
        adminMessage: "Your account has been rejected. Please contact the administrator."
      });
    }

    if (dbUser.status === "approved") {
      // Update session with latest user data
      req.user = { ...user, ...dbUser };
      return next();
    }

    return res.status(403).json({ message: "Invalid account status" });
  } catch (error) {
    console.error("Error in requireApprovedUser middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check if user is admin
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;

    if (!user || !user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get latest user data from database
    const dbUser = await storage.getUser(user.id);

    if (!dbUser || dbUser.role !== "admin" || dbUser.status !== "approved") {
      return res.status(403).json({ message: "Admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Error in requireAdmin middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};