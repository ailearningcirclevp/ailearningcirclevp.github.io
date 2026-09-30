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
const ORGANIZER_EMAIL = "ailearningcirclevp@gmail.com";

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
