import { saveAs } from 'file-saver';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  Tab,
  TabStopPosition,
  TabStopType,
  AlignmentType,
  BorderStyle,
} from 'docx';

// ══════════════════════════════════════════════════════════
//  PARSER — shared by PDF and DOCX
// ══════════════════════════════════════════════════════════

const SECTION_HEADERS = [
  'PROFESSIONAL SUMMARY',
  'CORE COMPETENCIES',
  'PROFESSIONAL EXPERIENCE',
  'KEY ACHIEVEMENTS',
  'SELECTED PROJECT',
  'EDUCATION',
  'CERTIFICATIONS & TECHNICAL SKILLS',
  'CERTIFICATIONS',
  'TECHNICAL SKILLS',
];

const DIVIDER_RE = /^[━─\-=]{5,}$/;
const DATE_RANGE_RE = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*Present\b)/i;
const SINGLE_DATE_RE = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s*$/i;

// Detect "Certifications:" or "Tools:" or "Methods:" prefix
const CERT_PREFIX_RE = /^(Certifications|Tools|Methods)\s*:\s*/i;

interface Block {
  type: 'name' | 'subtitle' | 'contact' | 'header' | 'divider' | 'dateline' |
        'bullet' | 'competencies' | 'text' | 'blank' | 'certline';
  text: string;
  left?: string;
  right?: string;
  items?: string[];
  prefix?: string;
  body?: string;
}

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let hdrIdx = 0;
  let section = '';
  let compBullets: string[] = [];

  const flushComp = () => {
    if (compBullets.length > 0) {
      blocks.push({ type: 'competencies', text: '', items: [...compBullets] });
      compBullets = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    if (!t) {
      if (section === 'CORE COMPETENCIES') continue;
      flushComp();
      blocks.push({ type: 'blank', text: '' });
      continue;
    }
    if (DIVIDER_RE.test(t)) {
      flushComp();
      blocks.push({ type: 'divider', text: t });
      continue;
    }
    if (SECTION_HEADERS.some(h => t === h || t.startsWith(h))) {
      flushComp();
      section = t;
      blocks.push({ type: 'header', text: t });
      continue;
    }

    // Name / subtitle / contact (before any section header)
    if (!section && !blocks.some(b => b.type === 'header')) {
      if (hdrIdx === 0 && t === t.toUpperCase() && t.length > 3 && !t.includes('|')) {
        blocks.push({ type: 'name', text: t });
        hdrIdx++;
        continue;
      }
      if (hdrIdx <= 2 && t.includes('|')) {
        const isContact = t.includes('@') || /\d{5,}/.test(t.replace(/[\s\-+()]/g, ''));
        blocks.push({ type: isContact ? 'contact' : 'subtitle', text: t });
        hdrIdx++;
        continue;
      }
      hdrIdx++;
    }

    // Core competencies bullets → collect
    if (section === 'CORE COMPETENCIES' && t.startsWith('\u2022')) {
      compBullets.push(t.replace(/^\u2022\s*/, ''));
      continue;
    }

    // Certifications & Technical Skills — lines with "Prefix: value"
    if ((section === 'CERTIFICATIONS & TECHNICAL SKILLS' || section === 'CERTIFICATIONS' || section === 'TECHNICAL SKILLS')) {
      const pm = t.match(CERT_PREFIX_RE);
      if (pm) {
        flushComp();
        blocks.push({ type: 'certline', text: t, prefix: pm[1] + ':', body: t.slice(pm[0].length) });
        continue;
      }
    }

    // Date range (experience / project)
    const drm = t.match(DATE_RANGE_RE);
    if (drm) {
      flushComp();
      const idx = t.indexOf(drm[0]);
      blocks.push({ type: 'dateline', text: t, left: t.slice(0, idx).trim(), right: drm[0].trim() });
      continue;
    }

    // Single date (education / project)
    if (section === 'EDUCATION' || section.startsWith('EDUCATION') ||
        section === 'SELECTED PROJECT' || section.startsWith('SELECTED')) {
      const sdm = t.match(SINGLE_DATE_RE);
      if (sdm && !t.startsWith('\u2022')) {
        const left = t.slice(0, t.indexOf(sdm[1])).trim();
        if (left.length > 3) {
          blocks.push({ type: 'dateline', text: t, left, right: sdm[1].trim() });
          continue;
        }
      }
    }

    // Bullet
    if (t.startsWith('\u2022')) {
      flushComp();
      blocks.push({ type: 'bullet', text: t });
      continue;
    }

    flushComp();
    blocks.push({ type: 'text', text: t });
  }

  flushComp();
  return blocks;
}


