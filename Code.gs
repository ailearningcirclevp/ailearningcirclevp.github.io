/**
 * AI Learning Circle — Session Calendar registration backend.
 *
 * Deploy this as a Google Apps Script Web App. It receives
 * { sessionId, name, email } from the website and adds that email
 * as a guest on the ONE existing Google Calendar event that
 * corresponds to sessionId — it never creates new events.
 *
 * SETUP: replace every "PUT_GOOGLE_EVENT_ID_HERE" below with the
 * real event ID for that session (see the deployment guide for how
 * to find it), then deploy and paste the resulting Web App URL into
 * the website's REGISTRATION_ENDPOINT constant.
 */

// Shared client key — must match REGISTRATION_KEY in index.html.
// This is a soft filter, not real security (anyone can view page
// source and read it), but it blocks generic bots/scanners that hit
// this URL without ever loading the site.
const SHARED_KEY = "m70wf5pfK60pOce1S_JKpgze";

// Simple abuse throttle: at most MAX_PER_WINDOW submissions per
// WINDOW_SECONDS, across all visitors combined. Keeps a scripted
// flood from spamming calendar invites onto your events.
const WINDOW_SECONDS = 300;   // 5 minutes
const MAX_PER_WINDOW = 25;

// Google Calendar emails the REGISTRANT automatically (sendUpdates:
// "all" below), but it does NOT email you, the organizer, just
// because a guest was added to your own event. This address gets a
// short notification email on every successful registration instead.
const ORGANIZER_EMAIL = "ailearningcirclevp@gmail.com,vivp.2901@gmail.com"; // comma-separated: every address gets each notification

