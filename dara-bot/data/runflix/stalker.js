module.exports = [
  ["gitstalk", "/stalk/gitstalk", ["username"]],
  ["twitterstalk", "/stalk/twitterstalk", ["username"]],
  ["wachannel", "/stalk/wachannel", ["url"]],
  ["ipstalk", "/stalk/ipstalk", ["address"]],
  ["npmstalk", "/stalk/npmstalk", ["packagename"]],
  ["tiktokstalk", "/stalk/tiktokstalk", ["username"]],
  ["igstalk", "/stalk/igstalk", ["username"]],
].map(([name, path, params]) => ({ name, path, params, category: "STALKER" }));
