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
const MAX_Y = PG_H - MB;

interface Sizing {
  nameFont: number;
  subtitleFont: number;
  contactFont: number;
  headerFont: number;
  titleFont: number;
  dateFont: number;
  companyFont: number;
  bodyFont: number;
  bulletFont: number;
  compFont: number;
  certFont: number;
  summaryLH: number;
  bulletLH: number;
  compLH: number;
  certLH: number;
  betweenBullets: number;
  betweenRoles: number;
  beforeHeader: number;
  afterHeaderLine: number;
}

const NORMAL: Sizing = {
  nameFont: 14,
  subtitleFont: 10,
  contactFont: 9,
  headerFont: 12,
  titleFont: 10.5,
  dateFont: 10,
  companyFont: 9,
  bodyFont: 9.5,
  bulletFont: 9,
  compFont: 9,
  certFont: 9,
  summaryLH: 3.8,
  bulletLH: 3.7,
  compLH: 4.4,
  certLH: 4,
  betweenBullets: 0.8,
  betweenRoles: 3.5,
  beforeHeader: 4.5,
  afterHeaderLine: 2.5,
};

const COMPACT: Sizing = {
  nameFont: 13,
  subtitleFont: 9.5,
  contactFont: 8.5,
  headerFont: 11,
  titleFont: 10,
  dateFont: 9.5,
  companyFont: 8.5,
  bodyFont: 9,
  bulletFont: 8.5,
  compFont: 8.5,
  certFont: 8.5,
  summaryLH: 3.5,
  bulletLH: 3.4,
  compLH: 4,
  certLH: 3.7,
  betweenBullets: 0.5,
  betweenRoles: 2.8,
  beforeHeader: 3.5,
  afterHeaderLine: 2,
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
  let bulletsInRole = 0;

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
        doc.setFontSize(sz.subtitleFont);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += sz.subtitleFont * 0.35 + 1;
        break;
      }

      // ─── CONTACT: normal, centered, gray + dark line below ───
      case 'contact': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.contactFont);
        doc.setTextColor(100, 100, 100);
        doc.text(b.text, PG_W / 2, y, { align: 'center' });
        y += sz.contactFont * 0.35 + 2.5;
        // Full-width dark line (matches reference)
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(ML, y, PG_W - MR, y);
        y += 3;
        break;
      }

      // ─── SECTION HEADER: bold, with thin elegant line below ───
      case 'header': {
        // Gap before header
        if (prevType && prevType !== 'contact' && prevType !== 'divider') {
          y += sz.beforeHeader;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.headerFont);
        doc.setTextColor(0, 0, 0);
        doc.text(b.text, ML, y);
        y += 1.8;
        // Thin elegant line below header
        doc.setDrawColor(204, 204, 204);
        doc.setLineWidth(0.2);
        doc.line(ML, y, PG_W - MR, y);
        y += 2.5; // 2.5mm gap between line and content
        bulletsInRole = 0;
        break;
      }

      case 'divider':
        break;

      // ─── DATELINE: bold title left, date right-aligned ───
      case 'dateline': {
        if (prevType === 'bullet' || prevType === 'text') {
          y += sz.betweenRoles;
        }
        bulletsInRole = 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.titleFont);
        doc.setTextColor(0, 0, 0);
        doc.text(b.left || '', ML, y);
        // Date pushed to far right
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.dateFont);
        doc.text(b.right || '', PG_W - MR, y, { align: 'right' });
        y += 4;
        break;
      }

      // ─── BULLET ───
      case 'bullet': {
        bulletsInRole++;
        if (bulletsInRole > maxBulletsPerRole) break;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sz.bulletFont);
        doc.setTextColor(51, 51, 51);
        const rawText = b.text.replace(/^\u2022\s*/, '');
        const bulletX = ML + 4;
        const textX = ML + 8;
        const textMaxW = CW - 8;
        const bLines = wrapText(doc, rawText, textMaxW);

        doc.text('\u2022', bulletX, y);
        for (let li = 0; li < bLines.length; li++) {
          doc.text(bLines[li], textX, y);
          y += sz.bulletLH;
        }
        y += sz.betweenBullets;
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
        doc.setFontSize(sz.compFont);
        doc.setTextColor(51, 51, 51);

        const rows = Math.max(col1.length, col2.length, col3.length);
        const colStart1 = ML + 2;
        const colStart2 = ML + CW / 3 + 2;
        const colStart3 = ML + (CW * 2) / 3 + 2;

        for (let r = 0; r < rows; r++) {
          if (r < col1.length) doc.text(`\u2022  ${col1[r]}`, colStart1, y);
          if (r < col2.length) doc.text(`\u2022  ${col2[r]}`, colStart2, y);
          if (r < col3.length) doc.text(`\u2022  ${col3[r]}`, colStart3, y);
          y += sz.compLH;
        }
        break;
      }

      // ─── CERTLINE: bold prefix + normal body ───
      case 'certline': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sz.certFont);
        doc.setTextColor(0, 0, 0);
        const pw = doc.getTextWidth((b.prefix || '') + ' ');
        doc.text((b.prefix || '') + ' ', ML, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        const bodyMaxW = CW - pw;
        const cLines = wrapText(doc, b.body || '', bodyMaxW);
        doc.text(cLines[0], ML + pw, y);
        y += sz.certLH;
        for (let li = 1; li < cLines.length; li++) {
          doc.text(cLines[li], ML + pw, y);
          y += sz.certLH;
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

      case 'blank':
        y += 0.5;
        break;
    }

    if (b.type !== 'divider') prevType = b.type;
  }

  return y;
}

