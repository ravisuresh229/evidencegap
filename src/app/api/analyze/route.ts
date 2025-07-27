import { NextRequest, NextResponse } from 'next/server';

interface Paper {
  title: string;
  abstract: string;
  authors: string[];
  journal?: string;
  pubDate?: string | null;
  pmid?: string | null;
  relevanceScore?: number;
}

async function analyzePapers(papers: Paper[], clinicalQuestion: string) {
  try {
    if (!papers || papers.length === 0) {
      return { error: "No papers provided" };
    }
    
    // Prepare papers for analysis
    let papersText = "";
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      papersText += `Paper ${i + 1}:\n`;
      papersText += `Title: ${paper.title || 'N/A'}\n`;
      papersText += `Abstract: ${paper.abstract || 'N/A'}\n`;
      papersText += `Authors: ${paper.authors ? paper.authors.join(', ') : 'N/A'}\n`;
      papersText += `Journal: ${paper.journal || 'N/A'}\n`;
      papersText += `Publication Date: ${paper.pubDate || 'N/A'}\n`;
      papersText += `Relevance Score: ${paper.relevanceScore || 'N/A'}\n\n`;
    }
    
    // Professional healthcare strategy consultant prompt
    const prompt = `
You are a senior healthcare strategy consultant analyzing medical literature for pharmaceutical and biotech companies. Your analysis will inform $10M+ research investment decisions.

CLIENT CONTEXT: Healthcare executives need actionable intelligence on research gaps that represent commercial opportunities and regulatory requirements.

ANALYSIS FRAMEWORK:

MARKET LANDSCAPE ASSESSMENT
- Current standard of care and treatment algorithms
- Key players (pharma companies, academic centers) in this space
- Regulatory environment (FDA guidance, label requirements)
- Market size and unmet medical need ($$ impact)

EVIDENCE QUALITY AUDIT
- Study design hierarchy: Systematic reviews > RCTs > observational studies
- Sample size adequacy and statistical power
- Follow-up duration vs. clinically meaningful endpoints
- Population representativeness (age, gender, comorbidities, geography)
- Primary vs. surrogate endpoints used

PRIORITY RESEARCH GAPS
For each gap, provide structured analysis:
Gap 1: [Specific Description]
- Clinical Impact: Patient populations affected, current treatment limitations
- Commercial Value: Market size, competitive advantage potential, pricing impact
- Regulatory Pathway: FDA requirements, potential label expansion opportunities
- Study Design: Specific trial design (Phase II/III, primary endpoints, inclusion criteria)
- Timeline & Investment: 3-7 year timeline, estimated cost ($5M-$50M range)
- Execution Risk: Recruitment feasibility, regulatory hurdles, competitive threats
- ROI Potential: Revenue impact if successful, probability of success

(Repeat for 3-5 priority gaps)

STRATEGIC RECOMMENDATIONS
- Immediate Opportunities (0-2 years): Quick wins, registry studies, real-world evidence
- Medium-term Investments (2-5 years): Pivotal trials, regulatory submissions
- Long-term Innovation (5+ years): Novel mechanisms, combination therapies
- Partnership Opportunities: Academic collaborations, CRO partnerships, regulatory consultants

COMPETITIVE INTELLIGENCE
- Who else is investing in this space?
- What trials are currently recruiting?
- Patent landscape and exclusivity considerations
- Potential acquisition targets or licensing opportunities

TONE: Executive summary style. Think McKinsey healthcare practice meets FDA regulatory guidance. Focus on actionable insights with clear ROI implications.

LENGTH: Comprehensive but scannable. Use headers, bullet points, and structured sections.

INPUT DATA:
Clinical Question: ${clinicalQuestion}
Research Papers: ${papersText}
Total Papers Analyzed: ${papers.length}

OUTPUT FORMAT: Professional research intelligence report suitable for C-suite presentation.
    `;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a senior healthcare strategy consultant with expertise in pharmaceutical R&D, FDA regulations, and market analysis. Your analysis informs multi-million dollar investment decisions for pharmaceutical and biotech companies."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    return {
      analysis,
      papers_analyzed: papers.length,
      clinical_question: clinicalQuestion
    };
    
  } catch (error) {
    return { error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const papers = body.results || [];
    const clinicalQuestion = body.question || 'Clinical research analysis';
    
    const result = await analyzePapers(papers, clinicalQuestion);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in analyze API route:', error);
    return NextResponse.json(
      { error: 'Failed to analyze papers' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Analyze API endpoint' });
} 