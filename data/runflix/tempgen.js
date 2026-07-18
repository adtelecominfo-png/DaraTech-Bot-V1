module.exports = [
  // v1 flow: generate → get email, then use email for inbox/message/delete
  ["tempmailgen", "/tempgen/v1/generate", []],
  ["tempmailinbox", "/tempgen/v1/inbox", ["email"]],
  ["tempmailmsg", "/tempgen/v1/message", ["email", "messageid"]],
  ["tempmaildelete", "/tempgen/v1/delete", ["email", "messageid"]],
  // v2 flow (Gmail-based)
  ["tempmail2gen", "/tempgen/v2/generate", ["mode"]],
  ["tempmail2inbox", "/tempgen/v2/inbox", ["email"]],
  // SMS temp number
  ["tempsmsgen", "/tempgen/sms/generate", ["country"]],
  ["tempsmsinbox", "/tempgen/sms/inbox", ["number"]],
].map(([name, path, params]) => ({ name, path, params, category: "TEMPGEN" }));
