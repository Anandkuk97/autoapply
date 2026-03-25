import { NextResponse } from 'next/server';
const pdfParse = require('pdf-parse');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse PDF
    const data = await pdfParse(buffer);
    
    return NextResponse.json({ text: data.text });
  } catch (error: any) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 });
  }
}
