const searchDateInput = document.querySelector("#search-date");
const searchButton = document.querySelector("#search-button");
const outdoorToggle = document.querySelector("#toggle-outdoor");
const indoorToggle = document.querySelector("#toggle-indoor");
const sourceCount = document.querySelector("#source-count");
const sourceChips = document.querySelector("#source-chips");
const timeFilterRow = document.querySelector("#time-filter-row");
const searchHelper = document.querySelector("#search-helper");
const runtimeWarning = document.querySelector("#runtime-warning");
const loadingOverlay = document.querySelector("#loading-overlay");
const resultsStage = document.querySelector("#results");
const resultsCount = document.querySelector("#results-count");
const resultsSummary = document.querySelector("#results-summary");
const resultList = document.querySelector("#result-list");
const listSummary = document.querySelector("#list-summary");
const resultRowTemplate = document.querySelector("#result-row-template");

const MIN_LOADING_MS = 900;
const SOURCE_TIMEOUT_MS = 16000;
const TIME_FILTERS = [
  { id: "before-work", label: "Vor der Arbeit", start: "07:00", end: "09:00" },
  { id: "morning", label: "Vormittags", start: "07:00", end: "11:00" },
  { id: "midday", label: "Mittags", start: "11:00", end: "15:00" },
  { id: "afternoon", label: "Nachmittags", start: "15:00", end: "18:00" },
  { id: "after-work", label: "Nach der Arbeit", start: "16:00", end: "19:00" },
  { id: "evening", label: "Abends", start: "18:00", end: "22:00" },
  { id: "late", label: "Spaetabends", start: "19:00", end: "22:00" },
];

const uiState = {
  selectedCourtTypes: new Set(["outdoor", "indoor"]),
  selectedSourceIds: new Set(),
  selectedTimeFilterIds: new Set(),
  isSearching: false,
  hasSearched: false,
};

let venues = [];
let liveSources = [];

function formatCourtTypeLabel(type) {
  if (type === "indoor") return "Drinnen";
  if (type === "outdoor") return "Draussen";
  return "Gemischt";
}

function formatSourceChipLabel(source) {
  return source.name
    .replace("Tennispark Stuttgart Outdoor", "Tennispark")
    .replace("TC Degerloch Halle", "Degerloch Halle")
    .replace("TC Degerloch Freiplaetze", "Degerloch Frei");
}

function sortResults(left, right) {
  const leftKey = `${left.dateIso}T${left.start}:00`;
  const rightKey = `${right.dateIso}T${right.start}:00`;

  if (leftKey !== rightKey) {
    return leftKey.localeCompare(rightKey);
  }

  const venueCompare = left.venueName.localeCompare(right.venueName);
  if (venueCompare !== 0) return venueCompare;

  return left.courtName.localeCompare(right.courtName);
}

function courtTypeMatchesSelection(sourceCourtType, selectedTypes) {
  if (sourceCourtType === "indoor_and_outdoor") {
    return selectedTypes.has("indoor") || selectedTypes.has("outdoor");
  }

  return selectedTypes.has(sourceCourtType);
}

function toggleCourtType(type) {
  if (uiState.selectedCourtTypes.has(type)) {
    uiState.selectedCourtTypes.delete(type);
  } else {
    uiState.selectedCourtTypes.add(type);
  }

  renderToggleState();
}

function renderToggleState() {
  const outdoorActive = uiState.selectedCourtTypes.has("outdoor");
  const indoorActive = uiState.selectedCourtTypes.has("indoor");
  const selectedCount = uiState.selectedCourtTypes.size;
  const selectedSourceCount = uiState.selectedSourceIds.size;

  outdoorToggle.classList.toggle("is-active", outdoorActive);
  outdoorToggle.setAttribute("aria-pressed", String(outdoorActive));

  indoorToggle.classList.toggle("is-active", indoorActive);
  indoorToggle.setAttribute("aria-pressed", String(indoorActive));

  searchButton.disabled = selectedCount === 0 || selectedSourceCount === 0 || uiState.isSearching;

  if (selectedSourceCount === 0) {
    searchHelper.textContent = "Keine Quelle ausgewaehlt.";
  } else if (selectedCount === 2) {
    searchHelper.textContent = "Alle Quellen aktiv.";
  } else if (outdoorActive) {
    searchHelper.textContent = "Nur draussen.";
  } else if (indoorActive) {
    searchHelper.textContent = "Nur drinnen.";
  } else {
    searchHelper.textContent = "Kein Platztyp ausgewaehlt.";
  }
}

