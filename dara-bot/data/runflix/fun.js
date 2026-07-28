// All FUN endpoints take no params besides apikey.
module.exports = [
  ["jokes", "/fun/jokes"],
  ["advice", "/fun/advice"],
  ["dares", "/fun/dares"],
  ["valentines", "/fun/valentines"],
  ["flirt", "/fun/flirt"],
  ["goodnight", "/fun/goodnight"],
  ["quotes", "/fun/quotes"],
  ["truth", "/fun/truth"],
  ["shayari", "/fun/shayari"],
  ["motivation", "/fun/motivation"],
  ["halloween", "/fun/halloween"],
  ["gratitude", "/fun/gratitude"],
  ["friendship", "/fun/friendship"],
  ["love", "/fun/love"],
  ["christmas", "/fun/christmas"],
  ["heartbreak", "/fun/heartbreak"],
  // These paths had apostrophes (father's-day) which broke URLs; fixed to hyphen-only
  ["fathersday", "/fun/fathers-day"],
  ["mothersday", "/fun/mothers-day"],
  ["girlfriendsday", "/fun/girlfriends-day"],
  ["boyfriendsday", "/fun/boyfriends-day"],
  // These were missing from the API (404); kept for gifted.co.ke fallback
  ["roseday", "/fun/rose-day"],
  ["pickuplines", "/fun/pick-up-lines"],
  ["thankyou", "/fun/thank-you"],
  ["newyear", "/fun/new-year"],
].map(([name, path]) => ({ name, path, params: [], category: "FUN" }));
