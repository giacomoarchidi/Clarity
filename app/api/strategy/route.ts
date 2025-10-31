export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prefer pdf-parse via CommonJS require to avoid Turbopack bundling internals
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let rawText = '';
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      rawText = (data.text || '').replace(/\u0000/g, ' ').trim();
    } catch (e) {
      console.error('pdf-parse failed, no text extracted:', e);
      return Response.json({ error: 'Impossibile estrarre testo dal PDF. Prova con un PDF testuale.' }, { status: 500 });
    }
    if (!rawText) {
      return Response.json({ error: 'Unable to extract text from PDF' }, { status: 422 });
    }

    // Lightweight condensation: collapse whitespace and limit length
    const condensed = rawText
      .replace(/\s+/g, ' ')
      .slice(0, 20000); // cap to 20k chars to keep prompt size reasonable

    return Response.json({ strategyText: condensed }, { status: 200 });
  } catch (err: any) {
    console.error('Strategy upload error:', err);
    return Response.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}


