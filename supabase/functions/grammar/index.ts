// Grammar and spelling check for new cards via the free LanguageTool API (British English).
// Requires a signed-in user (verify_jwt). Body: { text: string } -> { matches: [...] }
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let text = "";
  try { text = String((await req.json()).text ?? "").slice(0, 2000); } catch { /* empty */ }
  if (!text.trim()) return Response.json({ matches: [] }, { headers: cors });

  // Cards are often single words or phrases, so a lowercase start is fine.
  const form = new URLSearchParams({ text, language: "en-GB", enabledOnly: "false", disabledRules: "UPPERCASE_SENTENCE_START" });
  const r = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
  });
  if (!r.ok) return Response.json({ error: `LanguageTool ${r.status}` }, { status: 502, headers: cors });
  const data = await r.json();
  const matches = (data.matches ?? []).map((m: any) => ({
    message: m.message,
    offset: m.offset,
    length: m.length,
    replacements: (m.replacements ?? []).slice(0, 4).map((x: any) => x.value),
    rule: m.rule?.issueType ?? "",
  }));
  return Response.json({ matches }, { headers: cors });
});
