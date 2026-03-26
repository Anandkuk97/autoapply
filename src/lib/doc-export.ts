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

// ── Constants ──
const CV_SECTION_HEADERS = [
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
// Matches date ranges like "Jan 2020 - Dec 2023" or "Jan 2020 - Present"
const DATE_RE = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*Present\b)/i;
// Matches standalone single dates like "Sep 2026" at end of line (for education)
const SINGLE_DATE_RE = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s*$/i;

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  return CV_SECTION_HEADERS.some(h => t === h || t.startsWith(h));
}
function isDivider(line: string): boolean {
  return DIVIDER_RE.test(line.trim());
}

// ── Parse structured blocks from CV text ──
interface CvBlock {
  type: 'name' | 'subtitle' | 'contact' | 'header' | 'divider' | 'dateline' | 'bullet' | 'competency-group' | 'text' | 'blank';
  text: string;
  left?: string;
  right?: string;
  items?: string[];
}

function parseCvBlocks(text: string): CvBlock[] {
  const lines = text.split('\n');
  const blocks: CvBlock[] = [];
  let headerIndex = 0;
  let currentSection = '';
  let competencyBullets: string[] = [];

  const flushCompetencies = () => {
    if (competencyBullets.length > 0) {
      blocks.push({ type: 'competency-group', text: '', items: [...competencyBullets] });
      competencyBullets = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      if (currentSection === 'CORE COMPETENCIES') continue;
      flushCompetencies();
      blocks.push({ type: 'blank', text: '' });
      continue;
    }

    if (isDivider(trimmed)) {
      flushCompetencies();
      blocks.push({ type: 'divider', text: trimmed });
      continue;
    }

    if (isSectionHeader(trimmed)) {
      flushCompetencies();
      currentSection = trimmed;
      blocks.push({ type: 'header', text: trimmed });
      continue;
    }

    // Before first section header: name/subtitle/contact
    if (!currentSection && !blocks.some(b => b.type === 'header')) {
      if (headerIndex === 0 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
        blocks.push({ type: 'name', text: trimmed });
        headerIndex++;
        continue;
      }
      if (headerIndex <= 2 && trimmed.includes('|')) {
        if (trimmed.includes('@') || /\d{5,}/.test(trimmed.replace(/[\s\-+()]/g, ''))) {
          blocks.push({ type: 'contact', text: trimmed });
        } else {
          blocks.push({ type: 'subtitle', text: trimmed });
        }
        headerIndex++;
        continue;
      }
      headerIndex++;
    }

    // CORE COMPETENCIES: collect bullets for 2-column
    if (currentSection === 'CORE COMPETENCIES' && trimmed.startsWith('\u2022')) {
      competencyBullets.push(trimmed.replace(/^\u2022\s*/, ''));
      continue;
    }

    // Date range line (experience, project)
    const dateMatch = trimmed.match(DATE_RE);
    if (dateMatch) {
      flushCompetencies();
      const idx = trimmed.indexOf(dateMatch[0]);
      const left = trimmed.slice(0, idx).trim();
      const right = dateMatch[0].trim();
      blocks.push({ type: 'dateline', text: trimmed, left, right });
      continue;
    }

    // Single date line (education, project) - e.g. "MBA - Operations Sep 2026"
    if (currentSection === 'EDUCATION' || currentSection.startsWith('EDUCATION') ||
        currentSection === 'SELECTED PROJECT' || currentSection.startsWith('SELECTED')) {
      const singleMatch = trimmed.match(SINGLE_DATE_RE);
      if (singleMatch && !trimmed.startsWith('\u2022')) {
        const left = trimmed.slice(0, trimmed.indexOf(singleMatch[1])).trim();
        const right = singleMatch[1].trim();
        if (left.length > 3) {
          blocks.push({ type: 'dateline', text: trimmed, left, right });
          continue;
        }
      }
    }

    // Bullet
    if (trimmed.startsWith('\u2022')) {
      flushCompetencies();
      blocks.push({ type: 'bullet', text: trimmed });
      continue;
    }

    flushCompetencies();
    blocks.push({ type: 'text', text: trimmed });
  }

  flushCompetencies();
  return blocks;
}


// ══════════════════════════════════════════════════════════
//  PDF via jsPDF — tight one-page layout
// ══════════════════════════════════════════════════════════

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const MARGIN_LEFT = 18;
const MARGIN_RIGHT = 18;
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

