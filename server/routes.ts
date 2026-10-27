/**
 * @file routes.ts
 * @description Central routing configuration for the Express application.
 * Defines all API endpoints for Authentication, Admin Management, Projects, Materials, and Dashboards.
 * 
 * @functionality
 * - Authentication: Google OAuth routes (/api/auth/user, /api/logout).
 * - Admin: User approval/rejection workflows (/api/admin/*).
 * - Projects: CRUD operations for Projects and their sub-resources (Phases, Materials).
 * - Datasets: Lifecycle management for emission datasets (Draft/Active/Archived).
 * - Datasource Agent: Secure multi-tenant atomic uploads (CSV/XLSX) and factor metadata editing.
 * - BOQ Import: Batch processing for Bulk of Quantities imports.
 * 
 * @dependencies
 * - express: Web framework.
 * - @shared/schema: Database table definitions and types.
 * - googleAuth: Authentication middleware setup.
 * - organizationMiddleware: Tenant isolation and permission enforcement.
 * - adminAuth: Role-based access control middleware.
 * - storage: Database interaction layer.
 * - emissionCalculationService: Logic for resolving emission factors.
 * 
 * @breaking-changes
 * - Route Paths: API consumers depend on these specific URL structures.
 * - Middleware Order: `isAuthenticated` and `organizationMiddleware` must precede sensitive routes.
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupGoogleAuth, isAuthenticated } from "./googleAuth";
import { organizationMiddleware } from "./middleware";
import { requireApprovedUser, requireAdmin } from "./adminAuth";
import { generateProjectReportPDF } from "./reportPDF";
import multer from "multer";

import fs from "fs";
import path from "path";
import {
  sessions, users, projects, boqImports,
  projectMaterials, projectPhases, emissionDatasets,
  emissionFactors,
  organizations,
  organizationUsers,
  datasetUploadLogs,
  insertProjectPhaseSchema,
  insertProjectSchema,
  insertProjectMaterialSchema,
  insertEmissionFactorSchema,
  batchMaterialSchema,
  insertOrganizationSchema,
  insertEmissionDatasetSchema,
  insertDatasetUploadLogSchema,
} from "@shared/schema";
import { can } from "./policies";
import { eq, desc, asc, sql, and, or, isNull, lt, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { processStandardBOQ, processEnterpriseBOQ } from "./boqProcessing";
import { processDatasetImport } from "./datasetImport";
// Removed duplicate insertBoqImportSchema import

import { z } from "zod";




// Helper function to extract user ID from request
const getUserId = (req: any) => {
  if (req.user?.provider === 'google') {
    return req.user.id;
  } else if (req.user?.claims?.sub) {
    return req.user.claims.sub;
  }
  return req.user?.id;
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Google authentication
  setupGoogleAuth(app);

  // Auth endpoint for Google Auth
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      if (req.isAuthenticated() && req.user?.provider === 'google') {
        const userId = req.user.id;
        const dbUser = await storage.getUser(userId);

        // Fetch active organization if context provided, or default
        // This is purely for the frontend to know "current state", though middleware sets it on request
        // We might want to return the organizationId here too? 
        // For now, keep as is.

        if (dbUser) {
          res.json({
            ...req.user,
            role: dbUser.role,
            status: dbUser.status,
            approvedBy: dbUser.approvedBy,
            approvedAt: dbUser.approvedAt
          });
        } else {
          res.json(req.user);
        }
      } else {
        res.status(401).json({ message: "Not authenticated" });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get all organizations the user belongs to
  app.get("/api/user/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const userOrgs = await db.select({
        id: organizations.id,
        name: organizations.name,
        industry: organizations.industry,
        country: organizations.country,
        role: organizationUsers.role
      })
        .from(organizationUsers)
        .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
        .where(eq(organizationUsers.userId, userId));

      res.json(userOrgs);
    } catch (error) {
      console.error("Error fetching user organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });



  // Organization Member Management Routes
  app.get('/api/organizations/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      // Permission check: Must be a member of the org or a system admin
      const membership = await storage.getUserOrganizationMembership(req.user.id, req.params.id);
      if (!membership && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getOrganizationMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.post('/api/organizations/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      // Permission check: Only Org Admin or System Admin can add members
      const membership = await storage.getUserOrganizationMembership(req.user.id, req.params.id);
      const isOrgAdmin = membership?.role === 'org_admin';
      const isSystemAdmin = req.user.role === 'admin';

      if (!isOrgAdmin && !isSystemAdmin) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { email, role } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const validRoles = ['org_admin', 'estimator', 'viewer'];
      const targetRole = role || 'viewer';
      if (!validRoles.includes(targetRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.addUserToOrganization(req.params.id, email, targetRole);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found. They must first sign up to the platform." });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });



  // Logout route
  app.get('/api/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.redirect('/');
    });
  });

  app.get("/api/dashboard/stats", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getDashboardStats(userId, req.organizationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/portfolio", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const data = await storage.getOrganizationPortfolio(req.organizationId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching portfolio data:", error);
      res.status(500).json({ message: "Failed to fetch portfolio data" });
    }
  });

  app.get("/api/dashboard/emissions-by-category", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const data = await storage.getOrganizationEmissionsByCategory(req.organizationId, projectId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching emissions by category:", error);
      res.status(500).json({ message: "Failed to fetch emissions by category" });
    }
  });

  app.get("/api/dashboard/category-drilldown", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const category = req.query.category as string;
      const projectId = req.query.projectId as string | undefined;
      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }
      const data = await storage.getCategoryDrilldown(req.organizationId, category, projectId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching category drilldown:", error);
      res.status(500).json({ message: "Failed to fetch category drilldown" });
    }
  });

  app.get("/api/dashboard/emissions-by-stage", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const data = await storage.getOrganizationEmissionsByStage(req.organizationId, projectId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching emissions by stage:", error);
      res.status(500).json({ message: "Failed to fetch emissions by stage" });
    }
  });

  app.get("/api/dashboard/unmapped-summary", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const data = await storage.getUnmappedMaterialsSummary(req.organizationId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching unmapped summary:", error);
      res.status(500).json({ message: "Failed to fetch unmapped summary" });
    }
  });

  app.get("/api/dashboard/emissions-trend", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const data = await storage.getOrganizationEmissionsTrend(req.organizationId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching emissions trend:", error);
      res.status(500).json({ message: "Failed to fetch emissions trend" });
    }
  });

  // Admin user management routes
  app.get('/api/admin/pending-users', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const pendingUsers = await storage.getPendingUsers();
      res.json(pendingUsers);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      res.status(500).json({ message: "Failed to fetch pending users" });
    }
  });

  app.get('/api/admin/all-users', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/admin/approve-user/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const user = await storage.approveUser(req.params.userId, adminId);
      res.json(user);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: "Failed to approve user" });
    }
  });

  app.post('/api/admin/reject-user/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const user = await storage.rejectUser(req.params.userId, adminId);
      res.json(user);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ message: "Failed to reject user" });
    }
  });

  app.patch('/api/admin/users/:userId/role', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!['admin', 'estimator', 'viewer'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const user = await storage.updateUserRole(req.params.userId, role);
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch('/api/organizations/:id/members/:userId/role', isAuthenticated, async (req: any, res) => {
    try {
      const membership = await storage.getUserOrganizationMembership(req.user.id, req.params.id);
      if (membership?.role !== 'org_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role } = req.body;
      if (!['org_admin', 'estimator', 'viewer'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      await storage.updateOrgUserRole(req.params.id, req.params.userId, role);
      res.json({ message: "Role updated successfully" });
    } catch (error) {
      console.error("Error updating org member role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete('/api/organizations/:id/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const membership = await storage.getUserOrganizationMembership(req.user.id, req.params.id);
      if (membership?.role !== 'org_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.removeUserFromOrganization(req.params.id, req.params.userId);
      res.json({ message: "Member removed successfully" });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.post("/api/projects", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      console.log("🏗️ SERVER: Creating project - START");
      const userId = getUserId(req);
      console.log("👤 User ID:", userId);
      console.log("📥 Request body:", req.body);

      // Manifesto Compliance: Link Project to Organization
      const userOrg = await storage.getUserOrganization(userId);

      // Prefer the Active Context Organization, else fallback to User's default Org
      const targetOrganizationId = req.organizationId || userOrg?.organizationId;

      if (!targetOrganizationId) {
        return res.status(400).json({ message: "User is not part of an organization. Cannot create project." });
      }

      const projectData = insertProjectSchema.parse({
        ...req.body,
        userId,
        organizationId: targetOrganizationId
      });
      console.log("✅ Validation passed:", projectData);
      console.log("📋 Project data for storage:", projectData);

      const project = await storage.createProject(projectData);
      console.log("💾 Storage result:", project);

      // --- PHASE 2: Default Phase Scaffolding ---
      try {
        const defaultPhases = [
          { name: "Foundation", orderIndex: 0 },
          { name: "Superstructure", orderIndex: 1 },
          { name: "Envelope", orderIndex: 2 },
          { name: "Interiors", orderIndex: 3 },
          { name: "MEP / Services", orderIndex: 4 }
        ];

        for (const phase of defaultPhases) {
          await storage.createProjectPhase({
            projectId: project.id,
            name: phase.name,
            status: "planned",
            orderIndex: phase.orderIndex,
            description: "Auto-generated default phase"
          });
        }
        console.log("✅ Auto-created 5 default phases for project:", project.id);
      } catch (phaseError) {
        console.error("⚠️ Failed to create default phases:", phaseError);
        // Don't fail the project creation if phase scaffolding fails
      }

      res.status(201).json(project);
      console.log("🏗️ SERVER: Creating project - SUCCESS");
    } catch (error) {
      console.error("❌ SERVER: Creating project - ERROR:", error);
      if (error instanceof z.ZodError) {
        console.log("🔍 Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.organizationId;
      const projectData = insertProjectSchema.partial().parse(req.body);

      // Fetch project by ID and Organization (ignoring userId for now to allow Admin view)
      // We pass 'undefined' for userId to getProject to allow finding ANY project in the Org
      const project = await storage.getProject(req.params.id, undefined, organizationId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // 🛡️ Centralized Permission Check
      if (!can(req.user, 'update', 'project', project)) {
        console.warn(`⛔ RBAC: User ${userId} denied update on project ${project.id}`);
        return res.status(403).json({ message: "Unauthorized. You do not have permission to update this project." });
      }

      // We pass 'true' for isOrgAdmin regardless of actual role, because 'can()' already authorized the action.
      // This tells storage to bypass its own user-ownership check.
      const updated = await storage.updateProject(req.params.id, projectData, userId, true);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.get("/api/projects", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projects = await storage.getProjects(userId, req.organizationId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // We allow fetching if basic access exists. can('read') logic is implicitly covered by getProject filtering
      const project = await storage.getProject(req.params.id, userId, req.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found or access denied" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.organizationId;

      // Fetch project to check permissions
      const project = await storage.getProject(req.params.id, undefined, organizationId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // 🛡️ Centralized Permission Check
      if (!can(req.user, 'delete', 'project', project)) {
        console.warn(`⛔ RBAC: User ${userId} denied delete on project ${project.id}`);
        return res.status(403).json({ message: "Unauthorized. You do not have permission to delete this project." });
      }

      // Pass true to bypass local storage check
      await storage.deleteProject(req.params.id, userId, true);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.get("/api/projects/:id/emissions", isAuthenticated, async (req: any, res) => {
    try {
      const emissions = await storage.getProjectEmissions(req.params.id);
      res.json(emissions);
    } catch (error) {
      console.error("Error calculating project emissions:", error);
      res.status(500).json({ message: "Failed to calculate project emissions" });
    }
  });

  // Server-side PDF report generation using @react-pdf/renderer
  app.get("/api/projects/:id/report/pdf", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id, undefined, req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found or access denied" });

      const emissions = await storage.getProjectEmissions(req.params.id);
      // Fetch lifecycle data
      const materials = emissions?.materials || [];
      const byStage: Record<string, number> = { "A1-A3": 0, "A4-A5": 0, "B": 0, "C1-C4": 0, "D": 0 };
      for (const m of materials) {
        const stage = (m as any).lifecycleStage || "A1-A3";
        byStage[stage] = (byStage[stage] || 0) + (m.totalEmissions || 0);
      }
      const stages = Object.entries(byStage)
        .filter(([, v]) => v > 0)
        .map(([stage, totalEmissions]) => ({ stage, totalEmissions }));
      const lifecycleData = { stages, grandTotal: emissions?.totalEmissions || 0 };

      const filename = `SaHa_Carbon_Report_${project.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdfBuffer = await generateProjectReportPDF(project, emissions, lifecycleData);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      console.error("PDF report generation error:", error);
      res.status(500).json({ message: "Failed to generate PDF report" });
    }
  });

  // Reports hub: project report summary endpoint
  app.get("/api/reports/project/:id/summary", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id, undefined, req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found or access denied" });

      const emissions = await storage.getProjectEmissions(req.params.id);
      const materials = emissions?.materials || [];
      const totalEmissions = emissions?.totalEmissions || 0;

      // Top 3 materials sorted by emissions desc
      const sorted = [...materials].sort((a: any, b: any) => b.totalEmissions - a.totalEmissions);
      const topMaterials = sorted.slice(0, 3).map((m: any) => ({
        name: m.materialName,
        value: m.totalEmissions,
      }));

      // Top contributor
      const topContributor = sorted[0]
        ? { name: sorted[0].materialName, percentage: totalEmissions > 0 ? Math.round((sorted[0].totalEmissions / totalEmissions) * 100) : 0 }
        : { name: "N/A", percentage: 0 };

      // Phase data: group by lifecycle stage
      const phaseMap: Record<string, number> = {};
      for (const m of materials) {
        const stage = (m as any).lifecycleStage || "A1-A3";
        phaseMap[stage] = (phaseMap[stage] || 0) + (m.totalEmissions || 0);
      }
      const phaseData = Object.entries(phaseMap).map(([name, value]) => ({ name, value }));

      // Material data for chart (top 8 + other)
      const materialData = sorted.slice(0, 8).map((m: any) => ({
        name: m.materialName,
        value: m.totalEmissions,
        category: m.category || "Uncategorised",
      }));

      // Scope breakdown: simplified (scope 3 = all embodied, scope 1/2 = 0 for now)
      const scopeSummary = {
        scope1: 0,
        scope2: 0,
        scope3: totalEmissions,
      };

      // Carbon intensity (if floor area set)
      const emissionIntensity = project.buildingArea && project.buildingArea > 0
        ? totalEmissions / project.buildingArea
        : 0;

      res.json({
        projectName: project.name,
        projectDetails: project,
        totalEmissions,
        emissionIntensity,
        materialCount: materials.length,
        topContributor,
        topMaterials,
        phaseData,
        materialData,
        scopeSummary,
      });
    } catch (error) {
      console.error("Error generating report summary:", error);
      res.status(500).json({ message: "Failed to generate report summary" });
    }
  });

  app.get("/api/projects/:id/emissions/by-lifecycle", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      // Org boundary check
      const project = await storage.getProject(req.params.id, undefined, req.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found or access denied" });
      }

      const materials = await storage.getProjectMaterials(req.params.id);

      const byStage: Record<string, number> = {
        "A1-A3": 0, "A4-A5": 0, "B": 0, "C1-C4": 0, "D": 0
      };

      for (const m of materials) {
        if (!m.emissionFactor) continue;

              const factorValue = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
        const materialEmission = (m.quantity || 0) * factorValue;
        const wasteEmission = materialEmission * (m.wasteFactor || 0);

        // E11 FIX: Use mode-specific transport factors (Road=0.062, Rail=0.022, Ship=0.015, Air=0.602 kgCO₂e/tonne-km)
        const TRANSPORT_FACTORS_LOCAL: Record<string, number> = {
          'Road': 0.062, 'Rail': 0.022, 'Ship': 0.015, 'Air': 0.602
        };
        const tMode = (m as any).transportMode || 'Road';
        const tFactor = TRANSPORT_FACTORS_LOCAL[tMode] ?? 0.062;
        const density = m.emissionFactor?.density || 1.0;
        const weightTonnes = (m.quantity || 0) * density / 1000;
        const transportEmission = weightTonnes * (m.supplierDistance || 0) * tFactor;

        const itemTotal = materialEmission + wasteEmission + transportEmission;
        const stage = m.emissionFactor?.lifecycleStage || "A1-A3";

        if (byStage[stage] !== undefined) {
          byStage[stage] += itemTotal;
        } else {
          byStage["A1-A3"] += itemTotal;
        }
      }

      const stages = Object.entries(byStage).map(([stage, value]) => ({
        stage,
        totalEmissions: Math.round(value * 100) / 100,
        materialCount: materials.filter(m => (m.emissionFactor?.lifecycleStage || "A1-A3") === stage && m.emissionFactor).length
      }));

      const grandTotal = stages.reduce((sum, item) => sum + item.totalEmissions, 0);

      res.json({ stages, grandTotal: Math.round(grandTotal * 100) / 100 });
    } catch (error) {
      console.error("Error calculating emissions by lifecycle stage:", error);
      res.status(500).json({ message: "Failed to calculate emissions by lifecycle stage" });
    }
  });

  // --- PHASE 5: DeepSeek AI Recommendations ---
  app.post("/api/projects/:id/recommendations", isAuthenticated, organizationMiddleware, requireApprovedUser, async (req: any, res) => {
    try {
      // Org boundary check
      const project = await storage.getProject(req.params.id, undefined, req.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found or access denied" });
      }

      // Server-side: fetch top 5 materials by emission
      const materials = await storage.getProjectMaterials(req.params.id);
      const topMaterials = materials
        .filter((m: any) => m.emissionFactor)
        .map((m: any) => {
          const factor = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
          return {
            materialName: m.emissionFactor?.materialName || m.materialId,
            totalEmissions: (m.quantity || 0) * factor,
          };
        })
        .sort((a: any, b: any) => b.totalEmissions - a.totalEmissions)
        .slice(0, 5);

      if (topMaterials.length === 0) {
        return res.json({ recommendations: [] });
      }

      const { getAIRecommendations } = await import("./boqProcessing");
      const recommendations = await getAIRecommendations(topMaterials);

      res.json({ recommendations });
    } catch (error) {
      console.error("Failed to fetch AI recommendations:", error);
      res.status(500).json({ message: "Failed to fetch AI recommendations" });
    }
  });

  app.get("/api/reports/project/:id/detailed", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id, req.organizationId);
      // This route seems to be a placeholder or copy-paste error from phases route.
      // 'phases' is not defined here. Assuming it's meant to fetch project details or a specific report.
      // For now, returning project as a placeholder to maintain syntactical correctness.
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project); // Or some other detailed report
    } catch (error) {
      console.error("Error fetching project detailed report:", error);
      res.status(500).json({ message: "Failed to fetch project detailed report" });
    }
  });

  app.get("/api/projects/:id/phases", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const phases = await storage.getProjectPhases(req.params.id);
      console.log(`[DEBUG] GET /projects/${req.params.id}/phases returning ${phases.length} phases`);
      res.json(phases);
    } catch (error) {
      console.error("Error fetching project phases:", error);
      res.status(500).json({ message: "Failed to fetch project phases" });
    }
  });

  app.post("/api/projects/:id/phases", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const phaseData = insertProjectPhaseSchema.parse({ ...req.body, projectId: req.params.id });
      const phase = await storage.createProjectPhase(phaseData);
      res.status(201).json(phase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid phase data", errors: error.errors });
      }
      console.error("Error creating project phase:", error);
      res.status(500).json({ message: "Failed to create project phase" });
    }
  });

  app.put("/api/projects/:projectId/phases/:id", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const phaseData = insertProjectPhaseSchema.partial().parse(req.body);
      const phase = await storage.updateProjectPhase(req.params.id, phaseData);
      res.json(phase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid phase data", errors: error.errors });
      }
      console.error("Error updating project phase:", error);
      res.status(500).json({ message: "Failed to update project phase" });
    }
  });

  app.delete("/api/projects/:projectId/phases/:id", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      await storage.deleteProjectPhase(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project phase:", error);
      res.status(500).json({ message: "Failed to delete project phase" });
    }
  });

  app.patch("/api/projects/:id/phases/reorder", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const { phases } = req.body; // Expects { phases: [{ id, orderIndex }] }
      if (!Array.isArray(phases)) {
        return res.status(400).json({ message: "Invalid payload: 'phases' array required" });
      }

      await storage.reorderProjectPhases(phases);
      res.json({ message: "Phases reordered successfully" });
    } catch (error) {
      console.error("Error reordering phases:", error);
      res.status(500).json({ message: "Failed to reorder phases" });
    }
  });

  // Project material routes
  // Legacy route removed
  app.get("/api/materials/:id/factors", isAuthenticated, async (req, res) => {
    res.json([]);
  });

  app.get("/api/projects/:id/materials", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const materials = await storage.getProjectMaterials(req.params.id);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching project materials:", error);
      res.status(500).json({ message: "Failed to fetch project materials" });
    }
  });

  app.post("/api/projects/:id/materials", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const materialData = insertProjectMaterialSchema.parse({ ...req.body, projectId: req.params.id });
      const material = await storage.addProjectMaterial(materialData);
      res.status(201).json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material data", errors: error.errors });
      }
      console.error("Error adding project material:", error);
      res.status(500).json({ message: "Failed to add project material" });
    }
  });

  app.put("/api/projects/:projectId/materials/:id", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const materialData = insertProjectMaterialSchema.partial().parse(req.body);
      const material = await storage.updateProjectMaterial(req.params.id, materialData);
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material data", errors: error.errors });
      }
      console.error("Error updating project material:", error);
      res.status(500).json({ message: "Failed to update project material" });
    }
  });

  app.delete("/api/projects/:projectId/materials/:id", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      await storage.deleteProjectMaterial(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing project material:", error);
      res.status(500).json({ message: "Failed to remove project material" });
    }
  });



  // Material routes
  app.get("/api/materials", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.organizationId;
      // Use the smart storage method that handles prioritization (Org > Global)
      const materials = await storage.getMaterials(organizationId);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  app.get("/api/materials/:id/substitutes", isAuthenticated, async (req, res) => {
    try {
      const currentFactor = await storage.getMaterial(req.params.id);
      if (!currentFactor) {
        return res.status(404).json({ message: "Material not found" });
      }

      // Hybrid Schema: Find all factors in same category
      // Using direct DB access or storage method if available
      // Note: storage.getMaterials returns EmissionFactor[]
      const allFactors = await storage.getMaterials(req.organizationId);

      const { getMaterialSubstitutionSuggestions } = await import('./emissionCalculationService');
      const suggestions = getMaterialSubstitutionSuggestions(currentFactor, allFactors);

      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching substitutes:", error);
      res.status(500).json({ message: "Failed to fetch substitutes" });
    }
  });

  app.post("/api/materials", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      console.log("🧱 SERVER: Creating material - START");
      const userId = getUserId(req);
      const organizationId = req.organizationId;

      console.log("👤 User ID:", userId);
      console.log("🏢 Organization ID:", organizationId);
      console.log("📥 Request body:", req.body);

      const user = await storage.getUser(userId);
      /*
        Permissions Logic:
        - Admin: Can create Global (no orgId) OR Org-Specific (if orgId present)
        - Org Admin: Can create Org-Specific (must have orgId)
        - Estimator: Can create Org-Specific (if allowed?) - Let's stick to rule: "Org Admins can create..."
      */

      const isSystemAdmin = user?.role === 'admin';
      const isOrgAdmin = (await storage.getUserOrganizationMembership(userId, organizationId))?.role === 'org_admin';

      if (!isSystemAdmin && !isOrgAdmin) {
        return res.status(403).json({ message: "Insufficient permissions. Only Admins or Organization Admins can create materials." });
      }

      // Infer organizationId for the material
      // If System Admin AND explicit no-org in body? (Schema allows nullable)
      // For now:
      // - If Org Context exists -> Create Org Material
      // - If No Org Context AND System Admin -> Create Global Material

      const targetOrgId = organizationId || null;

      if (!targetOrgId && !isSystemAdmin) {
        return res.status(400).json({ message: "Organization context required for non-system admins." });
      }

      const materialData = insertEmissionFactorSchema.parse({
        ...req.body,
        datasetId: req.body.datasetId || "00000000-0000-0000-0000-000000000000", // Needs valid ID! We should fetch default or require it. For now, catch in validation.
        organizationId: targetOrgId
      });

      console.log("✅ Validation passed:", materialData);

      const material = await storage.createMaterial(materialData);
      console.log("💾 Storage result:", material);

      res.status(201).json(material);
      console.log("🧱 SERVER: Creating material - SUCCESS");
    } catch (error) {
      console.error("❌ SERVER: Creating material - ERROR:", error);
      if (error instanceof z.ZodError) {
        console.log("🔍 Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid material data", errors: error.errors });
      }
      console.error("Error creating material:", error);
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  app.put("/api/materials/:id", isAuthenticated, async (req: any, res) => {
    try {
      let userId;
      if (req.user?.provider === 'google') {
        userId = req.user.id;
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "User ID not found" });
      }

      const user = await storage.getUser(userId);
      if (user?.role !== 'admin' && user?.role !== 'estimator') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const materialData = insertEmissionFactorSchema.partial().parse(req.body);
      const material = await storage.updateMaterial(req.params.id, materialData);
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material data", errors: error.errors });
      }
      console.error("Error updating material:", error);
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.delete("/api/materials/:id", isAuthenticated, async (req: any, res) => {
    try {
      let userId;
      if (req.user?.provider === 'google') {
        userId = req.user.id;
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "User ID not found" });
      }

      const user = await storage.getUser(userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      await storage.deleteMaterial(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });



  app.put("/api/project-materials/:id", isAuthenticated, async (req, res) => {
    try {
      const projectMaterialData = insertProjectMaterialSchema.partial().parse(req.body);
      const projectMaterial = await storage.updateProjectMaterial(req.params.id, projectMaterialData);
      res.json(projectMaterial);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project material data", errors: error.errors });
      }
      console.error("Error updating project material:", error);
      res.status(500).json({ message: "Failed to update project material" });
    }
  });

  app.delete("/api/project-materials/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProjectMaterial(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project material:", error);
      res.status(500).json({ message: "Failed to delete project material" });
    }
  });

  // --- Reports Routes ---

  // Get Project Report Summary (Charts & Stats)
  // Get Project Report Summary (Charts & Stats)
  app.get("/api/reports/project/:projectId/summary", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId, req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const materials = await storage.getProjectMaterials(projectId);
      const organization = await storage.getOrganization(req.organizationId); // Fetch Org Name

      // Aggregation & Hotspot Analysis
      // Calculate totals and hotspots
      let totalEmissions = 0;
      let maxMaterialEmission = 0;
      let topMaterialName = "None";
      const byPhase: Record<string, any> = {};
      const byCategory: Record<string, number> = {};
      const byScope: Record<string, number> = { scope1: 0, scope2: 0, scope3: 0 }; // Initialize Scopes
      const materialList: { name: string, value: number, unit: string, quantity: number }[] = [];

      for (const m of materials) {
        // Hybrid Schema: Use available snapshot or current factor
        const name = m.emissionFactor?.materialName || "Unmapped Material";
        const category = m.emissionFactor?.materialCategory || "Other";
        const factorValue = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
        const ghgScope = m.emissionFactor?.ghgScope || "scope3"; // Default to Scope 3

        // Core Calculation
        const materialEmission = m.quantity * factorValue;
        const wasteEmission = materialEmission * (m.wasteFactor || 0);
        const transportEmission = m.quantity * (m.supplierDistance || 0) * 0.1;

        const itemTotal = materialEmission + wasteEmission + transportEmission;

        totalEmissions += itemTotal;

        // Hotspot Logic
        if (itemTotal > maxMaterialEmission) {
          maxMaterialEmission = itemTotal;
          topMaterialName = name;
        }

        // Scope Logic (Aggregate by GHG Scope)
        // Note: Transport is typically Scope 3 (Upstream Transport). 
        // Material is Scope 3 (Purchased Goods).
        // Only Fuel Usage (Scope 1) or Electricity (Scope 2) directly map.
        // For now, we trust the Factor's ghgScope property.
        // If the factor says "scope1" (e.g. Diesel), we map the whole usage there.
        // Transport might be separate, but for simplicity, we map itemTotal to the Factor's scope.
        if (byScope[ghgScope] !== undefined) {
          byScope[ghgScope] += itemTotal;
        } else {
          byScope['scope3'] += itemTotal; // Fallback
        }

        // Phase Logic
        const phaseName = m.phase?.name || "Unassigned";
        if (!byPhase[phaseName]) {
          byPhase[phaseName] = { phaseName, me: 0, tm: 0, total: 0 };
        }
        byPhase[phaseName].me += materialEmission + wasteEmission;
        byPhase[phaseName].tm += transportEmission;
        byPhase[phaseName].total += itemTotal;

        // Category Logic
        byCategory[category] = (byCategory[category] || 0) + itemTotal;

        materialList.push({
          name,
          value: itemTotal,
          unit: m.emissionFactor?.unit || "unit",
          quantity: m.quantity
        });
      }

      // Rank Materials
      materialList.sort((a, b) => b.value - a.value);
      const topMaterials = materialList.slice(0, 5);

      // Convert to Array
      const phaseData = Object.values(byPhase);
      const materialData = Object.entries(byCategory).map(([category, value]) => ({ category, value }));

      res.json({
        projectName: project.name,
        projectDetails: project,
        totalEmissions,
        emissionIntensity: project.buildingArea ? (totalEmissions / project.buildingArea) : 0,
        materialCount: materials.length,
        topContributor: {
          name: topMaterialName,
          percentage: totalEmissions > 0 ? ((maxMaterialEmission / totalEmissions) * 100).toFixed(1) : 0
        },
        scopeSummary: byScope, // New Advanced Reporting Field
        topMaterials,
        phaseData,
        materialData
      });

    } catch (error) {
      console.error("Report Summary Error:", error);
      res.status(500).json({ message: "Failed to generate report summary" });
    }
  });

  // Get Detailed Project Emissions (For CSV Export)
  // Get Detailed Project Emissions (For CSV Export)
  app.get("/api/projects/:id/emissions/detailed", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const getUserId = (req: any) => req.user?.id;
      const project = await storage.getProject(req.params.id, getUserId(req), req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const materials = await storage.getProjectMaterials(req.params.id);

      const detailedMaterials = materials.map(m => {
        // Use snapshot or fallback to current factor
        const factor = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
        const baseEmission = m.quantity * factor;
        // E11 FIX: Use mode-specific transport factors, not the stale 0.1 scalar
        const TRANSPORT_FACTORS_LOCAL: Record<string, number> = {
          'Road': 0.062, 'Rail': 0.022, 'Ship': 0.015, 'Air': 0.602
        };
        const tMode = (m as any).transportMode || 'Road';
        const tFactor = TRANSPORT_FACTORS_LOCAL[tMode] ?? 0.062;
        const density = m.emissionFactor?.density || 1.0;
        const weightTonnes = m.quantity * density / 1000;
        const transportEmission = weightTonnes * (m.supplierDistance || 0) * tFactor;
        const wasteEmission = baseEmission * (m.wasteFactor || 0);
        const total = baseEmission + transportEmission + wasteEmission;

        return {
          materialName: m.emissionFactor?.materialName || "Unmapped Material",
          category: m.emissionFactor?.materialCategory || "Uncategorized",
          quantity: m.quantity,
          phase: m.phase?.name || "Unassigned",
          emissionFactor: factor,
          totalEmissions: total,
          transportEmissions: transportEmission,
          wasteEmissions: wasteEmission
        };
      });

      res.json({ materials: detailedMaterials });
    } catch (error) {
      console.error("Project Emissions Detail Error:", error);
      res.status(500).json({ message: "Failed to fetch project emissions" });
    }
  });

  // BOQ Batch Import Routes



  app.post("/api/projects/:id/materials/batch-preview", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const getUserId = (req: any) => req.user?.id; // Local helper or use existing
      const project = await storage.getProject(projectId, getUserId(req), req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const batchData = z.array(batchMaterialSchema).parse(req.body);

      const { resolveBatchEmissionFactors } = await import("./emissionCalculationService");
      const preview = await resolveBatchEmissionFactors(
        batchData,
        project.organizationId || ""
      );

      res.json(preview);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid batch data", errors: error.errors });
      }
      console.error("Batch preview error:", error);
      res.status(500).json({ message: "Batch preview failed" });
    }
  });

  app.post("/api/projects/:id/materials/batch", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const getUserId = (req: any) => req.user?.id;
      const project = await storage.getProject(projectId, getUserId(req), req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Body should be array of InsertProjectMaterial including selectedEmissionFactor
      const batchData = z.array(insertProjectMaterialSchema).parse(req.body);

      const results = [];
      for (const item of batchData) {
        // Ensure projectId matches URL
        if (item.projectId !== projectId) {
          console.warn(`Mismatch project ID in batch: ${item.projectId} vs ${projectId}`);
          continue; // Skip or error? Skip specifically.
        }
        const result = await storage.addProjectMaterial(item);
        results.push(result);
      }
      res.status(201).json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid batch data", errors: error.errors });
      }
      console.error("Batch commit error:", error);
      res.status(500).json({ message: "Batch processing failed" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 10: Project Material Auto-Mapping
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @route POST /api/projects/:id/automap/preview
   * @description Dry-run matching for unmapped project materials against selected datasets.
   */
  app.post("/api/projects/:id/automap/preview", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { id: projectId } = req.params;
      const { datasetIds, skipMapped = true } = req.body;

      if (!datasetIds || !Array.isArray(datasetIds) || datasetIds.length === 0) {
        return res.status(400).json({ message: "At least one dataset ID is required." });
      }

      const project = await storage.getProject(projectId, req.user?.id, req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found." });

      // Fetch ALL project materials to check for unmapped and conflicts
      const allMaterials = await storage.getProjectMaterials(projectId);

      const highConfidence: any[] = [];
      const lowConfidence: any[] = [];
      const noMatch: any[] = [];
      const conflicts: any[] = [];

      const { matchMaterial } = await import("./boqProcessing");

      for (const pm of allMaterials) {
        const isMapped = !!pm.emissionFactorId;

        // Decision A2: Surfacing conflicts if skipMapped is false or if it's unmapped
        if (isMapped && skipMapped) continue;

        const match = await matchMaterial(
          pm.customName || pm.emissionFactor?.materialName || "",
          project.organizationId || undefined,
          datasetIds
        );

        const result = {
          projectMaterialId: pm.id,
          originalName: pm.customName || pm.emissionFactor?.materialName || "Unknown",
          matchedFactorId: match.id,
          matchedFactorName: match.name,
          confidence: match.confidence,
          method: match.method,
          currentFactorId: pm.emissionFactorId,
          currentFactorName: pm.emissionFactor?.materialName
        };

        if (isMapped) {
          // If a different/better match is found for an already mapped item, it's a conflict
          if (match.id && match.id !== pm.emissionFactorId) {
            conflicts.push(result);
          }
        } else if (match.id) {
          if (match.confidence >= 85) {
            highConfidence.push(result);
          } else {
            lowConfidence.push(result);
          }
        } else {
          noMatch.push({
            projectMaterialId: pm.id,
            originalName: pm.customName || "Unknown"
          });
        }
      }

      res.json({ highConfidence, lowConfidence, noMatch, conflicts });
    } catch (error: any) {
      console.error("Automap Preview Error:", error);
      res.status(500).json({ message: error.message || "Preview failed" });
    }
  });

  /**
   * @route POST /api/projects/:id/automap/commit
   * @description Atomically update project material mappings and trigger recalculation.
   */
  app.post("/api/projects/:id/automap/commit", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { id: projectId } = req.params;
      const { mappings } = req.body; // Array of { projectMaterialId, emissionFactorId }

      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ message: "Mappings array required." });
      }

      const project = await storage.getProject(projectId, req.user?.id, req.organizationId);
      if (!project) return res.status(404).json({ message: "Project not found." });

      const results = [];
      for (const m of mappings) {
        const factor = await db.select().from(emissionFactors).where(eq(emissionFactors.id, m.emissionFactorId)).limit(1);
        if (factor.length === 0) continue;

        const updateData = {
          emissionFactorId: m.emissionFactorId,
          snapshotEmissionValue: factor[0].emissionFactor,
          snapshotSource: factor[0].sourceReference || "Global",
          updatedAt: new Date()
        };

        const [updated] = await db
          .update(projectMaterials)
          .set(updateData)
          .where(and(eq(projectMaterials.id, m.projectMaterialId), eq(projectMaterials.projectId, projectId)))
          .returning();

        results.push(updated);
      }

      // Mandatory Recalculation (A6)
      const { calculateProjectEmissions } = await import("./emissionCalculationService");
      await calculateProjectEmissions(projectId, req.organizationId);

      res.json({
        success: true,
        count: results.length,
        message: `${results.length} materials successfully re-mapped and emissions recalculated.`
      });
    } catch (error: any) {
      console.error("Automap Commit Error:", error);
      res.status(500).json({ message: error.message || "Commit failed" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: BOQ Template Download
  // GET /api/boq/template — Returns a standard SaHa CSV template file.
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * @route GET /api/boq/template
   * @description Generates and streams a standard SaHa BOQ CSV template.
   * The template columns are: Material, Quantity, Unit, LifecycleStage.
   * Users fill this template and upload it via the BOQ Import Wizard.
   * @access Authenticated users
   */
  app.get("/api/boq/template", isAuthenticated, async (_req, res) => {
    try {
      // Build the CSV string with header + sample rows
      const records = [
        ["Material", "Quantity", "Unit", "LifecycleStage"],
        ["Ready Mix Concrete M25", "250", "m3", "A1-A3"],
        ["Structural Steel", "15", "tonne", "A1-A3"],
        ["Reinforcement Bar", "8", "tonne", "A1-A3"],
        ["Hollow Block Masonry", "1200", "nr", "A1-A3"],
        ["Float Glass 6mm", "80", "m2", "A1-A3"],
      ];

      // Convert array of arrays to CSV string, prepending the UTF-8 BOM
      const csvContent = "\uFEFF" + records.map(row =>
        // Quote strings to safely handle spaces/commas if any exist
        row.map(cell => `"${cell}"`).join(",")
      ).join("\n");

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      // The frontend will override this filename, but it's good practice to set a default
      res.setHeader("Content-Disposition", `attachment; filename="SaHa_BOQ_Template.csv"`);
      res.status(200).send(csvContent);
    } catch (err: any) {
      console.error("Template generation error:", err);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Advanced Reporting — Portfolio & Organization Summaries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @route GET /api/reports/portfolio/summary
   * @description Returns an aggregated emission summary across ALL projects
   * in the admin's view (all organizations). Admin-only.
   * @access requireAdmin
   */
  app.get("/api/reports/portfolio/summary", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      // Fetch all projects and group by organization
      const allProjects = await db.select({
        id: projects.id,
        name: projects.name,
        organizationId: projects.organizationId,
        status: projects.status,
      }).from(projects);

      const portfolioData: {
        projectId: string;
        projectName: string;
        organizationId: string | null;
        totalEmissions: number;
        materialCount: number;
      }[] = [];

      for (const project of allProjects) {
        const materials = await storage.getProjectMaterials(project.id);
        let totalEmissions = 0;
        for (const m of materials) {
          const factor = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
          const waste = factor * m.quantity * (m.wasteFactor || 0);
          const transport = m.quantity * (m.supplierDistance || 0) * 0.1;
          totalEmissions += m.quantity * factor + waste + transport;
        }
        portfolioData.push({
          projectId: project.id,
          projectName: project.name,
          organizationId: project.organizationId ?? null,
          totalEmissions: Math.round(totalEmissions * 100) / 100,
          materialCount: materials.length,
        });
      }

      const grandTotal = portfolioData.reduce((s, p) => s + p.totalEmissions, 0);
      res.json({
        totalProjects: allProjects.length,
        grandTotalEmissions: Math.round(grandTotal * 100) / 100,
        projects: portfolioData.sort((a, b) => b.totalEmissions - a.totalEmissions),
      });
    } catch (err) {
      console.error("Portfolio Summary Error:", err);
      res.status(500).json({ message: "Failed to generate portfolio summary" });
    }
  });

  /**
   * @route GET /api/reports/organization/summary
   * @description Returns an aggregated emission summary for the caller's
   * active organization, grouped by project.
   * @access Authenticated, organization context required
   */
  app.get("/api/reports/organization/summary", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const orgId = req.organizationId;
      if (!orgId) return res.status(400).json({ message: "No organization context" });

      const orgProjects = await db.select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      }).from(projects).where(eq(projects.organizationId, orgId));

      const projectSummaries: {
        projectId: string;
        projectName: string;
        status: string | null;
        totalEmissions: number;
        materialCount: number;
        byLifecycleStage: Record<string, number>;
      }[] = [];

      for (const project of orgProjects) {
        const materials = await storage.getProjectMaterials(project.id);
        let totalEmissions = 0;
        const byLifecycleStage: Record<string, number> = {};

        for (const m of materials) {
          const factor = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
          const waste = factor * m.quantity * (m.wasteFactor || 0);
          const transport = m.quantity * (m.supplierDistance || 0) * 0.1;
          const itemTotal = m.quantity * factor + waste + transport;
          totalEmissions += itemTotal;

          const stage = (m as any).lifecycleStage || m.emissionFactor?.lifecycleStage || "A1-A3";
          byLifecycleStage[stage] = (byLifecycleStage[stage] || 0) + itemTotal;
        }

        projectSummaries.push({
          projectId: project.id,
          projectName: project.name,
          status: project.status ?? null,
          totalEmissions: Math.round(totalEmissions * 100) / 100,
          materialCount: materials.length,
          byLifecycleStage: Object.fromEntries(
            Object.entries(byLifecycleStage).map(([k, v]) => [k, Math.round(v * 100) / 100])
          ),
        });
      }

      const grandTotal = projectSummaries.reduce((s, p) => s + p.totalEmissions, 0);
      res.json({
        organizationId: orgId,
        totalProjects: orgProjects.length,
        grandTotalEmissions: Math.round(grandTotal * 100) / 100,
        projects: projectSummaries.sort((a, b) => b.totalEmissions - a.totalEmissions),
      });
    } catch (err) {
      console.error("Organization Summary Error:", err);
      res.status(500).json({ message: "Failed to generate organization summary" });
    }
  });

  // BOQ Upload Route
  // Configure Multer
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // SEC-02 Fix: Whitelist only allowed file types to prevent arbitrary file uploads.
  const ALLOWED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel',                                           // .xls
    'text/csv',                                                           // .csv
    'application/pdf',                                                    // .pdf
  ];

  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type '${file.mimetype}' is not allowed. Upload XLSX, XLS, CSV, or PDF only.`));
      }
    },
  });

  app.post("/api/projects/:id/boq/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const projectId = req.params.id;
      const userId = req.user.id; // Correct way to get ID from updated auth flow?
      // Helper getUserId checks req.user.id or claims. Let's use it.
      // But getUserId is defined inside registerRoutes scope. I can reuse it.

      const user = await storage.getUser(userId);

      // Modular Permission Check
      const canImportPdf = user?.role === 'admin'; // Temporary: Enterprise feature restricted to admins

      console.log(`[BOQ] Upload received. Project: ${projectId}, File: ${req.file.originalname}`);
      console.log(`[BOQ] Processing with active code version: ${new Date().toISOString()}`);

      const ext = path.extname(req.file.originalname).toLowerCase();
      const isSpreadsheet = [".xlsx", ".xls", ".csv"].includes(ext);

      if (!isSpreadsheet) {
        return res.status(400).json({
          message: `Invalid file format (${ext}). Boilerplate BOQ uploads must strictly be in .csv, .xls, or .xlsx format.`
        });
      }

      // Process based on Type
      // Note: processStandardBOQ now handles "Smart Mapping" logic (fuzzy match)
      let result;
      if (isSpreadsheet) {
        result = await processStandardBOQ(req.file.path, req.organizationId, req.file.originalname);
      } else {
        result = await processEnterpriseBOQ(req.file.path, req.file.mimetype);
      }

      // Create BOQ Import Record (Audit Trail)
      const boqImportData = {
        projectId,
        userId,
        tier: canImportPdf ? "enterprise" : "free", // Logic proxy for now
        status: result.success ? "processed" : "error",
        originalFilename: req.file.originalname,
        fileUrl: req.file.path,
        extractedData: result.success ? result.data : null,
        mappingConfidence: "confidence" in result ? result.confidence : 0,
      };

      const newImport = await storage.createBoqImport(boqImportData as any);

      if (!result.success) {
        return res.status(400).json({
          message: "Import processing failed",
          error: result.error,
          importId: newImport.id
        });
      }

      // Return Data for Preview (Do not insert to project_materials yet)
      res.status(201).json({
        message: "BOQ Parsed Successfully. Please review mapping.",
        importId: newImport.id,
        data: result.data,
        detectedHeaders: result.detectedHeaders,
        suggestedPhases: "suggestedPhases" in result ? result.suggestedPhases : []
      });

    } catch (error) {
      console.error("BOQ Upload Error:", error);
      res.status(500).json({ message: "Internal server error during BOQ upload" });
    }
  });

  // BOQ Confirm Route - Commit the previewed/edited items
  app.post("/api/projects/:id/boq/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const { importId, items, phaseAssignments } = req.body; // items: BOQLineItem[], phaseAssignments: record of sheetName -> phaseId
      const projectId = req.params.id;

      if (!importId || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid confirmation data" });
      }

      // Update BOQ Import Status
      // await storage.updateBoqImportStatus(importId, 'completed'); // TODO: Add this method to storage

      const results = [];
      for (const item of items) {
        // We now allow unmapped items (matchedMaterialId = null) to be imported.
        // They will contribute 0 emissions until mapped later.

        // Create Project Material
        const mat = {
          projectId,
          emissionFactorId: item.matchedMaterialId || null,
          quantity: Number(item.quantity) || 0,
          phaseId: phaseAssignments?.[item.sheetName] || null,
          customName: item.customName || item.description,
          notes: `Imported from BOQ: ${item.description} (File: ${item.sourceFilename || 'Unknown'}, Sheet: ${item.sheetName || 'Unknown'}, Row: ${item.rowIndex || '?'})`,
          boqImportId: importId,
          lifecycleStage: item.lifecycleStage || "A1-A3"
        };

        // Use standard storage method
        const added = await storage.addProjectMaterial(mat as any);
        results.push(added);
      }

      res.json({ message: "Import confirmed", count: results.length });

    } catch (error) {
      console.error("BOQ Confirm Error:", error);
      res.status(500).json({ message: "Failed to confirm import" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BOQ Normalizer Routes — Standalone normalizer utility
  // These are NEW endpoints. Do NOT modify the existing /api/boq/upload or /api/boq/confirm.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @route POST /api/boq/normalizer/parse
   * @description Accepts an Excel file upload, classifies sheets, and returns raw parsed rows.
   * @access requireApprovedUser
   */
  app.post("/api/boq/normalizer/parse", isAuthenticated, requireApprovedUser, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      if (![".xlsx", ".xls", ".csv"].includes(ext)) {
        return res.status(400).json({
          message: `Invalid file format (${ext}). BOQ Normalizer accepts .xlsx, .xls, or .csv files only.`
        });
      }

      console.log(`[Normalizer] Parse started. File: ${req.file.originalname}`);

      const { parseBoqSheets } = await import("./boqNormalizer");
      const fileBuffer = fs.readFileSync(req.file.path);

      // Selected sheets can be passed as JSON string in form data
      let selectedSheets: string[] | undefined;
      if (req.body.selectedSheets) {
        try {
          selectedSheets = JSON.parse(req.body.selectedSheets);
        } catch {
          // Ignore parse error — use all sheets
        }
      }

      const result = await parseBoqSheets(fileBuffer, selectedSheets, req.file.originalname);

      // Clean up temp file
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }

      console.log(`[Normalizer] Parse complete. ${result.sheets.length} sheets, ${result.rows.length} rows extracted.`);
      res.json(result);
    } catch (error: any) {
      console.error("[Normalizer] Parse error:", error);
      res.status(500).json({ message: "Failed to parse BOQ file", error: error.message });
    }
  });

  /**
   * @route POST /api/boq/normalizer/interpret
   * @description Takes raw parsed rows and enriches them with AI classification.
   * @access requireApprovedUser
   */
  app.post("/api/boq/normalizer/interpret", isAuthenticated, requireApprovedUser, async (req: any, res) => {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided for interpretation" });
      }

      console.log(`[Normalizer] Interpret started. ${rows.length} rows to process.`);

      const { interpretBoqRows } = await import("./boqNormalizer");
      const enriched = await interpretBoqRows(rows);

      console.log(`[Normalizer] Interpret complete. ${enriched.length} rows enriched.`);
      res.json({ rows: enriched });
    } catch (error: any) {
      console.error("[Normalizer] Interpret error:", error);
      res.status(500).json({ message: "AI interpretation failed", error: error.message });
    }
  });

  /**
   * @route POST /api/boq/normalizer/push
   * @description Commits selected enriched rows into project_materials.
   * Supports pushing to an existing project or creating a new one.
   * @access requireApprovedUser
   */
  app.post("/api/boq/normalizer/push", isAuthenticated, requireApprovedUser, organizationMiddleware, async (req: any, res) => {
    try {
      const { rows, projectId, newProject } = req.body;
      const orgId = req.organizationId;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided for push" });
      }

      // Validate: no QRO rows without quantity
      const invalidQro = rows.filter((r: any) => r.isQro && (r.quantity === null || r.quantity === "QRO"));
      if (invalidQro.length > 0) {
        return res.status(400).json({
          message: `${invalidQro.length} QRO row(s) still have no quantity. Enter quantities or deselect them before pushing.`,
        });
      }

      // Resolve target project
      let targetProjectId = projectId;
      let targetProjectName = "";

      if (newProject && !projectId) {
        // Create new project
        if (!newProject.name) {
          return res.status(400).json({ message: "Project name is required when creating a new project" });
        }

        const [created] = await db.insert(projects).values({
          name: newProject.name,
          location: newProject.location || "",
          type: newProject.type || "commercial",
          organizationId: orgId,
          userId: req.user.id,
          status: "active",
        }).returning();

        targetProjectId = created.id;
        targetProjectName = created.name;

        // Auto-scaffold default phases (fire-and-forget)
        try {
          const defaultPhases = [
            { name: "Foundation", orderIndex: 0 },
            { name: "Superstructure", orderIndex: 1 },
            { name: "Envelope", orderIndex: 2 },
            { name: "Interiors", orderIndex: 3 },
            { name: "MEP / Services", orderIndex: 4 },
          ];
          await db.insert(projectPhases).values(
            defaultPhases.map(p => ({
              ...p,
              projectId: targetProjectId,
              status: "planned" as const,
            }))
          );
        } catch (phaseErr) {
          console.warn("[Normalizer] Failed to create default phases:", phaseErr);
        }
      } else if (projectId) {
        // Validate existing project belongs to this org
        const project = await storage.getProject(projectId, req.user.id, orgId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        targetProjectName = project.name;
      } else {
        return res.status(400).json({ message: "Either projectId or newProject must be provided" });
      }

      // Unit normalization map
      const unitNormMap: Record<string, string> = {
        cum: "m3", "cu.m": "m3", "cubic meter": "m3", "cubic metre": "m3",
        sqm: "m2", "sq.m": "m2", "square meter": "m2", "square metre": "m2",
        mt: "t", "metric ton": "t", "metric tonne": "t",
        rmt: "rm", "running meter": "rm", "running metre": "rm",
        nos: "nr", "numbers": "nr", no: "nr", each: "nr",
      };

      // Insert into project_materials
      let insertedCount = 0;
      for (const row of rows) {
        const rawUnit = String(row.unit || "nr").toLowerCase().trim();
        const normalizedUnit = unitNormMap[rawUnit] || row.unit || "nr";

        const notes = [
          `File: ${row.sourceFilename || "Unknown"}`,
          `Sheet: ${row.sheetName || "Unknown"}`,
          row.slNo ? `Sl.No: ${row.slNo}` : "",
          row.description ? row.description.substring(0, 120) : "",
          row.grade ? `Grade: ${row.grade}` : "",
          `AI confidence: ${(row.confidence ?? 0).toFixed(2)}`,
          row.editedByUser ? "Edited by user" : "",
        ].filter(Boolean).join(" | ");

        await db.insert(projectMaterials).values({
          projectId: targetProjectId,
          name: row.materialCategory || row.primaryMaterial || row.description?.substring(0, 80) || "Unknown Material",
          quantity: Number(row.quantity) || 0,
          unit: normalizedUnit,
          lifecycleStage: row.lifecycleStageEn15804 || "A1-A3",
          notes,
          // emissionFactorId left null — matched by existing emission matching flow
        } as any);

        insertedCount++;
      }

      console.log(`[Normalizer] Push complete. ${insertedCount} materials added to project ${targetProjectId}.`);
      res.json({
        inserted: insertedCount,
        projectId: targetProjectId,
        projectName: targetProjectName,
      });
    } catch (error: any) {
      console.error("[Normalizer] Push error:", error);
      res.status(500).json({ message: "Failed to push materials", error: error.message });
    }
  });

  // --- Emission Dataset Management (Multi-tenant & Lifecycle aligned) ---

  // Helper to check dataset permission
  const getDatasetWithPermission = async (req: any, datasetId: string, writeMode = false) => {
    const isSystemAdmin = req.user.role === 'admin';
    const organizationId = req.organizationId;

    const [dataset] = await db.select()
      .from(emissionDatasets)
      .where(eq(emissionDatasets.id, datasetId))
      .limit(1);

    if (!dataset) return { error: { status: 404, message: "Dataset not found" } };

    // Tenant Boundary check
    if (!isSystemAdmin) {
      if (dataset.organizationId && dataset.organizationId !== organizationId) {
        return { error: { status: 403, message: "Access denied to this organization's dataset" } };
      }
      if (writeMode && !dataset.organizationId) {
        return { error: { status: 403, message: "Only system admins can modify global datasets" } };
      }
    }

    return { dataset };
  };

  // 1. Unified Dataset Index
  app.get("/api/datasets", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const isSystemAdmin = req.user.role === 'admin';
      const organizationId = req.organizationId;

      // System Admins see everything. Org Admins see Global + their own.
      const query = isSystemAdmin
        ? db.select().from(emissionDatasets)
        : db.select().from(emissionDatasets).where(or(
          isNull(emissionDatasets.organizationId),
          eq(emissionDatasets.organizationId, organizationId)
        ));

      const datasets = await query.orderBy(desc(emissionDatasets.isDefault), desc(emissionDatasets.createdAt));

      // Calculate expiry warning (D9)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

      const result = datasets.map(ds => ({
        ...ds,
        isExpiringSoon: ds.validityEnd && ds.validityEnd > now && ds.validityEnd <= thirtyDaysFromNow,
        isExpired: ds.validityEnd && ds.validityEnd <= now
      }));

      res.json(result);
    } catch (error) {
      console.error("Fetch Datasets Error:", error);
      res.status(500).json({ message: "Failed to fetch datasets" });
    }
  });

  // 2. Create Dataset (Starts as Draft - D1)
  app.post("/api/datasets", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { name, region, description, environment, validityStart, validityEnd } = req.body;
      const organizationId = req.organizationId;
      const isSystemAdmin = req.user.role === 'admin';

      // If system admin, prioritize body.orgId, then header.orgId, then null (global)
      // If regular user, always use header.orgId
      const targetOrgId = isSystemAdmin
        ? (req.body.organizationId || organizationId || null)
        : organizationId;

      const [newDataset] = await db.insert(emissionDatasets).values({
        name,
        region: region || "Global",
        description,
        organizationId: targetOrgId,
        status: "draft", // D1 Locked Decision
        environment: environment || "production",
        validityStart: validityStart ? new Date(validityStart) : new Date(),
        validityEnd: validityEnd ? new Date(validityEnd) : null,
        isDefault: false
      }).returning();

      res.status(201).json(newDataset);
    } catch (error) {
      console.error("Create Dataset Error:", error);
      res.status(500).json({ message: "Failed to create dataset" });
    }
  });

  // 3. Dataset Template Download (D13/Phase 3)
  app.get("/api/datasets/template", isAuthenticated, async (req, res) => {
    const csvContent = "\ufeff" + [ // UTF-8 BOM
      "Material Name,Unit,Emission Factor,Category,Lifecycle Stage,GHG Scope,Source Reference,Density",
      "Steel Reinforcement,t,2.5,Metals,A1-A3,scope3,ICE v3.0,7850",
      "Ready Mix Concrete C30/37,m3,280,Concrete,A1-A3,scope3,Supplier EPD,2400",
      "Timber Joist,m3,110,Timber,A1-A3,scope3,General DB,600"
    ].join("\n");

    res.setHeader('Content-Type', 'text/csv; charset=utf-16');
    res.setHeader('Content-Disposition', 'attachment; filename=SaHa_EmissionFactors_Template.csv');
    res.status(200).send(csvContent);
  });

  // 4. Atomic Upload Handler (D2, D3, D6, D7)
  app.post("/api/datasets/:id/upload", isAuthenticated, organizationMiddleware, upload.single("file"), async (req: any, res) => {
    let logEntryHandled = false;
    const organizationId = req.organizationId;
    const userId = getUserId(req);

    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const datasetId = req.params.id;
      const { dataset, error } = await getDatasetWithPermission(req, datasetId, true);
      if (error) {
        fs.unlinkSync(req.file.path);
        return res.status(error.status).json({ message: error.message });
      }

      // Process with role-based limits (D6, D7)
      const result = await processDatasetImport(req.file.path, req.user.role);

      try { fs.unlinkSync(req.file.path); } catch (e) { }

      if (!result.success || result.errors) {
        // Log the failure (D3)
        await db.insert(datasetUploadLogs).values({
          datasetId, userId, organizationId,
          filename: req.file.originalname,
          fileSize: req.file.size,
          status: "failed",
          totalRows: result.stats?.total || 0,
          validRows: result.stats?.valid || 0,
          errorRows: result.stats?.invalid || 0,
          errorDetail: result.errors || [{ reason: result.error }]
        } as any);

        return res.status(400).json({
          message: result.error || "Validation failed for one or more rows",
          errors: result.errors,
          stats: result.stats
        });
      }

      // Atomic DB Insertion (D2)
      await db.transaction(async (tx) => {
        // Scope for insert
        const scope = dataset.organizationId ? 'organization' : 'platform';

        for (const row of result.data!) {
          await tx.insert(emissionFactors).values({
            materialName: row.name,
            materialCategory: row.category,
            emissionFactor: row.emissionFactor,
            unit: row.unit,
            sourceReference: row.sourceReference || row.source || `Imported from ${req.file!.originalname}`,
            datasetId: dataset.id,
            organizationId: dataset.organizationId,
            scope: scope,
            ghgScope: row.ghgScope,
            lifecycleStage: row.lifecycleStage,
            density: row.density,
            isActive: true
          });
        }

        // Update Dataset Meta
        await tx.update(emissionDatasets).set({
          activeFactorCount: (dataset.activeFactorCount || 0) + result.data!.length,
          lastFilename: req.file!.originalname,
          updatedAt: new Date()
        }).where(eq(emissionDatasets.id, datasetId));

        // Create Success Log
        await tx.insert(datasetUploadLogs).values({
          datasetId, userId, organizationId,
          filename: req.file!.originalname,
          fileSize: req.file!.size,
          status: "success",
          totalRows: result.stats!.total,
          validRows: result.stats!.valid,
          errorRows: 0,
        } as any);
      });

      res.json({
        message: `Successfully imported ${result.stats!.valid} factors.`,
        stats: result.stats
      });

    } catch (error: any) {
      console.error("Upload Error:", error);
      res.status(500).json({ message: "Internal server error during upload", details: error.message });
    }
  });

  // 5. Lifecycle Meta Update (D11)
  app.patch("/api/datasets/:id", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { dataset, error } = await getDatasetWithPermission(req, req.params.id, true);
      if (error) return res.status(error.status).json({ message: error.message });

      const updates: any = {};
      const body = req.body;

      // Status Transition Guards (D11)
      if (body.status && body.status !== dataset.status) {
        if (dataset.status === "archived") {
          return res.status(400).json({ message: "Archived datasets cannot be reactivated." });
        }
        if (dataset.status === "active" && body.status === "draft") {
          return res.status(400).json({ message: "Active datasets cannot be moved back to draft." });
        }
        // Activation Check: Cannot activate empty dataset
        if (body.status === "active" && (dataset.activeFactorCount || 0) === 0) {
          return res.status(400).json({ message: "Cannot activate an empty dataset. Please upload data first." });
        }
        updates.status = body.status;
      }

      if (body.name) updates.name = body.name;
      if (body.region) updates.region = body.region;
      if (body.description !== undefined) updates.description = body.description;
      if (body.environment) updates.environment = body.environment;
      if (body.validityStart) updates.validityStart = new Date(body.validityStart);
      if (body.validityEnd !== undefined) updates.validityEnd = body.validityEnd ? new Date(body.validityEnd) : null;

      updates.updatedAt = new Date();

      // If archiving, also deactivate factors (D5)
      if (updates.status === "archived") {
        await db.transaction(async (tx) => {
          await tx.update(emissionDatasets).set(updates).where(eq(emissionDatasets.id, dataset.id));
          await tx.update(emissionFactors).set({ isActive: false }).where(eq(emissionFactors.datasetId, dataset.id));
        });
      } else {
        await db.update(emissionDatasets).set(updates).where(eq(emissionDatasets.id, dataset.id));
      }

      res.json({ ...dataset, ...updates });
    } catch (error: any) {
      console.error("Update Dataset Error:", error);
      res.status(500).json({ message: "Failed to update dataset" });
    }
  });

  // 5.5. Fetch Dataset Factors (D4/Phase 3)
  app.get("/api/datasets/:id/factors", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { dataset, error } = await getDatasetWithPermission(req, req.params.id);
      if (error) return res.status(error.status).json({ message: error.message });

      const factors = await db.select()
        .from(emissionFactors)
        .where(eq(emissionFactors.datasetId, dataset.id))
        .orderBy(asc(emissionFactors.materialName));

      res.json(factors);
    } catch (error) {
      console.error("Fetch Factors Error:", error);
      res.status(500).json({ message: "Failed to fetch factors" });
    }
  });

  // 5.6. Update Individual Factor Metadata (Phase 8)
  app.patch("/api/factors/:id", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const factorId = req.params.id;
      const body = req.body;

      // 1. Find the factor
      const [factor] = await db.select().from(emissionFactors).where(eq(emissionFactors.id, factorId)).limit(1);
      if (!factor) return res.status(404).json({ message: "Emission factor not found" });

      // 2. Security Check: Traverse to parent dataset
      const { dataset, error } = await getDatasetWithPermission(req, factor.datasetId);
      if (error) return res.status(error.status).json({ message: error.message });

      // 3. Validation: Only allow metadata updates (Revised Scope v2)
      const updates: any = {};
      if (body.materialCategory !== undefined) updates.materialCategory = body.materialCategory;
      if (body.ghgScope !== undefined) updates.ghgScope = body.ghgScope;
      if (body.lifecycleStage !== undefined) updates.lifecycleStage = body.lifecycleStage;
      if (body.sourceReference !== undefined) updates.sourceReference = body.sourceReference;

      // D1-D13: Emission factor value, unit, and material name are IMMUTABLE here
      // Re-upload is required for core data changes.

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid metadata fields provided for update" });
      }

      const [updatedFactor] = await db.update(emissionFactors)
        .set(updates)
        .where(eq(emissionFactors.id, factorId))
        .returning();

      res.json(updatedFactor);
    } catch (error) {
      console.error("Update Factor Error:", error);
      res.status(500).json({ message: "Failed to update factor metadata" });
    }
  });

  // 6. Upload History (D3/Phase 3)
  app.get("/api/datasets/:id/logs", isAuthenticated, organizationMiddleware, async (req: any, res) => {
    try {
      const { dataset, error } = await getDatasetWithPermission(req, req.params.id);
      if (error) return res.status(error.status).json({ message: error.message });

      const logs = await db.select()
        .from(datasetUploadLogs)
        .where(eq(datasetUploadLogs.datasetId, dataset.id))
        .orderBy(desc(datasetUploadLogs.createdAt));

      res.json(logs);
    } catch (error) {
      console.error("Fetch Logs Error:", error);
      res.status(500).json({ message: "Failed to fetch upload logs" });
    }
  });

  // EPD Sync: Check if EPD_DATABASE_URL is configured
  app.get("/api/admin/sync-epd/status", requireAdmin, async (req, res) => {
    const isConfigured = !!process.env.EPD_DATABASE_URL;
    res.json({
      configured: isConfigured,
      message: isConfigured
        ? "EPD_DATABASE_URL is set. Sync is available."
        : "EPD_DATABASE_URL is not configured. Add it to your .env to enable EPD sync."
    });
  });

  // EPD Sync: Trigger a read-only mirror from EPD Extractor DB
  app.post("/api/admin/sync-epd", requireAdmin, async (req, res) => {
    try {
      const { syncEpdData } = await import("./epdSync");
      const syncResult = await syncEpdData();
      res.json({
        success: syncResult.errors.length === 0,
        message: `Sync complete: ${syncResult.inserted} inserted, ${syncResult.updated} updated, ${syncResult.skipped} skipped.`,
        ...syncResult,
      });
    } catch (error: any) {
      console.error("EPD Sync Error:", error);
      res.status(500).json({ error: "EPD sync failed", details: error.message });
    }
  });

  // --- Organization Management Routes ---

  // Get current user's organization
  app.get("/api/organization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const [userOrg] = await db.select({
        org: organizations,
        role: organizationUsers.role
      })
        .from(organizationUsers)
        .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
        .where(eq(organizationUsers.userId, userId))
        .limit(1);

      if (!userOrg) {
        return res.status(404).json({ message: "No organization found for this user" });
      }

      res.json({ ...userOrg.org, role: userOrg.role });
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  // Get Organizations for a user
  app.get("/api/user/organizations", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const orgs = await storage.getUserOrganizations(userId);
    res.json(orgs);
  });



  // Create Organization
  app.post("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgData = insertOrganizationSchema.parse(req.body);

      const newOrg = await storage.createOrganization(orgData, userId);
      res.status(201).json(newOrg);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid organization data", errors: error.errors });
      }
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  // Update Organization
  app.put("/api/organizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = req.params.id;

      // 1. Verify Membership & Role
      const membership = await storage.getUserOrganizationMembership(userId, orgId);
      if (!membership || membership.role !== 'org_admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      // 2. Validate Input
      const orgData = insertOrganizationSchema.partial().parse(req.body);

      // 3. Update
      const updatedOrg = await storage.updateOrganization(orgId, orgData);
      res.json(updatedOrg);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid organization data", errors: error.errors });
      }
      console.error("Error updating organization:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
