import crypto from "node:crypto";

type ApplicationBody = {
  truckersMPUsername?: string;
  truckersMPProfile?: string;
  discordUsername?: string;
  age?: string;
  country?: string;
  ets2Hours?: string;
  accountAge?: string;
  previousVtc?: string;
  whyJoin?: string;
  foundUs?: string;
  website?: string;
};

const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function env(name: string) { return process.env[name] || ""; }

function supabase(path: string, init: RequestInit = {}) {
  const base = env("SUPABASE_URL").replace(/\/+$/, "").trim().replace(/\/rest\/v1$/i, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const cleanPath = path.replace(/^\/+/, "");
  return fetch(`${base}/rest/v1/${cleanPath}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
}

const DISCORD_API = "https://discord.com/api/v10";

export async function GET() {
  return json({ ok: true, service: "V.I.P VTC application endpoint" });
}

export async function POST(request: Request) {
  try {
    const botToken = env("DISCORD_BOT_TOKEN");
    const channelId = env("DISCORD_APPLICATION_CHANNEL_ID");
    if (!botToken || !channelId) {
      return json({ error: "Discord bot application settings are not configured on the server." }, 500);
    }
    if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ error: "Application database is not configured on the server." }, 500);
    }

    let body: ApplicationBody;
    try { body = (await request.json()) as ApplicationBody; }
    catch { return json({ error: "Invalid application data." }, 400); }

    if (clean(body.website, 200)) return json({ ok: true });

    const fields: [string, string][] = [
      ["TruckersMP Username", clean(body.truckersMPUsername)],
      ["TruckersMP Profile", clean(body.truckersMPProfile, 500)],
      ["Discord Username", clean(body.discordUsername)],
      ["Age", clean(body.age, 20)],
      ["Country", clean(body.country, 100)],
      ["ETS2 Hours", clean(body.ets2Hours, 30)],
      ["TruckersMP Account Age", clean(body.accountAge, 100)],
      ["Previous VTC", clean(body.previousVtc)],
      ["Why do you want to join?", clean(body.whyJoin, 1000)],
      ["How did you find us?", clean(body.foundUs, 300)],
    ];

    if (fields.slice(0, 6).some(([, value]) => !value)) {
      return json({ error: "Please complete all required application fields." }, 400);
    }

    const applicationId = crypto.randomUUID();
    const embed = {
      title: "🚛 VTC APPLICATION",
      description: "A new driver application was submitted through the V.I.P LOGISTICS TRANSPORT website.\n\n**Status:** ⏳ PENDING REVIEW",
      color: 0xd90000,
      fields: fields.map(([name, value]) => ({ name, value: value || "Not provided", inline: name !== "Why do you want to join?" })),
      footer: { text: `V.I.P LOGISTICS TRANSPORT VTC • Application ${applicationId}` },
      timestamp: new Date().toISOString(),
    };

    const discordResponse = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 3, label: "Accept Application", custom_id: `vtc:accept:${applicationId}` },
            { type: 2, style: 4, label: "Reject Application", custom_id: `vtc:reject:${applicationId}` },
          ],
        }],
        allowed_mentions: { parse: [] },
      }),
    });

    if (!discordResponse.ok) {
      console.error("Discord bot message failed:", discordResponse.status, await discordResponse.text());
      return json({ error: "Discord could not receive the application. Please try again later." }, 502);
    }

    const discordMessage = await discordResponse.json() as { id: string; channel_id: string };
    const dbResponse = await supabase("applications", {
      method: "POST",
      body: JSON.stringify({
        id: applicationId,
        status: "PENDING",
        fields,
        message_id: discordMessage.id,
        channel_id: discordMessage.channel_id || channelId,
      }),
    });

    if (!dbResponse.ok) {
      console.error("Application database insert failed:", await dbResponse.text());
      // The Discord message exists, but without the database record buttons cannot be processed safely.
      return json({ error: "Application was sent to Discord, but could not be saved. Please contact management." }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Application endpoint error:", error);
    return json({ error: "Unable to submit application." }, 500);
  }
}
