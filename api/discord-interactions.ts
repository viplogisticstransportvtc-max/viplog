import crypto from "node:crypto";

const DISCORD_API = "https://discord.com/api/v10";

function env(name: string) {
  return process.env[name] || "";
}

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function discordHeaders() {
  const token = env("DISCORD_BOT_TOKEN");
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

function supabase(path: string, init: RequestInit = {}) {
  const base = env("SUPABASE_URL").replace(/\/+$/, "").trim().replace(/\/rest\/v1$/i, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const clean = path.replace(/^\/+/, "");
  return fetch(`${base}/rest/v1/${clean}`, {
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

function verifyDiscordRequest(body: string, signature: string, timestamp: string, publicKeyHex: string) {
  if (!signature || !timestamp || !publicKeyHex) return false;
  try {
    // Ed25519 SubjectPublicKeyInfo prefix for a raw 32-byte Ed25519 public key.
    const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = crypto.createPublicKey({ key: Buffer.concat([derPrefix, Buffer.from(publicKeyHex, "hex")]), format: "der", type: "spki" });
    return crypto.verify(
      null,
      Buffer.from(timestamp + body),
      publicKey,
      Buffer.from(signature, "hex")
    );
  } catch (error) {
    console.error("Discord signature verification failed:", error);
    return false;
  }
}

function safe(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function applicationEmbed(fields: Array<[string, string]>, status = "PENDING") {
  const statusText = status === "PENDING" ? "⏳ PENDING REVIEW" : status === "ACCEPTED" ? "✅ ACCEPTED" : "❌ REJECTED";
  return {
    title: "🚛 VTC APPLICATION",
    description: `V.I.P LOGISTICS TRANSPORT VTC\n\n**Status:** ${statusText}`,
    color: status === "ACCEPTED" ? 0x16a34a : status === "REJECTED" ? 0xdc2626 : 0xd90000,
    fields: fields.map(([name, value]) => ({
      name,
      value: value || "Not provided",
      inline: name !== "Why do you want to join?",
    })),
    footer: { text: "V.I.P LOGISTICS TRANSPORT VTC" },
    timestamp: new Date().toISOString(),
  };
}

async function editDiscordMessage(channelId: string, messageId: string, embed: unknown, status: "ACCEPTED" | "REJECTED") {
  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: discordHeaders(),
    body: JSON.stringify({
      embeds: [embed],
      components: [],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Discord message update failed (${status}):`, response.status, text);
  }
  return response;
}

export async function GET() {
  return json({ ok: true, service: "Discord interactions endpoint" });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";
  const publicKey = env("DISCORD_PUBLIC_KEY");

  if (!verifyDiscordRequest(rawBody, signature, timestamp, publicKey)) {
    return json({ error: "Invalid request signature." }, 401);
  }

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  // Discord sends this immediately when verifying the Interactions Endpoint URL.
  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  // Button/component interaction.
  if (interaction.type !== 3) {
    return json({ type: 1 });
  }

  const customId = safe(interaction.data?.custom_id, 200);
  const match = customId.match(/^vtc:(accept|reject):([0-9a-f-]{36})$/i);
  if (!match) return json({ type: 4, data: { content: "Unknown application action.", flags: 64 } });

  const action = match[1].toLowerCase() as "accept" | "reject";
  const applicationId = match[2];
  const managementRoleId = env("DISCORD_MANAGEMENT_ROLE_ID");
  const memberRoles: string[] = Array.isArray(interaction.member?.roles) ? interaction.member.roles : [];

  if (!managementRoleId || !memberRoles.includes(managementRoleId)) {
    return json({ type: 4, data: { content: "⛔ You do not have permission to manage VTC applications.", flags: 64 } });
  }

  const channelId = safe(interaction.channel_id, 40);
  const messageId = safe(interaction.message?.id, 40);
  if (!channelId || !messageId) return json({ type: 4, data: { content: "Application message information is missing.", flags: 64 } });

  const existingResponse = await supabase(`applications?id=eq.${encodeURIComponent(applicationId)}&select=id,status,fields,message_id,channel_id&limit=1`);
  if (!existingResponse.ok) {
    console.error("Application lookup failed:", await existingResponse.text());
    return json({ type: 4, data: { content: "Unable to look up this application.", flags: 64 } });
  }
  const rows = await existingResponse.json() as Array<{ id: string; status: string; fields: Array<[string, string]>; message_id: string; channel_id: string }>;
  const application = rows[0];
  if (!application) return json({ type: 4, data: { content: "This application no longer exists.", flags: 64 } });

  if (application.status !== "PENDING") {
    return json({ type: 4, data: { content: `This application has already been ${application.status.toLowerCase()}.`, flags: 64 } });
  }

  const newStatus = action === "accept" ? "ACCEPTED" : "REJECTED";
  const reviewer = interaction.member?.user?.username || interaction.user?.username || "Management";
  const update = await supabase(`applications?id=eq.${encodeURIComponent(applicationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus, reviewed_by: reviewer, reviewed_at: new Date().toISOString() }),
  });
  if (!update.ok) {
    console.error("Application status update failed:", await update.text());
    return json({ type: 4, data: { content: "Unable to update the application status.", flags: 64 } });
  }

  const embed = applicationEmbed(application.fields, newStatus);
  await editDiscordMessage(channelId, messageId, embed, newStatus);

  return json({
    type: 4,
    data: {
      content: `${newStatus === "ACCEPTED" ? "✅ Application accepted." : "❌ Application rejected."} Reviewed by **${reviewer}**.`,
      flags: 64,
    },
  });
}
