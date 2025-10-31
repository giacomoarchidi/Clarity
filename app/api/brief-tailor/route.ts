import OpenAI from "openai";
import { DEPARTMENTS, type DepartmentId } from "../../config/departments";

export async function POST(req: Request) {
  try {
    const { article, deptId, actions, strategyContext }: {
      article: { title: string; source: string; link: string; article_summary?: string; why_it_matters?: string; };
      deptId: DepartmentId;
      actions?: string[];
      strategyContext?: string;
    } = await req.json();

    const dept = DEPARTMENTS.find(d => d.id === deptId);
    if (!dept) {
      return Response.json({ error: "Invalid department" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const responsibilities = dept.responsibilities.slice(0, 4).join("; ");
    const actionsList = (actions || []).slice(0, 6).join("; ");

    const instructions = `You are generating a department-tailored operational summary for a food company (Andriani). The summary must be FAITHFUL to the article information provided (do not invent), but framed for the target department's role and the Board-approved actions, aligning with the company strategy context.

Constraints:
- Use concise, actionable, business-oriented language
- 4 lines total
- No speculation; only what is supported by the article summary/why_it_matters
- Explicitly connect to department responsibilities and the provided actions

Department: ${dept.name} (${dept.nameIT})
Responsibilities focus: ${responsibilities || "-"}
Board-approved actions for this department (if any): ${actionsList || "-"}
Company strategy context (if provided): ${strategyContext ? strategyContext.slice(0, 1200) : "-"}

Article title: ${article.title}
Source: ${article.source}
Link: ${article.link}
Why it matters (board): ${article.why_it_matters || "-"}
Article summary (faithful): ${article.article_summary || "-"}

Return ONLY the 4-line tailored summary.`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: "Produce the 4-line department-tailored summary now." }
      ],
      max_tokens: 800
    });

    const text = resp.choices[0]?.message?.content?.trim() || "";
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const trimmed = lines.slice(0, 4).join("\n");

    return Response.json({ tailored_summary: trimmed || text });
  } catch (err: any) {
    console.error("brief-tailor error", err);
    return Response.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}


