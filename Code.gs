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

const SESSION_MAP = {
  "presentation-ai-01": {
    calendarId: "primary",
    eventId: "PUT_GOOGLE_EVENT_ID_HERE"
  },
  "financial-modelling-01": {
    calendarId: "primary",
    eventId: "PUT_GOOGLE_EVENT_ID_HERE"
  },
  "prompt-context-01": {
    calendarId: "primary",
    eventId: "PUT_GOOGLE_EVENT_ID_HERE"
  },
  "budgeting-forecasting-01": {
    calendarId: "primary",
    eventId: "PUT_GOOGLE_EVENT_ID_HERE"
  },
  "website-ai-01": {
    calendarId: "primary",
    eventId: "PUT_GOOGLE_EVENT_ID_HERE"
  }
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
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

    return jsonOut({ success: true, message: "Calendar invitation sent" });

  } catch (err) {
    return jsonOut({ success: false, message: "Unable to register. Please try again." });
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
