
import 'dotenv/config';
import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const email = process.env.INITIAL_ADMIN_EMAIL || process.argv[2];
    if (!email) {
        console.error("Please provide an email via INITIAL_ADMIN_EMAIL env var or CLI argument: tsx scripts/fix_admin_access.ts user@example.com");
        process.exit(1);
    }
    console.log(`Checking user: ${email}...`);

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
        console.error("User not found!");
        process.exit(1);
    }

    console.log("Current Status:", user.status, "| Role:", user.role);

    await db.update(users)
        .set({
            role: 'admin',
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: null // Set to null to avoid FK violation
        })
        .where(eq(users.id, user.id));

    console.log("✅ User updated to Admin/Approved successfully.");
    process.exit(0);
}

main().catch(console.error);
