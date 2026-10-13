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
      var sWa = data.whatsappOptIn === true;
      notifySignup(sName, sEmail, sCompany, sWa);
      logRegistrant(sName, sEmail, "website signup", "", sWa);
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
    logRegistrant(name, email, "session registration", event.summary || sessionId, data.whatsappOptIn === true);
    sendWelcomeEmail(name, email, { hasAccount: data.accountCreated === true, session: event.summary || "" });

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
function notifySignup(name, email, company, whatsappOptIn) {
  try {
    MailApp.sendEmail(ORGANIZER_EMAIL, "New free signup: " + name,
      "A new free account was created on the AI Learning Circle website.\n\n" +
      "Name: " + name + "\n" +
      "Email: " + email + "\n" +
      (company ? "Company: " + company + "\n" : "") +
      (whatsappOptIn ? "WhatsApp community: they ticked the box, please add them\n" : "") +
      "\nTo make them a paid member after payment, set their role to 'member' in Supabase.");
  } catch (e) {}
  sendWelcomeEmail(name, email, { hasAccount: true });
}

// Welcome / introduction email. Sent to EVERYONE new: people who create a
// free account and people who only register for a session. Each email address
// gets it once (so a session registration followed by a signup does not send
// two). opts: { hasAccount: bool, session: "session title" }
function sendWelcomeEmail(name, email, opts) {
  opts = opts || {};
  try {
    var props = PropertiesService.getScriptProperties();
    var key = "welcomed_" + String(email).toLowerCase();
    if (props.getProperty(key)) return;
    props.setProperty(key, "1");

    var SITE = "https://ailearningcirclevp.github.io/";
    var WA_NUMBER = "+91 95664 30848";
    var WA_JOIN = "https://wa.me/919566430848?text=" + encodeURIComponent("Hi! I am interested in the community and would like to join the sessions. Could you share me details of it.");
    var WA_MEMBER = "https://wa.me/919566430848?text=" + encodeURIComponent("I would like to subscribe for the 6 months membership. Kindly share me payment details");
    var CONTACT_EMAIL = "ailearningcirclevp@gmail.com";
    var first = String(name || "").split(" ")[0] || "there";
    var link = function (href, label) {
      return '<a href="' + href + '" style="color:#1d3a6e;text-decoration:underline;">' + label + '</a>';
    };
    var h = function (t) { return '<p style="margin:22px 0 4px;"><b>' + t + '</b></p>'; };

    var intro = opts.session
      ? 'Thank you for registering for <b>' + opts.session + '</b>. A Google Calendar invitation is on its way separately; please accept it so the session is in your calendar.'
      : 'Thank you for joining AI Learning Circle.';
    var accountLine = opts.hasAccount
      ? 'Your free account has been created. Please confirm your email address using the separate confirmation message we sent, then ' + link(SITE + 'login.html', 'log in') + '.'
      : 'You can also create a free account at any time at ' + link(SITE + 'signup.html', 'our sign-up page') + ' to read free AI tips.';

    var html =
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;font-size:15px;line-height:1.6;">' +
      '<p>Hi ' + first + ',</p>' +
      '<p>' + intro + ' ' + accountLine + '</p>' +
      h('What AI Learning Circle is') +
      '<p style="margin:0;">A live learning community for finance and business professionals who want to use AI in real work. Each session takes one practical use case from a messy starting point to a usable result, using tools such as ChatGPT, Claude and Microsoft Copilot.</p>' +
      h('Join the WhatsApp community') +
      '<p style="margin:0;">Session reminders and updates are shared on WhatsApp. ' + link(WA_JOIN, 'Message us on WhatsApp') + ' and we will add you.</p>' +
      h('Upcoming sessions') +
      '<p style="margin:0;">' + link(SITE + '#calendar', 'View the session calendar') + ' and add any session to your calendar. Sessions are free to attend.</p>' +
      h('Membership') +
      '<p style="margin:0 0 6px;">Members get the Knowledge Library. For every session it includes the use case practice materials, a How-To &amp; Prompt Guide (steps, prompts and Copilot instructions) and the Session Recording. Pay once for the whole period; there are no monthly charges.</p>' +
      '<p style="margin:0 0 6px;"><b>&#8377;2,600 for 6 months</b>, one-time payment.</p>' +
      '<p style="margin:8px 0 0;">' + link(WA_MEMBER, 'Subscribe on WhatsApp') + ' or ' + link(SITE + '#membership', 'see membership details') + '.</p>' +
      h('Questions') +
      '<p style="margin:0;">WhatsApp ' + WA_NUMBER + ' or email ' + link('mailto:' + CONTACT_EMAIL, CONTACT_EMAIL) + '. You can also just reply to this email.</p>' +
      '<p style="margin:24px 0 0;">Regards,<br>AI Learning Circle</p>' +
      '</div>';

    var text =
      "Hi " + first + ",\n\n" +
      (opts.session
        ? "Thank you for registering for " + opts.session + ". A Google Calendar invitation is on its way separately; please accept it. "
        : "Thank you for joining AI Learning Circle. ") +
      (opts.hasAccount
        ? "Your free account has been created. Please confirm your email address using the separate confirmation message, then log in: " + SITE + "login.html"
        : "You can also create a free account any time: " + SITE + "signup.html") + "\n\n" +
      "WHAT AI LEARNING CIRCLE IS\n" +
      "A live learning community for finance and business professionals who want to use AI in real work. Each session takes one practical use case from a messy starting point to a usable result, using tools such as ChatGPT, Claude and Microsoft Copilot.\n\n" +
      "JOIN THE WHATSAPP COMMUNITY\nSession reminders and updates are shared on WhatsApp. Message us and we will add you: " + WA_JOIN + "\n\n" +
      "UPCOMING SESSIONS\nSession calendar: " + SITE + "#calendar (sessions are free to attend)\n\n" +
      "MEMBERSHIP\n" +
      "Members get the Knowledge Library. For every session: use case practice materials, a How-To & Prompt Guide (steps, prompts and Copilot instructions) and the Session Recording. Pay once for the whole period; no monthly charges.\n" +
      "Rs 2,600 for 6 months, one-time payment.\n" +
      "Subscribe on WhatsApp: " + WA_MEMBER + "\nDetails: " + SITE + "#membership\n\n" +
      "QUESTIONS\nWhatsApp " + WA_NUMBER + " or email " + CONTACT_EMAIL + ". You can also reply to this email.\n\n" +
      "Regards,\nAI Learning Circle";

    MailApp.sendEmail({
      to: email,
      subject: "Welcome to AI Learning Circle",
      body: text,
      htmlBody: html,
      name: "AI Learning Circle",
      replyTo: CONTACT_EMAIL
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


// ---------------------------------------------------------------
// Email reminders: about 2 hours before each session, every guest
// on the calendar event gets a short reminder with the join link.
//
// ONE-TIME SETUP: in the Apps Script editor pick "setupReminderTrigger"
// in the function dropdown and press Run (approve the permissions).
// That creates a timer that checks every 15 minutes. Each guest is
// reminded only once per session.
// ---------------------------------------------------------------
const REMINDER_HOURS_BEFORE = 2;

function setupReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendSessionReminders") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendSessionReminders").timeBased().everyMinutes(15).create();
}

function sendSessionReminders() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date().getTime();
  Object.keys(SESSION_MAP).forEach(function (id) {
    try {
      var m = SESSION_MAP[id];
      var ev = Calendar.Events.get(m.calendarId, m.eventId);
      if (!ev || ev.status === "cancelled" || !ev.start || !ev.start.dateTime) return;
      var start = new Date(ev.start.dateTime).getTime();
      var minsToStart = (start - now) / 60000;
      // Send once, when the session is between 0 and ~2h15m away.
      if (minsToStart <= 0 || minsToStart > REMINDER_HOURS_BEFORE * 60 + 15) return;
      var key = "reminded_" + m.eventId + "_" + ev.start.dateTime;
      if (props.getProperty(key)) return;

      var link = ev.hangoutLink || "";
      if (!link && ev.conferenceData && ev.conferenceData.entryPoints) {
        ev.conferenceData.entryPoints.forEach(function (p) { if (!link && p.uri) link = p.uri; });
      }
      if (!link) link = ev.htmlLink || "";
      var tz = ev.start.timeZone || Session.getScriptTimeZone();
      var when = Utilities.formatDate(new Date(start), tz, "EEEE d MMM, HH:mm") + " (" + tz + ")";
      var title = ev.summary || "AI Learning Circle session";

      (ev.attendees || []).forEach(function (a) {
        if (!a.email || a.responseStatus === "declined" || a.resource) return;
        var first = String(a.displayName || "").split(" ")[0] || "there";
        var text =
          "Hi " + first + ",\n\n" +
          "A quick reminder that your AI Learning Circle session starts soon.\n\n" +
          title + "\n" + when + "\n\n" +
          "Join here: " + link + "\n\n" +
          "See you there.\nAI Learning Circle";
        var html =
          '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#222;font-size:15px;line-height:1.6;">' +
          '<p>Hi ' + first + ',</p>' +
          '<p>A quick reminder that your AI Learning Circle session starts soon.</p>' +
          '<p><b>' + title + '</b><br>' + when + '</p>' +
          '<p><a href="' + link + '" style="color:#1d3a6e;text-decoration:underline;">Join the session</a></p>' +
          '<p style="margin:0;">See you there.<br>AI Learning Circle</p></div>';
        try {
          MailApp.sendEmail({
            to: a.email,
            subject: "Reminder: " + title + " starts in about 2 hours",
            body: text, htmlBody: html,
            name: "AI Learning Circle", replyTo: "ailearningcirclevp@gmail.com"
          });
        } catch (e) {}
      });
      props.setProperty(key, "1");
    } catch (err) {}
  });
}


// ---------------------------------------------------------------
// Registrations sheet: every sign-up and session registration is
// saved as a row in a private Google Sheet in YOUR Google Drive
// ("AI Learning Circle - Registrations"), created automatically the
// first time it is needed. Only you can open it unless you share it.
// ---------------------------------------------------------------
function getRegistrationsSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("REGISTRATIONS_SHEET_ID");
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create("AI Learning Circle - Registrations");
    props.setProperty("REGISTRATIONS_SHEET_ID", ss.getId());
    ss.getSheets()[0].setName("Registrations");
    ss.getSheets()[0].appendRow(["Date", "Name", "Email", "Source", "Session", "WhatsApp community requested"]);
    ss.getSheets()[0].setFrozenRows(1);
  }
  return ss.getSheets()[0];
}

