/**
 * @file db.ts
 * @description Database connection and Drizzle ORM initialization.
 * Establishes a connection pool to PostgreSQL and configures Drizzle schema.
 * 
 * @functionality
 * - Connection Pool: Manages PostgreSQL connections via `pg`.
 * - Drizzle Instance: Exports the `db` object for query building.
 * - Schema Mapping: Imports/maps shared schema definitions.
 * 
 * @dependencies
 * - pg: Node-postgres driver.
 * - drizzle-orm: ORM library.
 * - @shared/schema: Database schema definitions.
 * 
 * @breaking-changes
 * - DATABASE_URL: Application crashes if this env var is missing.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });