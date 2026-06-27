import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action =
  | "list_users"
  | "create_user"
  | "set_password"
  | "set_admin"
  | "set_allowed"
  | "delete_user"
  | "list_allowed"
  | "add_allowed"
  | "remove_allowed";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function audit(
  admin: ReturnType<typeof createClient>,
  actor_id: string,
  action: string,
  target_user_id: string | null,
  meta: Record<string, unknown> = {},
) {
  await admin.from("admin_audit").insert({ actor_id, action, target_user_id, meta });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "no_token" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "no_user" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json(403, { error: "forbidden" });

    const body = (await req.json().catch(() => ({}))) as { action?: Action; [k: string]: unknown };
    const action = body.action as Action;
    if (!action) return json(400, { error: "no_action" });

    switch (action) {
      case "list_users": {
        const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (error) return json(500, { error: error.message });
        const [{ data: profiles }, { data: roles }, { data: allowed }] = await Promise.all([
          admin.from("profiles").select("id, email, display_name, created_at"),
          admin.from("user_roles").select("user_id, role").eq("role", "admin"),
          admin.from("allowed_emails").select("email"),
        ]);
        const adminSet = new Set((roles ?? []).map((r: any) => r.user_id));
        const allowedSet = new Set((allowed ?? []).map((a: any) => String(a.email).toLowerCase()));
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const merged = users.map((u) => {
          const p = profileMap.get(u.id) as any;
          return {
            id: u.id,
            email: u.email,
            display_name: p?.display_name ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            banned_until: (u as any).banned_until ?? null,
            is_admin: adminSet.has(u.id),
            is_allowed: allowedSet.has(String(u.email ?? "").toLowerCase()),
          };
        });
        return json(200, { users: merged });
      }

      case "create_user": {
        const { email, password, display_name, is_admin } = body as any;
        if (!email || !password) return json(400, { error: "email_password_required" });
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: display_name ? { display_name } : undefined,
        });
        if (error || !created.user) return json(400, { error: error?.message ?? "create_failed" });
        await admin.from("allowed_emails").upsert({ email, created_by: user.id }, { onConflict: "email" });
        if (is_admin) {
          await admin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
        }
        await audit(admin, user.id, "create_user", created.user.id, { email, is_admin: !!is_admin });
        return json(200, { user_id: created.user.id });
      }

      case "set_password": {
        const { user_id, password } = body as any;
        if (!user_id || !password) return json(400, { error: "user_id_password_required" });
        const { error } = await admin.auth.admin.updateUserById(user_id, { password });
        if (error) return json(400, { error: error.message });
        await audit(admin, user.id, "set_password", user_id);
        return json(200, { ok: true });
      }

      case "set_admin": {
        const { user_id, is_admin } = body as any;
        if (!user_id) return json(400, { error: "user_id_required" });
        if (is_admin) {
          await admin.from("user_roles").insert({ user_id, role: "admin" }).select();
        } else {
          if (user_id === user.id) return json(400, { error: "cannot_demote_self" });
          await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
        }
        await audit(admin, user.id, "set_admin", user_id, { is_admin: !!is_admin });
        return json(200, { ok: true });
      }

      case "set_allowed": {
        const { email, allowed } = body as any;
        if (!email) return json(400, { error: "email_required" });
        if (allowed) {
          await admin.from("allowed_emails").upsert({ email, created_by: user.id }, { onConflict: "email" });
        } else {
          await admin.from("allowed_emails").delete().ilike("email", email);
        }
        await audit(admin, user.id, "set_allowed", null, { email, allowed: !!allowed });
        return json(200, { ok: true });
      }

      case "delete_user": {
        const { user_id } = body as any;
        if (!user_id) return json(400, { error: "user_id_required" });
        if (user_id === user.id) return json(400, { error: "cannot_delete_self" });
        const { data: target } = await admin.auth.admin.getUserById(user_id);
        const targetEmail = target?.user?.email;
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) return json(400, { error: error.message });
        if (targetEmail) await admin.from("allowed_emails").delete().ilike("email", targetEmail);
        await audit(admin, user.id, "delete_user", user_id, { email: targetEmail });
        return json(200, { ok: true });
      }

      case "list_allowed": {
        const { data } = await admin
          .from("allowed_emails")
          .select("email, note, created_at")
          .order("created_at", { ascending: false });
        return json(200, { allowed: data ?? [] });
      }

      case "add_allowed": {
        const { email, note } = body as any;
        if (!email) return json(400, { error: "email_required" });
        await admin.from("allowed_emails").upsert({ email, note, created_by: user.id }, { onConflict: "email" });
        await audit(admin, user.id, "add_allowed", null, { email });
        return json(200, { ok: true });
      }

      case "remove_allowed": {
        const { email } = body as any;
        if (!email) return json(400, { error: "email_required" });
        await admin.from("allowed_emails").delete().ilike("email", email);
        await audit(admin, user.id, "remove_allowed", null, { email });
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "unknown_action" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});