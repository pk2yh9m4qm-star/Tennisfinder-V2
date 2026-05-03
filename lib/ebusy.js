const EBUSY_AJAX_HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json, text/javascript, */*; q=0.01",
};

function formatDateForEbusy(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${year}`;
}

function normalizeDateInput(dateText) {
  if (!dateText) return new Date();
  const parsed = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Ungueltiges Datum: ${dateText}`);
  }
  return parsed;
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseCourtsFromHtml(html) {
  const courtRegex =
    /<th class="court[^"]*" data-id="(\d+)">([\s\S]*?)<\/th>/g;
  const courts = [];
  let match;

  while ((match = courtRegex.exec(html))) {
    const id = Number(match[1]);
    const raw = match[2];
    const desktopMatch = raw.match(
      /<span class="desktop-view-only">\s*([\s\S]*?)\s*<\/span>/,
    );
    const name = stripTags(desktopMatch ? desktopMatch[1] : raw);
    courts.push({ id, name });
  }

  return courts;
}

function parseSlotsFromHtml(html) {
  const slotRegex = /<td\b([^>]*)>/g;
  const slots = [];
  let match;

  while ((match = slotRegex.exec(html))) {
    const attrs = match[1];
    const classMatch = attrs.match(/class="([^"]*)"/);
    const classes = classMatch ? classMatch[1] : "";

    if (!classes.includes("slot")) {
      continue;
    }

    const courtMatch = attrs.match(/data-court="(\d+)"/);
    const startMatch = attrs.match(/data-major-begin="(\d{2}:\d{2})"/);
    const endMatch = attrs.match(/data-major-end="(\d{2}:\d{2})"/);
    const dateMatch = attrs.match(/data-date="(\d{2}\/\d{2}\/\d{4})"/);

    if (!courtMatch || !startMatch || !endMatch || !dateMatch) {
      continue;
    }

    const courtId = Number(courtMatch[1]);
    const start = startMatch[1];
    const end = endMatch[1];
    const date = dateMatch[1];

    slots.push({
      courtId,
      date,
      start,
      end,
      isPast: classes.includes("past-time"),
    });
  }

  return slots;
}

function overlapsReservation(slot, reservation) {
  if (slot.courtId !== reservation.court) return false;
  if (slot.date !== reservation.date) return false;
  return slot.start >= reservation.fromTime && slot.end <= reservation.toTime;
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 14000);

  try {
    const response = await fetch(url, {
      headers: options.headers || {},
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fuer ${url}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}) {
  const raw = await fetchText(url, options);
  return JSON.parse(raw);
}

async function getEbusyAvailability(moduleUrl, dateText) {
  const base = new URL(moduleUrl);
  const date = normalizeDateInput(dateText);
  const currentDate = formatDateForEbusy(date);

  const htmlUrl = new URL(base.toString());
  htmlUrl.searchParams.set("currentDate", currentDate);

  const jsonUrl = new URL(base.toString());
  jsonUrl.searchParams.set("currentDate", currentDate);

  const [html, bookings] = await Promise.all([
    fetchText(htmlUrl, { headers: { Accept: "text/html,application/xhtml+xml" } }),
    fetchJson(jsonUrl, { headers: EBUSY_AJAX_HEADERS }),
  ]);

  const courts = parseCourtsFromHtml(html);
  const slots = parseSlotsFromHtml(html);

  const reservations = Array.isArray(bookings.reservations)
    ? bookings.reservations
    : [];

  const freeSlots = slots
    .filter((slot) => !slot.isPast)
    .filter((slot) => !reservations.some((reservation) => overlapsReservation(slot, reservation)))
    .map((slot) => {
      const court = courts.find((item) => item.id === slot.courtId);
      return {
        courtId: slot.courtId,
        courtName: court ? court.name : `Court ${slot.courtId}`,
        date: slot.date,
        start: slot.start,
        end: slot.end,
      };
    });

  return {
    source: "ebusy",
    moduleUrl,
    currentDate,
    courts,
    reservationsCount: reservations.length,
    freeSlots,
  };
}

module.exports = {
  getEbusyAvailability,
  formatDateForEbusy,
  normalizeDateInput,
};
