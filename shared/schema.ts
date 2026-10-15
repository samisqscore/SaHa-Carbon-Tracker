/**
 * @file schema.ts
 * @description Database schema definitions using Drizzle ORM.
 * Defines the core data model for multi-tenant carbon footprint tracking.
 * 
 * @functionality
 * - Multi-tenancy: Organizations, Users, and OrganizationMembership tables.
 * - Projects: Hierarchical structure of Projects -> Phases -> Materials.
 * - Datasource Agent: Tables for `emissionDatasets`, `emissionFactors`, and `datasetUploadLogs`.
 * - Reporting: Snapshots and calculation audits for immutable emission records.
 * 
 * @dependencies
 * - drizzle-orm/pg-core: PostgreSQL-specific ORM types and table creators.
 * - drizzle-zod: Auto-generation of Zod schemas from DB definitions.
 * 
 * @breaking-changes
 * - Schema Migrations: Any change here requires a corresponding `drizzle-kit push` or migration script.
 * - Enum Stability: Changing enum values in `status` or `ghgScope` impacts existing data and UI selectors.
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uuid,
  real,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "estimator", "viewer"] }).default("estimator"),
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).default("pending"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  status: varchar("status", { enum: ["planning", "active", "completed", "cancelled"] }).default("planning"),
  type: text("type").notNull(),

  // Building specifications
  buildingArea: real("building_area"), // Square footage/meters
  floors: integer("floors"), // Number of floors
  buildingHeight: real("building_height"), // Total height in meters
  climateZone: varchar("climate_zone", { length: 3 }), // ASHRAE climate zones
  constructionMethod: varchar("construction_method", {
    enum: ["traditional", "prefab", "modular", "hybrid"]
  }),
  expectedDuration: integer("expected_duration"), // Project timeline in months
  soilConditions: text("soil_conditions"),
  buildingCode: varchar("building_code", { length: 100 }),

  // Organization Context (Manifesto Rule: Project must belong to Org)
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Manifesto Compliance: Dataset Selection
  preferredDatasetId: uuid("preferred_dataset_id").references(() => emissionDatasets.id),
  allowMixedDatasets: boolean("allow_mixed_datasets").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const boqImports = pgTable("boq_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tier: text("tier").notNull(), // 'free' | 'enterprise'
  status: text("status").notNull().default("uploaded"), // 'uploaded', 'processing', 'processed', 'completed', 'error'
  originalFilename: text("original_filename").notNull(),
  fileUrl: text("file_url").notNull(),
  extractedData: jsonb("extracted_data"),
  mappingConfidence: integer("mapping_confidence"), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legacy tables 'materials' and 'materialEmissionFactors' removed for Hybrid Architecture.
export const emissionDatasets = pgTable("emission_datasets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // 'ICE v3', 'India BEI 2024'
  region: text("region").default("Global"),
  description: text("description"),
  version: text("version").default("1.0"),
  isDefault: boolean("is_default").default(false),
  organizationId: uuid("organization_id").references(() => organizations.id), // Link for Private Datasets

  // Manifesto Phase 1: Lifecycle & Environment
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull().default("draft"),
  environment: text("environment", { enum: ["production", "test"] }).notNull().default("production"),

  // Validity Window
  validityStart: timestamp("validity_start").defaultNow().notNull(),
  validityEnd: timestamp("validity_end"),

  // Audit & Cache
  lastFilename: text("last_filename"),
  activeFactorCount: integer("active_factor_count").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const datasetUploadLogs = pgTable("dataset_upload_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  datasetId: uuid("dataset_id").references(() => emissionDatasets.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),

  filename: text("filename").notNull(),
  fileSize: integer("file_size"), // in bytes

  // Outcome
  status: text("status", { enum: ["in_progress", "success", "failed"] }).notNull(),
  totalRows: integer("total_rows").default(0),
  validRows: integer("valid_rows").default(0),
  errorRows: integer("error_rows").default(0),
  errorDetail: jsonb("error_detail"), // Array of row-level errors

  createdAt: timestamp("created_at").defaultNow(),
});

// Project phases table
export const projectPhases = pgTable("project_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { enum: ["planned", "active", "completed"] }).default("planned"),
  phasePercentage: real("phase_percentage").default(0),
  orderIndex: integer("order_index").default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Hybrid Architecture: Organizations ---
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  industry: text("industry").notNull(), // Manifesto Rule: Mandatory
  country: text("country").notNull(),   // Manifesto Rule: Mandatory
  reportingRegion: text("reporting_region").default("Global"), // Manifesto Rule
  defaultUnitSystem: text("default_unit_system", { enum: ["metric", "imperial"] }).default("metric"), // Manifesto Rule
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationUsers = pgTable("organization_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["org_admin", "estimator", "viewer"] }).default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqueUserOrg: unique().on(t.organizationId, t.userId),
}));

// --- Hybrid Architecture: Emission Factors ---
// Replaces usage of 'materials' + 'materialEmissionFactors' for calculation resolution
// --- Hybrid Architecture: Emission Factors ---
export const emissionFactors = pgTable("emission_factors", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Core Material Identity
  materialName: text("material_name").notNull(),
  materialCategory: text("material_category"), // 'Concrete', 'Steel', etc.

  // The Data
  emissionFactor: real("emission_factor").notNull(), // The Value
  unit: text("unit").notNull(), // The Unit (kg, m3)
  emissionUnit: text("emission_unit").default("kgCO2e"),

  // Source Traceability
  datasetId: uuid("dataset_id").references(() => emissionDatasets.id).notNull(), // Link to "India BEI"
  sourceReference: text("source_reference"), // e.g. "Table 4.2 Row 1"

  // Scoping
  scope: text("scope", { enum: ["platform", "organization"] }).default("platform").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id), // If private override

  // GHG Scope (1, 2, 3) for Reporting
  ghgScope: text("ghg_scope", { enum: ["scope1", "scope2", "scope3"] }).default("scope3").notNull(),

  // EN 15804 Lifecycle Stage
  lifecycleStage: text("lifecycle_stage", {
    enum: ["A1-A3", "A4-A5", "B", "C1-C4", "D"]
  }).default("A1-A3"),

  isActive: boolean("is_active").default(true),

  // Advanced Props (Moved from legacy materials table)
  density: real("density").default(1.0),
  wasteFactor: real("waste_factor").default(0.0),

  // EPD Specific Metadata
  manufacturer: text("manufacturer"),
  epdNumber: text("epd_number"),
  validityDate: timestamp("validity_date"),
  geographicalScope: text("geographical_scope"),
  versionInfo: text("version_info"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Emission Calculation Audit (Manifesto Rule 4)
export const calculationAudits = pgTable("calculation_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectMaterialId: uuid("project_material_id"),
  organizationId: uuid("organization_id").references(() => organizations.id), // Manifesto Rule 4: Non-repudiation
  emissionFactorId: uuid("emission_factor_id").references(() => emissionFactors.id),
  calculatedValue: real("calculated_value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced project materials table
export const projectMaterials = pgTable("project_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),

  // Link directly to the Emission Factor Record used (covers Material Name + Value + Source)
  emissionFactorId: uuid("emission_factor_id").references(() => emissionFactors.id),

  phaseId: uuid("phase_id").references(() => projectPhases.id),
  quantity: real("quantity").notNull(),

  // Advanced calculation factors
  supplierDistance: real("supplier_distance").default(0),
  wasteFactor: real("waste_factor").default(0), // P2 FIX: 0 = no waste uplift unless explicitly set
  transportMode: text("transport_mode", {
    enum: ["Road", "Rail", "Ship", "Air"]
  }).default("Road"), // P1b: transport mode selection
  installationMethod: text("installation_method"),
  notes: text("notes"),

  // Cost and Logistics
  costPerUnit: real("cost_per_unit").default(0),
  customName: text("custom_name"),
  supplier: text("supplier"),
  deliveryDate: timestamp("delivery_date"),

  // Snapshot for Audit (Immutable record of what was used)
  snapshotEmissionValue: real("snapshot_emission_value"),
  snapshotSource: text("snapshot_source"), // e.g. "India BEI v2"

  // Link to Source BOQ (if imported)
  boqImportId: uuid("boq_import_id").references(() => boqImports.id),

  // EN 15804 Lifecycle Stage for this material entry
  lifecycleStage: text("lifecycle_stage", {
    enum: ["A1-A3", "A4-A5", "B", "C1-C4", "D"]
  }).default("A1-A3"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Material suppliers table
export const materialSuppliers = pgTable("material_suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location"),
  contactInfo: jsonb("contact_info"),
  averageDistance: real("average_distance").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Emission calculations cache table
export const emissionCalculations = pgTable("emission_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectMaterialId: uuid("project_material_id").references(() => projectMaterials.id, { onDelete: "cascade" }).notNull(),
  materialEmission: real("material_emission").notNull(),
  transportationEmission: real("transportation_emission").default(0),
  installationEmission: real("installation_emission").default(0),
  wasteEmission: real("waste_emission").default(0),
  regionalEmission: real("regional_emission").default(0),
  totalEmission: real("total_emission").notNull(),
  calculationVersion: varchar("calculation_version", { length: 10 }).default("1.0"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  projectMaterials: many(projectMaterials),
  phases: many(projectPhases),
  preferredDataset: one(emissionDatasets, {
    fields: [projects.preferredDatasetId],
    references: [emissionDatasets.id],
  }),
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
}));

export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  projectMaterials: many(projectMaterials),
  boqImports: many(boqImports),
}));

export const boqImportsRelations = relations(boqImports, ({ one }) => ({
  project: one(projects, {
    fields: [boqImports.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [boqImports.userId],
    references: [users.id],
  }),
}));

export const emissionDatasetsRelations = relations(emissionDatasets, ({ many }) => ({
  factors: many(emissionFactors),
  projects: many(projects),
  uploadLogs: many(datasetUploadLogs),
}));

export const datasetUploadLogsRelations = relations(datasetUploadLogs, ({ one }) => ({
  dataset: one(emissionDatasets, {
    fields: [datasetUploadLogs.datasetId],
    references: [emissionDatasets.id],
  }),
  user: one(users, {
    fields: [datasetUploadLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [datasetUploadLogs.organizationId],
    references: [organizations.id],
  }),
}));

export const emissionFactorsRelations = relations(emissionFactors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [emissionFactors.organizationId],
    references: [organizations.id],
  }),
  dataset: one(emissionDatasets, {
    fields: [emissionFactors.datasetId],
    references: [emissionDatasets.id],
  }),
  audits: many(calculationAudits),
  projectMaterials: many(projectMaterials),
}));

export const projectMaterialsRelations = relations(projectMaterials, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectMaterials.projectId],
    references: [projects.id],
  }),
  // LINK TO EMISSION FACTOR (Hybrid Architecture)
  emissionFactor: one(emissionFactors, {
    fields: [projectMaterials.emissionFactorId],
    references: [emissionFactors.id],
  }),
  phase: one(projectPhases, {
    fields: [projectMaterials.phaseId],
    references: [projectPhases.id],
  }),
  emissionCalculations: many(emissionCalculations),
}));

export const emissionCalculationsRelations = relations(emissionCalculations, ({ one }) => ({
  projectMaterial: one(projectMaterials, {
    fields: [emissionCalculations.projectMaterialId],
    references: [projectMaterials.id],
  }),
}));

// Hybrid Architecture Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(organizationUsers),
  emissionFactors: many(emissionFactors),
}));

export const organizationUsersRelations = relations(organizationUsers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationUsers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationUsers.userId],
    references: [users.id],
  }),
}));

export const calculationAuditsRelations = relations(calculationAudits, ({ one }) => ({
  emissionFactor: one(emissionFactors, {
    fields: [calculationAudits.emissionFactorId],
    references: [emissionFactors.id],
  }),
}));

// Zod schemas for validation
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  buildingArea: z.coerce.number().positive().max(1000000).optional().nullable(), // sq ft/m²
  floors: z.coerce.number().int().positive().max(200).optional().nullable(),
  buildingHeight: z.coerce.number().positive().max(1000).optional().nullable(), // meters
  climateZone: z.string().regex(/^[1-8][A-C]$/).optional().nullable(), // ASHRAE zones only
  expectedDuration: z.coerce.number().int().positive().max(120).optional().nullable(), // months
  preferredDatasetId: z.string().uuid().optional().nullable(),
  allowMixedDatasets: z.coerce.boolean().optional(),
});

export const insertProjectPhaseSchema = createInsertSchema(projectPhases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  phasePercentage: z.coerce.number().min(0).max(100).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
});

export const insertEmissionFactorSchema = createInsertSchema(emissionFactors).omit({
  id: true,
  createdAt: true,
}).extend({
  emissionFactor: z.coerce.number().positive(),
  density: z.coerce.number().positive().optional(),
  wasteFactor: z.coerce.number().min(0).max(0.5).optional(),
  datasetId: z.string().uuid(),
  organizationId: z.string().uuid().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  epdNumber: z.string().optional().nullable(),
  validityDate: z.coerce.date().optional().nullable(),
  geographicalScope: z.string().optional().nullable(),
  versionInfo: z.string().optional().nullable(),
});

export const insertProjectMaterialSchema = createInsertSchema(projectMaterials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  quantity: z.coerce.number().positive(),
  supplierDistance: z.coerce.number().min(0).max(10000).optional(), // km
  wasteFactor: z.coerce.number().min(0).max(0.5).optional(), // 0-50%
  installationMethod: z.string().optional(),
  notes: z.string().optional(),
  costPerUnit: z.coerce.number().min(0).optional(),
  customName: z.string().optional(),
  supplier: z.string().optional(),
  deliveryDate: z.string().optional(),
  emissionFactorId: z.string().uuid().nullable(), // Allow unmapped items
});

// Batch Import Schemas
export const batchMaterialSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().optional(),
  supplier: z.string().optional(),
});

export const batchPreviewResponseSchema = z.object({
  original: batchMaterialSchema,
  matchedFactorId: z.string().uuid().nullable(), // Changed from MaterialId to FactorId
  resolvedFactor: z.object({
    value: z.number(),
    source: z.string(),
    unit: z.string(), // The unit of the factor
    datasetId: z.string().nullable(),
    isFallback: z.boolean(),
  }).nullable(),
  warnings: z.array(z.string()),
});

export const insertMaterialSupplierSchema = createInsertSchema(materialSuppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmissionDatasetSchema = createInsertSchema(emissionDatasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDatasetUploadLogSchema = createInsertSchema(datasetUploadLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEmissionCalculationSchema = createInsertSchema(emissionCalculations).omit({
  id: true,
  calculatedAt: true,
});

export const insertBoqImportSchema = createInsertSchema(boqImports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  industry: z.string().min(1, "Industry is required"),
  country: z.string().min(1, "Country is required"),
  reportingRegion: z.string().optional(),
  defaultUnitSystem: z.enum(["metric", "imperial"]).optional(),
});

// TypeScript types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type ProjectPhase = typeof projectPhases.$inferSelect;
export type InsertProjectPhase = z.infer<typeof insertProjectPhaseSchema>;

export type EmissionDataset = typeof emissionDatasets.$inferSelect;
export type InsertEmissionDataset = z.infer<typeof insertEmissionDatasetSchema>;

export type EmissionFactor = typeof emissionFactors.$inferSelect;
export type InsertEmissionFactor = z.infer<typeof insertEmissionFactorSchema>;

export type ProjectMaterial = typeof projectMaterials.$inferSelect;
export type InsertProjectMaterial = z.infer<typeof insertProjectMaterialSchema>;

export type BoqImport = typeof boqImports.$inferSelect;
export type InsertBoqImport = typeof boqImports.$inferInsert;

export type DatasetUploadLog = typeof datasetUploadLogs.$inferSelect;
export type InsertDatasetUploadLog = typeof datasetUploadLogs.$inferInsert;

export type MaterialSupplier = typeof materialSuppliers.$inferSelect;
export type InsertMaterialSupplier = z.infer<typeof insertMaterialSupplierSchema>;

export type EmissionCalculation = typeof emissionCalculations.$inferSelect;
export type InsertEmissionCalculation = z.infer<typeof insertEmissionCalculationSchema>;

export type BatchMaterial = z.infer<typeof batchMaterialSchema>;
export type BatchPreviewResponse = z.infer<typeof batchPreviewResponseSchema>;

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// Enhanced calculation result interface
export interface EmissionCalculationResult {
  materialEmission: number;
  transportationEmission: number;
  installationEmission: number;
  wasteEmission: number;
  regionalEmission: number;
  totalEmission: number;
  breakdown: {
    material: { quantity: number; factor: number; emission: number };
    transportation: { distance: number; weight: number; factor: number; emission: number };
    installation: { method: string; factor: number; emission: number };
    waste: { factor: number; emission: number };
    regional: { zone: string; factor: number; emission: number };
  };
}