// Spacing constants (mm) — tight for one-page fit
const SP = {
  afterName: 1.5,        // gap after name
  afterSubtitle: 1,      // gap after subtitle line
  afterContact: 3,       // gap after contact block to first section (~8pt)
  beforeHeader: 3.5,     // gap before section header (~10pt from last bullet)
  afterHeaderLine: 1.5,  // gap after header underline (~4pt)
  betweenBullets: 0.7,   // gap between bullet lines (~2pt)
  afterBulletBlock: 0,   // no extra gap after bullets (beforeHeader handles it)
  betweenRoles: 2.8,     // gap between experience roles (~8pt)
  lineHeight: 3.7,       // body text line height (~1.3 at 10pt)
  bulletLineHeight: 3.6, // bullet text line height
};

function wrapText(doc: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(test) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function buildCvPdf(doc: any, text: string) {
  const blocks = parseCvBlocks(text);
  let y = MARGIN_TOP;
  let prevType = '';

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];

    switch (b.type) {
      case 'name': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(17, 17, 17);
        const nameW = doc.getTextWidth(b.text);
        doc.text(b.text, (PAGE_W - nameW) / 2, y);
        y += 6 + SP.afterName;
        break;
      }
      case 'subtitle': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(68, 68, 68);
        const subW = doc.getTextWidth(b.text);
        doc.text(b.text, (PAGE_W - subW) / 2, y);
        y += 4 + SP.afterSubtitle;
        break;
      }
      case 'contact': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(85, 85, 85);
        const conW = doc.getTextWidth(b.text);
        doc.text(b.text, (PAGE_W - conW) / 2, y);
        y += 3.5 + SP.afterContact;
        break;
      }
      case 'header': {
        // Space before header (unless it's the very first element after contact)
        if (prevType && prevType !== 'contact' && prevType !== 'blank') {
          y += SP.beforeHeader;
        } else if (prevType === 'blank') {
          // blank already added small gap, just add a tiny bit more
          y += 1;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(17, 17, 17);
        doc.text(b.text, MARGIN_LEFT, y);
        y += 1.5;
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_LEFT, y, PAGE_W - MARGIN_RIGHT, y);
        y += SP.afterHeaderLine;
        break;
      }
      case 'divider':
        // Skip — header has underline
        break;
      case 'dateline': {
        // Add role gap if previous was bullet (new role within same section)
        if (prevType === 'bullet') {
          y += SP.betweenRoles;
        } else {
          y += 1;
        }
        // Left: bold title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(17, 17, 17);
        doc.text(b.left || '', MARGIN_LEFT, y);
        // Right: date
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const dateW = doc.getTextWidth(b.right || '');
        doc.text(b.right || '', PAGE_W - MARGIN_RIGHT - dateW, y);
        y += 3.8;
        break;
      }
      case 'bullet': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(34, 34, 34);
        const bulletText = b.text.replace(/^\u2022\s*/, '');
        const indent = 4;
        const bulletMaxW = CONTENT_W - indent - 3;
        const bLines = wrapText(doc, bulletText, bulletMaxW);

        // Bullet character
        doc.text('\u2022', MARGIN_LEFT + indent, y);
        for (let li = 0; li < bLines.length; li++) {
          doc.text(bLines[li], MARGIN_LEFT + indent + 3, y);
          y += SP.bulletLineHeight;
        }
        y += SP.betweenBullets;
        break;
      }
      case 'competency-group': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const col1 = items.slice(0, half);
        const col2 = items.slice(half);
        const colW = CONTENT_W / 2 - 2;
        y += 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(34, 34, 34);

        const rowCount = Math.max(col1.length, col2.length);
        for (let r = 0; r < rowCount; r++) {
          if (r < col1.length) {
            doc.text(`\u2022 ${col1[r]}`, MARGIN_LEFT + 2, y);
          }
          if (r < col2.length) {
            doc.text(`\u2022 ${col2[r]}`, MARGIN_LEFT + colW + 4, y);
          }
          y += 3.8;
        }
        break;
      }
      case 'text': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(34, 34, 34);
        const tLines = wrapText(doc, b.text, CONTENT_W);
        for (const tl of tLines) {
          doc.text(tl, MARGIN_LEFT, y);
          y += SP.lineHeight;
        }
        break;
      }
      case 'blank':
        y += 1;
        break;
    }

    if (b.type !== 'divider') {
      prevType = b.type;
    }
  }

  return y; // return final y for overflow detection
}

