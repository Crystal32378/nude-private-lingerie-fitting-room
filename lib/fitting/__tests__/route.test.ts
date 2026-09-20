import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../../app/api/fitting/judge/route.ts";

function request(origin: string) {
  // Next may expose an internal localhost URL while the browser uses 127.0.0.1.
  return new Request("http://localhost:3107/api/fitting/judge", {
    method: "POST", headers: { "Content-Type": "application/json", Host: "127.0.0.1:3107", Origin: origin },
    body: JSON.stringify({ task: "style_tradeoff", fields: {} }),
  });
}
test("same public origin survives Next's internal localhost URL", async () => {
  const response = await POST(request("http://127.0.0.1:3107"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { task: "style_tradeoff", status: "skipped", judgments: [] });
});
test("a genuinely different origin is still rejected before evaluation", async () => {
  const response = await POST(request("https://example.invalid"));
  assert.equal(response.status, 403);
});
