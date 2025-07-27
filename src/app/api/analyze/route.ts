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
    
    // Atropos Health real-world evidence focused prompt
    const prompt = `
You are a senior real-world evidence strategist at a leading healthcare AI company. Your analysis will inform evidence generation priorities for health systems, pharma, and researchers using federated clinical data networks.

**REAL-WORLD EVIDENCE FOCUS:**
- Identify gaps that can be filled with observational studies using EHR/claims data
- Highlight opportunities for comparative effectiveness research
- Focus on evidence needed at point-of-care for clinical decision-making

**FEDERATED DATA OPPORTUNITIES:**
- Which gaps could be addressed using multi-institutional data networks?
- What research questions need large-scale, diverse patient populations?
- How can real-world data complement traditional clinical trials?

**EVIDENCE GENERATION STRATEGY:**
For each gap, specify:
- **RWE Study Design**: Retrospective cohort, case-control, or registry study
- **Data Requirements**: EHR elements, claims codes, patient registries needed
- **Federated Network Value**: Why multi-site data improves this research
- **Clinical Decision Impact**: How results change treatment algorithms
- **Publication Potential**: Target journals, regulatory submissions

**COMPETITIVE LANDSCAPE:**
- Current evidence generation timelines (months/years)
- How rapid RWE could accelerate insights
- Opportunities for "evidence at the speed of care"

**FORMAT**: Research intelligence report for healthcare CxOs making evidence strategy decisions.

Focus on actionable research that can be executed using real-world clinical data networks, not traditional pharmaceutical clinical trials.

INPUT DATA:
Clinical Question: ${clinicalQuestion}
Research Papers: ${papersText}
Total Papers Analyzed: ${papers.length}

OUTPUT FORMAT: Concise, actionable research intelligence report suitable for healthcare executives.
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
            content: "You are a senior real-world evidence strategist with expertise in EHR data, claims analysis, and federated clinical networks. Your analysis informs evidence generation strategies for health systems and pharmaceutical companies using real-world data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500, // Reduced for faster processing
        temperature: 0.2  // Lower temperature for more consistent, focused output
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