// ══════════════════════════════════════════════════════════
//  CV PDF — jsPDF with exact measurements
// ══════════════════════════════════════════════════════════

const PG_W = 210;
const PG_H = 297;
const ML = 18;   // left margin
const MR = 18;   // right margin
const MT = 20;   // top margin
const MB = 20;   // bottom margin
const CW = PG_W - ML - MR; // content width
const MAX_Y = PG_H - MB;   // 277mm

interface Sizing {
  bodyFont: number;       // normal body font pt
  bulletFont: number;     // bullet font pt
  compFont: number;       // competency font pt
  summaryLH: number;      // summary line height mm
  bulletLH: number;       // bullet line height mm
  compLH: number;         // competency row height mm
  certLH: number;         // cert line height mm
  betweenBullets: number; // extra gap between bullets mm
  betweenRoles: number;   // gap between experience roles mm
  beforeHeader: number;   // gap before section header mm
  afterHeaderLine: number; // gap after header underline mm
  eduGap: number;         // gap between education entries mm
}

const NORMAL: Sizing = {
  bodyFont: 9.5,
  bulletFont: 9,
  compFont: 9,
  summaryLH: 3.8,
  bulletLH: 3.6,
  compLH: 4.2,
  certLH: 3.8,
  betweenBullets: 1.2,
  betweenRoles: 4,
  beforeHeader: 5,
  afterHeaderLine: 3,
  eduGap: 3,
};

const COMPACT: Sizing = {
  bodyFont: 9,
  bulletFont: 8.5,
  compFont: 8.5,
  summaryLH: 3.5,
  bulletLH: 3.3,
  compLH: 3.9,
  certLH: 3.5,
  betweenBullets: 0.9,
  betweenRoles: 3,
  beforeHeader: 4,
  afterHeaderLine: 2.5,
  eduGap: 2.5,
};

function wrapText(doc: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (doc.getTextWidth(test) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function renderCvPdf(doc: any, blocks: Block[], sz: Sizing, maxBulletsPerRole: number): number {
  let y = MT;
  let prevType = '';
  let bulletsInCurrentRole = 0;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];

    switch (b.type) {
      // ─── NAME ───
      case 'name': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += 5.5 + 2; // ~16pt descent + 2mm gap
        break;
      }

      // ─── SUBTITLE ───
      case 'subtitle': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += 3.5 + 1.5; // 10pt descent + 1.5mm gap
        break;
      }

      // ─── CONTACT ───
      case 'contact': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(85, 85, 85);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += 3 + 5; // 9pt descent + 5mm gap
        // Thin divider line after contact block
        doc.setDrawColor(204, 204, 204);
        doc.setLineWidth(0.1);
        doc.line(ML, y, PG_W - MR, y);
        y += 5; // 5mm gap after line
        break;
      }

      // ─── SECTION HEADER ───
      case 'header': {
        if (prevType && prevType !== 'contact' && prevType !== 'divider') {
          y += sz.beforeHeader;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, ML, y);
        y += 1.5;
        doc.setDrawColor(204, 204, 204);
        doc.setLineWidth(0.1);
        doc.line(ML, y, PG_W - MR, y);
        y += sz.afterHeaderLine;
        bulletsInCurrentRole = 0;
        break;
      }

      // ─── DIVIDER ───
      case 'divider':
        break; // skip, header draws its own line

      // ─── DATELINE (title left, date right) ───
      case 'dateline': {
        if (prevType === 'bullet' || prevType === 'text') {
          y += sz.betweenRoles;
          bulletsInCurrentRole = 0;
        }
        // Title — bold left
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(b.left || '', ML, y);
        // Date — normal right-aligned
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(b.right || '', PG_W - MR, y, { align: 'right' });
        y += 4;
        break;
      }

      // ─── BULLET ───
      case 'bullet': {
        bulletsInCurrentRole++;
        if (bulletsInCurrentRole > maxBulletsPerRole) break; // skip excess bullets

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.bulletFont);
        doc.setTextColor(51, 51, 51);
        const rawText = b.text.replace(/^\u2022\s*/, '');
        const bulletX = ML + 5;  // bullet char at 5mm indent
        const textX = ML + 9;    // text at 9mm (hanging indent)
        const textMaxW = CW - 9;
        const bLines = wrapText(doc, rawText, textMaxW);

        // Bullet character on first line
        doc.text('\u2022', bulletX, y);
        for (let li = 0; li < bLines.length; li++) {
          doc.text(bLines[li], textX, y);
          y += sz.bulletLH;
        }
        y += sz.betweenBullets;
        break;
      }

      // ─── COMPETENCIES (2-column) ───
      case 'competencies': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const col1 = items.slice(0, half);
        const col2 = items.slice(half);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.compFont);
        doc.setTextColor(51, 51, 51);

        const rows = Math.max(col1.length, col2.length);
        const colMid = 105; // page center for right column
        for (let r = 0; r < rows; r++) {
          if (r < col1.length) doc.text(`\u2022  ${col1[r]}`, ML + 2, y);
          if (r < col2.length) doc.text(`\u2022  ${col2[r]}`, colMid, y);
          y += sz.compLH;
        }
        break;
      }

      // ─── CERTLINE (prefix bold, body normal) ───
      case 'certline': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.bodyFont);
        doc.setTextColor(51, 51, 51);
        const prefixW = doc.getTextWidth(b.prefix + ' ');
        doc.text(b.prefix + ' ', ML, y);
        doc.setFont('helvetica', 'normal');
        // Wrap body after prefix
        const bodyMaxW = CW - prefixW;
        const cLines = wrapText(doc, b.body || '', bodyMaxW);
        doc.text(cLines[0], ML + prefixW, y);
        y += sz.certLH;
        for (let li = 1; li < cLines.length; li++) {
          doc.text(cLines[li], ML + prefixW, y);
          y += sz.certLH;
        }
        break;
      }

      // ─── TEXT (company line, summary paragraph, etc.) ───
      case 'text': {
        // If immediately after a dateline, this is likely company/location line
        if (prevType === 'dateline') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(85, 85, 85);
          doc.text(b.text, ML, y);
          y += 3.5;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(sz.bodyFont);
          doc.setTextColor(51, 51, 51);
          const tLines = wrapText(doc, b.text, CW);
          for (const tl of tLines) {
            doc.text(tl, ML, y);
            y += sz.summaryLH;
          }
        }
        break;
      }

      // ─── BLANK ───
      case 'blank':
        y += 1;
        break;
    }

    if (b.type !== 'divider') prevType = b.type;
  }

  return y;
}

