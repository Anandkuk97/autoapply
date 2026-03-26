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
// Also match "YYYY - YYYY" for projects like "2021 - 2024"
const YEAR_RANGE_RE = /(\b\d{4}\s*-\s*\d{4})\s*$/;
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
    // Handle both formats:
    // 1. One bullet per line: "• Supply Chain Management"
    // 2. All on one line: "• Supply Chain • Logistics • Procurement"
    if (section === 'CORE COMPETENCIES') {
      if (t.includes('\u2022')) {
        // Split by bullet character, filter empties, collect each
        const parts = t.split('\u2022').map(s => s.trim()).filter(s => s.length > 0);
        for (const part of parts) {
          compBullets.push(part);
        }
        continue;
      }
      // Also handle lines without bullet that are just text items (comma-separated)
      if (!SECTION_HEADERS.some(h => t === h) && t.length > 2) {
        const commaParts = t.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (commaParts.length > 1) {
          for (const cp of commaParts) compBullets.push(cp);
          continue;
        }
      }
    }

    // Certifications lines with "Prefix: value"
    if (section === 'CERTIFICATIONS & TECHNICAL SKILLS' || section === 'CERTIFICATIONS' || section === 'TECHNICAL SKILLS') {
      const pm = t.match(CERT_PREFIX_RE);
      if (pm) {
        flushComp();
        blocks.push({ type: 'certline', text: t, prefix: pm[1] + ':', body: t.slice(pm[0].length) });
        continue;
      }
    }

    // Date range (experience / project) e.g. "Jun 2020 - Sep 2025"
    const drm = t.match(DATE_RANGE_RE);
    if (drm) {
      flushComp();
      const idx = t.indexOf(drm[0]);
      blocks.push({ type: 'dateline', text: t, left: t.slice(0, idx).trim(), right: drm[0].trim() });
      continue;
    }

    // Year range for projects e.g. "2021 - 2024"
    if (section === 'SELECTED PROJECT' || section.startsWith('SELECTED')) {
      const yrm = t.match(YEAR_RANGE_RE);
      if (yrm && !t.startsWith('\u2022')) {
        const left = t.slice(0, t.indexOf(yrm[1])).trim();
        if (left.length > 3) {
          blocks.push({ type: 'dateline', text: t, left, right: yrm[1].trim() });
          continue;
        }
      }
    }

    // Single date (education) e.g. "Sep 2026"
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
//  CV PDF — Exact match to Anand_Kumar_Ops_.pdf reference
// ══════════════════════════════════════════════════════════
//
//  Reference layout (from the uploaded PDF):
//  - Name: ~14pt bold, centered, black
//  - Subtitle: ~10pt italic, centered
//  - Contact: ~9pt normal, centered, gray
//  - Full-width dark line (1pt, black) after contact
//  - Section headers: ~12pt bold, with thick dark line below
//  - Competencies: 3 COLUMNS, 4 rows each
//  - Company lines: italic, gray
//  - Bullets: small bullet char, indented
//  - Cert lines: bold prefix, normal body

const PG_W = 210;
const PG_H = 297;
const ML = 18;
const MR = 18;
const MT = 15;
const MB = 15;
const CW = PG_W - ML - MR;

// Target zone: content should end between 255mm and 277mm from top
const TARGET_MIN_Y = 255;
const TARGET_MAX_Y = PG_H - MB - 5; // 277mm

interface Sizing {
  nameFont: number;
  headerFont: number;
  bodyFont: number;
  companyFont: number;
  lineHeight: number;
  bulletGap: number;
  sectionGapBefore: number;
  afterHeaderLine: number; // ALWAYS 4mm minimum
}

function makeSizing(baseFontSize: number): Sizing {
  return {
    nameFont: baseFontSize + 7,
    headerFont: baseFontSize + 1,
    bodyFont: baseFontSize,
    companyFont: baseFontSize - 0.5,
    lineHeight: baseFontSize * 0.42,
    bulletGap: baseFontSize * 0.15,
    sectionGapBefore: baseFontSize * 0.55,
    afterHeaderLine: 4, // RULE 1: ALWAYS 4mm, never less
  };
}

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

