const liveSources = require("../data/live-sources.json");

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(liveSources);
};
