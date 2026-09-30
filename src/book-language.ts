// Feed metadata takes precedence. Text detection is deliberately conservative:
// short or ambiguous titles stay unclassified instead of getting a wrong label.
export function inferBookLanguage(title: string, description = ''): string {
  const value = `${title} ${description}`.trim();
  if (!value) return '';
  if (/[\u3040-\u30ff]/u.test(value)) return 'ja';
  if (/[\uac00-\ud7af]/u.test(value)) return 'ko';
  if (/[ăđơưảạãấầẩẫậắằẳẵặẻẽẹếềểễệỉĩịỏõọốồổỗộớờởỡợủũụứừửữựỷỹỵ]/iu.test(value)) return 'vi';
  if (/[\u3400-\u9fff]/u.test(value)) {
    const han = value.match(/[\u3400-\u9fff]/gu)?.length || 0;
    return han >= 3 && han / [...value.replace(/\s/g, '')].length >= 0.6 ? 'zh' : '';
  }
  const words = value.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length < 3) return '';
  const english = new Set(['the','and','for','with','from','into','your','their','this','that','what','where','when','how','learn','learning','english','dictionary','readers','reader','level','book','books','story','stories','guide','picture']);
  const hits = new Set(words.filter(word => english.has(word)));
  return hits.size >= 2 ? 'en' : '';
}
