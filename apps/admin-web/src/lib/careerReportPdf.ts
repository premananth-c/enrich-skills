import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MARGIN_MM = 10;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const RENDER_SCALE = 2;

function pageContentHeightPx(sourceWidthPx: number): number {
  const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;
  const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2;
  return sourceWidthPx * (contentHeightMm / contentWidthMm);
}

function packBlocks(blocks: HTMLElement[], maxHeightPx: number): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let currentHeight = 0;

  for (const block of blocks) {
    const blockHeight = block.offsetHeight;
    if (blockHeight > maxHeightPx) {
      if (current.length > 0) {
        pages.push(current);
        current = [];
        currentHeight = 0;
      }
      pages.push([block]);
      continue;
    }
    if (currentHeight + blockHeight > maxHeightPx && current.length > 0) {
      pages.push(current);
      current = [block];
      currentHeight = blockHeight;
    } else {
      current.push(block);
      currentHeight += blockHeight;
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

async function renderCanvas(
  target: HTMLElement,
  width: number
): Promise<HTMLCanvasElement> {
  return html2canvas(target, {
    scale: RENDER_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    width,
  });
}

async function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  contentWidthMm: number,
  pageIndex: number
) {
  const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;
  if (pageIndex > 0) pdf.addPage();
  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    MARGIN_MM,
    MARGIN_MM,
    contentWidthMm,
    imgHeightMm
  );
}

async function addOversizedBlockToPdf(
  pdf: jsPDF,
  block: HTMLElement,
  sourceWidth: number,
  contentWidthMm: number,
  pageHeightPx: number,
  startPageIndex: number
): Promise<number> {
  const staging = document.createElement('div');
  staging.style.cssText = `position:fixed;left:-10000px;top:0;width:${sourceWidth}px;background:#fff;`;
  const shell = document.createElement('div');
  shell.style.cssText = `width:${sourceWidth}px;background:#fff;box-sizing:border-box;`;
  shell.appendChild(block.cloneNode(true));
  staging.appendChild(shell);
  document.body.appendChild(staging);

  try {
    const canvas = await renderCanvas(shell, sourceWidth);
    let yOffset = 0;
    let pageIndex = startPageIndex;
    while (yOffset < canvas.height) {
      const sliceHeight = Math.min(pageHeightPx * RENDER_SCALE, canvas.height - yOffset);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        yOffset,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );
      await addCanvasToPdf(pdf, pageCanvas, contentWidthMm, pageIndex);
      yOffset += sliceHeight;
      pageIndex += 1;
    }
    return pageIndex;
  } finally {
    document.body.removeChild(staging);
  }
}

export async function downloadCareerReportPdf(
  source: HTMLElement,
  filename: string
): Promise<void> {
  const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;
  const sourceWidth = source.offsetWidth || source.scrollWidth || 800;
  const pageHeightPx = pageContentHeightPx(sourceWidth);

  const blocks = Array.from(source.querySelectorAll('.pdf-block')) as HTMLElement[];
  const pdf = new jsPDF('p', 'mm', 'a4');

  if (blocks.length === 0) {
    const canvas = await renderCanvas(source, sourceWidth);
    await addCanvasToPdf(pdf, canvas, contentWidthMm, 0);
    pdf.save(filename);
    return;
  }

  const pages = packBlocks(blocks, pageHeightPx);
  const staging = document.createElement('div');
  staging.style.cssText = `position:fixed;left:-10000px;top:0;width:${sourceWidth}px;background:#fff;`;
  document.body.appendChild(staging);

  let pageIndex = 0;
  try {
    for (const pageBlocks of pages) {
      if (pageBlocks.length === 1 && pageBlocks[0].offsetHeight > pageHeightPx) {
        pageIndex = await addOversizedBlockToPdf(
          pdf,
          pageBlocks[0],
          sourceWidth,
          contentWidthMm,
          pageHeightPx,
          pageIndex
        );
        continue;
      }

      staging.innerHTML = '';
      const shell = document.createElement('div');
      shell.style.cssText = [
        `width:${sourceWidth}px`,
        'background:#fff',
        'box-sizing:border-box',
        'padding:1.25rem',
        'font-family:system-ui,-apple-system,sans-serif',
        'font-size:1.05rem',
        'line-height:1.6',
        'color:#111827',
      ].join(';');
      for (const block of pageBlocks) {
        shell.appendChild(block.cloneNode(true));
      }
      staging.appendChild(shell);

      const canvas = await renderCanvas(shell, sourceWidth);
      await addCanvasToPdf(pdf, canvas, contentWidthMm, pageIndex);
      pageIndex += 1;
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(staging);
  }
}
