/** Conservative local suggestion: only a labelled skills block, then user review. */
export function explicitResumeSkills(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => /^(?:technical |professional |core )?skills\s*[:：]?\s*$/i.test(line.trim()));
  if (start < 0) return [];
  const skills: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^(experience|work experience|employment|education|projects|certifications|awards|references|summary|interests|languages)\s*[:：]?$/i.test(line.trim())) break;
    for (const item of line.replace(/^[•*-]\s*/, "").split(/[,;|•]/)) {
      const name = item.trim();
      if (name && name.length <= 160 && !/@|\[REDACTED\]/.test(name)) skills.push(name);
    }
    if (skills.length >= 80) break;
  }
  return [...new Set(skills)].slice(0, 80);
}
