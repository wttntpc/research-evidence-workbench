import test from "node:test";
import assert from "node:assert/strict";

import {
  createCloudAdapter,
  validateSupabaseConfig,
  workspaceRow,
} from "../cloud.mjs";

test("validateSupabaseConfig accepts HTTPS project settings and rejects unsafe input", () => {
  assert.deepEqual(
    validateSupabaseConfig("https://example.supabase.co", "publishable-key-with-enough-length"),
    { url: "https://example.supabase.co", key: "publishable-key-with-enough-length" },
  );
  assert.throws(() => validateSupabaseConfig("http://example.supabase.co", "long-enough-key-value"), /HTTPS/);
  assert.throws(() => validateSupabaseConfig("https://example.supabase.co", "short"), /publishable/);
});

test("workspaceRow binds cloud data to the signed-in owner and default slug", () => {
  const row = workspaceRow("user-123", { schema: "research-command-center/v1" }, "2026-11-11T08:00:00.000Z");

  assert.equal(row.user_id, "user-123");
  assert.equal(row.slug, "default");
  assert.equal(row.data.schema, "research-command-center/v1");
  assert.equal(row.updated_at, "2026-11-11T08:00:00.000Z");
});

test("cloud adapter delegates passwordless email login to Supabase Auth", async () => {
  let received;
  const fakeClient = {
    auth: {
      async signInWithOtp(input) { received = input; return { data: {}, error: null }; },
    },
  };
  const adapter = createCloudAdapter({
    url: "https://example.supabase.co",
    key: "publishable-key-with-enough-length",
    clientFactory: () => fakeClient,
  });

  await adapter.sendMagicLink("researcher@example.com", "https://example.github.io/workbench/");

  assert.deepEqual(received, {
    email: "researcher@example.com",
    options: { emailRedirectTo: "https://example.github.io/workbench/" },
  });
});
