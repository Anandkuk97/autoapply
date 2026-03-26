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
const DATE_RE = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*Present\b)/i;

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

    if (currentSection === 'CORE COMPETENCIES' && trimmed.startsWith('\u2022')) {
      competencyBullets.push(trimmed.replace(/^\u2022\s*/, ''));
      continue;
    }

    const dateMatch = trimmed.match(DATE_RE);
    if (dateMatch) {
      flushCompetencies();
      const idx = trimmed.indexOf(dateMatch[0]);
      const left = trimmed.slice(0, idx).trim();
      const right = dateMatch[0].trim();
      blocks.push({ type: 'dateline', text: trimmed, left, right });
      continue;
    }

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
//  PDF via jsPDF — full manual layout control
// ══════════════════════════════════════════════════════════

// Page constants (mm)
const PAGE_W = 210; // A4
const PAGE_H = 297;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const MARGIN_LEFT = 18;
const MARGIN_RIGHT = 18;
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

function ensureSpace(doc: any, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

// Word-wrap helper: splits text into lines that fit within maxWidth
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

  for (const b of blocks) {
    switch (b.type) {
      case 'name': {
        y = ensureSpace(doc, y, 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(17, 17, 17);
        const nameW = doc.getTextWidth(b.text);
        doc.text(b.text, (PAGE_W - nameW) / 2, y);
        y += 7;
        break;
      }
      case 'subtitle': {
        y = ensureSpace(doc, y, 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(68, 68, 68);
        const subW = doc.getTextWidth(b.text);
        doc.text(b.text, (PAGE_W - subW) / 2, y);
        y += 5;
        break;
      }
      case 'contact': {
        y = ensureSpace(doc, y, 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(85, 85, 85);
        const conW = doc.getTextWidth(b.text);
        doc.text(b.text, (PAGE_W - conW) / 2, y);
        y += 7;
        break;
      }
      case 'header': {
        y = ensureSpace(doc, y, 12);
        y += 5; // space above header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(17, 17, 17);
        doc.text(b.text, MARGIN_LEFT, y);
        y += 2;
        doc.setDrawColor(51, 51, 51);
        doc.setLineWidth(0.4);
        doc.line(MARGIN_LEFT, y, PAGE_W - MARGIN_RIGHT, y);
        y += 5;
        break;
      }
      case 'divider':
        // Skip — header has border
        break;
      case 'dateline': {
        y = ensureSpace(doc, y, 8);
        y += 3;
        // Left: bold job title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(17, 17, 17);
        doc.text(b.left || '', MARGIN_LEFT, y);
        // Right: date, right-aligned
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(85, 85, 85);
        const dateW = doc.getTextWidth(b.right || '');
        doc.text(b.right || '', PAGE_W - MARGIN_RIGHT - dateW, y);
        y += 4.5;
        break;
      }
      case 'bullet': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(34, 34, 34);
        const bulletText = b.text.replace(/^\u2022\s*/, '');
        const bulletIndent = 4;
        const bulletMaxW = CONTENT_W - bulletIndent - 3;
        const bLines = wrapText(doc, bulletText, bulletMaxW);
        const needed = bLines.length * 4.2 + 1;
        y = ensureSpace(doc, y, needed);
        // Draw bullet character
        doc.text('\u2022', MARGIN_LEFT + bulletIndent, y);
        // Draw wrapped text
        for (let li = 0; li < bLines.length; li++) {
          doc.text(bLines[li], MARGIN_LEFT + bulletIndent + 3, y);
          y += 4.2;
        }
        y += 0.5;
        break;
      }
      case 'competency-group': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const col1 = items.slice(0, half);
        const col2 = items.slice(half);
        const colW = CONTENT_W / 2 - 2;
        const rowCount = Math.max(col1.length, col2.length);
        y = ensureSpace(doc, y, rowCount * 4.5 + 3);
        y += 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(34, 34, 34);

        for (let r = 0; r < rowCount; r++) {
          if (r < col1.length) {
            doc.text(`\u2022 ${col1[r]}`, MARGIN_LEFT + 2, y);
          }
          if (r < col2.length) {
            doc.text(`\u2022 ${col2[r]}`, MARGIN_LEFT + colW + 4, y);
          }
          y += 4.5;
        }
        y += 1;
        break;
      }
      case 'text': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(34, 34, 34);
        const tLines = wrapText(doc, b.text, CONTENT_W);
        const tNeeded = tLines.length * 4.2;
        y = ensureSpace(doc, y, tNeeded);
        for (const tl of tLines) {
          doc.text(tl, MARGIN_LEFT, y);
          y += 4.2;
        }
        break;
      }
      case 'blank':
        y += 2;
        break;
    }
  }
}

