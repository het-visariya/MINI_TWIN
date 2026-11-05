/**
 * "Export all my data."
 *
 * Returns one JSON file with a key per model and only the caller's rows. The
 * session is re-checked here rather than trusted from the proxy: this endpoint
 * hands over everything the product knows about somebody, so it is the last
 * place to take a cookie's word for it.
 *
 * Demo mode gets a 403 rather than the fixtures. Exporting sample data as
 * though it were the visitor's own would be a lie about what the file is.
 */

import { getViewer } from "@/lib/auth/session";
import { buildExport } from "@/lib/data/account.repo";
import { hasDatabase } from "@/lib/db";

export async function GET() {
  const viewer = await getViewer();

  if (viewer.kind !== "user") {
    return Response.json(
      { error: "Sign in to export your data." },
      { status: viewer.kind === "demo" ? 403 : 401 },
    );
  }

  if (!hasDatabase()) {
    return Response.json({ error: "No database configured." }, { status: 503 });
  }

  try {
    const data = await buildExport(viewer.userId);

    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="digital-twin-export-${stamp}.json"`,
        /* Never cached, by us or by anything in between. */
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    console.error(
      `[account/export] ${error instanceof Error ? error.message : "unknown error"}`,
    );

    return Response.json({ error: "The export could not be built." }, { status: 500 });
  }
}
