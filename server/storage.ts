/**
 * @file storage.ts
 * @description Data Access Layer (DAL) for the application.
 * Encapsulates all database operations, abstracting standard CRUD and complex queries.
 * 
 * @functionality
 * - User Interfaces: Defines `IStorage` interface for potential multi-backend support.
 * - User/Admin Ops: CRUD for users, including role and status management.
 * - Project Ops: Managing Projects, Phases, and Materials structures.
 * - Emission Stats: Aggregating emission calculations and dashboard metrics.
 * - Manifesto Compliance: Handling emission factor resolution and snapshotting.
 * 
 * @dependencies
 * - drizzle-orm: For executing SQL queries via TypeScript.
 * - @shared/schema: Types and Zod schemas for validation.
 * - emissionCalculationService: Helper for advanced logic (circular dependency handling).
 * - emailService: Notifications for approval/rejection events.
 * 
 * @breaking-changes
 * - Interface Contract: Changes to `IStorage` must be reflected in `DatabaseStorage`.
 * - Material ID Generation: Relies on `displayId` format stability.
 */

import {
  users,
  projects,
  projectPhases,
  projectMaterials,
  boqImports,
  emissionDatasets,
  emissionFactors,
  materialSuppliers,
  emissionCalculations,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type EmissionFactor,
  type InsertEmissionFactor,
  type ProjectMaterial,
  type InsertProjectMaterial,
  type ProjectPhase,
  type InsertProjectPhase,
  type MaterialSupplier,
  type InsertMaterialSupplier,
  organizationUsers,
  type EmissionCalculation,
  type InsertEmissionCalculation,
  type EmissionDataset,
  type InsertEmissionDataset,
  organizations, // Ensure this is present
  type Organization,
  type InsertOrganization,
  type BoqImport,
  type InsertBoqImport,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, isNull, like } from "drizzle-orm";
import { emailService } from "./emailService";
import { resolveEmissionFactor } from "./emissionFactorService";

