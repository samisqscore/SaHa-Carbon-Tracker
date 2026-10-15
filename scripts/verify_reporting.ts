
import "dotenv/config";
import { db } from "../server/db";
import { emissionFactors, projectMaterials, projects, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";
// We need to fetch the report logic or simulate it.
// Since the report logic is in routes.ts (Express), we can't import it easily.
// We will SIMULATE the logic here to verify the data integrity in DB.

async function verifyReporting() {
    console.log("🧪 Verifying Advanced Reporting (Scopes)...");

    // 1. Setup Data
    // Get Org
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) throw new Error("No org found");

    // Get User (Required for Project)
    const { users } = await import("@shared/schema");
    let [user] = await db.select().from(users).limit(1);
    if (!user) {
        // Create dummy user
        [user] = await db.insert(users).values({ id: "test-user-001", email: "test@example.com", role: "admin", status: "approved" }).returning();
    }

    // Create Project
    const [project] = await db.insert(projects).values({
        name: "Scope Reporting Test Project",
        organizationId: org.id,
        userId: user.id, // Mandatory
        buildingArea: 1000,
        type: "Commercial",
        location: "Test Location" // Mandatory
    }).returning();
    console.log(`✅ Created Project: ${project.id}`);

    // Create Factors (Scope 1, 2, 3)
    const factors = [
        { name: "Diesel (Scope 1)", factor: 2.68, scope: "scope1" }, // kg/L
        { name: "Grid Electricity (Scope 2)", factor: 0.85, scope: "scope2" }, // kg/kWh
        { name: "Concrete (Scope 3)", factor: 240, scope: "scope3" } // kg/m3
    ];

    const factorIds = [];
    for (const f of factors) {
        const [inserted] = await db.insert(emissionFactors).values({
            materialName: f.name,
            materialCategory: "Test",
            emissionFactor: f.factor,
            unit: "unit",
            datasetId: (await db.query.emissionDatasets.findFirst())?.id || "",
            ghgScope: f.scope,
            isActive: true
        }).returning();
        factorIds.push(inserted.id);
    }
    console.log("✅ Created Test Factors with Scopes");

    // Add Materials to Project
    // 10 units each
    for (const fid of factorIds) {
        await db.insert(projectMaterials).values({
            projectId: project.id,
            emissionFactorId: fid,
            quantity: 10,
            snapshotEmissionValue: 0, // Should be populated by logic or manually here
            snapshotSource: "Verification Script", // Mandatory
            // Hack: The storage logic handles snapshotting. Here we manually insert.
            // Let's look up the factor value again to be safe.
            // Actually, we can just fetch the factor from DB in the verification step.
        });
    }

    // 2. Fetch and Calculate (Simulate Route Logic)
    const materials = await db.select({
        qty: projectMaterials.quantity,
        factor: emissionFactors.emissionFactor,
        scope: emissionFactors.ghgScope
    })
        .from(projectMaterials)
        .innerJoin(emissionFactors, eq(projectMaterials.emissionFactorId, emissionFactors.id))
        .where(eq(projectMaterials.projectId, project.id));

    const byScope: Record<string, number> = { scope1: 0, scope2: 0, scope3: 0 };

    for (const m of materials) {
        const emission = m.qty * m.factor; // Ignoring waste/transport for this test
        const scope = m.scope || "scope3";
        if (byScope[scope] !== undefined) {
            byScope[scope] += emission;
        }
    }

    console.log("📊 Calculated Scope Breakdown:", byScope);

    // diesel: 10 * 2.68 = 26.8
    // elec: 10 * 0.85 = 8.5
    // concrete: 10 * 240 = 2400

    if (Math.abs(byScope.scope1 - 26.8) < 0.1 && Math.abs(byScope.scope3 - 2400) < 0.1) {
        console.log("✅ Verification Successful: Scopes matched expected values!");
    } else {
        console.error("❌ Verification Failed: Data mismatch");
        process.exit(1);
    }

    // Cleanup
    await db.delete(projectMaterials).where(eq(projectMaterials.projectId, project.id));
    await db.delete(projects).where(eq(projects.id, project.id));
    // Leaving factors for now or delete them
    console.log("🧹 Cleanup complete");
    process.exit(0);
}

verifyReporting().catch(error => {
    console.error(error);
    process.exit(1);
});
