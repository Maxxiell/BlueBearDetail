import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Only send for rows created recently (reduces abuse if the endpoint is called without JWT). */
const MAX_AGE_MS = 15 * 60 * 1000;

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
    const body = (await req.json()) as { booking_id?: string };
    const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return new Response(JSON.stringify({ error: "Invalid booking_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "";

    if (!supabaseUrl || !serviceKey) {
      console.error("[send-booking-email] Missing Supabase env");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendKey || !fromEmail) {
      console.error("[send-booking-email] Missing RESEND_API_KEY or RESEND_FROM_EMAIL");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error: fetchErr } = await admin
      .from("bookings")
      .select(
        "id, reference_code, created_at, cust_email, cust_first_name, cust_last_name, summary_text, booking_date, booking_time, service_package, vehicle_type, addons"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchErr || !row) {
      console.error("[send-booking-email] fetch", fetchErr);
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const created = new Date(String(row.created_at)).getTime();
    if (Number.isNaN(created) || Date.now() - created > MAX_AGE_MS) {
      return new Response(JSON.stringify({ error: "Booking too old to send" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = String(row.cust_email || "").trim();
    if (!to || !to.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = [row.cust_first_name, row.cust_last_name].filter(Boolean).join(" ").trim() || "there";
    const refShort =
      (typeof row.reference_code === "string" && row.reference_code.trim()) ||
      String(row.id || bookingId)
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase();
    const subject = `We received your booking request · Blue Bear Detail`;

    const textBody = buildBookingEmailText({
      name,
      refShort,
      summaryText: String(row.summary_text || "").trim(),
      bookingDate: String(row.booking_date || ""),
      bookingTime: String(row.booking_time || ""),
      servicePackage: String(row.service_package || ""),
      vehicleType: String(row.vehicle_type || ""),
      addons: row.addons,
    });

    /** GitHub Pages + custom domain fallbacks so the logo loads when the site is live */
    const logoUrl =
      Deno.env.get("BOOKING_EMAIL_LOGO_URL") ??
      "https://maxxiell.github.io/BlueBearDetail/logos/BBD-Site-Logo-horizontal.png";

    const htmlBody = buildBookingEmailHtml({
      name,
      refShort,
      summaryText: String(row.summary_text || "").trim(),
      bookingDate: String(row.booking_date || ""),
      bookingTime: String(row.booking_time || ""),
      servicePackage: String(row.service_package || ""),
      vehicleType: String(row.vehicle_type || ""),
      addons: row.addons,
      logoUrl,
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[send-booking-email] Resend error", resendRes.status, errText);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-booking-email]", e);
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

const SERVICE_LABELS: Record<string, string> = {
  essential: "Essential",
  complete: "Complete",
  signature: "Signature",
};

const VEHICLE_LABELS: Record<string, string> = {
  "sedan-coupe": "Sedan / Coupe",
  suv: "SUV",
  truck: "Truck",
};

function formatService(key: string): string {
  return SERVICE_LABELS[key] || key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatVehicle(key: string): string {
  return VEHICLE_LABELS[key] || key;
}

function formatTime12h(iso: string): string {
  const p = iso.split(":");
  const h = parseInt(p[0] || "0", 10);
  const m = p[1] || "00";
  if (Number.isNaN(h)) return iso;
  const ampm = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDateUs(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, mo, d] = isoDate.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mi = parseInt(mo, 10) - 1;
  return `${months[mi] || mo} ${parseInt(d, 10)}, ${y}`;
}

function addonsLine(addons: unknown): string {
  if (addons == null) return "";
  if (Array.isArray(addons) && addons.length === 0) return "None";
  if (Array.isArray(addons)) return addons.join(", ");
  try {
    return JSON.stringify(addons);
  } catch {
    return String(addons);
  }
}

type BookingEmailFields = {
  name: string;
  refShort: string;
  summaryText: string;
  bookingDate: string;
  bookingTime: string;
  servicePackage: string;
  vehicleType: string;
  addons: unknown;
  logoUrl: string;
};

function buildBookingEmailText(f: BookingEmailFields): string {
  const lines: string[] = [];
  lines.push(`Hi ${f.name},`);
  lines.push("");
  lines.push("Thanks for booking with Blue Bear Detail. We received your request.");
  lines.push(`Reference: ${f.refShort}`);
  lines.push("");
  if (f.bookingDate) lines.push(`Preferred date: ${formatDateUs(f.bookingDate)}`);
  if (f.bookingTime) lines.push(`Preferred time: ${formatTime12h(f.bookingTime)}`);
  if (f.servicePackage) lines.push(`Service: ${formatService(f.servicePackage)}`);
  if (f.vehicleType) lines.push(`Vehicle type: ${formatVehicle(f.vehicleType)}`);
  const addOns = addonsLine(f.addons);
  if (addOns && addOns !== "None") lines.push(`Add-ons: ${addOns}`);
  lines.push("");
  lines.push("— Full request —");
  lines.push(f.summaryText || "(no details)");
  lines.push("");
  lines.push("We’ll follow up by phone or email to confirm your appointment.");
  lines.push("");
  lines.push("— Blue Bear Detail");
  lines.push("bluebeardetail.com");
  return lines.join("\n");
}

/** Dark-themed HTML for email: black canvas, white logo bar, white “full request” block, brand #02396b */
function buildBookingEmailHtml(f: BookingEmailFields): string {
  const brand = "#02396b";
  const cardBg = "#0a0a0a";
  const cardBorder = "#1e293b";
  const text = "#e5e7eb";
  const muted = "#9ca3af";
  const white = "#ffffff";
  const black = "#000000";
  const rowBg = "#111827";

  const summaryBlock = escapeHtml(f.summaryText || "").replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
  const logoSrc = escapeHtml(f.logoUrl);

  const rows: string[] = [];
  if (f.bookingDate) {
    rows.push(rowHtmlDark("Preferred date", escapeHtml(formatDateUs(f.bookingDate)), rowBg));
  }
  if (f.bookingTime) {
    rows.push(rowHtmlDark("Preferred start time", escapeHtml(formatTime12h(f.bookingTime)), rowBg));
  }
  if (f.servicePackage) {
    rows.push(rowHtmlDark("Service package", escapeHtml(formatService(f.servicePackage)), rowBg));
  }
  if (f.vehicleType) {
    rows.push(rowHtmlDark("Vehicle type", escapeHtml(formatVehicle(f.vehicleType)), rowBg));
  }
  const addStr = addonsLine(f.addons);
  if (addStr && addStr !== "None") {
    rows.push(rowHtmlDark("Add-ons", escapeHtml(addStr), rowBg));
  }

  const detailsTable = rows.length
    ? `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 22px 0;border:1px solid ${cardBorder};border-radius:8px;overflow:hidden;">
    <tbody>
      ${rows.join("\n")}
    </tbody>
  </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width"/>
  <meta name="color-scheme" content="dark light"/>
  <meta name="supported-color-schemes" content="dark light"/>
  <title>Booking received</title>
</head>
<body bgcolor="${black}" style="margin:0;padding:0;background-color:${black} !important;color:${text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${black}" style="border-collapse:collapse;background-color:${black} !important;">
    <tr>
      <td align="center" bgcolor="${black}" style="background-color:${black} !important;padding:28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:600px;background-color:${cardBg} !important;border-radius:14px;overflow:hidden;border:1px solid ${cardBorder};">
          <tr>
            <td align="center" bgcolor="${white}" style="background-color:${white} !important;padding:26px 28px 22px 28px;">
              <a href="https://bluebeardetail.com" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <img src="${logoSrc}" alt="Blue Bear Detail" width="220" height="48" border="0" style="display:block;margin:0 auto;max-width:100%;width:220px;height:auto;border:0;outline:none;-ms-interpolation-mode:bicubic;"/>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 28px 8px 28px;background-color:${cardBg} !important;">
              <h1 style="margin:0 0 12px 0;font-size:21px;font-weight:700;color:${white};line-height:1.25;">Booking request received</h1>
              <p style="margin:0;font-size:13px;color:${muted};letter-spacing:0.06em;">Reference <span style="display:inline-block;padding:6px 14px;border-radius:8px;background-color:${black};color:${brand};font-weight:800;letter-spacing:0.12em;border:1px solid ${brand};">${escapeHtml(f.refShort)}</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px 28px;background-color:${cardBg} !important;">
              <p style="margin:0 0 14px 0;font-size:16px;line-height:1.55;color:${text};">Hi ${escapeHtml(f.name)},</p>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.65;color:${muted};">Thanks for choosing Blue Bear Detail. Below is a copy of what you submitted. We’ll contact you to confirm your appointment.</p>
              ${detailsTable}
              <p style="margin:0 0 10px 0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${brand};">Full request</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 12px 0;">
                <tr>
                  <td bgcolor="${white}" style="background-color:${white} !important;border:1px solid #d1d5db;border-left:5px solid ${brand};border-radius:10px;padding:18px 20px;font-size:13px;line-height:1.65;color:#111827;font-family:Consolas,'SF Mono','Liberation Mono',Menlo,monospace;">${summaryBlock}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 28px 22px 28px;background-color:${cardBg} !important;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:${muted};">Questions? Reply to this email or visit <a href="https://bluebeardetail.com" style="color:${brand};font-weight:700;text-decoration:underline;">bluebeardetail.com</a>.</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${black}" style="background-color:${black} !important;padding:22px 28px;text-align:center;border-top:3px solid ${brand};">
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#ffffff;">Blue Bear Detail</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:rgba(255,255,255,0.72);">Mobile auto detailing · Denver area</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);line-height:1.45;">This message was sent because you submitted a booking on our website.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function rowHtmlDark(label: string, value: string, bg: string): string {
  return `<tr>
    <td bgcolor="${bg}" style="padding:11px 14px;border-bottom:1px solid #374151;font-size:11px;font-weight:700;color:${muted};width:36%;vertical-align:top;text-transform:uppercase;letter-spacing:0.04em;">${label}</td>
    <td bgcolor="${bg}" style="padding:11px 14px;border-bottom:1px solid #374151;font-size:14px;color:#f3f4f6;vertical-align:top;">${value}</td>
  </tr>`;
}