function buildCvPdf(doc: any, text: string) {
  const blocks = parseBlocks(text);

  // First pass: try normal sizing
  let finalY = renderCvPdf(doc, blocks, NORMAL, 5);

  if (finalY > MAX_Y) {
    // Overflow — clear and retry with compact sizing
    // jsPDF doesn't support clearing, so we delete all pages and start fresh
    const totalPages = doc.getNumberOfPages();
    // Remove extra pages if any were added
    while (doc.getNumberOfPages() > 1) {
      doc.deletePage(doc.getNumberOfPages());
    }
    // Clear the single remaining page by adding a white rectangle
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PG_W, PG_H, 'F');

    finalY = renderCvPdf(doc, blocks, COMPACT, 5);

    if (finalY > MAX_Y) {
      // Still overflows — retry compact with max 4 bullets
      while (doc.getNumberOfPages() > 1) {
        doc.deletePage(doc.getNumberOfPages());
      }
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, PG_W, PG_H, 'F');
      renderCvPdf(doc, blocks, COMPACT, 4);
    }
  }
}


// ══════════════════════════════════════════════════════════
//  COVER LETTER PDF
// ══════════════════════════════════════════════════════════

function buildCoverLetterPdf(doc: any, text: string) {
  const lines = text.split('\n');
  let y = MT;
  let lineIdx = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      y += 4;
      lineIdx++;
      continue;
    }

    // Name (ALL CAPS at top)
    if (lineIdx < 2 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(trimmed, ML, y);
      y += 6;
      lineIdx++;
      continue;
    }

    // Contact line
    if (lineIdx < 3 && trimmed.includes('|')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(85, 85, 85);
      doc.text(trimmed, ML, y);
      y += 4.5;
      // Thin line after contact
      doc.setDrawColor(204, 204, 204);
      doc.setLineWidth(0.1);
      doc.line(ML, y, PG_W - MR, y);
      y += 5;
      lineIdx++;
      continue;
    }

    // Salutation or closing
    if (/^(Dear|Warm regards|Kind regards|Sincerely|Best regards|Yours)/i.test(trimmed)) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(trimmed, ML, y);
      y += 6;
      lineIdx++;
      continue;
    }

    // Body text — wrap
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    const pLines = wrapText(doc, trimmed, CW);
    for (const pl of pLines) {
      if (y > MAX_Y) {
        doc.addPage();
        y = MT;
      }
      doc.text(pl, ML, y);
      y += 4.8;
    }
    y += 1;
    lineIdx++;
  }
}


// ══════════════════════════════════════════════════════════
//  PDF EXPORT
// ══════════════════════════════════════════════════════════

