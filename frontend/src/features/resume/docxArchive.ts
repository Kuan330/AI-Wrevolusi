/** Reject damaged/encrypted/oversized DOCX archives before Mammoth parses text. */
export async function checkDocx(buffer: ArrayBuffer) {
  const view = new DataView(buffer), decoder = new TextDecoder();
  const damaged = () => new Error("This DOCX archive is damaged or unsupported. Upload a readable DOCX export or enter your details manually.");
  if (buffer.byteLength >= 8 && view.getUint32(0, true) === 0xe011cfd0 && view.getUint32(4, true) === 0xe11ab1a1) throw new Error("This file is encrypted or uses an old Word format. Upload a readable, unencrypted DOCX export.");
  if (buffer.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) throw damaged();
  let end = buffer.byteLength - 22;
  while (end >= Math.max(0, buffer.byteLength - 65557)) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === buffer.byteLength) break;
    end--;
  }
  if (end < 0 || end < buffer.byteLength - 65557) throw damaged();
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || count > 2000 || start + size !== end) throw damaged();
  let cursor = start, expanded = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw damaged();
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true), expected = view.getUint32(cursor + 24, true), local = view.getUint32(cursor + 42, true);
    const nameSize = view.getUint16(cursor + 28, true), extra = view.getUint16(cursor + 30, true), comment = view.getUint16(cursor + 32, true);
    if (cursor + 46 + nameSize + extra + comment > end || ![0, 8].includes(method) || local + 30 > start || view.getUint32(local, true) !== 0x04034b50) throw damaged();
    if (flags & 1) throw new Error("This DOCX is encrypted. Upload an unlocked copy; passwords are not collected.");
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameSize));
    if (names.has(name) || name.includes("\\") || name.split("/").includes("..") || name.startsWith("/")) throw damaged();
    names.add(name);
    expanded += expected;
    if (expanded > 40 * 1024 * 1024 || expected > 10 * 1024 * 1024) throw new Error("This DOCX expands beyond the supported size.");
    const offset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (offset + compressed > start) throw damaged();
    if (method === 0) { if (compressed !== expected) throw damaged(); }
    else {
      // Central-directory sizes can lie. Stream inflation and bound ACTUAL bytes.
      const stream = new Blob([buffer.slice(offset, offset + compressed)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader(); let actual = 0;
      try {
        while (true) { const chunk = await reader.read(); if (chunk.done) break; actual += chunk.value.byteLength; if (actual > expected || actual > 10 * 1024 * 1024) throw damaged(); }
        if (actual !== expected) throw damaged();
      } finally { await reader.cancel().catch(() => undefined); }
    }
    cursor += 46 + nameSize + extra + comment;
  }
  if (cursor !== end || !names.has("word/document.xml") || !names.has("[Content_Types].xml")) throw new Error("This file does not contain a DOCX document.");
}
