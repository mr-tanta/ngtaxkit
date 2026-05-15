type PDFDocumentConstructor = new (
  options?: PDFKit.PDFDocumentOptions,
) => PDFKit.PDFDocument;

export async function loadPDFDocument(): Promise<PDFDocumentConstructor> {
  try {
    const pdfkitModule = await import('pdfkit') as unknown as {
      default?: PDFDocumentConstructor;
    };
    return pdfkitModule.default ?? (pdfkitModule as unknown as PDFDocumentConstructor);
  } catch (error) {
    throw new Error(
      'PDF generation requires optional dependency "pdfkit". Install it with: npm install pdfkit',
      { cause: error },
    );
  }
}
