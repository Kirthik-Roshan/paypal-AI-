import "core-js/actual/array-buffer/transfer-to-fixed-length.js";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
// Previews are rendered from the stored bytes, never a hand-drawn stand-in.
export async function pdfPreview(bytes: Buffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes), {
      isEvalSupported: false,
      maxImageSize: 4_000_000,
      useSystemFonts: true,
    });
    try {
      if (pdf.numPages > 30) return null;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      if (viewport.width * viewport.height > 4_000_000) return null;
      const image = await renderPageAsImage(pdf, 1, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale: 1,
      });
      return `data:image/png;base64,${Buffer.from(image).toString("base64")}`;
    } finally {
      await pdf.destroy();
    }
  } catch {
    return null;
  }
}
