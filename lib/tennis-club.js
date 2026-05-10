const PUBLIC_API_KEY =
  "8a72264a15e492ea287c5cbd9fd7e93f29b66fde4e60b8a9w8er7awer8asd564";

function normalizeDateInput(dateText) {
  if (!dateText) return new Date();
  const parsed = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Ungueltiges Datum: ${dateText}`);
  }
  return parsed;
}

function formatDateForDisplay(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTimeWithOffset(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const offsetRestMinutes = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRestMinutes}`;
}

function parseLocalDateTime(value) {
  return new Date(value.replace(" ", "T"));
}

function timeTextToMinutes(value) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return (hours * 60) + minutes;
}

function minutesToTimeText(value) {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseMinuteMarks(raw) {
  if (!raw) return [0, 30];
  const marks = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part.replace(":", "")))
    .filter((part) => Number.isInteger(part) && part >= 0 && part < 60);

  return marks.length ? [...new Set(marks)].sort((left, right) => left - right) : [0, 30];
}

function parseDurations(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(timeTextToMinutes)
    .filter((value) => value > 0);
}

function buildOpenWindow(court, seasonSettings) {
  const start = timeTextToMinutes(court.zeit_von || seasonSettings.zeit_von);
  const end = timeTextToMinutes(court.zeit_bis || seasonSettings.zeit_bis);
  return { start, end };
}

function clampRange(start, end, min, max) {
  const clampedStart = Math.max(start, min);
  const clampedEnd = Math.min(end, max);
  if (clampedEnd <= clampedStart) return null;
  return { start: clampedStart, end: clampedEnd };
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged = [];

  sorted.forEach((range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      return;
    }

    previous.end = Math.max(previous.end, range.end);
  });

  return merged;
}

function subtractRanges(windowRange, occupiedRanges) {
  const freeRanges = [];
  let cursor = windowRange.start;

  occupiedRanges.forEach((range) => {
    if (range.start > cursor) {
      freeRanges.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  });

  if (cursor < windowRange.end) {
    freeRanges.push({ start: cursor, end: windowRange.end });
  }

  return freeRanges;
}

function minuteOfDayForDate(date) {
  return (date.getHours() * 60) + date.getMinutes();
}

function getFreeSlotsForCourt({ court, seasonSettings, bookings, date }) {
  const openWindow = buildOpenWindow(court, seasonSettings);
  const minimumDuration =
    Math.min(...parseDurations(court.zeitraeume || seasonSettings.zeitraeume)) || 60;
  const minuteMarks = parseMinuteMarks(court.buchungsintervalle);
  const occupied = mergeRanges(
    bookings
      .map((booking) => {
        const startDate = parseLocalDateTime(booking.start);
        const endDate = parseLocalDateTime(booking.end);
        return clampRange(
          minuteOfDayForDate(startDate),
          minuteOfDayForDate(endDate),
          openWindow.start,
          openWindow.end,
        );
      })
      .filter(Boolean),
  );

  const freeRanges = subtractRanges(openWindow, occupied);
  const slots = [];

  freeRanges.forEach((range) => {
    for (let start = range.start; start + minimumDuration <= range.end; start += 15) {
      if (!minuteMarks.includes(start % 60)) continue;

      slots.push({
        courtId: court.i,
        courtName: court.b,
        date: formatDateForDisplay(date),
        start: minutesToTimeText(start),
        end: minutesToTimeText(start + minimumDuration),
      });
    }
  });

  return slots;
}

async function apiRequest(path, data = {}) {
  const form = new FormData();
  form.set("apiKey", PUBLIC_API_KEY);

  Object.entries(data).forEach(([key, value]) => {
    form.set(key, String(value));
  });

  const response = await fetch(`https://apiv2.tennis-club.net/v2/${path}`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fuer ${path}`);
  }

  const payload = await response.json();
  if (payload?.meta?.code !== 100) {
    throw new Error(`Unerwartete API-Antwort fuer ${path}`);
  }

  return payload.data;
}

async function getTennisClubAvailability(source, dateText) {
  const date = normalizeDateInput(dateText);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);

  const [stammdaten, bookingsPayload] = await Promise.all([
    apiRequest("platzbuchung/stammdaten", { tvid: source.tvid, sprachcode: "de" }),
    apiRequest("platzbuchung/getBuchungen", {
      tvid: source.tvid,
      sprachcode: "de",
      start: formatDateTimeWithOffset(start),
      end: formatDateTimeWithOffset(end),
    }),
  ]);

  const requestedCourtIds = new Set(source.courtIds.map(String));
  const courts = stammdaten.plaetze.filter((court) => requestedCourtIds.has(String(court.i)));
  const bookings = bookingsPayload.events || [];

  const freeSlots = courts.flatMap((court) => {
    const seasonSettings = stammdaten.einstellungen[court.season];
    const courtBookings = bookings.filter((booking) =>
      Array.isArray(booking.resourceIds) && booking.resourceIds.map(String).includes(String(court.i)),
    );

    return getFreeSlotsForCourt({
      court,
      seasonSettings,
      bookings: courtBookings,
      date,
    });
  });

  return {
    source: "tennis_club",
    currentDate: formatDateForDisplay(date),
    moduleUrl: source.bookingUrl,
    bookingUrl: source.bookingUrl,
    courts: courts.map((court) => ({
      id: Number(court.i),
      name: court.b,
    })),
    reservationsCount: bookings.length,
    freeSlots,
  };
}

module.exports = {
  getTennisClubAvailability,
};
