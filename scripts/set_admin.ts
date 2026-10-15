
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as dotenv from "dotenv";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function main() {
    console.log("🔍 Finding users...");
    const allUsers = await db.select().from(users);

    if (allUsers.length === 0) {
        console.log("❌ No users found in database.");
        return;
    }

    console.log(`Found ${allUsers.length} users:`);
    allUsers.forEach(u => console.log(` - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Status: ${u.status}`));

    // If there is only one user, or if we want to specificall approve one, we can do it here.
    // For now, I'll just approve ALL pending users to be safe for this dev environment, 
    // or I'll ask for confirmation if there are many.

    // Update the first user to be admin and approved
    const targetUser = allUsers[0];
    console.log(`\n🚀 Promoting ${targetUser.email} (ID: ${targetUser.id}) to ADMIN and APPROVED...`);

    await db.update(users)
        .set({ role: "admin", status: "approved" })
        .where(eq(users.id, targetUser.id));

    console.log("✅ User updated successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
});
