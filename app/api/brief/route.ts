import OpenAI from "openai";
import { getRelevantDepartments, DEPARTMENTS, type DepartmentId } from "../config/departments";

const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function POST(req: Request) {
  try {
    const { items, filters, summaryLength, strategyContext } = await req.json();
    // items: [{ title, source, link, date? }, ...]
    // filters: { categories: string[], regions: string[], searchTerm: string }

    // Intelligent pre-filtering based on selected filters
    let filteredItems = items;
    
    // Filter by search term
    if (filters?.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => 
        item.title?.toLowerCase().includes(searchTerm) ||
        item.source?.toLowerCase().includes(searchTerm)
      );
    }

    // SIMPLE RULE: Always analyze exactly the items provided (max 8)
    // 8 articles is the sweet spot for GPT-4o-mini to analyze ALL reliably
    filteredItems = items.slice(0, 8); // Hard limit to 8 articles for guaranteed success
    
    console.log(`Analyzing exactly ${filteredItems.length} articles`);
    console.log('Articles to analyze:', filteredItems.map((item: any) => item.title));

    // NO FILTERING - analyze all articles provided
    // Filters are only for context, not for excluding articles
    let filterContext = "";
    if (filters?.categories?.length || filters?.regions?.length) {
      filterContext = "\nUser is interested in: " + 
        (filters.categories?.join(', ') || '') + ' ' + 
        (filters.regions?.join(', ') || '');
    }

    // Map summary length to line count and precision guidance
    const summaryConfig = (() => {
      const level = (summaryLength || 'medium') as 'short' | 'medium' | 'long';
      if (level === 'short') {
        return {
          lines: 2,
          precisionNote: `Use very concise wording. Prioritize facts explicitly present in the article title/description. Avoid hedging and avoid invented context.`,
          temperature: 0.1
        };
      }
      if (level === 'long') {
        return {
          lines: 10,
          precisionNote: `Provide maximum factual precision. Prefer concrete figures, named entities, dates, and explicit qualifiers like "not specified" rather than guessing. No speculation.`,
          temperature: 0.05
        };
      }
      return {
        lines: 5,
        precisionNote: `Balanced detail and precision. Stick strictly to title/description facts; avoid invention.`,
        temperature: 0.1
      };
    })();

    const strategySection = strategyContext && typeof strategyContext === 'string' && strategyContext.trim().length > 0
      ? `\nCOMPANY STRATEGY CONTEXT (use to tailor 'why_it_matters' for Andriani):\n${strategyContext.slice(0, 20000)}\n\n` : '';

    const instructions = `
You are a strategic analyst creating executive briefings for a food company's board of directors.

YOUR TASK:
- Analyze ALL ${filteredItems.length} articles provided below
- Create executive summaries for EVERY article (even if not directly food-related)
- Extract business implications and strategic insights
- Be creative in finding relevance to food industry, supply chain, or business strategy

EXECUTIVE BRIEFING FORMAT:
- Focus on strategic implications, not just news summaries
- Provide actionable insights for board-level decision making
- Highlight competitive advantages, risks, and opportunities
- Connect news to Andriani's business strategy and market position

${strategySection}
SUMMARY LENGTH & PRECISION:
- Summary length setting: ${summaryLength || 'medium'}
- Article summary must be EXACTLY ${summaryConfig.lines} lines long
- Precision guidance: ${summaryConfig.precisionNote}

REQUIRED FIELDS for each item:
- title: Concise executive summary title (max 60 characters)
- source: News source
- link: Original article URL
- theme: Strategic theme (Agri & Commodity; Policy & Trade; ESG/Energy/Packaging; Competitors/Finance/Governance; Geopolitics & Risks; Tech/Data/Automation; Food Safety/Public Health; Territory/Brand Italy; Communication/Attention Economy)
- priority: High/Medium/Low based on strategic impact for Andriani
- why_it_matters: 2-line PRECISE strategic analysis focusing on SPECIFIC business implications for Andriani
- region: Italy, EU, USA, Canada
- category: packaging, supply-chain, regulations, competitors, innovation, sustainability

RISK MANAGEMENT AUGMENTATION (be concise, board-grade):
-- risk_register: array of risks with fields {name, type, drivers, likelihood, impact, timeframe, mitigation}
  • MUST include at least 2 concrete, article-grounded risks
  • type in {regulatory, supply_chain, market, reputational, financial, technology, ESG}
  • likelihood in {Low, Medium, High}
  • impact in {Low, Medium, High}
  • timeframe in {Immediate, Short-term, Mid-term, Long-term}
  • mitigation: 1-2 concrete actions aligned with Andriani strategy context
  • Be faithful to article facts; if data not present, use explicit "Not specified" rather than invent
-- opportunity_register: array of opportunities with fields {name, thesis, magnitude, timeframe, actions}
  • MUST include at least 2 concrete, article-grounded opportunities
  • Tie each to Andriani's strategy context when relevant
  • Prefer quantified/qualified statements; avoid generic wording; if data missing, use "Not specified"

STRATEGIC ANALYSIS FOCUS:
- Market positioning implications
- Competitive landscape changes
- Regulatory impact on operations
- Supply chain vulnerabilities/opportunities
- Brand reputation considerations
- Financial performance indicators
- Innovation and technology trends
- Sustainability and ESG factors

CATEGORIZATION RULES:
- Each article must be assigned to EXACTLY ONE category
- Choose the most relevant category based on primary content focus
- Avoid duplicate categorization - each article belongs to only one category
- Categories: packaging, supply-chain, regulations, competitors, innovation, sustainability
${filterContext}

⚠️ CRITICAL REQUIREMENT ⚠️
You MUST generate EXACTLY ${filteredItems.length} summaries - one for EACH article below.
DO NOT skip any article. DO NOT filter articles. Analyze ALL ${filteredItems.length} articles.

For each article, provide:
- title: Keep EXACT original article title
- source: Keep original source
- link: Keep original link  
- theme: One of (Agri & Commodity; Policy & Trade; ESG/Energy/Packaging; Competitors/Finance/Governance; Geopolitics & Risks; Tech/Data/Automation; Food Safety/Public Health; Territory/Brand Italy; Communication/Attention Economy)
- priority: Assign based on these STRICT CRITERIA:
  
  **HIGH Priority** (immediate board action required):
  • Direct competitor moves (M&A, pricing, new products)
  • Regulatory changes affecting operations/compliance
  • Major supply chain disruptions
  • Food safety incidents/recalls
  • Tariffs/trade policy changes affecting exports
  • Market opportunities >€10M potential
  
  **MEDIUM Priority** (monitor and plan):
  • Industry trends and market research
  • Technology/innovation developments
  • Sustainability/ESG initiatives
  • Consumer behavior shifts
  • Regional market changes
  
  **LOW Priority** (awareness only):
  • General industry news
  • Distant geographic markets
  • Tangential topics
  • Opinion pieces without actionable data

- why_it_matters: 2-line strategic analysis explaining WHY this matters for food company board strategy
  • Make explicit, concrete links to Andriani's strategy, vision, or objectives when supported by the COMPANY STRATEGY CONTEXT
- region: Italy/EU/USA/Canada
- category: packaging/supply-chain/regulations/competitors/innovation/sustainability
- article_summary: ${summaryConfig.lines}-line FAITHFUL summary of article content (NO invention, based ONLY on title/description). Lines must be separated by "\n" and strictly equal to ${summaryConfig.lines} lines.
- key_data: Object with key metrics/data from article (market_size, growth_rate, companies, regions, etc.)
 - key_data: Object with key metrics/data strictly extracted from the article (NO invention)
   • Include ONLY facts present in title/description (or explicit figures in content if provided)
   • Prefer exact units and figures: keep symbols (€, $, %, tons, mt), dates (YYYY-MM), named entities
   • Suggested keys when present: market_size, growth_rate, prices, volumes, companies (array), regions (array), key_figures (array of strings), policies (array), dates (array)
   • Use arrays for multi-values; for numbers include units in the string if part of the article
   • Omit keys that are not present; do NOT write placeholders like "unknown"
- relevant_departments: Array of department IDs from [legal, operations, marketing, rd, sustainability, finance, supply-chain, quality] that should receive this article
- strategic_actions: Object mapping department IDs to specific actionable strategies (2-3 concrete actions per department)
 - strategic_actions: Object mapping department IDs to specific actionable strategies
   • Actions MUST be department-specific, concrete and SMART-like (verb-first, outcome, metric or deliverable, timeframe)
   • Calibrate by priority: if High → 3 urgent actions max; Medium → 2 focused actions max; Low → 1 light action max
   • Avoid overload: never exceed the cap above for any department
   • Only include departments truly impacted (align with department responsibilities)
 - risk_register: Array of structured risks (see above)
 - opportunity_register: Array of structured opportunities (see above)

DEPARTMENT ASSIGNMENT RULES:
- legal: regulations, compliance, laws, tariffs, intellectual property, contracts
- operations: production, manufacturing, efficiency, capacity, automation
- marketing: brand, market share, consumer trends, campaigns, positioning
- rd: innovation, research, new products, technology, formulations
- sustainability: ESG, environment, carbon, renewable energy, circular economy
- finance: investment, M&A, costs, revenue, financial performance
- supply-chain: logistics, suppliers, distribution, procurement
- quality: food safety, certifications, quality control, standards

OUTPUT: {"items": [${filteredItems.length} complete summaries]}
`;

    // Use OpenAI GPT-4o-mini (faster and more capable than GPT-3.5, same price)
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: instructions },
        { 
          role: "user", 
          content: `Analyze these ${filteredItems.length} news articles and create executive summaries.

INPUT_ARTICLES:
${JSON.stringify(filteredItems, null, 2)}

IMPORTANT: 
- Analyze ONLY the articles above
- Your title should match the original article title
- Do NOT invent articles about Brexit, tariffs, or topics not in the input

Return ONLY JSON format: {"items":[...]}` 
        }
      ],
      temperature: summaryConfig.temperature, // Tuned by summary length setting
      response_format: { type: 'json_object' },
      max_tokens: 16384, // GPT-4o-mini supports up to 16K output tokens
    });

    const text = response.choices[0]?.message?.content ?? "";
    console.log(`OpenAI response length: ${text.length} characters`);
    console.log(`OpenAI response preview: ${text.substring(0, 500)}...`);
    
    let json: any;
    const attemptParse = (s: string) => {
      try {
        return JSON.parse(s);
      } catch {}
      // Try fenced code block ```json ... ```
      const code = s.match(/```json\s*([\s\S]*?)```/i)?.[1]
        || s.match(/```\s*([\s\S]*?)```/i)?.[1];
      if (code) {
        try { return JSON.parse(code); } catch {}
      }
      // Try substring starting at {"items"
      const start = s.indexOf('{"items"');
      const end = s.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        let cand = s.slice(start, end + 1);
        // Remove common trailing commas
        cand = cand.replace(/,\s*(\]|\})/g, '$1');
        try { return JSON.parse(cand); } catch {}
      }
      return null;
    };

    json = attemptParse(text) ?? { items: [] };
    if (!json.items) json.items = [];
    console.log(`Parsed JSON items: ${json.items.length}`);

    // Ensure we have items array
    if (!json.items || !Array.isArray(json.items)) {
      console.error('Invalid response format - no items array found');
      return Response.json({ 
        error: 'AI failed to generate summaries',
        items: [] 
      }, { status: 500 });
    }

    // Attempt to repair missing risk/opportunity registers for any items
    const repairOne = async (item: any): Promise<any> => {
      try {
        const sys = `You will augment an analyzed article with precise, faithful RISK and OPPORTUNITY registers.
Constraints:
- Use ONLY information from the provided fields (title, why_it_matters, article_summary, key_data, strategy_context)
- If a specific field value is not present in the article, write "Not specified" (do not invent)
- Keep it concise, board-grade, business-focused, aligned with Andriani strategy
- Output STRICT JSON with fields {risk_register: [...], opportunity_register: [...]} and at least 2 entries per list`;
        const usr = {
          title: item.title,
          why_it_matters: item.why_it_matters,
          article_summary: item.article_summary,
          key_data: item.key_data,
          strategy_context: typeof strategyContext === 'string' ? strategyContext.slice(0, 2000) : ''
        } as any;
        const resp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.05,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `Fill missing registers for this article (keep faithful):\n${JSON.stringify(usr)}` }
          ],
          max_tokens: 1200
        });
        const aug = attemptParse(resp.choices[0]?.message?.content || '') || {};
        if (aug.risk_register && Array.isArray(aug.risk_register) && aug.risk_register.length > 0) {
          item.risk_register = item.risk_register && item.risk_register.length > 0 ? item.risk_register : aug.risk_register;
        }
        if (aug.opportunity_register && Array.isArray(aug.opportunity_register) && aug.opportunity_register.length > 0) {
          item.opportunity_register = item.opportunity_register && item.opportunity_register.length > 0 ? item.opportunity_register : aug.opportunity_register;
        }
      } catch (e) {
        console.warn('Repair attempt failed for item', item?.title);
      }
      return item;
    };

    const toRepair = (json.items as any[]).filter(it => !it || !Array.isArray(it.risk_register) || it.risk_register.length === 0 || !Array.isArray(it.opportunity_register) || it.opportunity_register.length === 0);
    if (toRepair.length > 0) {
      console.log(`Repairing ${toRepair.length} items missing risk/opportunity registers...`);
      await Promise.all(json.items.map((it: any, idx: number) => (
        (!it || !Array.isArray(it.risk_register) || it.risk_register.length === 0 || !Array.isArray(it.opportunity_register) || it.opportunity_register.length === 0)
          ? repairOne(it).then((fixed) => { json.items[idx] = fixed; })
          : Promise.resolve()
      )));
    }

    // Normalize and, if missing, try safe extraction of key_data strictly from provided summary/fields
    const normalizeKeyData = (obj: any) => {
      if (!obj || typeof obj !== 'object') return undefined;
      const out: any = {};
      const maxEntries = 8;
      for (const [k, v] of Object.entries(obj)) {
        if (v == null) continue;
        if (typeof v === 'string') {
          const s = v.trim();
          if (!s || /^not\s+specified/i.test(s)) continue;
          out[k] = s.slice(0, 400);
        } else if (typeof v === 'number') {
          out[k] = v;
        } else if (Array.isArray(v)) {
          const arr = v
            .map(x => (typeof x === 'string' ? x.trim() : x))
            .filter(x => (typeof x === 'string' ? x.length > 0 && !/^not\s+specified/i.test(x) : x != null))
            .slice(0, 10);
          if (arr.length > 0) out[k] = arr;
        } else if (typeof v === 'object') {
          // Nested objects are rare; keep shallow valid fields only
          const nested: any = {};
          for (const [nk, nv] of Object.entries(v)) {
            if (nv == null) continue;
            if (typeof nv === 'string') {
              const s = nv.trim();
              if (!s || /^not\s+specified/i.test(s)) continue;
              nested[nk] = s.slice(0, 200);
            } else if (typeof nv === 'number') nested[nk] = nv;
          }
          if (Object.keys(nested).length > 0) out[k] = nested;
        }
        if (Object.keys(out).length >= maxEntries) break;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    };

    const extractKeyDataIfMissing = async (item: any) => {
      try {
        const sys = `Extract KEY DATA strictly from the provided fields. Do NOT invent. Omit any field not present.
Return STRICT JSON {key_data:{...}} using concise, precise values (units preserved).`;
        const usr = {
          title: item.title,
          source: item.source,
          why_it_matters: item.why_it_matters,
          article_summary: item.article_summary,
          key_data: item.key_data || null
        } as any;
        const resp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.05,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `From this content, extract only factual key_data (omit anything not present):\n${JSON.stringify(usr)}` }
          ],
          max_tokens: 800
        });
        const aug = attemptParse(resp.choices[0]?.message?.content || '') || {};
        const kd = normalizeKeyData(aug.key_data);
        if (kd) item.key_data = kd;
      } catch {}
      return item;
    };

    await Promise.all((json.items as any[]).map(async (it, idx) => {
      // Normalize existing key_data
      const norm = normalizeKeyData(it?.key_data);
      if (norm) {
        json.items[idx].key_data = norm;
        return;
      }
      // Attempt safe extraction only if missing/empty
      await extractKeyDataIfMissing(it);
      const norm2 = normalizeKeyData(it?.key_data);
      if (norm2) json.items[idx].key_data = norm2; else delete json.items[idx].key_data;
    }));

    // Calibrate strategic actions: limit by priority, deduplicate, and keep only relevant departments if provided
    const capForPriority = (p: string) => (p === 'High' ? 3 : p === 'Medium' ? 2 : 1);
    (json.items as any[]).forEach((it: any) => {
      const cap = capForPriority(it?.priority);
      if (!it || !it.strategic_actions || typeof it.strategic_actions !== 'object') return;
      const allowedDepts = Array.isArray(it.relevant_departments) && it.relevant_departments.length > 0
        ? new Set(it.relevant_departments)
        : null;
      const next: Record<string, string[]> = {};
      for (const [deptId, actions] of Object.entries(it.strategic_actions as Record<string, any>)) {
        if (allowedDepts && !allowedDepts.has(deptId)) continue;
        if (!Array.isArray(actions)) continue;
        const cleaned = actions
          .filter(a => typeof a === 'string')
          .map(a => a.trim())
          .filter(a => a.length > 0);
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const a of cleaned) {
          const key = a.toLowerCase();
          if (!seen.has(key)) { seen.add(key); deduped.push(a); }
        }
        next[deptId] = deduped.slice(0, cap);
      }
      it.strategic_actions = next;
    });

    // TOLERANCE: Accept if we get at least 80% of summaries (e.g. 7 out of 8)
    const minimumAcceptable = Math.floor(filteredItems.length * 0.8);
    if (json.items.length < minimumAcceptable) {
      console.error(`AI generated only ${json.items.length} summaries, minimum acceptable is ${minimumAcceptable}`);
      return Response.json({ 
        error: `Expected ${filteredItems.length} summaries, got only ${json.items.length}`,
        items: json.items
      }, { status: 500 });
    }
    
    // Log warning if not all items were analyzed, but still succeed
    if (json.items.length < filteredItems.length) {
      console.warn(`⚠️ AI analyzed ${json.items.length}/${filteredItems.length} articles (${Math.round(json.items.length/filteredItems.length*100)}% success rate)`);
    }

    console.log(`✅ Successfully generated ${json.items.length} executive summaries`);
    return Response.json(json, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return Response.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
