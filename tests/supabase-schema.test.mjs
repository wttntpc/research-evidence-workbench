import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("workspace table uses an owner-scoped compound primary key and enables RLS", () => {
  assert.match(sql, /primary key\s*\(user_id,\s*slug\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /references auth\.users\s*\(id\)/i);
});

test("RLS policies explicitly protect every write and read operation", () => {
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`for\\s+${operation}`, "i"));
  }
  assert.ok((sql.match(/to authenticated/gi) || []).length >= 4);
  assert.ok((sql.match(/\(select auth\.uid\(\)\)\s*=\s*user_id/gi) || []).length >= 4);
});

test("browser-facing schema never grants access to anonymous users", () => {
  assert.match(sql, /revoke all on table public\.research_workspaces from anon/i);
  assert.doesNotMatch(sql, /service_role|secret key/i);
});
