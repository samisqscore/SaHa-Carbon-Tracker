import { pgTable, text, varchar, timestamp, jsonb, index, uuid, real, integer, boolean, unique } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    console.log("⚠️  RESETTING DATABASE (DROP SCHEMA public CASCADE)...");

    const client = await pool.connect();
    try {
        // Drop the public schema and recreate it. This wipes EVERYTHING.
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        await client.query('CREATE SCHEMA public');
        // Default grants usually sufficient for owner, adding public access just in case
        await client.query('GRANT ALL ON SCHEMA public TO public');
        console.log("✅ Database reset complete. Ready for clean migration.");
    } catch (err) {
        console.error("❌ Reset failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