function renderCvPdf(doc: any, blocks: Block[], sz: Sizing, maxBulletsPerRole: number): { lastY: number; bulletCount: number } {
  let y = MT;
  let prevType = '';
  let bulletsInRole = 0;
  let totalBullets = 0;

  for (const b of blocks) {
    switch (b.type) {

      // ─── NAME: bold, centered ───
      case 'name': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.nameFont);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += sz.nameFont * 0.35 + 1.5;
        break;
      }

      // ─── SUBTITLE: italic, centered ───
      case 'subtitle': {
        doc.setFont('helvetica', 'oblique');
        doc.setFontSize(sz.bodyFont);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += sz.bodyFont * 0.35 + 1;
        break;
      }

      // ─── CONTACT: normal, centered, gray + dark line below ───
      case 'contact': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.bodyFont - 0.5);
        doc.setTextColor(100, 100, 100);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += (sz.bodyFont - 0.5) * 0.35 + 2.5;
        // Full-width dark line (matches reference)
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(ML, y, PG_W - MR, y);
        y += 3; // gap after contact line to first section
        break;
      }

      // ─── SECTION HEADER: bold, with thin elegant line below ───
      // RULE 1: 4mm gap after EVERY section header underline
      // RULE 2: 0.2mm thick, #CCCCCC color
      case 'header': {
        // Gap before header
        if (prevType && prevType !== 'contact' && prevType !== 'divider') {
          y += sz.sectionGapBefore;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.headerFont);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, ML, y);
        y += 1.8;
        // RULE 2: Thin elegant line — 0.2mm, #CCCCCC
        doc.setDrawColor(204, 204, 204);
        doc.setLineWidth(0.2);
        doc.line(ML, y, PG_W - MR, y);
        // RULE 1: EXACTLY 4mm gap after section line
        y += sz.afterHeaderLine; // always 4mm
        bulletsInRole = 0;
        break;
      }

      case 'divider':
        break;

      // ─── DATELINE: bold title left, date right-aligned ───
      case 'dateline': {
        if (prevType === 'bullet' || prevType === 'text') {
          y += sz.sectionGapBefore * 0.6;
        }
        bulletsInRole = 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.bodyFont + 1);
        doc.setTextColor(0, 0, 0);
        doc.text(b.left || '', ML, y);
        // Date pushed to far right
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.bodyFont);
        doc.text(b.right || '', PG_W - MR, y, { align: 'right' });
        y += sz.lineHeight + 0.5;
        break;
      }

      // ─── BULLET ───
      case 'bullet': {
        bulletsInRole++;
        if (bulletsInRole > maxBulletsPerRole) break;
        totalBullets++;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.bodyFont);
        doc.setTextColor(51, 51, 51);
        const rawText = b.text.replace(/^\u2022\s*/, '');
        const bulletX = ML + 4;
        const textX = ML + 8;
        const textMaxW = CW - 8;
        const bLines = wrapText(doc, rawText, textMaxW);

        doc.text('\u2022', bulletX, y);
        for (let li = 0; li < bLines.length; li++) {
          doc.text(bLines[li], textX, y);
          y += sz.lineHeight;
        }
        y += sz.bulletGap;
        break;
      }

      // ─── COMPETENCIES: 3 COLUMNS (matching reference) ───
      case 'competencies': {
        const items = b.items || [];
        const third = Math.ceil(items.length / 3);
        const col1 = items.slice(0, third);
        const col2 = items.slice(third, third * 2);
        const col3 = items.slice(third * 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.bodyFont);
        doc.setTextColor(51, 51, 51);

        const rows = Math.max(col1.length, col2.length, col3.length);
        const colStart1 = ML + 2;
        const colStart2 = ML + CW / 3 + 2;
        const colStart3 = ML + (CW * 2) / 3 + 2;

        for (let r = 0; r < rows; r++) {
          if (r < col1.length) doc.text(`\u2022  ${col1[r]}`, colStart1, y);
          if (r < col2.length) doc.text(`\u2022  ${col2[r]}`, colStart2, y);
          if (r < col3.length) doc.text(`\u2022  ${col3[r]}`, colStart3, y);
          y += sz.lineHeight + 0.5;
        }
        break;
      }

      // ─── CERTLINE: bold prefix + normal body ───
      case 'certline': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.bodyFont);
        doc.setTextColor(0, 0, 0);
        const pw = doc.getTextWidth((b.prefix || '') + ' ');
        doc.text((b.prefix || '') + ' ', ML, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        const bodyMaxW = CW - pw;
        const cLines = wrapText(doc, b.body || '', bodyMaxW);
        doc.text(cLines[0], ML + pw, y);
        y += sz.lineHeight;
        for (let li = 1; li < cLines.length; li++) {
          doc.text(cLines[li], ML + pw, y);
          y += sz.lineHeight;
        }
        break;
      }

      // ─── TEXT: company line (italic after dateline) or normal ───
      case 'text': {
        if (prevType === 'dateline') {
          // Company/location line — italic, gray (matches reference)
          doc.setFont('helvetica', 'oblique');
          doc.setFontSize(sz.companyFont);
          doc.setTextColor(100, 100, 100);
          doc.text(b.text, ML, y);
          y += sz.lineHeight + 0.5;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(sz.bodyFont);
          doc.setTextColor(51, 51, 51);
          const tLines = wrapText(doc, b.text, CW);
          for (const tl of tLines) {
            doc.text(tl, ML, y);
            y += sz.lineHeight;
          }
        }
        break;
      }

      case 'blank':
        y += 0.5;
        break;
    }

    if (b.type !== 'divider') prevType = b.type;
  }

  return { lastY: y, bulletCount: totalBullets };
}

