/** Clean source text for display only. Stored wording remains the evidence. */
export function cleanDisplayText(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
    ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity: string) => {
    if (entity.startsWith("#")) {
      const point = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : original;
    }
    return entities[entity.toLowerCase()] ?? original;
  }).replace(/[\u200b\u00ad\ufeff]/g, "").replace(/\s+/g, " ").trim();
}

export function shortTaskLabel(value: string, max = 80): string {
  const text = cleanDisplayText(value).replace(/[;\s]+$/, "");
  if (text.length <= max) return text;
  const shortened = text.slice(0, max - 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${lastSpace > max / 2 ? shortened.slice(0, lastSpace) : shortened}…`;
}

export function goalDisplayLabel(value: string, skillLabel?: string): string {
  const text = cleanDisplayText(value);
  const skill = skillLabel ? cleanDisplayText(skillLabel) : "";
  // Only shorten the app's default label. Keep a user's edited goal wording.
  return skill && text === `Develop ${skill}` ? skill[0].toUpperCase() + skill.slice(1) : text;
}

export function cleanMultilineDisplayText(value: string): string {
  return value.split(/\r?\n/).map(cleanDisplayText).join("\n").trim();
}
