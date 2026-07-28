const leagues = ["epl", "laliga", "bundesliga", "seriea", "ligue1", "ucl", "europa", "euros", "fifa"];
const leagueEndpoints = [];
for (const l of leagues) {
  leagueEndpoints.push([`${l}standings`, `/football/${l}/standings`]);
  leagueEndpoints.push([`${l}scorers`, `/football/${l}/scorers`]);
  leagueEndpoints.push([`${l}matches`, `/football/${l}/matches`]);
  leagueEndpoints.push([`${l}upcoming`, `/football/${l}/upcoming`]);
}

module.exports = [
  ["sportslive", "/sports/live", ["category"]],
  ["sportsall", "/sports/all", ["category"]],
  // sportsstream: usage $sportsstream <source> | <id>  (both required)
  ["sportsstream", "/sports/stream", ["source", "id"]],
  ["sportscategories", "/sports/categories", []],
  ["predictions", "/football/predictions", []],
  ["livescore", "/football/livescore", []],
  ["livescore2", "/football/livescore2", []],
  ["basketballlive", "/football/basketball-live", []],
  // streaming commands
  ["streaming", "/football/streaming", ["query"]],
  ["streamingbasketball", "/football/streaming/basketball", []],
  ["streamingall", "/football/streaming/all", []],
  ["streamingleagues", "/football/streaming/leagues", []],
  ["footballnews", "/football/news", []],
  // search commands — API accepts both ?name= and ?query=; using query for consistency
  ["playersearch", "/football/player-search", ["query"]],
  ["playerid", "/football/player-id", ["id"]],
  ["teamsearch", "/football/team-search", ["query"]],
  ["venuesearch", "/football/venue-search", ["query"]],
  // gameevents: usage $gameevents Arsenal_vs_Chelsea
  ["gameevents", "/football/game-events", ["match"]],
  ["leagues", "/football/leagues", []],
  ["basketlivescore", "/basketball/livescore", []],
  ...leagueEndpoints,
].map(([name, path, params = []]) => ({ name, path, params, category: "SPORTS" }));
