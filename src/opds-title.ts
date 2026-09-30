// Keep original source titles intact; only the library's displayed titles are changed.
export function stripOpdsTitlePrefixes(title: string): string {
  const cleaned = title.replace(/^(?:\s*\[[^\]\r\n]{1,100}\]\s*)+/u, '').trim();
  return cleaned || title;
}
