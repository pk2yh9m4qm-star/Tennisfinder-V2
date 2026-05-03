const { getEbusyAvailability } = require("../lib/ebusy");
const liveSources = require("../data/live-sources.json");

function getQuery(req) {
  if (req.query) return req.query;
  const url = new URL(req.url || "/", "https://tennisplatz-finder.local");
  return Object.fromEntries(url.searchParams.entries());
}

module.exports = async function handler(req, res) {
  const { source: sourceId, date } = getQuery(req);
  const source = liveSources.find((entry) => entry.id === sourceId);

  if (!source) {
    res.status(404).json({
      error: "source_not_found",
      message: `Unbekannte Quelle: ${sourceId}`,
    });
    return;
  }

  if (source.provider !== "ebusy") {
    res.status(400).json({
      error: "provider_not_supported",
      message: `Provider ${source.provider} wird noch nicht unterstuetzt`,
    });
    return;
  }

  try {
    const payload = await getEbusyAvailability(source.moduleUrl, date);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json({
      ...payload,
      sourceId: source.id,
      sourceName: source.name,
      courtType: source.courtType,
      venueId: source.venueId,
    });
  } catch (error) {
    res.status(500).json({
      error: "availability_fetch_failed",
      message: error.message,
    });
  }
};