// Create a sizing variant with scaled body/bullet fonts and proportional line heights
function scaleSizing(base: Sizing, bodyFontPt: number): Sizing {
  const ratio = bodyFontPt / base.bodyFont;
  return {
    ...base,
    bodyFont: bodyFontPt,
    bulletFont: base.bulletFont * ratio,
    compFont: base.compFont * ratio,
    certFont: base.certFont * ratio,
    companyFont: base.companyFont * ratio,
    summaryLH: base.summaryLH * ratio,
    bulletLH: base.bulletLH * ratio,
    compLH: base.compLH * ratio,
    certLH: base.certLH * ratio,
    betweenBullets: base.betweenBullets * ratio,
    betweenRoles: base.betweenRoles * ratio,
    beforeHeader: base.beforeHeader * ratio,
    // Keep afterHeaderLine fixed at 2.5mm (the gap we set)
    afterHeaderLine: 2.5,
  };
}

// Dry-run measurement on a throwaway doc
function measureCv(jsPDFClass: any, blocks: Block[], sz: Sizing, maxB: number): number {
  const tmp = new jsPDFClass({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  return renderCvPdf(tmp, blocks, sz, maxB);
}

// Target: fill page with 15-20mm bottom margin (MAX_Y = 282, so content should end between 262-277)
const IDEAL_MIN_Y = MAX_Y - 20; // 262mm — if content ends before this, scale up
const IDEAL_MAX_Y = MAX_Y;      // 282mm — must not exceed this

function buildCvPdf(doc: any, text: string, jsPDFClass: any) {
  const blocks = parseBlocks(text);

  // Step 1: Try increasing font sizes to fill the page (9.5 → 10 → 10.5 → 11)
  const upSizes = [9.5, 10, 10.5, 11];
  let bestSz: Sizing = NORMAL;
  let bestBullets = 6;
  let bestY = 0;

  for (const fs of upSizes) {
    const sz = scaleSizing(NORMAL, fs);
    const y = measureCv(jsPDFClass, blocks, sz, 6);
    if (y <= IDEAL_MAX_Y) {
      bestSz = sz;
      bestBullets = 6;
      bestY = y;
    } else {
      break; // overflows, stop scaling up
    }
  }

  // If best fit has too much space AND we haven't maxed fonts, we already picked the largest that fits
  // If the normal 9.5pt already overflows, scale down
  if (bestY === 0) {
    // Even 9.5pt overflows with 6 bullets — try reducing bullets
    const sz95 = scaleSizing(NORMAL, 9.5);
    let y = measureCv(jsPDFClass, blocks, sz95, 5);
    if (y <= IDEAL_MAX_Y) {
      bestSz = sz95; bestBullets = 5; bestY = y;
    } else {
      // Try compact
      y = measureCv(jsPDFClass, blocks, COMPACT, 5);
      if (y <= IDEAL_MAX_Y) {
        bestSz = COMPACT; bestBullets = 5; bestY = y;
      } else {
        bestSz = COMPACT; bestBullets = 4; bestY = measureCv(jsPDFClass, blocks, COMPACT, 4);
      }
    }
  }

  // Render with the best sizing
  renderCvPdf(doc, blocks, bestSz, bestBullets);
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
      if (y > MAX_Y) { doc.addPage(); y = MT; }
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
