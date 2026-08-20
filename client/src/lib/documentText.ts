export function normalizeExtractedText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, all) => line || (index > 0 && Boolean(all[index - 1])))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countDocumentWords(value: string) {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}