function renderSourceChips(data) {
  sourceCount.textContent = String(data.length);
  sourceChips.innerHTML = "";

  data.forEach((source) => {
    const chip = document.createElement("button");
    const isActive = uiState.selectedSourceIds.has(source.id);
    chip.className = "source-chip";
    chip.classList.toggle("is-active", isActive);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(isActive));
    chip.textContent = formatSourceChipLabel(source);
    chip.addEventListener("click", () => {
      if (uiState.selectedSourceIds.has(source.id)) {
        uiState.selectedSourceIds.delete(source.id);
      } else {
        uiState.selectedSourceIds.add(source.id);
      }
      renderSourceChips(liveSources);
      renderToggleState();
    });
    sourceChips.append(chip);
  });
}

function renderTimeFilterChips() {
  timeFilterRow.innerHTML = "";

  TIME_FILTERS.forEach((filter) => {
    const chip = document.createElement("button");
    const isActive = uiState.selectedTimeFilterIds.has(filter.id);
    chip.className = "time-chip";
    chip.classList.toggle("is-active", isActive);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(isActive));
    chip.textContent = filter.label;
    chip.title = `${filter.start} bis ${filter.end}`;
    chip.addEventListener("click", () => {
      if (uiState.selectedTimeFilterIds.has(filter.id)) {
        uiState.selectedTimeFilterIds.delete(filter.id);
      } else {
        uiState.selectedTimeFilterIds.add(filter.id);
      }
      renderTimeFilterChips();
    });
    timeFilterRow.append(chip);
  });
}

function findVenueById(venueId) {
  return venues.find((venue) => venue.id === venueId);
}

function normalizeResults(payloads) {
  return payloads.flatMap((payload) => {
    const venue = findVenueById(payload.venueId);
    const bookingUrl = venue?.bookingUrl || payload.moduleUrl || "#";
    const city = venue?.city || "Stuttgart";
    const district = venue?.district || "Umgebung";
    const groupedCount = payload.freeSlots.length;

    return payload.freeSlots.map((slot) => ({
      sourceId: payload.sourceId,
      sourceName: payload.sourceName,
      courtType: payload.courtType,
      venueName: venue?.name || payload.sourceName,
      courtName: slot.courtName,
      bookingUrl,
      city,
      district,
      date: payload.currentDate,
      dateIso: slot.date.split("/").reverse().join("-"),
      start: slot.start,
      end: slot.end,
      availableCountForSource: groupedCount,
    }));
  });
}

function getSelectedTimeFilters() {
  return TIME_FILTERS.filter((filter) => uiState.selectedTimeFilterIds.has(filter.id));
}

function slotMatchesTimeFilters(result) {
  const selectedFilters = getSelectedTimeFilters();
  if (!selectedFilters.length) return true;

  return selectedFilters.some((filter) => result.start >= filter.start && result.start < filter.end);
}