function buildCoverLetterPdf(doc: any, text: string) {
  const lines = text.split('\n');
  let y = MARGIN_TOP;
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
      doc.setTextColor(17, 17, 17);
      doc.text(trimmed, MARGIN_LEFT, y);
      y += 6;
      lineIdx++;
      continue;
    }

    // Contact line
    if (lineIdx < 3 && trimmed.includes('|')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(85, 85, 85);
      doc.text(trimmed, MARGIN_LEFT, y);
      y += 4.5;
      lineIdx++;
      continue;
    }

    // Salutation or closing
    if (/^(Dear|Warm regards|Kind regards|Sincerely|Best regards|Yours)/i.test(trimmed)) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(17, 17, 17);
      doc.text(trimmed, MARGIN_LEFT, y);
      y += 6;
      lineIdx++;
      continue;
    }

    // Body text — wrap
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(34, 34, 34);
    const pLines = wrapText(doc, trimmed, CONTENT_W);
    for (const pl of pLines) {
      if (y > PAGE_H - MARGIN_BOTTOM) {
        doc.addPage();
        y = MARGIN_TOP;
      }
      doc.text(pl, MARGIN_LEFT, y);
      y += 4.8;
    }
    y += 1;
    lineIdx++;
  }
}

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
//  DOCX via docx lib — tight professional layout
// ══════════════════════════════════════════════════════════

const FONT_DOC = 'Calibri';
const TAB_RIGHT = TabStopPosition.MAX;

function buildCvDocxParagraphs(text: string): Paragraph[] {
  const blocks = parseCvBlocks(text);
  const paras: Paragraph[] = [];
  let prevType = '';

  for (const b of blocks) {
    switch (b.type) {
      case 'name':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: b.text, bold: true, size: 36, font: FONT_DOC })],
        }));
        break;
      case 'subtitle':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: b.text, size: 22, font: FONT_DOC, color: '444444' })],
        }));
        break;
      case 'contact':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: b.text, size: 19, font: FONT_DOC, color: '555555' })],
        }));
        break;
      case 'header':
        paras.push(new Paragraph({
          spacing: { before: prevType === 'bullet' ? 140 : 100, after: 40 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '444444', space: 1 } },
          children: [new TextRun({ text: b.text, bold: true, size: 21, font: FONT_DOC, characterSpacing: 50 })],
        }));
        break;
      case 'divider':
        break;
      case 'dateline':
        paras.push(new Paragraph({
          spacing: { before: prevType === 'bullet' ? 80 : 40, after: 10 },
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          children: [
            new TextRun({ text: b.left || '', bold: true, size: 19, font: FONT_DOC }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: b.right || '', size: 18, font: FONT_DOC, color: '666666' }),
          ],
        }));
        break;
      case 'bullet':
        paras.push(new Paragraph({
          spacing: { after: 15 },
          indent: { left: 240, hanging: 160 },
          children: [new TextRun({ text: b.text, size: 19, font: FONT_DOC })],
        }));
        break;
      case 'competency-group': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const rows = Math.max(half, items.length - half);
        for (let r = 0; r < rows; r++) {
          const left = r < half ? `\u2022 ${items[r]}` : '';
          const right = (r + half) < items.length ? `\u2022 ${items[r + half]}` : '';
          paras.push(new Paragraph({
            spacing: { after: 10 },
            tabStops: [{ type: TabStopType.LEFT, position: 4800 }],
            children: [
              new TextRun({ text: left, size: 19, font: FONT_DOC }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: right, size: 19, font: FONT_DOC }),
            ],
          }));
        }
        break;
      }
      case 'text':
        paras.push(new Paragraph({
          spacing: { after: 15 },
          children: [new TextRun({ text: b.text, size: 19, font: FONT_DOC })],
        }));
        break;
      case 'blank':
        paras.push(new Paragraph({ spacing: { after: 20 } }));
        break;
    }
    if (b.type !== 'divider') prevType = b.type;
  }

  return paras;
}

function buildCoverLetterDocxParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n');
  const paras: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      paras.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    // Name
    if (i < 2 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
      paras.push(new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: trimmed, bold: true, size: 28, font: FONT_DOC })],
      }));
      continue;
    }

    // Contact
    if (i < 3 && trimmed.includes('|')) {
      paras.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: trimmed, size: 19, font: FONT_DOC, color: '555555' })],
      }));
      continue;
    }

    paras.push(new Paragraph({
      spacing: { after: 50, line: 300 },
      children: [new TextRun({ text: trimmed, size: 22, font: FONT_DOC })],
    }));
  }

  return paras;
}

export async function downloadAsDocx(text: string, filename: string) {
  const isCV = filename.toLowerCase().includes('cv');
  const children = isCV ? buildCvDocxParagraphs(text) : buildCoverLetterDocxParagraphs(text);

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