// Dry-run measurement on a throwaway doc
function measureCv(jsPDFClass: any, blocks: Block[], sz: Sizing, maxB: number): { lastY: number; bulletCount: number } {
  const tmp = new jsPDFClass({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  return renderCvPdf(tmp, blocks, sz, maxB);
}

function buildCvPdf(doc: any, text: string, jsPDFClass: any) {
  const blocks = parseBlocks(text);

  // RULE 3: Dynamic font sizing to fill the entire page
  // Start at 9.5pt, increase by 0.3 until content fills 255-277mm range
  let baseFontSize = 9.5;
  let rendered = false;
  let iterations = 0;
  const maxIterations = 5;
  let finalResult = { lastY: 0, bulletCount: 0 };

  while (!rendered && iterations < maxIterations) {
    iterations++;
    const sz = makeSizing(baseFontSize);
    const result = measureCv(jsPDFClass, blocks, sz, 6);

    // RULE 4: Log verification values
    console.log(`[CV PDF] Iteration ${iterations}: baseFontSize=${baseFontSize.toFixed(1)}, lastY=${result.lastY.toFixed(1)}mm, bullets=${result.bulletCount}`);

    if (result.lastY > TARGET_MAX_Y) {
      // Overflow — decrease font size
      baseFontSize -= 0.3;
      if (baseFontSize < 8) {
        // Emergency: render at minimum size
        console.warn('[CV PDF] Emergency: font size too small, rendering at 8pt');
        baseFontSize = 8;
        rendered = true;
        finalResult = result;
      }
    } else if (result.lastY < TARGET_MIN_Y) {
      // Too much blank space — increase font size
      baseFontSize += 0.3;
      finalResult = result;
      // If we've hit the max font and still have space, that's OK — use it
      if (baseFontSize > 12) {
        baseFontSize = 12;
        rendered = true;
      }
    } else {
      // Perfect: lastY is between 255mm and 277mm
      rendered = true;
      finalResult = result;
    }
  }

  // If loop ended without converging, use last measured size
  if (!rendered) {
    console.log(`[CV PDF] Did not converge after ${maxIterations} iterations, using baseFontSize=${baseFontSize.toFixed(1)}`);
  }

  // Final render on the real document
  const finalSz = makeSizing(baseFontSize);
  const result = renderCvPdf(doc, blocks, finalSz, 6);

  // RULE 4: Final verification logging
  const remainingSpace = PG_H - MB - result.lastY;
  console.log(`[CV PDF] === FINAL VERIFICATION ===`);
  console.log(`[CV PDF] Last content Y position: ${result.lastY.toFixed(1)}mm`);
  console.log(`[CV PDF] Page height: 297mm, Bottom margin: ${MB}mm`);
  console.log(`[CV PDF] Remaining blank space: ${remainingSpace.toFixed(1)}mm`);
  console.log(`[CV PDF] Final base font size: ${baseFontSize.toFixed(1)}pt`);
  console.log(`[CV PDF] Total bullets rendered: ${result.bulletCount}`);

  if (remainingSpace > 25) {
    console.warn(`[CV PDF] WARNING: ${remainingSpace.toFixed(1)}mm blank space remaining (>25mm). PDF may not fill the page optimally.`);
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

    if (!trimmed) { y += 4; lineIdx++; continue; }

    // Name
    if (lineIdx < 2 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(trimmed, ML, y);
      y += 6;
      lineIdx++;
      continue;
    }

    // Contact
    if (lineIdx < 3 && trimmed.includes('|')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 100, 100);
      doc.text(trimmed, ML, y);
      y += 4;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
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

    // Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    const pLines = wrapText(doc, trimmed, CW);
    for (const pl of pLines) {
      if (y > PG_H - MB) { doc.addPage(); y = MT; }
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
    buildCvPdf(doc, text, jsPDF);
  } else {
    buildCoverLetterPdf(doc, text);
  }

  doc.save(`${filename}.pdf`);
}


// ══════════════════════════════════════════════════════════
//  DOCX — matching reference layout
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
          spacing: { after: 20 },
          children: [new TextRun({ text: b.text, bold: true, size: 28, font: FD })],
        }));
        break;
      case 'subtitle':
        p.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 15 },
          children: [new TextRun({ text: b.text, italics: true, size: 20, font: FD })],
        }));
        break;
      case 'contact':
        p.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
          children: [new TextRun({ text: b.text, size: 18, font: FD, color: '666666' })],
        }));
        break;
      case 'header':
        p.push(new Paragraph({
          spacing: { before: prev === 'bullet' || prev === 'text' ? 100 : 60, after: 40 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 1 } },
          children: [new TextRun({ text: b.text, bold: true, size: 24, font: FD })],
        }));
        break;
      case 'divider':
        break;
      case 'dateline':
        p.push(new Paragraph({
          spacing: { before: prev === 'bullet' || prev === 'text' ? 70 : 15, after: 8 },
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_R }],
          children: [
            new TextRun({ text: b.left || '', bold: true, size: 21, font: FD }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: b.right || '', size: 20, font: FD }),
          ],
        }));
        break;
      case 'bullet':
        p.push(new Paragraph({
          spacing: { after: 15 },
          indent: { left: 300, hanging: 160 },
          children: [new TextRun({ text: b.text, size: 18, font: FD, color: '333333' })],
        }));
        break;
      case 'competencies': {
        // 3-column layout via two tab stops
        const items = b.items || [];
        const third = Math.ceil(items.length / 3);
        const col1 = items.slice(0, third);
        const col2 = items.slice(third, third * 2);
        const col3 = items.slice(third * 2);
        const rows = Math.max(col1.length, col2.length, col3.length);
        for (let r = 0; r < rows; r++) {
          const c1 = r < col1.length ? `\u2022  ${col1[r]}` : '';
          const c2 = r < col2.length ? `\u2022  ${col2[r]}` : '';
          const c3 = r < col3.length ? `\u2022  ${col3[r]}` : '';
          p.push(new Paragraph({
            spacing: { after: 12 },
            tabStops: [
              { type: TabStopType.LEFT, position: 3200 },
              { type: TabStopType.LEFT, position: 6400 },
            ],
            children: [
              new TextRun({ text: c1, size: 18, font: FD, color: '333333' }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: c2, size: 18, font: FD, color: '333333' }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: c3, size: 18, font: FD, color: '333333' }),
            ],
          }));
        }
        break;
      }
      case 'certline':
        p.push(new Paragraph({
          spacing: { after: 12 },
          children: [
            new TextRun({ text: (b.prefix || '') + ' ', bold: true, size: 18, font: FD }),
            new TextRun({ text: b.body || '', size: 18, font: FD, color: '333333' }),
          ],
        }));
        break;
      case 'text':
        if (prev === 'dateline') {
          p.push(new Paragraph({
            spacing: { after: 8 },
            children: [new TextRun({ text: b.text, italics: true, size: 18, font: FD, color: '666666' })],
          }));
        } else {
          p.push(new Paragraph({
            spacing: { after: 12 },
            children: [new TextRun({ text: b.text, size: 19, font: FD, color: '333333' })],
          }));
        }
        break;
      case 'blank':
        p.push(new Paragraph({ spacing: { after: 10 } }));
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
    if (!t) { p.push(new Paragraph({ spacing: { after: 100 } })); continue; }
    if (i < 2 && t === t.toUpperCase() && t.length > 3 && !t.includes('|')) {
      p.push(new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: t, bold: true, size: 28, font: FD })],
      }));
      continue;
    }
    if (i < 3 && t.includes('|')) {
      p.push(new Paragraph({
        spacing: { after: 40 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
        children: [new TextRun({ text: t, size: 19, font: FD, color: '666666' })],
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
        page: { margin: { top: 720, bottom: 720, left: 1020, right: 1020 } },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
