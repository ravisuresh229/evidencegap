import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface Paper {
  title: string;
  abstract: string;
  authors: string[];
  journal?: string;
  pubDate?: string | null;
  pmid?: string | null;
  relevanceScore?: number;
}

interface TruncatedPaper {
  title: string;
  abstract: string;
  journal: string;
  pubDate: string;
}

export async function POST(req: NextRequest) {
  let papers: Paper[] = [];
  let query: string = '';

  try {
    const body = await req.json();
    papers = body.papers || [];
    query = body.query || '';

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        analysis: "## **CONFIGURATION ERROR**\n\nOpenAI API key not configured. Please contact support."
      }, { status: 500 });
    }

    if (!papers || papers.length === 0) {
      return NextResponse.json({
        analysis: "No papers available for analysis. Please try a different search query."
      });
    }

    // Truncate papers to avoid token limits
    const truncatedPapers: TruncatedPaper[] = papers.slice(0, 10).map((paper: Paper) => ({
      title: paper.title || 'No title',
      abstract: paper.abstract ? paper.abstract.substring(0, 500) : 'No abstract available',
      journal: paper.journal || 'Unknown journal',
      pubDate: paper.pubDate || 'Unknown date'
    }));

    const prompt = `You are a senior healthcare strategy consultant analyzing medical literature for pharmaceutical and biotech companies.

CLINICAL QUESTION: "${query}"

RESEARCH PAPERS TO ANALYZE:
${truncatedPapers.map((paper: TruncatedPaper, index: number) => `
Paper ${index + 1}:
Title: ${paper.title}
Journal: ${paper.journal} (${paper.pubDate})
Abstract: ${paper.abstract}
`).join('\n')}

Provide a comprehensive analysis in this format:

## **EXECUTIVE SUMMARY**
[2-3 sentences on current research landscape and key opportunities]

## **REAL-WORLD EVIDENCE OPPORTUNITIES**
- **Gap 1**: [Specific evidence gap]
  - RWE Study Design: [Retrospective cohort/case-control/registry study]
  - Data Requirements: [Specific EHR elements, claims codes needed]
  - Clinical Impact: [How this affects patient care decisions]
  - Timeline: [2-5 year estimate]

- **Gap 2**: [Another evidence gap]
  - RWE Study Design: [Study type]
  - Data Requirements: [Data needed]
  - Clinical Impact: [Patient care impact]
  - Timeline: [Timeline estimate]

## **FEDERATED DATA NETWORK VALUE**
[How multi-institutional data could address these gaps]

## **STRATEGIC RECOMMENDATIONS**
1. **Immediate (0-2 years)**: [Quick wins with existing data]
2. **Medium-term (2-5 years)**: [Larger studies needed]
3. **Partnership opportunities**: [Academic/industry collaborations]

Focus on actionable research opportunities using real-world clinical data.`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a healthcare research strategist providing actionable intelligence for evidence generation."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const analysis = completion.choices[0]?.message?.content || "Analysis could not be completed.";

    return NextResponse.json({ analysis });

  } catch (error: unknown) {
    console.error('Analysis API Error:', error);
    
    // Return a meaningful fallback analysis
    return NextResponse.json({
      analysis: `## **ANALYSIS TEMPORARILY UNAVAILABLE**

Found ${papers?.length || 0} relevant research papers for "${query || 'your search'}".

**Key Research Areas Identified:**
- Comparative effectiveness studies needed
- Real-world evidence gaps in clinical outcomes
- Long-term safety and efficacy data requirements
- Patient population diversity in studies

**Recommended Next Steps:**
1. Review the ${papers?.length || 0} papers found for detailed insights
2. Identify specific patient populations of interest
3. Consider multi-institutional data collaboration
4. Plan observational studies using EHR/claims data

*Full AI analysis will be available shortly. Please try again.*`
    });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Analyze API endpoint' });
} 