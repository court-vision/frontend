/**
 * The agent's prose, as blocks the AI desk renders. The model writes plain
 * paragraphs, "-" bullets and **bold** (its prompt asks for nothing more), so
 * that is all this reads: no HTML, no links, nothing that could carry markup
 * from a tool result into the page. Anything else shows as written.
 */

export type ProseSpan = { text: string; bold: boolean };
export type ProseBlock = { kind: "p"; spans: ProseSpan[] } | { kind: "ul"; items: ProseSpan[][] };

const BULLET = /^\s*[-•*]\s+/;

/** "**a** b" -> [{a, bold}, { b}]. An unclosed ** stays as written. */
export function spans(line: string): ProseSpan[] {
  const out: ProseSpan[] = [];
  let rest = line;
  for (;;) {
    const open = rest.indexOf("**");
    const close = open === -1 ? -1 : rest.indexOf("**", open + 2);
    if (open === -1 || close === -1) {
      if (rest) out.push({ text: rest, bold: false });
      return out;
    }
    if (open > 0) out.push({ text: rest.slice(0, open), bold: false });
    const inner = rest.slice(open + 2, close);
    if (inner) out.push({ text: inner, bold: true });
    rest = rest.slice(close + 2);
  }
}

export function prose(text: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", spans: spans(para.join(" ")) });
    para = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (BULLET.test(line)) {
      flush();
      const item = spans(line.replace(BULLET, ""));
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
