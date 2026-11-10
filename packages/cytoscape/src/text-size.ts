/** Measures wrapped pill text without Cytoscape's deprecated width/height: label. */
export function wrappedTextSize(text: string, fontSize: number, maxWidth: number, measure: (text: string) => number) {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (Math.ceil(measure(line)) <= maxWidth) {
      lines.push(line);
      continue;
    }
    let current = "";
    let previous = 0;
    // Preserve whitespace and unbreakable words, like the renderer's word wrapping.
    for (const match of line.matchAll(/[\s\u200b]+|$/g)) {
      const word = line.slice(previous, match.index);
      previous = match.index! + match[0].length;
      const candidate = current.length ? current + word + match[0] : word;
      if (Math.ceil(measure(candidate)) > maxWidth) {
        if (current) lines.push(current);
        current = word + match[0];
      } else current += word + match[0];
    }
    if (!/^[\s\u200b]+$/.test(current)) lines.push(current);
  }
  return {
    width: Math.max(1, ...lines.map((line) => Math.ceil(measure(line)))),
    height: Math.max(1, lines.length) * fontSize,
  };
}

export function pillTextSizer(fontFamily: string) {
  let context: CanvasRenderingContext2D | null = null;
  const cache = new Map<string, { width: number; height: number }>();
  return (text: string, scale: number) => {
    const key = JSON.stringify([text, scale]);
    const known = cache.get(key);
    if (known) return known;
    if (!context && typeof document !== "undefined") context = document.createElement("canvas").getContext("2d");
    const size = 6 * scale;
    if (context) context.font = `normal normal ${size}px ${fontFamily}`;
    const measure = (line: string) => context
      ? context.measureText(line).width
      : Array.from(line).reduce((width, char) => width + size * (/[^\x00-\xff]/.test(char) ? 1 : 0.6), 0);
    const result = wrappedTextSize(text, size, 50 * scale, measure);
    // Continuous zoom can produce many scales; don't retain an unbounded history.
    if (cache.size >= 512) cache.clear();
    cache.set(key, result);
    return result;
  };
}
