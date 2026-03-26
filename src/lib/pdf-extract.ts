/**
 * Extract all text from a PDF file on the client side using pdfjs-dist.
 * This module must only be called from client components (browser context).
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  // Dynamic import to avoid SSR/prerender issues (pdfjs-dist needs browser APIs)
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str);
    pages.push(strings.join(' '));
  }

  return pages.join('\n\n');
}
