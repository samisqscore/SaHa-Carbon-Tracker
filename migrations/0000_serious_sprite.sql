CREATE TABLE "boq_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"original_filename" text NOT NULL,
	"file_url" text NOT NULL,
	"extracted_data" jsonb,
	"mapping_confidence" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calculation_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_material_id" uuid,
	"organization_id" uuid,
	"emission_factor_id" uuid,
	"calculated_value" real NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emission_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_material_id" uuid NOT NULL,
	"material_emission" real NOT NULL,
	"transportation_emission" real DEFAULT 0,
	"installation_emission" real DEFAULT 0,
	"waste_emission" real DEFAULT 0,
	"regional_emission" real DEFAULT 0,
	"total_emission" real NOT NULL,
	"calculation_version" varchar(10) DEFAULT '1.0',
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emission_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"region" text DEFAULT 'Global',
	"description" text,
	"version" text DEFAULT '1.0',
	"is_default" boolean DEFAULT false,
	"organization_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emission_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_name" text NOT NULL,
	"material_category" text,
	"emission_factor" real NOT NULL,
	"unit" text NOT NULL,
	"emission_unit" text DEFAULT 'kgCO2e',
	"dataset_id" uuid NOT NULL,
	"source_reference" text,
	"scope" text DEFAULT 'platform' NOT NULL,
	"organization_id" uuid,
	"is_active" boolean DEFAULT true,
	"density" real DEFAULT 1,
	"waste_factor" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"contact_info" jsonb,
	"average_distance" real DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" varchar,
	"role" text DEFAULT 'viewer',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_users_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"country" text NOT NULL,
	"reporting_region" text DEFAULT 'Global',
	"default_unit_system" text DEFAULT 'metric',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"emission_factor_id" uuid NOT NULL,
	"phase_id" uuid,
	"quantity" real NOT NULL,
	"supplier_distance" real DEFAULT 0,
	"waste_factor" real DEFAULT 0.1,
	"installation_method" text,
	"notes" text,
	"cost_per_unit" real DEFAULT 0,
	"supplier" text,
	"delivery_date" timestamp,
	"snapshot_emission_value" real NOT NULL,
	"snapshot_source" text NOT NULL,
	"boq_import_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" varchar DEFAULT 'planned',
	"phase_percentage" real DEFAULT 0,
	"order_index" integer DEFAULT 0,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"status" varchar DEFAULT 'planning',
	"type" text NOT NULL,
	"building_area" real,
	"floors" integer,
	"building_height" real,
	"climate_zone" varchar(3),
	"construction_method" varchar,
	"expected_duration" integer,
	"soil_conditions" text,
	"building_code" varchar(100),
	"organization_id" uuid,
	"preferred_dataset_id" uuid,
	"allow_mixed_datasets" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'estimator',
	"status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "boq_imports" ADD CONSTRAINT "boq_imports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_imports" ADD CONSTRAINT "boq_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_audits" ADD CONSTRAINT "calculation_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_audits" ADD CONSTRAINT "calculation_audits_emission_factor_id_emission_factors_id_fk" FOREIGN KEY ("emission_factor_id") REFERENCES "public"."emission_factors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_project_material_id_project_materials_id_fk" FOREIGN KEY ("project_material_id") REFERENCES "public"."project_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_datasets" ADD CONSTRAINT "emission_datasets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_dataset_id_emission_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."emission_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_emission_factor_id_emission_factors_id_fk" FOREIGN KEY ("emission_factor_id") REFERENCES "public"."emission_factors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_boq_import_id_boq_imports_id_fk" FOREIGN KEY ("boq_import_id") REFERENCES "public"."boq_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_preferred_dataset_id_emission_datasets_id_fk" FOREIGN KEY ("preferred_dataset_id") REFERENCES "public"."emission_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");