export type Section = { title: string; line: number; labels: string[] };

// Only explicit headings become sections; ordinary explanatory comments stay comments.
export function extractSections(source: string): Section[] {
  const sections: Section[] = [];
  for (const [index, line] of source.split("\n").entries()) {
    const heading = line.match(/^\s*%%\s*(\d+[.)、]\s*.+|#{1,6}\s+.+)$/);
    if (heading) {
      sections.push({
        title: heading[1].replace(/^#+\s*/, ""),
        line: index + 1,
        labels: [],
      });
      continue;
    }
    if (!sections.length || /^\s*%%/.test(line)) continue;
    // Message/note labels, and the visible labels of sequence control blocks.
    const label =
      line.match(
        /^\s*(?:Note\s+(?:over|left of|right of)\s+[^:]+|\S+\s*[-<][^:]*[>x)\]]\s*[^:]*):\s*(.+)$/i,
      )?.[1] ??
      line.match(
        /^\s*(?:loop|alt|else|opt|par|and|critical|option|break|rect)\s+(.+)$/i,
      )?.[1];
    if (label) sections[sections.length - 1].labels.push(label);
  }
  return sections;
}

export function normalizeLabel(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

// Consume the whole preceding section, not just its first message. Repeated
// labels in different stages then resolve to their own occurrence.
export function linkSections<T extends { normalized: string; y: number }>(
  sections: Section[],
  entries: T[],
) {
  let previousY = -Infinity;
  return sections.map((section) => {
    let target: T | undefined;
    for (const label of section.labels) {
      const normalized = normalizeLabel(label);
      // Mermaid can emit one <text> per explicit line break. Anchor the first
      // rendered line if it did not emit a single element for the full label.
      const firstLine = normalizeLabel(label.split(/<br\s*\/?\s*>/i)[0]);
      const next = entries.find(
        (entry) =>
          entry.y > previousY &&
          (entry.normalized === normalized || entry.normalized === firstLine),
      );
      if (next) {
        previousY = next.y;
        target ??= next;
      }
    }
    return { ...section, target };
  });
}
