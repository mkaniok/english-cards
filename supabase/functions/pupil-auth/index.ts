// Pupil accounts without e-mail: class code + nickname + 4-digit PIN.
// Each pupil gets an internal Supabase Auth user with a synthetic address that is never mailed.
// Actions:
//   register  { classCode, nickname, pin }            -> creates the account (no auth needed)
//   reset_pin { userId, pin }                         -> admin only (admins manage every class)
//   remove    { userId }                              -> admin only (admins manage every class)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Keep in sync with src/lib/pupil.ts
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const emailFor = (slug: string, code: string) => `${slug}.${code.toLowerCase()}@pupil.invalid`;
const passwordFor = (pin: string, slug: string) => `ec:${pin}:${slug}`;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function callerAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await admin.from("profiles").select("id, role").eq("id", data.user.id).single();
  return p && p.role === "admin" ? p : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "Neplatný požadavek." }, 400); }

  if (body.action === "register") {
    const code = String(body.classCode ?? "").trim().toUpperCase();
    const nickname = String(body.nickname ?? "").trim().replace(/\s+/g, " ");
    const pin = String(body.pin ?? "");
    const slug = slugify(nickname);
    if (nickname.length < 2 || nickname.length > 20 || slug.length < 2)
      return json({ error: "Přezdívka musí mít 2 až 20 znaků (písmena nebo čísla)." }, 400);
    if (!/^\d{4}$/.test(pin)) return json({ error: "PIN musí mít přesně 4 číslice." }, 400);

    if (!/^[A-Z0-9]{4,12}$/.test(code)) return json({ error: "Kód třídy neexistuje." }, 404);
    // A pupil code registers a pupil, the secret admin code registers an admin.
    const { data: cls } = await admin.from("classes").select("id, code, admin_code")
      .or(`code.eq.${code},admin_code.eq.${code}`).maybeSingle();
    if (!cls) return json({ error: "Kód třídy neexistuje." }, 404);
    const role = cls.admin_code === code ? "admin" : "student";

    const { data: taken } = await admin.from("profiles").select("id").eq("class_id", cls.id).eq("login_slug", slug).maybeSingle();
    if (taken) return json({ error: "Tuhle přezdívku už ve třídě někdo má. Zkus jinou." }, 409);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: emailFor(slug, cls.code),
      password: passwordFor(pin, slug),
      email_confirm: true,
      user_metadata: { nickname },
    });
    if (error || !created.user) return json({ error: "Účet se nepodařilo vytvořit: " + (error?.message ?? "") }, 500);

    const { error: pErr } = await admin.from("profiles").insert({
      id: created.user.id, class_id: cls.id, nickname, login_slug: slug, role,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "Účet se nepodařilo vytvořit." }, 500);
    }
    return json({ ok: true, classCode: cls.code, role });
  }

  if (body.action === "reset_pin" || body.action === "remove") {
    const me = await callerAdmin(req);
    if (!me) return json({ error: "Jen pro admina." }, 403);
    const { data: target } = await admin.from("profiles").select("id, login_slug").eq("id", body.userId).maybeSingle();
    if (!target) return json({ error: "Uživatel nenalezen." }, 404);

    if (body.action === "remove") {
      if (target.id === me.id) return json({ error: "Sám sebe smazat nejde." }, 400);
      const { error } = await admin.auth.admin.deleteUser(target.id);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    const pin = String(body.pin ?? "");
    if (!/^\d{4}$/.test(pin)) return json({ error: "PIN musí mít přesně 4 číslice." }, 400);
    const { error } = await admin.auth.admin.updateUserById(target.id, { password: passwordFor(pin, target.login_slug) });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  return json({ error: "Neznámá akce." }, 400);
});
