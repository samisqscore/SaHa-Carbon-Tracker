
import "dotenv/config";
import { db } from "./db";
import { organizations, emissionFactors, emissionDatasets, projects, users, organizationUsers } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

/**
 * @deprecated One-time migration script.
 * Updated to use emissionFactors table (replaces removed `materials` + `materialEmissionFactors`).
 *
 * This script:
 * 1. Creates a default organization if none exists.
 * 2. Links orphan projects to the default org.
 * 3. Links existing users to the default org.
 * 4. Migrates any platform-scoped emissionFactors (no-op if already migrated).
 */
async function migrate() {
    console.log("🚀 Starting Hybrid Architecture Migration...");

    // 1. Create Default Organization (if none exists)
    const [existingOrg] = await db.select().from(organizations).limit(1);
    let defaultOrgId = existingOrg?.id;

    if (!defaultOrgId) {
        console.log("➡️ Creating Default Organization: 'SaHa Foundation'");
        const [newOrg] = await db.insert(organizations).values({
            name: "SaHa Foundation",
            industry: "Climate Tech",
            country: "Global"
        }).returning();
        defaultOrgId = newOrg.id;
    } else {
        console.log("✅ Default Organization exists:", existingOrg.name);
    }

    // 2. Link Existing Projects to Default Organization
    const orphanProjects = await db.select().from(projects).where(isNull(projects.organizationId));

    if (orphanProjects.length > 0) {
        console.log(`➡️ Linking ${orphanProjects.length} existing projects to '${defaultOrgId}'...`);
        await db.update(projects)
            .set({ organizationId: defaultOrgId })
            .where(isNull(projects.organizationId));
        console.log("✅ Projects linked.");
    } else {
        console.log("✅ No orphan projects found.");
    }

    // 3. Link Existing Users to Default Organization
    const allUsers = await db.select().from(users);
    let userLinkCount = 0;

    for (const user of allUsers) {
        const [link] = await db.select()
            .from(organizationUsers)
            .where(eq(organizationUsers.userId, user.id))
            .limit(1);

        if (!link) {
            await db.insert(organizationUsers).values({
                organizationId: defaultOrgId,
                userId: user.id,
                role: user.role === 'admin' ? 'org_admin' : 'estimator'
            });
            userLinkCount++;
        }
    }
    if (userLinkCount > 0) console.log(`✅ Linked ${userLinkCount} users to default organization.`);

    // 4. Check Platform Emission Factors (no material migration needed — already uses emissionFactors)
    const [defaultDataset] = await db.select().from(emissionDatasets).limit(1);
    if (!defaultDataset) {
        console.log("⚠️  No emission datasets found. Please seed datasets before migrating factors.");
    } else {
        const [factorCount] = await db.select({ count: eq(emissionFactors.scope, "platform") })
            .from(emissionFactors);
        console.log(`✅ Platform emission factors present. Default dataset: ${defaultDataset.name}`);
    }

    console.log("🏁 Migration Complete.");
    process.exit(0);
}

migrate().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
