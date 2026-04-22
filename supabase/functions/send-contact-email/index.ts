import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_FALLBACK_EMAIL = "alvarez.maciel@outlook.com";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
    const ownerEmail = (Deno.env.get("CONTACT_OWNER_EMAIL") || OWNER_FALLBACK_EMAIL).trim().toLowerCase();
    if (!resendKey || !fromEmail) {
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as ContactPayload;
    const name = String(payload.name || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const phone = String(payload.phone || "").trim();
    const message = String(payload.message || "").trim();

    if (!name || !email || !message || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Missing required contact fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerSubject = `New contact form message · ${name}`;
    const ownerText = [
      "New contact form submission",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "Not provided"}`,
      "",
      "Message:",
      message,
    ].join("\n");

    const ownerHtml = `<!doctype html>
<html lang="en">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#020617;margin:0;padding:22px;color:#e5e7eb;">
  <div style="max-width:680px;margin:0 auto;background:#0b1220;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
    <div style="padding:18px 20px;background:linear-gradient(120deg,#0b3868 0%,#0a1f3b 100%);">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#bfdbfe;">Blue Bear Detail</p>
      <h2 style="margin:0;color:#ffffff;font-size:21px;">New contact message</h2>
    </div>
    <div style="padding:18px 20px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #1f2937;border-radius:10px;overflow:hidden;margin-bottom:14px;">
        <tr><td style="padding:9px 12px;border-bottom:1px solid #1f2937;color:#9ca3af;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;width:30%;">Name</td><td style="padding:9px 12px;border-bottom:1px solid #1f2937;color:#f3f4f6;">${escapeHtml(
          name
        )}</td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #1f2937;color:#9ca3af;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Email</td><td style="padding:9px 12px;border-bottom:1px solid #1f2937;color:#f3f4f6;">${escapeHtml(
          email
        )}</td></tr>
        <tr><td style="padding:9px 12px;color:#9ca3af;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Phone</td><td style="padding:9px 12px;color:#f3f4f6;">${escapeHtml(
          phone || "Not provided"
        )}</td></tr>
      </table>
      <p style="margin:0 0 8px 0;color:#93c5fd;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Message</p>
      <pre style="margin:0;white-space:pre-wrap;background:#020617;border:1px solid #1f2937;border-radius:10px;padding:12px;color:#e5e7eb;line-height:1.55;">${escapeHtml(
        message
      )}</pre>
    </div>
  </div>
</body>
</html>`;

    const ownerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ownerEmail],
        reply_to: email,
        subject: ownerSubject,
        text: ownerText,
        html: ownerHtml,
      }),
    });

    if (!ownerRes.ok) {
      const detail = await ownerRes.text();
      return new Response(JSON.stringify({ error: "Failed to send contact email", detail }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "We received your message · Blue Bear Detail",
        text:
          `Hi ${name},\n\n` +
          "Thanks for contacting Blue Bear Detail. We received your message and will follow up shortly.\n\n" +
          "— Blue Bear Detail",
      }),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        owner_email_sent: true,
        customer_email_sent: customerRes.ok,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[send-contact-email]", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
