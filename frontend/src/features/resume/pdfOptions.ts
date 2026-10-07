/** PDF.js resources are copied from our locked dependency, never loaded from a CDN. */
export const localPdfAssets = () => ({
  cMapUrl: new URL(`${import.meta.env?.BASE_URL ?? "/"}vendor/pdfjs/cmaps/`, globalThis.location.origin).href,
  cMapPacked: true,
  standardFontDataUrl: new URL(`${import.meta.env?.BASE_URL ?? "/"}vendor/pdfjs/standard_fonts/`, globalThis.location.origin).href,
  wasmUrl: new URL(`${import.meta.env?.BASE_URL ?? "/"}vendor/pdfjs/wasm/`, globalThis.location.origin).href,
  enableXfa: false,
});
