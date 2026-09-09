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
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return json({ ok: true, service: "V.I.P VTC application endpoint" });
}

export async function POST(request: Request) {
  try {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) return json({ error: "Discord webhook is not configured on the server." }, 500);

    let body: ApplicationBody;
    try {
      body = (await request.json()) as ApplicationBody;
    } catch {
      return json({ error: "Invalid application data." }, 400);
    }

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

    const discordResponse = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "V.I.P VTC Applications",
        embeds: [{
          title: "🚛 New VTC Application",
          description: "A new driver application was submitted through the V.I.P LOGISTICS TRANSPORT website.",
          color: 0xd90000,
          fields: fields.map(([name, value]) => ({
            name,
            value: value || "Not provided",
            inline: name !== "Why do you want to join?",
          })),
          footer: { text: "V.I.P LOGISTICS TRANSPORT VTC" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
    });

    if (!discordResponse.ok) {
      console.error("Discord webhook failed:", discordResponse.status, await discordResponse.text());
      return json({ error: "Discord could not receive the application. Please try again later." }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Application endpoint error:", error);
    return json({ error: "Unable to submit application." }, 500);
  }
}
