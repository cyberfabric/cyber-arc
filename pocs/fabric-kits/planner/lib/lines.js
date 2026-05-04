function countLines(text) {
  if (!text) return 0;
  const newlineCount = (text.match(/\n/g) || []).length;
  return text.endsWith("\n") ? newlineCount : newlineCount + 1;
}

module.exports = {
  countLines,
};
