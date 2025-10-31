export const runtime = 'nodejs';

import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const deptId = String(formData.get('deptId') || '');
    const articleTitle = String(formData.get('articleTitle') || '');
    const articleLink = String(formData.get('articleLink') || '');
    const articleWhy = String(formData.get('articleWhy') || '');
    const articleSummary = String(formData.get('articleSummary') || '');
    const actionText = String(formData.get('actionText') || '');
    const strategyContext = String(formData.get('strategyContext') || '');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let rawText = '';
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      rawText = (data.text || '').replace(/\u0000/g, ' ').trim();
    } catch (e) {
      console.error('pdf-parse failed:', e);
      return Response.json({ error: 'Impossibile leggere il PDF' }, { status: 500 });
    }
    if (!rawText) {
      return Response.json({ error: 'PDF senza testo leggibile' }, { status: 422 });
    }

    // Condense text
    const condensed = rawText.replace(/\s+/g, ' ').slice(0, 25000);

    // AI screening
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = `You are the Board's AI assistant at Andriani. Review a department proposal against:
- Article content (facts only), Board-requested action, and Andriani strategy context.
Constraints:
- Be precise, board-grade; DO NOT invent beyond the PDF / provided fields
- Tie every point to article facts or strategy context, avoid generic phrasing
- Output STRICT JSON with keys:
  {summary, strengths[], gaps[], risks[], feasibility[], recommended_adjustments[], next_steps[]}`;

    const user = {
      department: deptId,
      article: { title: articleTitle, link: articleLink, why_it_matters: articleWhy, summary: articleSummary },
      action_requested: actionText,
      strategy_context: strategyContext.slice(0, 2000),
      proposal_text: condensed
    } as any;

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Analyze the proposal strictly based on text. Return JSON only.\n${JSON.stringify(user)}` }
      ],
      max_tokens: 1800
    });

    const content = resp.choices[0]?.message?.content || '{}';
    let review: any;
    try { review = JSON.parse(content); } catch { review = {}; }

    // Basic normalization
    const norm = (arr: any) => Array.isArray(arr) ? arr.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim()).slice(0, 10) : [];
    const result = {
      summary: typeof review.summary === 'string' ? review.summary.slice(0, 1200) : '',
      strengths: norm(review.strengths),
      gaps: norm(review.gaps),
      risks: norm(review.risks),
      feasibility: norm(review.feasibility),
      recommended_adjustments: norm(review.recommended_adjustments),
      next_steps: norm(review.next_steps)
    };

    return Response.json({ analysis: result });
  } catch (err: any) {
    console.error('proposal screening error:', err);
    return Response.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}