function logRegistrant(name, email, source, session, whatsappOptIn) {
  try {
    var sh = getRegistrationsSheet();
    sh.appendRow([new Date(), name, email, source, session || "", whatsappOptIn ? "Yes" : "No"]);
  } catch (e) {}
}

// ONE-TIME: run this by hand (function dropdown -> exportCalendarGuests -> Run)
// to copy everyone who is already a guest on your session events into the
// sheet. Safe to run again: it skips emails already listed for that session.
function exportCalendarGuests() {
  var sh = getRegistrationsSheet();
  var seen = {};
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) { seen[String(rows[i][2]).toLowerCase() + "|" + rows[i][4]] = true; }
  var added = 0;
  Object.keys(SESSION_MAP).forEach(function (id) {
    try {
      var m = SESSION_MAP[id];
      var ev = Calendar.Events.get(m.calendarId, m.eventId);
      (ev.attendees || []).forEach(function (a) {
        if (!a.email || a.organizer || a.self || a.resource) return;
        var title = ev.summary || id;
        var key = a.email.toLowerCase() + "|" + title;
        if (seen[key]) return;
        seen[key] = true;
        sh.appendRow([new Date(), a.displayName || "", a.email, "calendar guest (export)", title, "Unknown"]);
        added++;
      });
    } catch (e) {}
  });
  Logger.log("Added " + added + " guests. Sheet: " + sh.getParent().getUrl());
}
