import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

/** UUID v4 for booking id (avoids .select() after insert — anon has no SELECT RLS on bookings). */
function newBookingId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Insert a "Book appointment" request into public.bookings.
 * Returns { id } on success, { error } on failure, or { skipped: true } if Supabase URL/key not set.
 */
export async function submitBookAppointment(form, summaryText) {
  try {
    return await submitBookAppointmentInner(form, summaryText);
  } catch (e) {
    console.error("[booking-submit-supabase]", e);
    return {
      error:
        (e && e.message) ||
        "Could not save your booking. Please try again or call us.",
    };
  }
}

async function submitBookAppointmentInner(form, summaryText) {
  if (!isSupabaseConfigured()) {
    return { skipped: true };
  }

  var fd = new FormData(form);
  var addons = fd.getAll("addon");

  var yearRaw = String(fd.get("vehYear") || "").trim();
  var year = yearRaw ? parseInt(yearRaw, 10) : null;
  if (yearRaw && Number.isNaN(year)) year = null;

  var userId = null;
  try {
    var sessionRes = await supabase.auth.getSession();
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    if (session && session.user) userId = session.user.id;
  } catch (_e) {}

  var bookingId = newBookingId();

  var row = {
    id: bookingId,
    user_id: userId,
    status: "book_requested",
    service_package: String(fd.get("service") || ""),
    vehicle_type: String(fd.get("vehicle") || ""),
    addons: addons,
    booking_date: String(fd.get("bookingDate") || ""),
    booking_time: String(fd.get("bookingTime") || ""),
    cust_first_name: String(fd.get("custFirstName") || "").trim(),
    cust_last_name: String(fd.get("custLastName") || "").trim(),
    cust_email: String(fd.get("custEmail") || "").trim(),
    cust_phone: String(fd.get("custPhone") || "").trim(),
    cust_address: String(fd.get("custAddress") || "").trim(),
    veh_year: year,
    veh_make: String(fd.get("vehMake") || "").trim(),
    veh_model: String(fd.get("vehModel") || "").trim(),
    veh_make_custom: String(fd.get("vehMakeCustom") || "").trim() || null,
    veh_model_custom: String(fd.get("vehModelCustom") || "").trim() || null,
    veh_color: String(fd.get("vehColor") || "").trim() || null,
    cust_notes: String(fd.get("custNotes") || "").trim() || null,
    checkout_method: "book",
    pay_inspection_ack: fd.get("payInspectionAck") === "yes",
    summary_text: String(summaryText || ""),
  };

  if (!row.booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.booking_date)) {
    return { error: "Invalid booking date." };
  }

  // Do not chain .select() — anon role has INSERT RLS but no SELECT; returning rows fails.
  var ins = await supabase.from("bookings").insert(row);

  if (ins.error) {
    console.error("[booking-submit-supabase]", ins.error);
    return {
      error:
        ins.error.message ||
        "Could not save your booking. Please try again or call us.",
    };
  }

  var emailSent = false;
  try {
    var invoked = await supabase.functions.invoke("send-booking-email", {
      body: { booking_id: bookingId },
    });
    if (invoked.error) {
      console.warn("[booking-submit-supabase] send-booking-email", invoked.error);
    } else {
      emailSent = true;
    }
  } catch (fnErr) {
    console.warn("[booking-submit-supabase] send-booking-email", fnErr);
  }

  return { id: bookingId, emailSent: emailSent };
}