function courtTypeIcon(type) {
  if (type === "indoor") {
    return `<img src="./assets/tennis-indoor.png" alt="Drinnen" />`;
  }

  return `<img src="./assets/tennis-outdoor.png" alt="Draussen" />`;
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json();
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function renderResultRows(results) {
  resultList.innerHTML = "";

  if (!results.length) {
    resultList.innerHTML = `
      <div class="empty-state">
        Gerade nichts Passendes gefunden. Versuch drinnen oder einen anderen Zeitpunkt.
      </div>
    `;
    listSummary.textContent = "Keine weiteren Slots.";
    return;
  }

  listSummary.textContent = `${results.length} weitere`;

  results.forEach((result) => {
    const fragment = resultRowTemplate.content.cloneNode(true);
    fragment.querySelector(".result-row-time").textContent = `${result.start}-${result.end}`;
    fragment.querySelector(".result-row-venue").textContent = result.venueName;
    fragment.querySelector(".result-row-detail").textContent =
      `${result.courtName} · ${result.city} · ${result.district}`;
    fragment.querySelector(".result-row-type").innerHTML = courtTypeIcon(result.courtType);
    fragment.querySelector(".result-link-inline").href = result.bookingUrl;
    resultList.append(fragment);
  });
}

function renderSearchResults(results, meta) {
  const sortedResults = [...results].filter(slotMatchesTimeFilters).sort(sortResults);

  resultsCount.textContent = String(sortedResults.length);

  if (meta.loadedSources === 0 && meta.failedSources.length > 0) {
    resultsSummary.textContent = "";
    resultList.innerHTML = `
      <div class="empty-state">
        Die angebundenen Buchungsquellen sind im Moment aus dieser lokalen Umgebung nicht erreichbar.
        Bitte versuch es gleich noch einmal. Dein Filter war korrekt, aber die Live-Daten kamen nicht durch.
      </div>
    `;
    listSummary.textContent = "Keine Live-Daten.";
    return;
  }

  if (!sortedResults.length) {
    resultsSummary.textContent = "";
    renderResultRows([]);
    return;
  }

  resultsSummary.textContent = "";

  renderResultRows(sortedResults);
}

function setSearchingState(isSearching) {
  uiState.isSearching = isSearching;
  loadingOverlay.hidden = !isSearching;
  renderToggleState();
}

function renderResultsStageVisibility() {
  resultsStage.classList.toggle("is-hidden", !uiState.hasSearched);
}

function getSelectedSources() {
  return liveSources.filter((source) =>
    uiState.selectedSourceIds.has(source.id) &&
    courtTypeMatchesSelection(source.courtType, uiState.selectedCourtTypes),
  );
}

async function searchAvailability() {
  const date = searchDateInput.value;
  const selectedSources = getSelectedSources();

  uiState.hasSearched = true;
  renderResultsStageVisibility();

  if (window.location.protocol === "file:") {
    resultsCount.textContent = "0";
    resultsSummary.textContent =
      "Die Seite ist gerade als lokale Datei geoeffnet. Fuer Live-Ergebnisse muss die App ueber den lokalen Server laufen.";
    resultList.innerHTML = `
      <div class="empty-state">
        Bitte oeffne die App ueber <strong>http://127.0.0.1:4173</strong> statt ueber <strong>file://</strong>.
        Nur dort sind die Live-API-Endpunkte erreichbar.
      </div>
    `;
    listSummary.textContent = "Live-Suche nur ueber den lokalen Server.";
    return;
  }

  if (!selectedSources.length) {
    resultsSummary.textContent = "Waehle mindestens eine Quelle und einen Platztyp fuer die Suche.";
    return;
  }

  setSearchingState(true);

  try {
    const startTime = Date.now();
    const requests = selectedSources.map(async (source) => {
      const { response, payload } = await fetchJsonWithTimeout(
        `/api/availability?source=${encodeURIComponent(source.id)}&date=${encodeURIComponent(date)}`,
        SOURCE_TIMEOUT_MS,
      );
      if (!response.ok) {
        throw new Error(payload.message || `Fehler in ${source.name}`);
      }
      return { ...payload, moduleUrl: source.moduleUrl };
    });

    const settled = await Promise.allSettled(requests);
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_LOADING_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
    }

    const successfulPayloads = settled
      .filter((entry) => entry.status === "fulfilled")
      .map((entry) => entry.value);

    const failedSources = settled
      .map((entry, index) => ({ entry, source: selectedSources[index] }))
      .filter(({ entry }) => entry.status === "rejected")
      .map(({ source }) => source.name);

    const normalizedResults = normalizeResults(successfulPayloads);
    renderSearchResults(normalizedResults, {
      dateLabel: date,
      loadedSources: successfulPayloads.length,
      failedSources,
    });
  } catch (error) {
    resultsCount.textContent = "0";
    resultsSummary.textContent = `Die Suche ist fehlgeschlagen: ${error.message}`;
    resultList.innerHTML = `
      <div class="empty-state">
        Die Suche konnte gerade nicht abgeschlossen werden. Bitte versuch es gleich noch einmal.
      </div>
    `;
    listSummary.textContent = "Suche fehlgeschlagen.";
  } finally {
    setSearchingState(false);
    resultsStage.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function registerInteractions() {
  outdoorToggle.addEventListener("click", () => toggleCourtType("outdoor"));
  indoorToggle.addEventListener("click", () => toggleCourtType("indoor"));
  searchButton.addEventListener("click", searchAvailability);
}

async function init() {
  const [venuesResponse, liveSourcesResponse] = await Promise.all([
    fetch("./data/venues.seed.json"),
    fetch("./data/live-sources.json"),
  ]);

  venues = await venuesResponse.json();
  liveSources = await liveSourcesResponse.json();
  uiState.selectedSourceIds = new Set(liveSources.map((source) => source.id));

  searchDateInput.value = new Date().toISOString().slice(0, 10);
  renderSourceChips(liveSources);
  renderTimeFilterChips();
  registerInteractions();
  renderToggleState();
  renderResultsStageVisibility();

  if (window.location.protocol === "file:") {
    runtimeWarning.classList.remove("is-hidden");
    runtimeWarning.textContent =
      "Die App ist gerade als Datei geoeffnet. Fuer echte Live-Ergebnisse musst du sie ueber http://127.0.0.1:4173 aufrufen.";
  }
}

init().catch((error) => {
  resultsSummary.textContent = `Die App konnte nicht initialisiert werden: ${error.message}`;
  resultList.innerHTML = `
    <div class="empty-state">
      Die Suchoberflaeche konnte nicht geladen werden. Bitte Seite neu laden.
    </div>
  `;
});
