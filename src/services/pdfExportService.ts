import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { ModuleId } from '../types/vectoria';

export const LAB_ANALYSIS_MODULE_IDS = new Set<ModuleId>([
  'simulation-lab',
  'classifier',
  'xai',
  'topology',
  'neural-lab',
  'smart-irrigation',
  'linear-algebra',
  'geometry',
  'evaluation',
  'analytics',
  'robustness',
  'verification',
  'reports',
]);

export interface ExtractedDomSummary {
  headings: string[];
  paragraphs: string[];
  tables: Array<{ headers: string[]; rows: string[][] }>;
}

export interface PdfExportOptions {
  element: HTMLElement;
  moduleId: ModuleId;
  moduleTitle: string;
  authorName?: string;
  program?: string;
  autoDownload?: boolean;
}

export interface PdfExportResult {
  filename: string;
  pageCount: number;
  sizeBytes: number;
  usedVisualCapture: boolean;
  blob: Blob;
  exportedAt: string;
}

function cleanPdfText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Extrae encabezados, párrafos clave y tablas renderizadas del área principal
 * como respaldo estructurado y verificable para el reporte PDF.
 */
export function extractPrintableMainSummary(container: HTMLElement): ExtractedDomSummary {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3'))
    .map((el) => cleanPdfText(el.textContent ?? ''))
    .filter(Boolean)
    .slice(0, 24);

  const paragraphs = Array.from(container.querySelectorAll('p'))
    .map((el) => cleanPdfText(el.textContent ?? ''))
    .filter((txt) => txt.length >= 10)
    .slice(0, 18);

  const tables = Array.from(container.querySelectorAll('table'))
    .slice(0, 4)
    .map((tbl) => {
      const headers = Array.from(tbl.querySelectorAll('thead th')).map((th) =>
        cleanPdfText(th.textContent ?? '')
      );
      const rows = Array.from(tbl.querySelectorAll('tbody tr'))
        .slice(0, 16)
        .map((tr) =>
          Array.from(tr.querySelectorAll('td, th')).map((cell) =>
            cleanPdfText(cell.textContent ?? '')
          )
        )
        .filter((row) => row.length > 0);
      return { headers, rows };
    })
    .filter((t) => t.headers.length > 0 || t.rows.length > 0);

  return { headings, paragraphs, tables };
}

function buildPdfFilename(moduleId: ModuleId, now = new Date()): string {
  const dateSlug = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `vectoria_analisis_${moduleId}_${dateSlug}.pdf`;
}

function resolveCanvasBackgroundHex(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '#ffffff';
  }
  const bg = window.getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim();
  return bg || '#ffffff';
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('No se pudo decodificar la captura visual del área principal.'));
    img.src = dataUrl;
  });
}

function sliceImageAcrossPdfPages(
  doc: jsPDF,
  dataUrl: string,
  imgWidth: number,
  imgHeight: number,
  startY: number,
  marginX: number,
  usableWidth: number,
  pageHeight: number,
  bottomMargin: number
): void {
  const renderedTotalHeightMm = (imgHeight * usableWidth) / Math.max(1, imgWidth);
  const firstPageAvailableMm = pageHeight - startY - bottomMargin;

  if (renderedTotalHeightMm <= firstPageAvailableMm) {
    doc.addImage(dataUrl, 'PNG', marginX, startY, usableWidth, renderedTotalHeightMm, undefined, 'FAST');
    return;
  }

  // Multi-page vertical slicing via offscreen canvas when content exceeds 1 A4 sheet
  const sourceImg = new Image();
  sourceImg.src = dataUrl;

  const pxPerMm = imgWidth / usableWidth;
  let offsetMm = 0;
  let pageIndex = 0;

  while (offsetMm < renderedTotalHeightMm - 0.5) {
    const pageTopMm = pageIndex === 0 ? startY : 16;
    const availMm = pageHeight - pageTopMm - bottomMargin;
    const sliceMm = Math.min(availMm, renderedTotalHeightMm - offsetMm);

    const srcY = Math.floor(offsetMm * pxPerMm);
    const srcH = Math.max(1, Math.min(imgHeight - srcY, Math.ceil(sliceMm * pxPerMm)));

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = imgWidth;
    sliceCanvas.height = srcH;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx && sourceImg.complete && sourceImg.naturalWidth > 0) {
      ctx.drawImage(sourceImg, 0, srcY, imgWidth, srcH, 0, 0, imgWidth, srcH);
      const sliceUrl = sliceCanvas.toDataURL('image/png');
      doc.addImage(sliceUrl, 'PNG', marginX, pageTopMm, usableWidth, sliceMm, undefined, 'FAST');
    } else {
      doc.addImage(dataUrl, 'PNG', marginX, pageTopMm, usableWidth, sliceMm, undefined, 'FAST');
      break;
    }

    offsetMm += sliceMm;
    pageIndex += 1;
    if (offsetMm < renderedTotalHeightMm - 0.5) {
      doc.addPage();
    }
  }
}