const SESSION_MAP = {
  "presentation-ai-01": {
    calendarId: "primary",
    eventId: "43n53eaa3gdhrqbl5ebei0qsv4"
  },
  "financial-modelling-01": {
    calendarId: "primary",
    eventId: "b1l1hbf8rl83d9vf1jepvud3m4"
  },
  "prompt-context-01": {
    calendarId: "primary",
    eventId: "88l7ui3ft020dlcutkkdm9p9lk"
  },
  "budgeting-forecasting-01": {
    calendarId: "primary",
    eventId: "0h5tj75fcq4k535pce8r4jomok"
  },
  "website-ai-01": {
    calendarId: "primary",
    eventId: "ugamngqq21u29de9qffog8lus0"
  }
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Reject anything without the shared key (blocks bots that never
    // loaded the actual page) and anything that filled in the hidden
    // honeypot field (blocks bots that fill in every field they see).
    if (String(data.key || "") !== SHARED_KEY || String(data.hp || "").length > 0) {
      return jsonOut({ success: false, message: "Unable to register. Please try again." });
    }

    if (isRateLimited()) {
      return jsonOut({ success: false, message: "Too many requests right now. Please try again in a few minutes." });
    }

    // WhatsApp interest form from the homepage: no calendar involved,
    // just email the organizer so no one's interest is ever missed.
    if (String(data.type || "") === "interest") {
      var iName = String(data.name || "").trim().slice(0, 120);
      var iPhone = String(data.whatsapp || "").replace(/[^0-9+]/g, "");
      var iRole = String(data.role || "").trim().slice(0, 200);
      if (!iName) {
        return jsonOut({ success: false, message: "Please provide your name." });
      }
      if (iPhone.replace(/\+/g, "").length < 8 || iPhone.length > 18) {
        return jsonOut({ success: false, message: "Please provide a valid WhatsApp number with country code." });
      }
      notifyInterest(iName, iPhone, iRole);
      return jsonOut({ success: true, message: "Thanks! We'll message you on WhatsApp." });
    }

    // Free account created on the website: email the organizer and send
    // the new member a welcome note. (Never include passwords.)
    if (String(data.type || "") === "signup") {
      var sName = String(data.name || "").trim().slice(0, 120);
      var sEmail = String(data.email || "").trim();
      var sCompany = String(data.company || "").trim().slice(0, 200);
      if (!sName || !isValidEmail(sEmail)) {
        return jsonOut({ success: false, message: "Invalid details." });
      }
      notifySignup(sName, sEmail, sCompany);
      return jsonOut({ success: true });
    }

    var sessionId = String(data.sessionId || "").trim();
    var name = String(data.name || "").trim();
    var email = String(data.email || "").trim();

    if (!sessionId || !SESSION_MAP.hasOwnProperty(sessionId)) {
      return jsonOut({ success: false, message: "Unable to register. Please try again." });
    }
    if (!name) {
      return jsonOut({ success: false, message: "Please provide your name." });
    }
    if (!isValidEmail(email)) {
      return jsonOut({ success: false, message: "Please provide a valid email address." });
    }

    var mapping = SESSION_MAP[sessionId];

    // Use the Calendar Advanced Service so we can send updates to guests.
    // Enable it first: Apps Script editor -> Services (+) -> Calendar API.
    var event = Calendar.Events.get(mapping.calendarId, mapping.eventId);

    var attendees = event.attendees || [];
    var already = attendees.some(function (a) {
      return a.email && a.email.toLowerCase() === email.toLowerCase();
    });

    if (already) {
      return jsonOut({
        success: true,
        alreadyRegistered: true,
        message: "You're already registered for this session. Please check your calendar."
      });
    }

    attendees.push({ email: email, displayName: name });
    event.attendees = attendees;

    Calendar.Events.patch(
      { attendees: attendees },
      mapping.calendarId,
      mapping.eventId,
      { sendUpdates: "all" }
    );

    notifyOrganizer(event, name, email);

    return jsonOut({ success: true, message: "Calendar invitation sent" });

  } catch (err) {
    return jsonOut({ success: false, message: "Unable to register. Please try again." });
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Emails you (the organizer) whenever someone successfully registers,
// since Google Calendar's own notification only goes to the guest.
// Wrapped in try/catch so a Gmail hiccup never breaks the registration
// itself -- the guest is already added to the calendar by this point.
function notifyOrganizer(event, name, email) {
  try {
    var title = event.summary || "AI Learning Circle session";
    var when = "";
    if (event.start) {
      var startVal = event.start.dateTime || event.start.date;
      if (startVal) when = new Date(startVal).toString();
    }
    var subject = "New registration: " + title;
    var body =
      "New sign-up for \"" + title + "\"" + (when ? " (" + when + ")" : "") + ".\n\n" +
      "Name: " + name + "\n" +
      "Email: " + email + "\n\n" +
      "They've been added as a guest and Google has emailed them the calendar invite automatically.";
    MailApp.sendEmail(ORGANIZER_EMAIL, subject, body);
  } catch (e) {
    // Notification failing should never block the registration.
  }
}

// Emails the organizer a new WhatsApp interest (name + number + role).
function notifyInterest(name, phone, role) {
  var digits = phone.replace(/[^0-9]/g, "");
  var body =
    "New WhatsApp interest from the AI Learning Circle website.\n\n" +
    "Name: " + name + "\n" +
    "WhatsApp: " + phone + "\n" +
    (role ? "Role / company: " + role + "\n" : "") +
    "\nOpen chat: https://wa.me/" + digits;
  MailApp.sendEmail(ORGANIZER_EMAIL, "New WhatsApp interest: " + name, body);
}

// New free account: tell the organizer, and welcome the member.
function notifySignup(name, email, company) {
  try {
    MailApp.sendEmail(ORGANIZER_EMAIL, "New free signup: " + name,
      "A new free account was created on the AI Learning Circle website.\n\n" +
      "Name: " + name + "\n" +
      "Email: " + email + "\n" +
      (company ? "Company: " + company + "\n" : "") +
      "\nTo make them a paid member after payment, set their role to 'member' in Supabase.");
  } catch (e) {}
  try {
    MailApp.sendEmail({
      to: email,
      subject: "Welcome to AI Learning Circle",
      body: "Hi " + name + ",\n\n" +
        "Thanks for creating your free AI Learning Circle account. " +
        "Please confirm your email using the separate confirmation message, then log in at https://ailearningcirclevp.github.io/login.html to see free AI tips.\n\n" +
        "Want the full Knowledge Library (use cases, starter kits, cheat sheets, prompt library)? " +
        "Message us on WhatsApp: https://wa.me/919566430848\n\n" +
        "AI Learning Circle",
      replyTo: "ailearningcirclevp@gmail.com"
    });
  } catch (e) {}
}

function isRateLimited() {
  var cache = CacheService.getScriptCache();
  var bucket = "alc_rl_" + Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  var current = Number(cache.get(bucket) || "0") + 1;
  cache.put(bucket, String(current), WINDOW_SECONDS);
  return current > MAX_PER_WINDOW;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