export async function downloadAsPdf(text: string, filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const isCV = filename.toLowerCase().includes('cv');

  if (isCV) {
    buildCvPdf(doc, text);
  } else {
    buildCoverLetterPdf(doc, text);
  }

  doc.save(`${filename}.pdf`);
}


// ══════════════════════════════════════════════════════════
//  DOCX — matching professional layout
// ══════════════════════════════════════════════════════════

const FD = 'Calibri';
const TAB_R = TabStopPosition.MAX;

function buildCvDocx(text: string): Paragraph[] {
  const blocks = parseBlocks(text);
  const p: Paragraph[] = [];
  let prev = '';

  for (const b of blocks) {
    switch (b.type) {
      case 'name':
        p.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 30 },
          children: [new TextRun({ text: b.text, bold: true, size: 32, font: FD })],
        }));
        break;
      case 'subtitle':
        p.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: b.text, size: 20, font: FD })],
        }));
        break;
      case 'contact':
        p.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 4 } },
          children: [new TextRun({ text: b.text, size: 18, font: FD, color: '555555' })],
        }));
        break;
      case 'header':
        p.push(new Paragraph({
          spacing: { before: prev === 'bullet' || prev === 'text' ? 120 : 80, after: 50 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
          children: [new TextRun({ text: b.text, bold: true, size: 20, font: FD, characterSpacing: 40 })],
        }));
        break;
      case 'divider':
        break;
      case 'dateline':
        p.push(new Paragraph({
          spacing: { before: prev === 'bullet' || prev === 'text' ? 80 : 20, after: 10 },
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_R }],
          children: [
            new TextRun({ text: b.left || '', bold: true, size: 20, font: FD }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: b.right || '', size: 19, font: FD }),
          ],
        }));
        break;
      case 'bullet':
        p.push(new Paragraph({
          spacing: { after: 20 },
          indent: { left: 340, hanging: 180 },
          children: [new TextRun({ text: b.text, size: 18, font: FD, color: '333333' })],
        }));
        break;
      case 'competencies': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const rows = Math.max(half, items.length - half);
        for (let r = 0; r < rows; r++) {
          const left = r < half ? `\u2022  ${items[r]}` : '';
          const right = (r + half) < items.length ? `\u2022  ${items[r + half]}` : '';
          p.push(new Paragraph({
            spacing: { after: 15 },
            tabStops: [{ type: TabStopType.LEFT, position: 4800 }],
            children: [
              new TextRun({ text: left, size: 18, font: FD, color: '333333' }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: right, size: 18, font: FD, color: '333333' }),
            ],
          }));
        }
        break;
      }
      case 'certline':
        p.push(new Paragraph({
          spacing: { after: 15 },
          children: [
            new TextRun({ text: (b.prefix || '') + ' ', bold: true, size: 18, font: FD, color: '333333' }),
            new TextRun({ text: b.body || '', size: 18, font: FD, color: '333333' }),
          ],
        }));
        break;
      case 'text':
        if (prev === 'dateline') {
          // Company/location line
          p.push(new Paragraph({
            spacing: { after: 10 },
            children: [new TextRun({ text: b.text, size: 18, font: FD, color: '555555' })],
          }));
        } else {
          p.push(new Paragraph({
            spacing: { after: 15 },
            children: [new TextRun({ text: b.text, size: 19, font: FD, color: '333333' })],
          }));
        }
        break;
      case 'blank':
        p.push(new Paragraph({ spacing: { after: 15 } }));
        break;
    }
    if (b.type !== 'divider') prev = b.type;
  }

  return p;
}

function buildCoverLetterDocx(text: string): Paragraph[] {
  const lines = text.split('\n');
  const p: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) {
      p.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }
    if (i < 2 && t === t.toUpperCase() && t.length > 3 && !t.includes('|')) {
      p.push(new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: t, bold: true, size: 28, font: FD })],
      }));
      continue;
    }
    if (i < 3 && t.includes('|')) {
      p.push(new Paragraph({
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 4 } },
        children: [new TextRun({ text: t, size: 19, font: FD, color: '555555' })],
      }));
      continue;
    }
    p.push(new Paragraph({
      spacing: { after: 50, line: 300 },
      children: [new TextRun({ text: t, size: 22, font: FD })],
    }));
  }

  return p;
}

export async function downloadAsDocx(text: string, filename: string) {
  const isCV = filename.toLowerCase().includes('cv');
  const children = isCV ? buildCvDocx(text) : buildCoverLetterDocx(text);

  const doc = new DocxDocument({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1020, right: 1020 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
