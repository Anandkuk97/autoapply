import { saveAs } from 'file-saver';
import {
  Document,
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
  let headerIndex = 0; // track position for name/subtitle/contact detection
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
      if (currentSection === 'CORE COMPETENCIES') continue; // skip blanks inside competencies
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

    // Before first section header: name, subtitle, contact
    if (!currentSection && !blocks.some(b => b.type === 'header')) {
      if (headerIndex === 0 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
        blocks.push({ type: 'name', text: trimmed });
        headerIndex++;
        continue;
      }
      if (headerIndex <= 2 && trimmed.includes('|')) {
        // Determine if it's subtitle (Role | Specialty) or contact (has @ or phone-like)
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

    // CORE COMPETENCIES: collect bullets for 2-column grid
    if (currentSection === 'CORE COMPETENCIES' && trimmed.startsWith('\u2022')) {
      competencyBullets.push(trimmed.replace(/^\u2022\s*/, ''));
      continue;
    }

    // Date line
    const dateMatch = trimmed.match(DATE_RE);
    if (dateMatch) {
      flushCompetencies();
      const idx = trimmed.indexOf(dateMatch[0]);
      const left = trimmed.slice(0, idx).trim();
      const right = dateMatch[0].trim();
      blocks.push({ type: 'dateline', text: trimmed, left, right });
      continue;
    }

    // Bullet
    if (trimmed.startsWith('\u2022')) {
      flushCompetencies();
      blocks.push({ type: 'bullet', text: trimmed });
      continue;
    }

    // Default text
    flushCompetencies();
    blocks.push({ type: 'text', text: trimmed });
  }

  flushCompetencies();
  return blocks;
}

// ══════════════════════════════════════════════════════════
//  CV PDF — Professional layout via html2pdf.js
// ══════════════════════════════════════════════════════════

function buildCvHtml(text: string): string {
  const blocks = parseCvBlocks(text);
  const F = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
  let html = '';

  for (const b of blocks) {
    switch (b.type) {
      case 'name':
        html += `<div style="text-align:center;font-family:${F};font-size:20px;font-weight:700;letter-spacing:3px;color:#111;margin-bottom:2px">${b.text}</div>`;
        break;
      case 'subtitle':
        html += `<div style="text-align:center;font-family:${F};font-size:11px;color:#444;margin-bottom:1px">${b.text}</div>`;
        break;
      case 'contact':
        html += `<div style="text-align:center;font-family:${F};font-size:10px;color:#555;margin-bottom:8px">${b.text}</div>`;
        break;
      case 'header':
        html += `<div style="font-family:${F};font-size:11px;font-weight:700;letter-spacing:2px;color:#111;margin-top:14px;padding-bottom:3px;border-bottom:1.5px solid #333">${b.text}</div>`;
        break;
      case 'divider':
        // We draw the line under the header instead, so skip explicit dividers
        break;
      case 'dateline':
        html += `<div style="display:flex;justify-content:space-between;align-items:baseline;font-family:${F};margin-top:8px;margin-bottom:1px">`;
        html += `<span style="font-size:10.5px;font-weight:700;color:#111">${b.left}</span>`;
        html += `<span style="font-size:10px;color:#555;white-space:nowrap">${b.right}</span>`;
        html += `</div>`;
        break;
      case 'bullet':
        html += `<div style="font-family:${F};font-size:10px;color:#222;padding-left:14px;text-indent:-12px;line-height:1.55;margin-top:2px">${b.text}</div>`;
        break;
      case 'competency-group': {
        const items = b.items || [];
        const half = Math.ceil(items.length / 2);
        const col1 = items.slice(0, half);
        const col2 = items.slice(half);
        html += `<div style="display:flex;gap:16px;margin-top:6px;margin-bottom:2px">`;
        html += `<div style="flex:1;font-family:${F};font-size:10px;color:#222;line-height:1.7">${col1.map(c => `<div>\u2022 ${c}</div>`).join('')}</div>`;
        html += `<div style="flex:1;font-family:${F};font-size:10px;color:#222;line-height:1.7">${col2.map(c => `<div>\u2022 ${c}</div>`).join('')}</div>`;
        html += `</div>`;
        break;
      }
      case 'text':
        html += `<div style="font-family:${F};font-size:10px;color:#222;line-height:1.55;margin-top:2px">${b.text}</div>`;
        break;
      case 'blank':
        html += `<div style="height:4px"></div>`;
        break;
    }
  }

  return `<div style="padding:0;margin:0;color:#111;background:#fff">${html}</div>`;
}

// ── Cover Letter PDF HTML ──
function buildCoverLetterHtml(text: string): string {
  const F = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
  const lines = text.split('\n');
  let html = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += `<div style="height:12px"></div>`;
      continue;
    }
    // Detect "Dear ..." or "Warm regards," etc
    if (/^(Dear|To|Warm regards|Kind regards|Sincerely|Best regards|Yours)/i.test(trimmed)) {
      html += `<div style="font-family:${F};font-size:11px;color:#111;line-height:1.7;margin-top:4px;margin-bottom:4px">${trimmed}</div>`;
    } else {
      html += `<div style="font-family:${F};font-size:11px;color:#222;line-height:1.7;text-align:justify">${trimmed}</div>`;
    }
  }

  return `<div style="padding:0;margin:0;color:#111;background:#fff">${html}</div>`;
}

export async function downloadAsPdf(text: string, filename: string) {
  const html2pdf = (await import('html2pdf.js')).default;
  const isCV = filename.toLowerCase().includes('cv');

  const container = document.createElement('div');
  container.style.width = '170mm'; // A4 content width at 20mm margins
  container.innerHTML = isCV ? buildCvHtml(text) : buildCoverLetterHtml(text);
  document.body.appendChild(container);

  await html2pdf()
    .set({
      margin: [20, 20, 20, 20],
      filename: `${filename}.pdf`,
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}

// ══════════════════════════════════════════════════════════
//  CV DOCX — Professional layout via docx lib
// ══════════════════════════════════════════════════════════

const FONT = 'Calibri';
const TAB_RIGHT = TabStopPosition.MAX; // right edge

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
          children: [new TextRun({ text: b.text, size: 21, font: FONT, color: '444444' })],
        }));
        break;

      case 'contact':
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: b.text, size: 19, font: FONT, color: '555555' })],
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
        // Dividers are handled by header bottom border, skip
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

      case 'bullet':
        paras.push(new Paragraph({
          spacing: { after: 30 },
          indent: { left: 280, hanging: 180 },
          children: [new TextRun({ text: b.text, size: 20, font: FONT })],
        }));
        break;

      case 'competency-group': {
        // DOCX doesn't do inline columns easily, so use tab-stop two-column approach
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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paras.push(new Paragraph({ spacing: { after: 120 } }));
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

  const doc = new Document({
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
