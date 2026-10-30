import { sql } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { listPublicProjects, findProjectById } from "../src/repositories/project.repository.js";
import { getResume } from "../src/repositories/resume.repository.js";
import { toPublicProject, toAdminProject } from "../src/services/project.service.js";
import { toPublicMetadata } from "../src/services/resume.service.js";

const main = async () => {
  const rows = await db.execute(sql`
    select slug,
           cover_image       as cover_image,
           cover_file_id     as cover_file_id,
           cover_storage_key as cover_storage_key,
           document_url      as document_url
    from projects order by sort_order
  `);
  console.log("=== RAW PROJECT COVER COLUMNS ===");
  for (const row of rows.rows as Record<string, unknown>[]) {
    console.log(JSON.stringify(row));
  }

  const images = await db.execute(sql`
    select p.slug, i.url, i.storage_key, i.file_id
    from project_images i join projects p on p.id = i.project_id
    order by p.slug, i.sort_order
  `);
  console.log("\n=== RAW PROJECT IMAGE COLUMNS ===");
  for (const row of images.rows as Record<string, unknown>[]) {
    console.log(JSON.stringify(row));
  }

  const resume = await getResume();
  console.log("\n=== RAW RESUME ===");
  console.log(JSON.stringify(resume));

  console.log("\n=== PUBLIC API SHAPE (/projects) ===");
  const publicProjects = (await listPublicProjects()).map(toPublicProject);
  for (const p of publicProjects) {
    console.log(
      JSON.stringify({
        slug: p.slug,
        imageParent: p.imageParent,
        imageBox: p.imageBox,
        documentUrl: p.documentUrl,
      }),
    );
  }

  const first = await listPublicProjects();
  if (first[0]) {
    const admin = await findProjectById(first[0].id);
    if (admin) console.log("\n=== ADMIN API SHAPE (/admin/projects/:id) ===", JSON.stringify(toAdminProject(admin), null, 1));
  }

  console.log("\n=== PUBLIC API SHAPE (/resume) ===");
  console.log(JSON.stringify(toPublicMetadata(resume)));

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
