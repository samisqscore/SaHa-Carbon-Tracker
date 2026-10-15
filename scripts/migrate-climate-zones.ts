/**
 * @file migrate-climate-zones.ts
 * @description One-time migration script to NULL out legacy climateZone values.
 *
 * BACKGROUND:
 * The old UI allowed saving descriptive names like "tropical", "arid", "temperate",
 * "continental", "polar". These do not map cleanly to ASHRAE zones used by the
 * calculation engine and are longer than the varchar(3) DB column constraint.
 *
 * STRATEGY (Option 1 - User Approved 2026-03-05):
 * - Set climate_zone = NULL for any row that holds a legacy name
 * - Do NOT attempt to auto-map (ambiguous without geographic context)
 * - Users will be prompted in the UI to set the correct ASHRAE zone manually
 *
 * USAGE:
 *   Local:      DATABASE_URL="postgres://..." npx ts-node scripts/migrate-climate-zones.ts
 *   Production: DATABASE_URL="<railway_url>" npx ts-node scripts/migrate-climate-zones.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

const LEGACY_ZONE_NAMES = ["tropical", "arid", "temperate", "continental", "polar"];

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("❌ DATABASE_URL environment variable is not set.");
        process.exit(1);
    }

    console.log("🔗 Connecting to database...");
    const pool = new Pool({ connectionString });
    const db = drizzle(pool);

    // 1. DRY RUN — count affected rows first
    const countResult = await db.execute(
        sql`SELECT id, name, climate_zone FROM projects WHERE climate_zone IN (${sql.join(
            LEGACY_ZONE_NAMES.map((z) => sql`${z}`),
            sql`, `
        )})`
    );

    const affected = countResult.rows as { id: string; name: string; climate_zone: string }[];

    if (affected.length === 0) {
        console.log("✅ No projects with legacy climate zone values found. Nothing to migrate.");
        await pool.end();
        return;
    }

    console.log(`\n📋 Found ${affected.length} project(s) with legacy climate zone values:\n`);
    affected.forEach((p) => {
        console.log(`   - [${p.id}] "${p.name}" → climate_zone: "${p.climate_zone}"`);
    });

    // 2. Perform the update
    console.log(`\n🔄 Setting climate_zone = NULL for ${affected.length} project(s)...`);
    await db.execute(
        sql`UPDATE projects SET climate_zone = NULL, updated_at = NOW() WHERE climate_zone IN (${sql.join(
            LEGACY_ZONE_NAMES.map((z) => sql`${z}`),
            sql`, `
        )})`
    );

    // 3. Verify
    const verifyResult = await db.execute(
        sql`SELECT COUNT(*) as remaining FROM projects WHERE climate_zone IN (${sql.join(
            LEGACY_ZONE_NAMES.map((z) => sql`${z}`),
            sql`, `
        )})`
    );
    const remaining = Number((verifyResult.rows[0] as any).remaining);

    if (remaining === 0) {
        console.log(
            `\n✅ Migration complete. ${affected.length} project(s) updated. Climate zone set to NULL — users will be prompted to re-select from the new ASHRAE dropdown.`
        );
    } else {
        console.error(`\n❌ Migration incomplete. ${remaining} legacy rows still remain.`);
    }

    await pool.end();
}

main().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
