import { NextRequest, NextResponse } from 'next/server';

async function analyzePapers(papers: any[]) {
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
      papersText += `Authors: ${paper.authors ? paper.authors.join(', ') : 'N/A'}\n\n`;
    }
    
    // Analyze with OpenAI
    const prompt = `
      Analyze the following research papers and identify evidence gaps in the field:

      ${papersText}

      Please provide:
      1. A summary of the current research landscape
      2. Key evidence gaps that need to be addressed
      3. Recommendations for future research directions
      4. Potential research questions that could fill these gaps

      Format your response in a clear, structured manner.
    `;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a research analyst specializing in identifying evidence gaps in scientific literature."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    return {
      analysis,
      papers_analyzed: papers.length
    };
    
  } catch (error) {
    return { error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const papers = body.results || [];
    
    const result = await analyzePapers(papers);
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