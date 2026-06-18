import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MARGIN_MM = 10;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const RENDER_SCALE = 2;

/**
 * Compute the page boundaries (in canvas pixels) so that no `.pdf-block`
 * element is split across two pages. We render the whole report once (exact
 * layout, no reflow) and only choose vertical cut positions that fall in the
 * gaps between blocks.
 */
function computePageBreaks(
  blockEdges: Array<{ top: number; bottom: number }>,
  totalHeight: number,
  pageHeight: number
): Array<{ start: number; end: number }> {
  const pages: Array<{ start: number; end: number }> = [];
  let pageStart = 0;
  let guard = 0;

  while (pageStart < totalHeight - 1 && guard < 1000) {
    guard += 1;
    const maxEnd = pageStart + pageHeight;

    if (maxEnd >= totalHeight) {
      pages.push({ start: pageStart, end: totalHeight });
      break;
    }

    // Default cut at the full page height.
    let cut = maxEnd;

    // If any block straddles the proposed cut, move the cut up to the top of
    // that block so it starts fresh on the next page.
    for (const edge of blockEdges) {
      if (edge.top < maxEnd && edge.bottom > maxEnd) {
        if (edge.top > pageStart) {
          cut = Math.min(cut, edge.top);
        }
        // If the block starts at/above pageStart it is taller than a single
        // page; we have no choice but to hard-cut at maxEnd.
      }
    }

    // Safety: never produce a zero/negative-height page.
    if (cut <= pageStart) cut = maxEnd;

    pages.push({ start: pageStart, end: cut });
    pageStart = cut;
  }

  if (pages.length === 0) {
    pages.push({ start: 0, end: totalHeight });
  }
  return pages;
}

export async function downloadCareerReportPdf(
  source: HTMLElement,
  filename: string
): Promise<void> {
  const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;
  const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2;
  const sourceWidthCss = source.offsetWidth || source.scrollWidth || 800;

  // Render the entire report once at exact layout — no cloning, no reflow.
  const canvas = await html2canvas(source, {
    scale: RENDER_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: sourceWidthCss,
  });

  const pxPerCssPx = canvas.width / sourceWidthCss;
  // Height of one printable page expressed in canvas pixels.
  const pageHeightCanvas =
    sourceWidthCss * (contentHeightMm / contentWidthMm) * pxPerCssPx;

  // Block edges relative to the source, converted to canvas pixels.
  const srcRect = source.getBoundingClientRect();
  const blockEdges = (Array.from(source.querySelectorAll('.pdf-block')) as HTMLElement[])
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        top: (rect.top - srcRect.top) * pxPerCssPx,
        bottom: (rect.bottom - srcRect.top) * pxPerCssPx,
      };
    })
    .filter((e) => e.bottom > e.top)
    .sort((a, b) => a.top - b.top);

  const pages = computePageBreaks(blockEdges, canvas.height, pageHeightCanvas);

  const pdf = new jsPDF('p', 'mm', 'a4');

  pages.forEach((page, index) => {
    const sliceHeight = Math.max(1, Math.round(page.end - page.start));
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      Math.round(page.start),
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const imgHeightMm = (sliceHeight / canvas.width) * contentWidthMm;
    if (index > 0) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL('image/png'),
      'PNG',
      MARGIN_MM,
      MARGIN_MM,
      contentWidthMm,
      imgHeightMm
    );
  });

  pdf.save(filename);
}
