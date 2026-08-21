/**
 * End-to-end test of the YouCam cloth-v4 flow used by app/api/tryon/route.ts.
 * Usage: node scripts/test-youcam.mjs [person.jpg] [garment.jpg]
 */
import { readFileSync, writeFileSync } from "node:fs";

const API_KEY = process.env.YOUCAM_API_KEY;
const API_BASE = "https://yce-api-01.makeupar.com/s2s/v2.0";
const personPath = process.argv[2] ?? "/tmp/nude-test/person.jpg";
const garmentPath = process.argv[3] ?? "/tmp/nude-test/garment-nude05.jpg";

if (!API_KEY) {
  console.error("✗ YOUCAM_API_KEY not set");
  process.exit(1);
}

async function uploadFile(filePath, name) {
  const buffer = readFileSync(filePath);
  console.log(`↑ Uploading ${name} (${(buffer.length / 1024).toFixed(0)} KB)...`);

  const metaRes = await fetch(`${API_BASE}/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      files: [{ content_type: "image/jpeg", file_name: name, file_size: buffer.length }],
    }),
  });
  console.log(`  File API: ${metaRes.status}`);
  if (!metaRes.ok) throw new Error(await metaRes.text());

  const meta = await metaRes.json();
  const entry = meta?.data?.files?.[0];
  if (!entry?.file_id || !entry?.requests?.[0]?.url) throw new Error("No file_id/upload URL");

  const putRes = await fetch(entry.requests[0].url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg", "Content-Length": String(buffer.length) },
    body: new Uint8Array(buffer),
  });
  console.log(`  Binary PUT: ${putRes.status}`);
  if (!putRes.ok) throw new Error("Binary upload failed");

  return entry.file_id;
}

const personId = await uploadFile(personPath, "person.jpg");
const refId = await uploadFile(garmentPath, "garment.jpg");
console.log(`✓ person file_id: ${personId.slice(0, 24)}...`);
console.log(`✓ garment file_id: ${refId.slice(0, 24)}...\n`);

console.log("→ Creating cloth-v4 task (upper_body)...");
const taskRes = await fetch(`${API_BASE}/task/cloth-v4`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    src_file_id: personId,
    ref_file_id: refId,
    garment_category: "upper_body",
  }),
});
console.log(`  Task API: ${taskRes.status}`);
const taskJson = await taskRes.json();
if (!taskRes.ok || !taskJson?.data?.task_id) {
  console.error("✗ Task creation failed:", JSON.stringify(taskJson));
  process.exit(1);
}
const taskId = taskJson.data.task_id;
console.log(`✓ task_id: ${taskId}\n`);

const deadline = Date.now() + 120_000;
let status = "processing";
let resultUrl = null;
let errorPayload = null;

while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000));
  const pollRes = await fetch(`${API_BASE}/task/cloth-v4/${taskId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const pollJson = await pollRes.json();
  status = pollJson?.data?.task_status ?? "processing";
  console.log(`  poll: ${status} (${Math.round((Date.now() - (deadline - 120_000)) / 1000)}s)`);
  if (status === "success") {
    resultUrl = pollJson.data.results?.url ?? null;
    break;
  }
  if (status === "failed") {
    errorPayload = pollJson.data?.error ?? pollJson;
    break;
  }
}

if (status !== "success" || !resultUrl) {
  console.error("✗ Try-on failed:", JSON.stringify(errorPayload));
  process.exit(1);
}

console.log(`\n✓ SUCCESS — downloading result...`);
const imgRes = await fetch(resultUrl);
const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
const out = "/tmp/nude-test/vto-result.jpg";
writeFileSync(out, imgBuffer);
console.log(`✓ Saved ${out} (${(imgBuffer.length / 1024).toFixed(0)} KB)`);