// generateMaterialId removed (dead code, relied on non-existent displayId)

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Admin user management operations
  getPendingUsers(): Promise<User[]>;
  approveUser(userId: string, adminId: string): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>, adminOverride?: Partial<User>): Promise<User>;
  rejectUser(userId: string, adminId: string): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Organization Context
  getUserOrganization(userId: string): Promise<{ organizationId: string, role: string } | undefined>;
  getUserOrganizations(userId: string): Promise<{ id: string, name: string, role: string }[]>;
  getUserOrganizationMembership(userId: string, organizationId: string): Promise<{ organizationId: string, role: string } | undefined>;

  /**
   * Creates a new organization and assigns the creator as an admin.
   * @param org Organization data to insert
   * @param userId ID of the user creating the organization
   * @returns Created Organization object
   */
  createOrganization(org: InsertOrganization, userId: string): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization>;

  // Organization Member Management
  addUserToOrganization(organizationId: string, email: string, role: string): Promise<User | undefined>;
  removeUserFromOrganization(organizationId: string, userId: string): Promise<void>;
  getOrganizationMembers(organizationId: string): Promise<(User & { orgRole: string })[]>;
  getOrganization(organizationId: string): Promise<Organization | undefined>; // Added

  // Project operations
  getProjects(userId: string, organizationId?: string): Promise<Project[]>;
  getProject(id: string, userId: string, organizationId?: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, userId: string, isOrgAdmin?: boolean): Promise<Project>;
  deleteProject(id: string, userId: string, isOrgAdmin?: boolean): Promise<void>;

  // Project phase operations
  getProjectPhases(projectId: string): Promise<ProjectPhase[]>;
  createProjectPhase(phase: InsertProjectPhase): Promise<ProjectPhase>;
  updateProjectPhase(id: string, phase: Partial<InsertProjectPhase>): Promise<ProjectPhase>;
  deleteProjectPhase(id: string): Promise<void>;
  reorderProjectPhases(phaseOrders: { id: string, orderIndex: number }[]): Promise<void>;

  // Material operations (Aliased to EmissionFactors for now)
  getMaterials(organizationId?: string): Promise<EmissionFactor[]>;
  createMaterial(material: InsertEmissionFactor): Promise<EmissionFactor>;
  updateMaterial(id: string, material: Partial<InsertEmissionFactor>): Promise<EmissionFactor>;
  deleteMaterial(id: string): Promise<void>;

  // Material supplier operations
  getMaterialSuppliers(): Promise<MaterialSupplier[]>;
  createMaterialSupplier(supplier: InsertMaterialSupplier): Promise<MaterialSupplier>;
  updateMaterialSupplier(id: string, supplier: Partial<InsertMaterialSupplier>): Promise<MaterialSupplier>;
  deleteMaterialSupplier(id: string): Promise<void>;

  // Project material operations
  getProjectMaterials(projectId: string): Promise<(ProjectMaterial & { emissionFactor: EmissionFactor | null; phase?: ProjectPhase })[]>;
  addProjectMaterial(projectMaterial: InsertProjectMaterial): Promise<ProjectMaterial>;
  updateProjectMaterial(id: string, projectMaterial: Partial<InsertProjectMaterial>): Promise<ProjectMaterial>;
  deleteProjectMaterial(id: string): Promise<void>;

  // Emission calculation operations
  getEmissionCalculations(projectMaterialId: string): Promise<EmissionCalculation[]>;
  saveEmissionCalculation(calculation: InsertEmissionCalculation): Promise<EmissionCalculation>;

  // Enhanced emissions calculations
  getProjectEmissions(projectId: string): Promise<{
    totalEmissions: number;
    breakdownByCategory: Record<string, number>;
    breakdownByPhase: Record<string, number>;
  }>;
  getDashboardStats(userId: string, organizationId?: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalEmissions: number;
    avgIntensity: number;
    dataQualityPercent: number;
  }>;
  getOrganizationPortfolio(organizationId: string): Promise<{
    id: string;
    name: string;
    totalEmissions: number;
    dataQualityPercent: number;
    buildingArea: number | null;
    intensity: number | null;
  }[]>;
  getOrganizationEmissionsByCategory(organizationId: string, projectId?: string): Promise<{ category: string, value: number }[]>;
  getCategoryDrilldown(organizationId: string, category: string, projectId?: string): Promise<{
    materialName: string;
    totalEmissions: number;
    unit: string;
    lifecycleStage: string;
    source: string;
  }[]>;
  getOrganizationEmissionsByStage(organizationId: string, projectId?: string): Promise<{
    name: string; // Project name or "Organization Total"
    breakdown: Record<string, number>;
  }[]>;
  getUnmappedMaterialsSummary(organizationId: string): Promise<{
    projectId: string;
    projectName: string;
    totalMaterials: number;
    unmappedMaterials: number;
    qualityPercent: number;
  }[]>;
  getOrganizationEmissionsTrend(organizationId: string): Promise<{ month: string, emissions: number }[]>;

  // Manifesto Compliance
  getEmissionDatasets(): Promise<EmissionDataset[]>;

  // Reporting
  getPortfolioReport(userId: string, organizationId?: string): Promise<Array<{
    projectName: string;
    status: string;
    createdAt: Date;
    totalMaterials: number;
    totalEmissions: number;
  }>>;

  // BOQ Import operations
  createBoqImport(boqImport: InsertBoqImport): Promise<BoqImport>;
  getBoqImport(id: string): Promise<BoqImport | undefined>;
  getBoqImports(projectId: string): Promise<BoqImport[]>;
  updateBoqImport(id: string, boqImport: Partial<InsertBoqImport>): Promise<BoqImport>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Helper method for Organization Context
  async getUserOrganization(userId: string): Promise<{ organizationId: string, role: string } | undefined> {
    const [result] = await db
      .select({
        organizationId: organizationUsers.organizationId,
        role: organizationUsers.role
      })
      .from(organizationUsers)
      .where(eq(organizationUsers.userId, userId))
      .limit(1);

    // Type casting because Drizzle leftJoin/references might return nulls if not careful, 
    // but here we select directly from organizationUsers.
    // organizationId is generated as nullable in schema but logic implies it shouldn't be for a record.
    if (result && result.organizationId) {
      return { organizationId: result.organizationId, role: result.role || 'viewer' };
    }
    return undefined;
  }

  async getUserOrganizations(userId: string): Promise<{ id: string, name: string, role: string }[]> {
    const results = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: organizationUsers.role
      })
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
      .where(eq(organizationUsers.userId, userId));

    return results.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role || 'viewer'
    }));
  }

  async getOrganization(organizationId: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    return org;
  }

  // Specific Membership Check
  async getUserOrganizationMembership(userId: string, organizationId: string): Promise<{ organizationId: string, role: string } | undefined> {
    const [result] = await db
      .select({
        organizationId: organizationUsers.organizationId,
        role: organizationUsers.role
      })
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ))
      .limit(1);

    if (result && result.organizationId) {
      return { organizationId: result.organizationId, role: result.role || 'viewer' };
    }
    return undefined;
  }

  /**
   * Creates a new organization and assigns the creator as an admin.
   * @param org Organization data to insert
   * @param userId ID of the user creating the organization
   * @returns Created Organization object
   */
  async createOrganization(org: InsertOrganization, userId: string): Promise<Organization> {
    // 1. Create Organization
    const [newOrg] = await db.insert(organizations).values(org).returning();

    // 2. Add Creator as Admin
    await db.insert(organizationUsers).values({
      userId,
      organizationId: newOrg.id,
      role: 'org_admin'
    });

    return newOrg;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization> {
    const [updatedOrg] = await db
      .update(organizations)
      .set(org)
      .where(eq(organizations.id, id))
      .returning();

    if (!updatedOrg) {
      throw new Error("Organization not found");
    }

    return updatedOrg;
  }

  async addUserToOrganization(organizationId: string, email: string, role: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return undefined;

    // Check if already a member
    const [existingMember] = await db
      .select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, user.id)
      ));

    if (existingMember) {
      // Update role if already exists
      await db
        .update(organizationUsers)
        .set({ role: role as "org_admin" | "estimator" | "viewer" })
        .where(eq(organizationUsers.id, existingMember.id));
    } else {
      // Add new member
      await db.insert(organizationUsers).values({
        organizationId,
        userId: user.id,
        role: role as "org_admin" | "estimator" | "viewer"
      });
    }

    return user;
  }

  async removeUserFromOrganization(organizationId: string, userId: string): Promise<void> {
    await db
      .delete(organizationUsers)
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      ));
  }

  async getOrganizationMembers(organizationId: string): Promise<(User & { orgRole: string })[]> {
    const members = await db
      .select({
        user: users,
        role: organizationUsers.role
      })
      .from(organizationUsers)
      .innerJoin(users, eq(organizationUsers.userId, users.id))
      .where(eq(organizationUsers.organizationId, organizationId));

    return members.map(m => ({
      ...m.user,
      orgRole: m.role || 'viewer'
    }));
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [userToUpdate] = await db.select().from(users).where(eq(users.id, userId));
    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;

    if (userToUpdate && initialAdminEmail && userToUpdate.email?.toLowerCase() === initialAdminEmail.toLowerCase()) {
      throw new Error("Action Prohibited: The Root Administrator role cannot be modified.");
    }

    const [updatedUser] = await db.update(users)
      .set({ role: role as any })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updateOrgUserRole(organizationId: string, userId: string, role: string): Promise<void> {
    await db.update(organizationUsers)
      .set({ role: role as any })
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      ));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      let existingUser;
      if (userData.email) {
        [existingUser] = await db.select().from(users).where(eq(users.email, userData.email));
      }
      if (!existingUser && userData.id) {
        [existingUser] = await db.select().from(users).where(eq(users.id, userData.id));
      }

      if (existingUser) {
        // CRITICAL FIX: Do NOT overwrite status or role if they exist!
        // Only update profile information like name/photo on login.
        const { status, role, approvedBy, approvedAt, createdAt, ...updateFields } = userData;

        // SELF-HEALING: If this is the Initial Admin and they are somehow "pending", fix them!
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
        let adminOverride = {};

        if (initialAdminEmail && existingUser.email && existingUser.email.toLowerCase() === initialAdminEmail.toLowerCase()) {
          if (existingUser.status !== 'approved' || existingUser.role !== 'admin') {
            console.log(`[Auth] Self-Healing Initial Admin: ${existingUser.email}`);
            adminOverride = {
              role: 'admin',
              status: 'approved',
              approvedAt: new Date(),
              approvedBy: null // System approval has no user ID
            };
          }
        }

        const [updatedUser] = await db
          .update(users)
          .set({ ...updateFields, ...adminOverride, updatedAt: new Date() })
          .where(eq(users.id, existingUser.id))
          .returning();

        return updatedUser;
      } else {
        // Bootstrap Strategy: First user in empty DB OR matching INITIAL_ADMIN_EMAIL becomes super admin
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
        let finalUserData = { ...userData };

        const isEmailMatch = initialAdminEmail && userData.email &&
          userData.email.toLowerCase() === initialAdminEmail.toLowerCase();

        // Check if this is literally the first user in the system
        const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
        const isFirstUser = count === 0;

        if (isEmailMatch || isFirstUser) {
          if (isFirstUser) {
            console.log(`[Auth] 🚀 First user detected — auto-promoting to Super Admin: ${userData.email}`);
          } else {
            console.log(`[Auth] Auto-approving Initial Admin (INITIAL_ADMIN_EMAIL match): ${userData.email}`);
          }
          finalUserData.role = 'admin';
          finalUserData.status = 'approved';
          finalUserData.approvedAt = new Date();
          finalUserData.approvedBy = null; // System approval
        }

        const [newUser] = await db.insert(users).values(finalUserData).returning();
        return newUser;
      }
    } catch (error) {
      console.error("Error in upsertUser:", error);
      throw error;
    }
  }

  async updateUser(id: string, user: Partial<UpsertUser>, adminOverride: Partial<User> = {}): Promise<User> {
    try {
      const { status, role, approvedBy, approvedAt, createdAt, ...updateFields } = user;

      const [updatedUser] = await db
        .update(users)
        .set({ ...updateFields, ...adminOverride, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) throw new Error("User not found");
      return updatedUser;
    } catch (error) {
      console.error("Error in updateUser:", error);
      throw error;
    }
  }

  async getPendingUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.status, "pending")).orderBy(desc(users.createdAt));
  }

  async approveUser(userId: string, adminId: string): Promise<User> {
    try {
      const [updatedUser] = await db.update(users).set({ status: "approved", approvedBy: adminId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId)).returning();

      if (updatedUser?.email) {
        const userName = `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.email;
        try {
          await emailService.sendApprovalNotification(updatedUser.email, userName);
        } catch (e) {
          console.warn('Failed to send approval email:', e);
        }
      }
      return updatedUser;
    } catch (error) {
      console.error("Error approving user:", error);
      throw error;
    }
  }

  async rejectUser(userId: string, adminId: string): Promise<User> {
    try {
      const [updatedUser] = await db.update(users).set({ status: "rejected", approvedBy: adminId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId)).returning();

      if (updatedUser?.email) {
        const userName = `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.email;
        try {
          await emailService.sendRejectionNotification(updatedUser.email, userName);
        } catch (e) {
          console.warn('Failed to send rejection email:', e);
        }
      }
      return updatedUser;
    } catch (error) {
      console.error("Error rejecting user:", error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async migrateExistingUsers(adminId: string): Promise<number> { return 0; }

  // Project operations
  async getProjects(userId: string, organizationId?: string): Promise<Project[]> {
    if (!organizationId) {
      throw new Error("Organization context is mandatory for project listing.");
    }

    return await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string, userId?: string, organizationId?: string): Promise<Project | undefined> {
    if (!organizationId) {
      throw new Error("Organization context is mandatory for project fetching.");
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, id),
        eq(projects.organizationId, organizationId)
      ));

    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    console.log("💾 DATABASE: Creating project - START");
    console.log("📝 Project data to insert:", project);

    const insertData = { ...project, updatedAt: new Date() };
    console.log("📋 Final insert data:", insertData);

    const [newProject] = await db
      .insert(projects)
      .values(insertData)
      .returning();

    console.log("✅ Database insert successful:", newProject);
    console.log("💾 DATABASE: Creating project - SUCCESS");
    return newProject;
  }

  async updateProject(id: string, project: Partial<InsertProject>, userId: string, isOrgAdmin: boolean = false): Promise<Project> {
    const whereClause = isOrgAdmin
      ? eq(projects.id, id)
      : and(eq(projects.id, id), eq(projects.userId, userId));

    const [updatedProject] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(whereClause)
      .returning();

    if (!updatedProject) throw new Error("Project not found or access denied");
    return updatedProject;
  }

  async deleteProject(id: string, userId: string, isOrgAdmin: boolean = false): Promise<void> {
    const whereClause = isOrgAdmin
      ? eq(projects.id, id)
      : and(eq(projects.id, id), eq(projects.userId, userId));

    await db
      .delete(projects)
      .where(whereClause);
  }

  // Material operations
  async getMaterials(organizationId?: string): Promise<EmissionFactor[]> {
    let factors: EmissionFactor[] = [];

    if (organizationId) {
      // 1. Fetch ALL relevant factors (Global + My Org)
      factors = await db
        .select()
        .from(emissionFactors)
        .where(
          and(
            eq(emissionFactors.isActive, true),
            or(
              eq(emissionFactors.scope, "platform"),
              eq(emissionFactors.organizationId, organizationId)
            )
          )
        );
    } else {
      // 2. Default: Return only Global Factors
      factors = await db
        .select()
        .from(emissionFactors)
        .where(and(eq(emissionFactors.scope, "platform"), eq(emissionFactors.isActive, true)));
    }

    // 3. Deduplicate/Prioritize: Organization > Platform
    const factorMap = new Map<string, EmissionFactor>();

    for (const factor of factors) {
      // Normalize name for matching
      const key = factor.materialName.toLowerCase().trim();
      const existing = factorMap.get(key);

      if (!existing) {
        factorMap.set(key, factor);
      } else {
        // If conflict, prefer Organization scope
        if (factor.scope === 'organization' && existing.scope === 'platform') {
          factorMap.set(key, factor);
        }
        // If existing is Organization, keep it (ignore Platform)
      }
    }

    // 4. Return as array, sorted by Category -> Name
    return Array.from(factorMap.values()).sort((a, b) => {
      const catCompare = (a.materialCategory || "").localeCompare(b.materialCategory || "");
      if (catCompare !== 0) return catCompare;
      return a.materialName.localeCompare(b.materialName);
    });
  }

  async getMaterial(id: string): Promise<EmissionFactor | undefined> {
    const [factor] = await db
      .select()
      .from(emissionFactors)
      .where(eq(emissionFactors.id, id));
    return factor;
  }

  async createMaterial(material: InsertEmissionFactor): Promise<EmissionFactor> {
    console.log("💾 DATABASE: Creating emission factor - START");
    console.log("📝 Factor data to insert:", material);

    const [newFactor] = await db
      .insert(emissionFactors)
      .values(material)
      .returning();

    console.log("✅ Database insert successful:", newFactor);
    return newFactor;
  }

  async updateMaterial(id: string, material: Partial<InsertEmissionFactor>): Promise<EmissionFactor> {
    const [updatedFactor] = await db
      .update(emissionFactors)
      .set(material)
      .where(eq(emissionFactors.id, id))
      .returning();
    return updatedFactor;
  }

  async deleteMaterial(id: string): Promise<void> {
    await db.delete(emissionFactors).where(eq(emissionFactors.id, id));
  }


  async getProjectMaterials(projectId: string): Promise<(ProjectMaterial & { emissionFactor: EmissionFactor | null; phase?: ProjectPhase })[]> {
    // DEBUG: Check raw without joins first
    const raw = await db.select().from(projectMaterials).where(eq(projectMaterials.projectId, projectId));
    console.log(`[DEBUG] getProjectMaterials raw count for ${projectId}: ${raw.length}`);
    if (raw.length > 0) {
      console.log(`[DEBUG] First raw material factorID: ${raw[0].emissionFactorId}`);
    }

    const result = await db
      .select({
        id: projectMaterials.id,
        projectId: projectMaterials.projectId,
        emissionFactorId: projectMaterials.emissionFactorId,
        phaseId: projectMaterials.phaseId,
        quantity: projectMaterials.quantity,
        supplierDistance: projectMaterials.supplierDistance,
        wasteFactor: projectMaterials.wasteFactor,
        transportMode: projectMaterials.transportMode, // P1b
        installationMethod: projectMaterials.installationMethod,
        notes: projectMaterials.notes,
        createdAt: projectMaterials.createdAt,
        updatedAt: projectMaterials.updatedAt,
        customName: projectMaterials.customName,
        boqImportId: projectMaterials.boqImportId,
        lifecycleStage: projectMaterials.lifecycleStage,
        // Snapshot Values
        snapshotEmissionValue: projectMaterials.snapshotEmissionValue,
        snapshotSource: projectMaterials.snapshotSource,
        // Cost and Logistics
        costPerUnit: projectMaterials.costPerUnit,
        supplier: projectMaterials.supplier,
        deliveryDate: projectMaterials.deliveryDate,
        emissionFactor: emissionFactors,
        phase: projectPhases,
      })
      .from(projectMaterials)
      .leftJoin(emissionFactors, eq(projectMaterials.emissionFactorId, emissionFactors.id))
      .leftJoin(projectPhases, eq(projectMaterials.phaseId, projectPhases.id))
      .where(eq(projectMaterials.projectId, projectId));

    return result.map(row => ({
      id: row.id,
      projectId: row.projectId,
      emissionFactorId: row.emissionFactorId,
      phaseId: row.phaseId,
      quantity: row.quantity,
      supplierDistance: row.supplierDistance,
      wasteFactor: row.wasteFactor,
      transportMode: row.transportMode ?? 'Road', // P1b: default Road for existing records
      installationMethod: row.installationMethod,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customName: row.customName,
      boqImportId: row.boqImportId,
      lifecycleStage: row.lifecycleStage ?? null,
      snapshotEmissionValue: row.snapshotEmissionValue,
      snapshotSource: row.snapshotSource,
      costPerUnit: row.costPerUnit,
      supplier: row.supplier,
      deliveryDate: row.deliveryDate,
      emissionFactor: row.emissionFactor as EmissionFactor | null,
      phase: row.phase as ProjectPhase | undefined,
    }));
  }

  async addProjectMaterial(projectMaterial: InsertProjectMaterial): Promise<ProjectMaterial> {
    // Manifesto Compliance: Resolve and snapshot the emission factor at entry time
    const [project] = await db.select().from(projects).where(eq(projects.id, projectMaterial.projectId));

    let resolvedValues = {};
    // Only resolve if not already provided AND we have a factor to snapshot
    if (project && projectMaterial.snapshotEmissionValue === undefined && projectMaterial.emissionFactorId) {
      // Need factor data for resolution
      const [factor] = await db.select().from(emissionFactors).where(eq(emissionFactors.id, projectMaterial.emissionFactorId)).limit(1);

      if (factor) {
        resolvedValues = {
          snapshotEmissionValue: factor.emissionFactor,
          snapshotSource: factor.sourceReference || factor.datasetId // MVP fallback
        };
      }
    }

    const [newProjectMaterial] = await db
      .insert(projectMaterials)
      .values({
        ...projectMaterial,
        deliveryDate: projectMaterial.deliveryDate ? new Date(projectMaterial.deliveryDate) : undefined,
        ...resolvedValues
      })
      .returning();

    // Manifesto Compliance: Audit the initial calculation (only if factor exists)
    if (project && newProjectMaterial.emissionFactorId) {
      const [factor] = await db.select().from(emissionFactors).where(eq(emissionFactors.id, newProjectMaterial.emissionFactorId)).limit(1);
      if (factor) {
        const { calculateAdvancedEmissions } = await import('./emissionCalculationService');
        // Fire and forget audit log to not block UI
        calculateAdvancedEmissions(newProjectMaterial, factor, project, true).catch(err =>
          console.error("Background Audit Log Failed:", err)
        );
      }
    }

    return newProjectMaterial;
  }

  async updateProjectMaterial(id: string, projectMaterial: Partial<InsertProjectMaterial>): Promise<ProjectMaterial> {
    const [updatedProjectMaterial] = await db
      .update(projectMaterials)
      .set({
        ...projectMaterial,
        deliveryDate: projectMaterial.deliveryDate ? new Date(projectMaterial.deliveryDate) : undefined
      })
      .where(eq(projectMaterials.id, id))
      .returning();

    // Manifesto Compliance: Audit the updated calculation (only if factor exists)
    if (updatedProjectMaterial && updatedProjectMaterial.emissionFactorId) {
      const factor = await db.select().from(emissionFactors).where(eq(emissionFactors.id, updatedProjectMaterial.emissionFactorId)).limit(1);
      const [project] = await db.select().from(projects).where(eq(projects.id, updatedProjectMaterial.projectId)).limit(1);

      if (factor[0] && project) {
        const { calculateAdvancedEmissions } = await import('./emissionCalculationService');
        calculateAdvancedEmissions(updatedProjectMaterial, factor[0], project, true).catch(err =>
          console.error("Background Audit Log Failed:", err)
        );
      }
    }

    return updatedProjectMaterial;
  }

  async deleteProjectMaterial(id: string): Promise<void> {
    await db.delete(projectMaterials).where(eq(projectMaterials.id, id));
  }

  // Project phase operations
  async getProjectPhases(projectId: string): Promise<ProjectPhase[]> {
    return await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(projectPhases.orderIndex, projectPhases.createdAt);
  }

  async createProjectPhase(phase: InsertProjectPhase): Promise<ProjectPhase> {
    const [newPhase] = await db
      .insert(projectPhases)
      .values(phase)
      .returning();
    return newPhase;
  }

  async updateProjectPhase(id: string, phase: Partial<InsertProjectPhase>): Promise<ProjectPhase> {
    const [updatedPhase] = await db
      .update(projectPhases)
      .set({ ...phase, updatedAt: new Date() })
      .where(eq(projectPhases.id, id))
      .returning();
    return updatedPhase;
  }

  async deleteProjectPhase(id: string): Promise<void> {
    await db
      .delete(projectPhases)
      .where(eq(projectPhases.id, id));
  }

  async reorderProjectPhases(phaseOrders: { id: string, orderIndex: number }[]): Promise<void> {
    // Transactional update for safety
    await db.transaction(async (tx) => {
      for (const item of phaseOrders) {
        await tx
          .update(projectPhases)
          .set({ orderIndex: item.orderIndex, updatedAt: new Date() })
          .where(eq(projectPhases.id, item.id));
      }
    });
  }

  // Material supplier operations
  async getMaterialSuppliers(): Promise<MaterialSupplier[]> {
    return await db
      .select()
      .from(materialSuppliers)
      .orderBy(materialSuppliers.name);
  }

  async createMaterialSupplier(supplier: InsertMaterialSupplier): Promise<MaterialSupplier> {
    const [newSupplier] = await db
      .insert(materialSuppliers)
      .values(supplier)
      .returning();
    return newSupplier;
  }

  async updateMaterialSupplier(id: string, supplier: Partial<InsertMaterialSupplier>): Promise<MaterialSupplier> {
    const [updatedSupplier] = await db
      .update(materialSuppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(eq(materialSuppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async deleteMaterialSupplier(id: string): Promise<void> {
    await db
      .delete(materialSuppliers)
      .where(eq(materialSuppliers.id, id));
  }

  // Emission calculation operations
  async getEmissionCalculations(projectMaterialId: string): Promise<EmissionCalculation[]> {
    return await db
      .select()
      .from(emissionCalculations)
      .where(eq(emissionCalculations.projectMaterialId, projectMaterialId))
      .orderBy(emissionCalculations.calculatedAt);
  }

  async saveEmissionCalculation(calculation: InsertEmissionCalculation): Promise<EmissionCalculation> {
    const [newCalculation] = await db
      .insert(emissionCalculations)
      .values(calculation)
      .returning();
    return newCalculation;
  }

  // Enhanced emissions calculations
  async getProjectEmissions(projectId: string): Promise<{
    totalEmissions: number;
    breakdownByCategory: Record<string, number>;
    breakdownByPhase: Record<string, number>;
    breakdownByScope: Record<string, number>;
    materials: Array<{
      materialName: string;
      quantity: number;
      emissionFactor: number;
      totalEmissions: number;
      category: string;
      phase?: string;
      ghgScope?: string;
      unit?: string;
      source?: string;
      lifecycleStage?: string;
    }>;
  }> {
    const projectMaterials = await this.getProjectMaterials(projectId);
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    let totalEmissions = 0;
    const breakdownByCategory: Record<string, number> = {};
    const breakdownByPhase: Record<string, number> = {};
    const breakdownByScope: Record<string, number> = {};
    const materials: Array<{
      materialName: string;
      quantity: number;
      emissionFactor: number;
      totalEmissions: number;
      category: string;
      phase?: string;
      ghgScope?: string;
      unit?: string;
      source?: string;
      lifecycleStage?: string;
    }> = [];

    if (project.length === 0) {
      return { totalEmissions: 0, breakdownByCategory: {}, breakdownByPhase: {}, breakdownByScope: {}, materials: [] };
    }

    const projectData = project[0];

    // Import calculation service
    const { calculateAdvancedEmissions } = await import('./emissionCalculationService');

    for (const projectMaterialRow of projectMaterials) {
      // Calculate advanced emissions (handles null emissionFactors)
      const calculation = await calculateAdvancedEmissions(
        projectMaterialRow,
        projectMaterialRow.emissionFactor,
        projectData,
        false // Do not log audits on read
      );

      totalEmissions += calculation.totalEmission;

      // Category breakdown
      const category = projectMaterialRow.emissionFactor?.materialCategory || "Unmapped";
      breakdownByCategory[category] = (breakdownByCategory[category] || 0) + calculation.totalEmission;

      // Phase breakdown
      const phaseName = projectMaterialRow.phase?.name || "Unassigned";
      breakdownByPhase[phaseName] = (breakdownByPhase[phaseName] || 0) + calculation.totalEmission;

      // Scope breakdown
      const scope = projectMaterialRow.emissionFactor?.ghgScope || 'scope3';
      breakdownByScope[scope] = (breakdownByScope[scope] || 0) + calculation.totalEmission;

      materials.push({
        materialName: projectMaterialRow.emissionFactor?.materialName || `Unmapped: ${projectMaterialRow.notes?.split(': ')[1] || 'Item'}`,
        quantity: projectMaterialRow.quantity,
        emissionFactor: projectMaterialRow.snapshotEmissionValue ?? projectMaterialRow.emissionFactor?.emissionFactor ?? 0,
        totalEmissions: calculation.totalEmission,
        category: category,
        phase: phaseName,
        ghgScope: scope,
        unit: projectMaterialRow.emissionFactor?.unit || "kg",
        source: projectMaterialRow.emissionFactor?.sourceReference || "System",
        lifecycleStage: projectMaterialRow.emissionFactor?.lifecycleStage || "A1-A3"
      });
    }

    return {
      totalEmissions,
      breakdownByCategory,
      breakdownByPhase,
      breakdownByScope,
      materials
    };
  }

  async getDashboardStats(userId: string, organizationId?: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalEmissions: number;
    avgIntensity: number;
    dataQualityPercent: number;
  }> {
    const userProjects = await this.getProjects(userId, organizationId);
    const totalProjects = userProjects.length;

    // Bug B2: Include 'planning' and 'active' projects as active.
    const activeProjects = userProjects.filter(p =>
      p.status === 'active' || p.status === 'planning'
    ).length;

    let totalEmissions = 0;
    let totalMaterialsCount = 0;
    let mappedMaterialsCount = 0;
    let totalIntensitySum = 0;
    let projectsWithIntensity = 0;

    for (const project of userProjects) {
      const materials = await this.getProjectMaterials(project.id);
      totalMaterialsCount += materials.length;
      mappedMaterialsCount += materials.filter(m => !!m.emissionFactorId).length;

      const emissionsData = await this.getProjectEmissions(project.id);
      totalEmissions += emissionsData.totalEmissions;

      if (project.buildingArea && project.buildingArea > 0) {
        totalIntensitySum += emissionsData.totalEmissions / project.buildingArea;
        projectsWithIntensity++;
      }
    }

    const avgIntensity = projectsWithIntensity > 0 ? totalIntensitySum / projectsWithIntensity : 0;
    const dataQualityPercent = totalMaterialsCount > 0
      ? Math.round((mappedMaterialsCount / totalMaterialsCount) * 100)
      : 100;

    return {
      totalProjects,
      activeProjects,
      totalEmissions,
      avgIntensity,
      dataQualityPercent
    };
  }

  async getOrganizationPortfolio(organizationId: string): Promise<{
    id: string;
    name: string;
    totalEmissions: number;
    dataQualityPercent: number;
    buildingArea: number | null;
    intensity: number | null;
  }[]> {
    const orgProjects = await db.select().from(projects).where(eq(projects.organizationId, organizationId));
    const portfolio = [];

    for (const project of orgProjects) {
      const materials = await this.getProjectMaterials(project.id);
      const mappedCount = materials.filter(m => !!m.emissionFactorId).length;
      const qualityPercent = materials.length > 0 ? Math.round((mappedCount / materials.length) * 100) : 100;

      const emissionsData = await this.getProjectEmissions(project.id);
      const intensity = project.buildingArea && project.buildingArea > 0
        ? emissionsData.totalEmissions / project.buildingArea
        : null;

      portfolio.push({
        id: project.id,
        name: project.name,
        totalEmissions: emissionsData.totalEmissions,
        dataQualityPercent: qualityPercent,
        buildingArea: project.buildingArea,
        intensity
      });
    }

    // Sort by emissions descending as requested in Phase 3 Band 2
    return portfolio.sort((a, b) => b.totalEmissions - a.totalEmissions);
  }

  async getOrganizationEmissionsByCategory(organizationId: string, projectId?: string): Promise<{ category: string, value: number }[]> {
    const orgProjects = projectId
      ? await db.select().from(projects).where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
      : await db.select().from(projects).where(eq(projects.organizationId, organizationId));

    const byCategory: Record<string, number> = {};

    for (const project of orgProjects) {
      const emissionsData = await this.getProjectEmissions(project.id);
      for (const [category, value] of Object.entries(emissionsData.breakdownByCategory)) {
        byCategory[category] = (byCategory[category] || 0) + value;
      }
    }

    return Object.entries(byCategory)
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }

  async getCategoryDrilldown(organizationId: string, category: string, projectId?: string): Promise<{
    materialName: string;
    totalEmissions: number;
    unit: string;
    lifecycleStage: string;
    source: string;
  }[]> {
    const orgProjects = projectId
      ? await db.select().from(projects).where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
      : await db.select().from(projects).where(eq(projects.organizationId, organizationId));

    const drilldown: any[] = [];

    for (const project of orgProjects) {
      const emissionsData = await this.getProjectEmissions(project.id);
      const filteredMaterials = emissionsData.materials.filter(m => m.category === category);

      for (const mat of filteredMaterials) {
        drilldown.push({
          materialName: mat.materialName,
          totalEmissions: mat.totalEmissions,
          unit: mat.unit || "kg",
          lifecycleStage: mat.lifecycleStage || "A1-A3",
          source: mat.source || "System"
        });
      }
    }

    // Sort by emissions descending
    return drilldown.sort((a, b) => b.totalEmissions - a.totalEmissions);
  }

  async getOrganizationEmissionsByStage(organizationId: string, projectId?: string): Promise<{
    name: string;
    breakdown: Record<string, number>;
  }[]> {
    const orgProjects = projectId
      ? await db.select().from(projects).where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
      : await db.select().from(projects).where(eq(projects.organizationId, organizationId));

    const results = [];

    for (const project of orgProjects) {
      const emissionsData = await this.getProjectEmissions(project.id);
      const stageBreakdown: Record<string, number> = {
        "A1-A3": 0, "A4-A5": 0, "B": 0, "C1-C4": 0, "D": 0
      };

      for (const m of emissionsData.materials) {
        if (m.lifecycleStage && stageBreakdown.hasOwnProperty(m.lifecycleStage)) {
          stageBreakdown[m.lifecycleStage] += m.totalEmissions;
        }
      }

      results.push({
        name: project.name,
        breakdown: stageBreakdown
      });
    }

    return results;
  }

  async getUnmappedMaterialsSummary(organizationId: string): Promise<{
    projectId: string;
    projectName: string;
    totalMaterials: number;
    unmappedMaterials: number;
    qualityPercent: number;
  }[]> {
    const orgProjects = await db.select().from(projects).where(eq(projects.organizationId, organizationId));
    const summary = [];

    for (const project of orgProjects) {
      const materials = await this.getProjectMaterials(project.id);
      const total = materials.length;
      if (total === 0) continue;

      const unmapped = materials.filter(m => !m.emissionFactorId).length;
      const quality = Math.round(((total - unmapped) / total) * 100);

      summary.push({
        projectId: project.id,
        projectName: project.name,
        totalMaterials: total,
        unmappedMaterials: unmapped,
        qualityPercent: quality
      });
    }

    return summary.sort((a, b) => a.qualityPercent - b.qualityPercent);
  }

  async getOrganizationEmissionsTrend(organizationId: string): Promise<{ month: string, emissions: number }[]> {
    const orgProjects = await db.select().from(projects).where(eq(projects.organizationId, organizationId));

    const monthlyEmissions: Record<string, number> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const project of orgProjects) {
      const materials = await this.getProjectMaterials(project.id);
      for (const m of materials) {
        const date = m.createdAt || new Date();
        const monthNum = date.getMonth();
        const month = monthNames[monthNum];

        // Use the snapshot or current factor value for simplicity in trend
        const factorValue = m.snapshotEmissionValue ?? m.emissionFactor?.emissionFactor ?? 0;
        const total = m.quantity * factorValue;

        monthlyEmissions[month] = (monthlyEmissions[month] || 0) + total;
      }
    }

    // Returns last 6 months in order
    const currentMonth = new Date().getMonth();
    const orderedMonths = [];
    for (let i = 5; i >= 0; i--) {
      const m = (currentMonth - i + 12) % 12;
      orderedMonths.push(monthNames[m]);
    }

    return orderedMonths.map(month => ({
      month,
      emissions: monthlyEmissions[month] || 0
    }));
  }

  async getEmissionDatasets(): Promise<EmissionDataset[]> {
    return await db.select().from(emissionDatasets).orderBy(emissionDatasets.name);
  }

  async getPortfolioReport(userId: string, organizationId?: string): Promise<Array<{
    projectName: string;
    status: string;
    createdAt: Date;
    totalMaterials: number;
    totalEmissions: number;
  }>> {
    const userProjects = await this.getProjects(userId, organizationId);
    const reportData = [];

    for (const project of userProjects) {
      const emissionsData = await this.getProjectEmissions(project.id);
      const materials = await this.getProjectMaterials(project.id);

      reportData.push({
        projectName: project.name,
        status: project.status || 'unknown',
        createdAt: project.createdAt || new Date(),
        totalMaterials: materials.length,
        totalEmissions: emissionsData.totalEmissions
      });
    }

    return reportData;
  }

  // BOQ Import operations
  async createBoqImport(boqImport: InsertBoqImport): Promise<BoqImport> {
    const [newImport] = await db.insert(boqImports).values(boqImport).returning();
    return newImport;
  }

  async getBoqImport(id: string): Promise<BoqImport | undefined> {
    const [boqImport] = await db.select().from(boqImports).where(eq(boqImports.id, id));
    return boqImport;
  }

  async getBoqImports(projectId: string): Promise<BoqImport[]> {
    return await db
      .select()
      .from(boqImports)
      .where(eq(boqImports.projectId, projectId))
      .orderBy(desc(boqImports.createdAt));
  }

  async updateBoqImport(id: string, boqImport: Partial<InsertBoqImport>): Promise<BoqImport> {
    const [updated] = await db
      .update(boqImports)
      .set({ ...boqImport, updatedAt: new Date() })
      .where(eq(boqImports.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