function appendStructuredSummaryFallback(
  doc: jsPDF,
  summary: ExtractedDomSummary,
  startY: number,
  marginX: number,
  usableWidth: number,
  pageHeight: number
): void {
  let y = startY;
  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Resumen Estructurado del Contenido Renderizado', marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  for (const heading of summary.headings) {
    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(`• ${heading}`, usableWidth) as string[];
    doc.text(lines, marginX, y);
    y += lines.length * 4.5 + 1.5;
  }

  for (const para of summary.paragraphs) {
    ensureSpace(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(para, usableWidth) as string[];
    doc.text(lines, marginX, y);
    y += lines.length * 4.2 + 2;
  }

  for (const table of summary.tables) {
    ensureSpace(14);
    y += 2;
    if (table.headers.length > 0) {
      doc.setFont('helvetica', 'bold');
      const headerLine = doc.splitTextToSize(table.headers.join(' | '), usableWidth) as string[];
      doc.text(headerLine, marginX, y);
      y += headerLine.length * 4.2 + 1;
    }
    doc.setFont('helvetica', 'normal');
    for (const row of table.rows) {
      ensureSpace(7);
      const rowLine = doc.splitTextToSize(row.join(' | '), usableWidth) as string[];
      doc.text(rowLine, marginX, y);
      y += rowLine.length * 4 + 1;
    }
  }
}

/**
 * Captura el contenido actualmente renderizado dentro del área principal (`<main>`)
 * y genera un reporte PDF imprimible usando `jspdf`.
 */
export async function exportMainAreaToPdf(
  options: PdfExportOptions
): Promise<PdfExportResult> {
  const {
    element,
    moduleId,
    moduleTitle,
    authorName = 'Investigador VectorIA Studio',
    program = 'Álgebra Lineal e Ingeniería de Redes Neuronales',
    autoDownload = true,
  } = options;

  const exportedAt = new Date().toISOString();
  const filename = buildPdfFilename(moduleId);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const usableWidth = pageWidth - marginX * 2;

  // Header strip on page 1
  doc.setFillColor(24, 24, 38);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`VectorIA Studio — ${moduleTitle}`, marginX, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${authorName} · ${program} · Exportado: ${new Date(exportedAt).toLocaleString('es-MX')}`,
    marginX,
    17.5
  );

  let usedVisualCapture = false;
  const contentStartY = 29;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const bgHex = resolveCanvasBackgroundHex();
      const pngDataUrl = await toPng(element, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bgHex,
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset?.pdfIgnore === 'true') {
            return false;
          }
          return true;
        },
      });
      const dims = await loadImageDimensions(pngDataUrl);
      if (dims.width > 0 && dims.height > 0) {
        sliceImageAcrossPdfPages(
          doc,
          pngDataUrl,
          dims.width,
          dims.height,
          contentStartY,
          marginX,
          usableWidth,
          pageHeight,
          14
        );
        usedVisualCapture = true;
      }
    } catch {
      usedVisualCapture = false;
    }
  }

  if (!usedVisualCapture) {
    const domSummary = extractPrintableMainSummary(element);
    appendStructuredSummaryFallback(doc, domSummary, contentStartY + 2, marginX, usableWidth, pageHeight);
  }

  // Stamp clean page numbers across all sheets
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 145);
    doc.text(
      `VectorIA Studio · Reporte de Experimento (${moduleId})`,
      marginX,
      pageHeight - 6
    );
    doc.text(
      `Página ${p} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  const blob = doc.output('blob');
  if (autoDownload) {
    doc.save(filename);
  }

  return {
    filename,
    pageCount: totalPages,
    sizeBytes: blob.size,
    usedVisualCapture,
    blob,
    exportedAt,
  };
}
