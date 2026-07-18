// Vercel Serverless Function - Jikkai Discord DM
// Path: /api/discord-dm

const DISCORD_API = "https://discord.com/api/v10";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function discordFetch(path, token, options = {}) {
  const resp = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!resp.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    const err = new Error(detail || resp.statusText);
    err.status = resp.status;
    throw err;
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Metodo nao permitido" });

  try {
    const body = await readBody(req);
    const discordId = String(body.discordId || "").trim();
    const content = String(body.content || "").trim().slice(0, 1900);
    const token = String(process.env.DISCORD_BOT_TOKEN || body.botToken || "").trim();

    if (!token || token.includes("COLE_AQUI")) return json(res, 400, { ok: false, error: "Bot token ausente" });
    if (!/^\d{15,25}$/.test(discordId)) return json(res, 400, { ok: false, error: "Discord ID invalido" });
    if (!content) return json(res, 400, { ok: false, error: "Mensagem vazia" });

    const dm = await discordFetch("/users/@me/channels", token, {
      method: "POST",
      body: JSON.stringify({ recipient_id: discordId }),
    });

    const msg = await discordFetch(`/channels/${dm.id}/messages`, token, {
      method: "POST",
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
    });

    return json(res, 200, { ok: true, channelId: dm.id, messageId: msg.id });
  } catch (err) {
    return json(res, err.status || 500, {
      ok: false,
      error: err.message || "Falha ao enviar DM",
      status: err.status || 500,
    });
  }
};
