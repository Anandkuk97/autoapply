import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from 'docx';

// ── Section headers that the CV uses ──
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

const DIVIDER_REGEX = /^[━─\-=]{5,}$/;

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return CV_SECTION_HEADERS.some(h => trimmed === h || trimmed.startsWith(h));
}

function isDividerLine(line: string): boolean {
  return DIVIDER_REGEX.test(line.trim());
}

// ── Detect if a line has a right-aligned date pattern ──
const DATE_PATTERN = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*Present\b)/i;

// ══════════════════════════════════════════════════
//  PDF DOWNLOAD via html2pdf.js (dynamic import)
// ══════════════════════════════════════════════════

function buildStyledHtml(text: string, title: string): string {
  const lines = text.split('\n');
  let html = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += '<div style="height:6px"></div>';
      continue;
    }
    if (isDividerLine(trimmed)) {
      html += '<hr style="border:none;border-top:1.5px solid #333;margin:10px 0">';
      continue;
    }
    if (isSectionHeader(trimmed)) {
      html += `<div style="font-weight:700;font-size:13px;letter-spacing:1.5px;margin-top:12px;margin-bottom:4px;font-family:'Segoe UI',Arial,sans-serif">${trimmed}</div>`;
      continue;
    }

    // Line with date? Split into left content + right-aligned date
    const dateMatch = trimmed.match(DATE_PATTERN);
    if (dateMatch) {
      const idx = trimmed.indexOf(dateMatch[0]);
      const left = trimmed.slice(0, idx).trim();
      const right = dateMatch[0].trim();
      html += `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:11px;line-height:1.5;font-family:'Segoe UI',Arial,sans-serif">`;
      html += `<span style="font-weight:600">${left}</span>`;
      html += `<span style="white-space:nowrap;color:#555">${right}</span>`;
      html += `</div>`;
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('\u2022')) {
      html += `<div style="padding-left:16px;text-indent:-14px;font-size:11px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif">${trimmed}</div>`;
      continue;
    }

    // First couple of lines (name / subtitle / contact) — check for ALL CAPS name
    html += `<div style="font-size:11px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif${trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|') ? ';font-weight:700;font-size:18px;text-align:center;letter-spacing:2px' : ''}">${trimmed}</div>`;
  }

  return `<div style="padding:24px 32px;max-width:720px;margin:0 auto;color:#111;background:#fff">${html}</div>`;
}

export async function downloadAsPdf(text: string, filename: string) {
  const html2pdf = (await import('html2pdf.js')).default;
  const container = document.createElement('div');
  container.innerHTML = buildStyledHtml(text, filename);
  document.body.appendChild(container);

  await html2pdf()
    .set({
      margin: [10, 12, 10, 12],
      filename: `${filename}.pdf`,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}

// ══════════════════════════════════════════════════
//  DOCX DOWNLOAD via docx + file-saver
// ══════════════════════════════════════════════════

function buildDocxParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 } }));
      continue;
    }

    if (isDividerLine(trimmed)) {
      paragraphs.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } },
          spacing: { after: 120 },
        })
      );
      continue;
    }

    if (isSectionHeader(trimmed)) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 24,
              font: 'Calibri',
            }),
          ],
        })
      );
      continue;
    }

    // Date line
    const dateMatch = trimmed.match(DATE_PATTERN);
    if (dateMatch) {
      const idx = trimmed.indexOf(dateMatch[0]);
      const left = trimmed.slice(0, idx).trim();
      const right = dateMatch[0].trim();
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: left + '    ', bold: true, size: 21, font: 'Calibri' }),
          ],
        })
      );
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: right, italics: true, size: 20, font: 'Calibri', color: '555555' }),
          ],
        })
      );
      continue;
    }

    // Bullet
    if (trimmed.startsWith('\u2022')) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          indent: { left: 360, hanging: 200 },
          children: [
            new TextRun({ text: trimmed, size: 21, font: 'Calibri' }),
          ],
        })
      );
      continue;
    }

    // Name (ALL CAPS, no pipe)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|') && !trimmed.includes('\u2022')) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: trimmed, bold: true, size: 32, font: 'Calibri' }),
          ],
        })
      );
      continue;
    }

    // Default line
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: trimmed, size: 21, font: 'Calibri' }),
        ],
      })
    );
  }

  return paragraphs;
}

export async function downloadAsDocx(text: string, filename: string) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children: buildDocxParagraphs(text),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
