import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Only send for rows created recently (reduces abuse if the endpoint is called without JWT). */
const MAX_AGE_MS = 15 * 60 * 1000;
const OWNER_NOTIFICATION_EMAIL = "alvarez.maciel@outlook.com";

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
    const body = (await req.json()) as { booking_id?: string; reference_code?: string };
    const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : "";
    const incomingRefCode =
      typeof body.reference_code === "string" ? body.reference_code.trim().toUpperCase() : "";
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
        "id, reference_code, created_at, cust_email, cust_first_name, cust_last_name, cust_phone, cust_address, summary_text, booking_date, booking_time, service_package, vehicle_type, addons"
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
      incomingRefCode ||
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

    const customerRes = await fetch("https://api.resend.com/emails", {
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

    if (!customerRes.ok) {
      const errText = await customerRes.text();
      console.error("[send-booking-email] customer email", customerRes.status, errText);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerTo = (Deno.env.get("BOOKING_OWNER_EMAIL") || OWNER_NOTIFICATION_EMAIL).trim().toLowerCase();
    const ownerText = buildOwnerBookingText({
      refShort,
      bookingDate: String(row.booking_date || ""),
      bookingTime: String(row.booking_time || ""),
      servicePackage: String(row.service_package || ""),
      vehicleType: String(row.vehicle_type || ""),
      addons: row.addons,
      summaryText: String(row.summary_text || "").trim(),
      customerName: name,
      customerEmail: to,
      customerPhone: String(row.cust_phone || "").trim(),
      customerAddress: String(row.cust_address || "").trim(),
    });
    const ownerHtml = buildOwnerBookingHtml({
      refShort,
      bookingDate: String(row.booking_date || ""),
      bookingTime: String(row.booking_time || ""),
      servicePackage: String(row.service_package || ""),
      vehicleType: String(row.vehicle_type || ""),
      addons: row.addons,
      summaryText: String(row.summary_text || "").trim(),
      customerName: name,
      customerEmail: to,
      customerPhone: String(row.cust_phone || "").trim(),
      customerAddress: String(row.cust_address || "").trim(),
    });
    let ownerEmailSent = false;
    if (ownerTo && ownerTo.includes("@")) {
      const ownerRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [ownerTo],
          subject: `New booking request ${refShort} · Blue Bear Detail`,
          text: ownerText,
          html: ownerHtml,
        }),
      });
      if (!ownerRes.ok) {
        const ownerErrText = await ownerRes.text();
        console.error("[send-booking-email] owner notification", ownerRes.status, ownerErrText);
      } else {
        ownerEmailSent = true;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reference_code: refShort,
        customer_email_sent: true,
        owner_email_sent: ownerEmailSent,
      }),
      {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
  logoUrl?: string;
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
  const logoSrc = escapeHtml(
    f.logoUrl ||
      "https://maxxiell.github.io/BlueBearDetail/logos/BBD-Site-Logo-horizontal.png"
  );

  const rows: string[] = [];
  if (f.bookingDate) {
    rows.push(rowHtmlDark("Preferred date", escapeHtml(formatDateUs(f.bookingDate)), rowBg, muted));
  }
  if (f.bookingTime) {
    rows.push(rowHtmlDark("Preferred start time", escapeHtml(formatTime12h(f.bookingTime)), rowBg, muted));
  }
  if (f.servicePackage) {
    rows.push(rowHtmlDark("Service package", escapeHtml(formatService(f.servicePackage)), rowBg, muted));
  }
  if (f.vehicleType) {
    rows.push(rowHtmlDark("Vehicle type", escapeHtml(formatVehicle(f.vehicleType)), rowBg, muted));
  }
  const addStr = addonsLine(f.addons);
  if (addStr && addStr !== "None") {
    rows.push(rowHtmlDark("Add-ons", escapeHtml(addStr), rowBg, muted));
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

function rowHtmlDark(label: string, value: string, bg: string, muted: string): string {
  return `<tr>
    <td bgcolor="${bg}" style="padding:11px 14px;border-bottom:1px solid #374151;font-size:11px;font-weight:700;color:${muted};width:36%;vertical-align:top;text-transform:uppercase;letter-spacing:0.04em;">${label}</td>
    <td bgcolor="${bg}" style="padding:11px 14px;border-bottom:1px solid #374151;font-size:14px;color:#f3f4f6;vertical-align:top;">${value}</td>
  </tr>`;
}

const SERVICE_BASE_PRICES: Record<string, number> = {
  essential: 119.99,
  complete: 249.99,
  signature: 339.99,
};

const ADDON_BASE_PRICES: Record<string, number> = {
  "spray-wax": 35,
  "pet-hair": 59,
  "leather-condition": 45,
  "light-stain-spot-treatment": 50,
  "headliner-cleaning": 40,
  "carpet-shampoo": 75,
};

const ADDON_LABELS: Record<string, string> = {
  "spray-wax": "Spray Wax Protection",
  "pet-hair": "Pet Hair Removal",
  "leather-condition": "Leather Condition & Protection",
  "light-stain-spot-treatment": "Stain Spot Treatment",
  "headliner-cleaning": "Headliner Cleaning",
  "carpet-shampoo": "Carpet Shampoo",
};

type OwnerEmailFields = {
  refShort: string;
  bookingDate: string;
  bookingTime: string;
  servicePackage: string;
  vehicleType: string;
  addons: unknown;
  summaryText: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
};

function parseAddonArray(addons: unknown): string[] {
  return Array.isArray(addons)
    ? addons.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function addonLabel(key: string): string {
  return ADDON_LABELS[key] || key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildOwnerBookingText(f: OwnerEmailFields): string {
  const addons = parseAddonArray(f.addons);
  const serviceCost = SERVICE_BASE_PRICES[f.servicePackage] ?? 0;
  const addOnTotal = addons.reduce((sum, key) => sum + (ADDON_BASE_PRICES[key] ?? 0), 0);
  const estimateTotal = serviceCost + addOnTotal;
  const lines: string[] = [];
  lines.push(`New booking request received (${f.refShort})`);
  lines.push("");
  lines.push(`Customer: ${f.customerName}`);
  lines.push(`Email: ${f.customerEmail}`);
  if (f.customerPhone) lines.push(`Phone: ${f.customerPhone}`);
  if (f.customerAddress) lines.push(`Address: ${f.customerAddress}`);
  if (f.bookingDate) lines.push(`Date: ${formatDateUs(f.bookingDate)}`);
  if (f.bookingTime) lines.push(`Time: ${formatTime12h(f.bookingTime)}`);
  if (f.servicePackage) lines.push(`Service: ${formatService(f.servicePackage)}`);
  if (f.vehicleType) lines.push(`Vehicle: ${formatVehicle(f.vehicleType)}`);
  lines.push("");
  lines.push("Invoice estimate:");
  lines.push(`- Service base: ${money(serviceCost)}`);
  if (addons.length) {
    addons.forEach((key) => {
      lines.push(`- Add-on (${addonLabel(key)}): ${money(ADDON_BASE_PRICES[key] ?? 0)}`);
    });
  }
  lines.push(`- Estimated total: ${money(estimateTotal)}`);
  lines.push("");
  lines.push("Submitted summary:");
  lines.push(f.summaryText || "(none)");
  return lines.join("\n");
}

function buildOwnerBookingHtml(f: OwnerEmailFields): string {
  const addons = parseAddonArray(f.addons);
  const serviceCost = SERVICE_BASE_PRICES[f.servicePackage] ?? 0;
  const addOnTotal = addons.reduce((sum, key) => sum + (ADDON_BASE_PRICES[key] ?? 0), 0);
  const estimateTotal = serviceCost + addOnTotal;
  const addOnRows = addons.length
    ? addons
        .map((key) => {
          return `<tr><td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#d1d5db;">${escapeHtml(
            addonLabel(key)
          )}</td><td style="padding:10px 12px;border-bottom:1px solid #1f2937;text-align:right;color:#f9fafb;font-weight:600;">${money(
            ADDON_BASE_PRICES[key] ?? 0
          )}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="2" style="padding:10px 12px;color:#9ca3af;">No add-ons selected</td></tr>`;

  const details = [
    ["Reference", f.refShort],
    ["Customer", f.customerName],
    ["Email", f.customerEmail],
    ["Phone", f.customerPhone || "—"],
    ["Address", f.customerAddress || "—"],
    ["Date", f.bookingDate ? formatDateUs(f.bookingDate) : "—"],
    ["Time", f.bookingTime ? formatTime12h(f.bookingTime) : "—"],
    ["Service", f.servicePackage ? formatService(f.servicePackage) : "—"],
    ["Vehicle", f.vehicleType ? formatVehicle(f.vehicleType) : "—"],
  ].map(
    ([k, v]) =>
      `<tr><td style="padding:9px 12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;font-size:11px;border-bottom:1px solid #1f2937;width:34%;">${escapeHtml(
        k
      )}</td><td style="padding:9px 12px;color:#f3f4f6;border-bottom:1px solid #1f2937;">${escapeHtml(v)}</td></tr>`
  )
    .join("");

  return `<!doctype html>
<html lang="en">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#020617;margin:0;padding:22px;color:#e5e7eb;">
  <div style="max-width:700px;margin:0 auto;background:#0b1220;border:1px solid #1e293b;border-radius:14px;overflow:hidden;box-shadow:0 20px 48px rgba(0,0,0,0.38);">
    <div style="padding:18px 20px;background:linear-gradient(120deg,#0b3868 0%,#0a1f3b 100%);border-bottom:1px solid #1e3a5f;">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.13em;color:#bfdbfe;text-transform:uppercase;">Blue Bear Detail</p>
      <h2 style="margin:0;font-size:22px;line-height:1.2;color:#ffffff;">New booking request</h2>
      <p style="margin:10px 0 0 0;font-size:13px;color:#dbeafe;">Reference <span style="display:inline-block;margin-left:6px;padding:4px 10px;border-radius:999px;background:#020617;border:1px solid #3b82f6;color:#93c5fd;font-weight:700;letter-spacing:0.08em;">${escapeHtml(
        f.refShort
      )}</span></p>
    </div>
    <div style="padding:18px 20px 20px 20px;">
      <h3 style="margin:0 0 10px 0;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd;">Request details</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;border:1px solid #1f2937;border-radius:10px;overflow:hidden;">
        ${details}
      </table>
      <h3 style="margin:0 0 10px 0;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd;">Estimate snapshot</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;border:1px solid #1f2937;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#d1d5db;">Service base</td><td style="padding:10px 12px;border-bottom:1px solid #1f2937;text-align:right;color:#f9fafb;font-weight:600;">${money(
          serviceCost
        )}</td></tr>
        ${addOnRows}
        <tr><td style="padding:11px 12px;color:#ffffff;font-weight:700;border-top:1px solid #334155;">Estimated total</td><td style="padding:11px 12px;text-align:right;color:#ffffff;font-weight:700;border-top:1px solid #334155;">${money(
          estimateTotal
        )}</td></tr>
      </table>
      <h3 style="margin:0 0 8px 0;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd;">Submitted summary</h3>
      <pre style="white-space:pre-wrap;background:#020617;border:1px solid #1f2937;border-radius:10px;padding:12px;margin:0;color:#e5e7eb;line-height:1.5;">${escapeHtml(
        f.summaryText || "(none)"
      )}</pre>
    </div>
  </div>
</body>
</html>`;
}
