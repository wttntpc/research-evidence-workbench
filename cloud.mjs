import { createClient } from "@supabase/supabase-js";

// Supabase browser client initialization:
// https://supabase.com/docs/reference/javascript/initializing
export function validateSupabaseConfig(urlInput, keyInput) {
  const url = String(urlInput ?? "").trim().replace(/\/$/, "");
  const key = String(keyInput ?? "").trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase Project URL 格式不正確");
  }
  if (parsed.protocol !== "https:") throw new Error("Supabase Project URL 必須使用 HTTPS");
  if (key.length < 20) throw new Error("請填入 Supabase publishable 或 anon key");
  return { url, key };
}

export function workspaceRow(userId, workspace, updatedAt = new Date().toISOString(), slug = "default") {
  if (!userId) throw new Error("尚未登入 Supabase");
  return {
    user_id: userId,
    slug,
    data: workspace,
    updated_at: updatedAt,
  };
}

function resultOrThrow(result, fallbackMessage) {
  if (result?.error) throw new Error(result.error.message || fallbackMessage);
  return result?.data;
}

export function createCloudAdapter({ url, key, clientFactory = createClient }) {
  const config = validateSupabaseConfig(url, key);
  const client = clientFactory(config.url, config.key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  async function currentUser() {
    const data = resultOrThrow(await client.auth.getUser(), "無法讀取登入狀態");
    if (!data?.user) throw new Error("請先登入 Supabase");
    return data.user;
  }

  return {
    async sendMagicLink(email, emailRedirectTo) {
      // Official passwordless email flow:
      // https://supabase.com/docs/reference/javascript/auth-signinwithotp
      return resultOrThrow(await client.auth.signInWithOtp({
        email: String(email ?? "").trim(),
        options: { emailRedirectTo },
      }), "無法寄出登入連結");
    },

    async getSession() {
      const data = resultOrThrow(await client.auth.getSession(), "無法讀取登入狀態");
      return data?.session ?? null;
    },

    onAuthStateChange(callback) {
      return client.auth.onAuthStateChange((event, session) => callback(event, session));
    },

    async signOut() {
      resultOrThrow(await client.auth.signOut(), "登出失敗");
    },

    async fetchWorkspace(slug = "default") {
      const user = await currentUser();
      const result = await client
        .from("research_workspaces")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .eq("slug", slug)
        .maybeSingle();
      const row = resultOrThrow(result, "無法下載雲端工作區");
      return row ? { workspace: row.data, updatedAt: row.updated_at } : null;
    },

    async saveWorkspace(workspace, slug = "default") {
      const user = await currentUser();
      const updatedAt = new Date().toISOString();
      // Official upsert pattern with a unique conflict key:
      // https://supabase.com/docs/reference/javascript/upsert
      const result = await client
        .from("research_workspaces")
        .upsert(workspaceRow(user.id, workspace, updatedAt, slug), { onConflict: "user_id,slug" })
        .select("data, updated_at")
        .single();
      const row = resultOrThrow(result, "無法上傳研究工作區");
      return { workspace: row.data, updatedAt: row.updated_at };
    },
  };
}