function buildCoverLetterPdf(doc: any, text: string) {
  const lines = text.split('\n');
  let y = MARGIN_TOP;
  let lineIdx = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(17, 17, 17);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      y += 5;
      lineIdx++;
      continue;
    }

    // Name line (ALL CAPS at top)
    if (lineIdx < 2 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
      y = ensureSpace(doc, y, 10);
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
      y = ensureSpace(doc, y, 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(85, 85, 85);
      doc.text(trimmed, MARGIN_LEFT, y);
      y += 5;
      lineIdx++;
      continue;
    }

    // Salutation or closing
    if (/^(Dear|Warm regards|Kind regards|Sincerely|Best regards|Yours)/i.test(trimmed)) {
      y = ensureSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(17, 17, 17);
      doc.text(trimmed, MARGIN_LEFT, y);
      y += 6;
      lineIdx++;
      continue;
    }

    // Body paragraph text — wrap
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(34, 34, 34);
    const pLines = wrapText(doc, trimmed, CONTENT_W);
    const needed = pLines.length * 5;
    y = ensureSpace(doc, y, needed);
    for (const pl of pLines) {
      doc.text(pl, MARGIN_LEFT, y);
      y += 5;
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
//  DOCX via docx lib — professional layout
// ══════════════════════════════════════════════════════════

const FONT = 'Calibri';
const TAB_RIGHT = TabStopPosition.MAX;

function buildCvDocxParagraphs(text: string): Paragraph[] {
  const blocks = parseCvBlocks(text);
  const paras: Paragraph[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case 'name':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: b.text, bold: true, size: 36, font: FONT })],
        }));
        break;
      case 'subtitle':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: b.text, size: 22, font: FONT, color: '444444' })],
        }));
        break;
      case 'contact':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: b.text, size: 20, font: FONT, color: '555555' })],
        }));
        break;
      case 'header':
        paras.push(new Paragraph({
          spacing: { before: 200, after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '333333', space: 2 } },
          children: [new TextRun({ text: b.text, bold: true, size: 22, font: FONT, characterSpacing: 60 })],
        }));
        break;
      case 'divider':
        break;
      case 'dateline':
        paras.push(new Paragraph({
          spacing: { before: 100, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TAB_RIGHT }],
          children: [
            new TextRun({ text: b.left || '', bold: true, size: 21, font: FONT }),
            new TextRun({ children: [new Tab()] }),
            new TextRun({ text: b.right || '', size: 20, font: FONT, color: '555555' }),
          ],
        }));
        break;
      case 'bullet': {
        const bulletText = b.text;
        paras.push(new Paragraph({
          spacing: { after: 30 },
          indent: { left: 280, hanging: 180 },
          children: [new TextRun({ text: bulletText, size: 20, font: FONT })],
        }));
        break;
      }
      case 'competency-group': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const rows = Math.max(half, items.length - half);
        for (let r = 0; r < rows; r++) {
          const left = r < half ? `\u2022 ${items[r]}` : '';
          const right = (r + half) < items.length ? `\u2022 ${items[r + half]}` : '';
          paras.push(new Paragraph({
            spacing: { after: 20 },
            tabStops: [{ type: TabStopType.LEFT, position: 4800 }],
            children: [
              new TextRun({ text: left, size: 20, font: FONT }),
              new TextRun({ children: [new Tab()] }),
              new TextRun({ text: right, size: 20, font: FONT }),
            ],
          }));
        }
        break;
      }
      case 'text':
        paras.push(new Paragraph({
          spacing: { after: 30 },
          children: [new TextRun({ text: b.text, size: 20, font: FONT })],
        }));
        break;
      case 'blank':
        paras.push(new Paragraph({ spacing: { after: 60 } }));
        break;
    }
  }

  return paras;
}

function buildCoverLetterDocxParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n');
  const paras: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      paras.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Name
    if (i < 2 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
      paras.push(new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: trimmed, bold: true, size: 28, font: FONT })],
      }));
      continue;
    }

    // Contact
    if (i < 3 && trimmed.includes('|')) {
      paras.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: trimmed, size: 20, font: FONT, color: '555555' })],
      }));
      continue;
    }

    paras.push(new Paragraph({
      spacing: { after: 60, line: 320 },
      children: [new TextRun({ text: trimmed, size: 22, font: FONT })],
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
          margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
