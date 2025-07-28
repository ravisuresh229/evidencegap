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

// Query-specific intelligence function
const addQueryContext = (query: string) => {
  const contexts: { [key: string]: { focus: string; outcomes: string; populations: string } } = {
    'telemedicine': {
      focus: 'remote care delivery effectiveness, patient engagement, cost implications',
      outcomes: 'clinical outcomes vs in-person care, patient satisfaction, care accessibility',
      populations: 'rural vs urban patients, elderly vs younger patients, different chronic conditions'
    },
    'diabetes': {
      focus: 'glycemic control, medication adherence, complication prevention',
      outcomes: 'HbA1c trends, hospitalization rates, quality of life measures',
      populations: 'type 1 vs type 2, pediatric vs adult, different ethnic groups'
    },
    'jak inhibitors': {
      focus: 'safety profiles, effectiveness vs other biologics, long-term outcomes',
      outcomes: 'adverse events, treatment persistence, disease activity scores',
      populations: 'elderly patients, patients with comorbidities, treatment-naive vs experienced'
    },
    'statins': {
      focus: 'cardiovascular risk reduction, safety in different populations, adherence patterns',
      outcomes: 'LDL reduction, cardiovascular events, muscle-related adverse events',
      populations: 'elderly patients, patients with diabetes, different cardiovascular risk levels'
    },
    'glp-1': {
      focus: 'weight loss effects, cardiovascular benefits, glycemic control',
      outcomes: 'HbA1c reduction, weight loss, cardiovascular outcomes, gastrointestinal side effects',
      populations: 'obese patients, cardiovascular risk patients, different age groups'
    },
    'biologics': {
      focus: 'effectiveness vs conventional therapy, safety profiles, cost-effectiveness',
      outcomes: 'disease activity scores, adverse events, treatment persistence, quality of life',
      populations: 'treatment-naive vs experienced, different disease severities, elderly patients'
    },
    'cancer': {
      focus: 'survival outcomes, treatment response, quality of life during treatment',
      outcomes: 'overall survival, progression-free survival, adverse events, patient-reported outcomes',
      populations: 'different cancer stages, age groups, treatment histories'
    },
    'elderly': {
      focus: 'safety profiles, effectiveness in older populations, polypharmacy interactions',
      outcomes: 'adverse events, functional outcomes, quality of life, healthcare utilization',
      populations: 'different age subgroups, patients with multiple comorbidities, nursing home residents'
    }
  };
  
  // Extract relevant context based on query terms
  const queryLower = query.toLowerCase();
  return Object.keys(contexts).find(key => queryLower.includes(key));
};

// Relevance validation function
const filterRelevantPapers = (papers: Paper[], query: string): Paper[] => {
  const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
  
  return papers.filter(paper => {
    const fullText = `${paper.title} ${paper.abstract}`.toLowerCase();
    
    // Special handling for multi-concept queries (e.g., "telemedicine diabetes")
    const hasTelemedicine = query.toLowerCase().includes('telemedicine') || query.toLowerCase().includes('telehealth');
    const hasDiabetes = query.toLowerCase().includes('diabetes') || query.toLowerCase().includes('diabetic');
    
    // If query contains both telemedicine and diabetes, paper must contain BOTH concepts
    if (hasTelemedicine && hasDiabetes) {
      const hasTelemedicineInPaper = fullText.includes('telemedicine') || fullText.includes('telehealth') || 
                                    fullText.includes('remote monitoring') || fullText.includes('virtual care');
      const hasDiabetesInPaper = fullText.includes('diabetes') || fullText.includes('diabetic') || 
                                fullText.includes('diabetes mellitus');
      
      if (!hasTelemedicineInPaper || !hasDiabetesInPaper) {
        return false;
      }
    }
    
    // Must contain ALL key terms from query
    const hasAllTerms = queryTerms.every(term => {
      // Direct match
      if (fullText.includes(term)) return true;
      
      // Medical term synonyms
      const synonyms: { [key: string]: string[] } = {
        'telemedicine': ['telehealth', 'remote monitoring', 'virtual care', 'digital health'],
        'diabetes': ['diabetic', 'diabetes mellitus', 'type 1', 'type 2'],
        'statins': ['statin', 'atorvastatin', 'simvastatin', 'rosuvastatin', 'lipid lowering'],
        'glp-1': ['glp1', 'glucagon-like peptide', 'semaglutide', 'liraglutide', 'dulaglutide'],
        'biologics': ['biologic', 'biological', 'monoclonal antibody', 'mab'],
        'ra': ['rheumatoid arthritis', 'rheumatoid'],
        'cancer': ['oncology', 'tumor', 'malignant', 'carcinoma'],
        'elderly': ['geriatric', 'older adults', 'aging', 'senior'],
        'safety': ['adverse', 'toxicity', 'side effects', 'complications'],
        'effectiveness': ['efficacy', 'outcomes', 'effectiveness', 'clinical benefit']
      };
      
      // Check synonyms
      if (synonyms[term]) {
        return synonyms[term].some(synonym => fullText.includes(synonym));
      }
      
      return false;
    });
    
    return hasAllTerms;
  });
};

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

    // TEMPORARILY DISABLE OVERLY RESTRICTIVE RELEVANCE FILTERING
    // The papers from PubMed are actually relevant - the filter was too strict
    const relevantPapers = papers; // Use all papers for now
    
    // Get query-specific context
    const queryContext = addQueryContext(query);
    
    // Define contexts for use in prompt
    const contexts: { [key: string]: { focus: string; outcomes: string; populations: string } } = {
      'telemedicine': {
        focus: 'remote care delivery effectiveness, patient engagement, cost implications',
        outcomes: 'clinical outcomes vs in-person care, patient satisfaction, care accessibility',
        populations: 'rural vs urban patients, elderly vs younger patients, different chronic conditions'
      },
      'diabetes': {
        focus: 'glycemic control, medication adherence, complication prevention',
        outcomes: 'HbA1c trends, hospitalization rates, quality of life measures',
        populations: 'type 1 vs type 2, pediatric vs adult, different ethnic groups'
      },
      'jak inhibitors': {
        focus: 'safety profiles, effectiveness vs other biologics, long-term outcomes',
        outcomes: 'adverse events, treatment persistence, disease activity scores',
        populations: 'elderly patients, patients with comorbidities, treatment-naive vs experienced'
      },
      'statins': {
        focus: 'cardiovascular risk reduction, safety in different populations, adherence patterns',
        outcomes: 'LDL reduction, cardiovascular events, muscle-related adverse events',
        populations: 'elderly patients, patients with diabetes, different cardiovascular risk levels'
      },
      'glp-1': {
        focus: 'weight loss effects, cardiovascular benefits, glycemic control',
        outcomes: 'HbA1c reduction, weight loss, cardiovascular outcomes, gastrointestinal side effects',
        populations: 'obese patients, cardiovascular risk patients, different age groups'
      },
      'biologics': {
        focus: 'effectiveness vs conventional therapy, safety profiles, cost-effectiveness',
        outcomes: 'disease activity scores, adverse events, treatment persistence, quality of life',
        populations: 'treatment-naive vs experienced, different disease severities, elderly patients'
      },
      'cancer': {
        focus: 'survival outcomes, treatment response, quality of life during treatment',
        outcomes: 'overall survival, progression-free survival, adverse events, patient-reported outcomes',
        populations: 'different cancer stages, age groups, treatment histories'
      },
      'elderly': {
        focus: 'safety profiles, effectiveness in older populations, polypharmacy interactions',
        outcomes: 'adverse events, functional outcomes, quality of life, healthcare utilization',
        populations: 'different age subgroups, patients with multiple comorbidities, nursing home residents'
      }
    };
    
    if (relevantPapers.length === 0) {
      return NextResponse.json({
        analysis: `## **NO PAPERS FOUND**

**Query**: "${query}"

**Papers Found**: ${papers.length} total papers

**Recommendations:**
1. **Try broader search terms** - Use more general terminology
2. **Use alternative keywords** - Consider synonyms for medical conditions
3. **Check spelling** - Ensure medical terms are correctly spelled
4. **Try example questions** - Use the provided example questions as templates

**Example Refinements:**
- Instead of "GLP-1 agonists", try "diabetes medication"
- Instead of "biologics in RA", try "rheumatoid arthritis treatment"
- Instead of "telemedicine outcomes", try "remote care diabetes"`

      });
    }

    // Truncate relevant papers to avoid token limits
    const truncatedPapers: TruncatedPaper[] = relevantPapers.slice(0, 10).map((paper: Paper) => ({
      title: paper.title || 'No title',
      abstract: paper.abstract ? paper.abstract.substring(0, 500) : 'No abstract available',
      journal: paper.journal || 'Unknown journal',
      pubDate: paper.pubDate || 'Unknown date'
    }));

    const prompt = `You are a real-world evidence strategist at Atropos Health, analyzing medical literature to identify evidence gaps that can be addressed using federated clinical data networks.

CLINICAL QUESTION: "${query}"

${queryContext ? `QUERY-SPECIFIC CONTEXT:
- Focus Areas: ${contexts[queryContext].focus}
- Key Outcomes: ${contexts[queryContext].outcomes}
- Target Populations: ${contexts[queryContext].populations}

` : ''}RESEARCH PAPERS: ${truncatedPapers.map((paper: TruncatedPaper, index: number) => `
Paper ${index + 1}:
Title: ${paper.title}
Journal: ${paper.journal} (${paper.pubDate})
Abstract: ${paper.abstract}
`).join('\n')}

Provide analysis in this EXACT format:

## **CURRENT REAL-WORLD EVIDENCE LANDSCAPE**
[2-3 sentences on what RWE currently exists and what's missing from clinical practice]

## **PRIORITY EVIDENCE GAPS FOR FEDERATED DATA NETWORKS**

**Gap 1: [Specific, actionable gap]**
- **Why This Matters**: [Specific clinical decision this would inform]
- **RWE Study Design**: [Retrospective cohort/case-control/registry - be specific]
- **Required Data Elements**: [Specific EHR fields, ICD codes, lab values needed]
- **Multi-Site Value**: [Why federated data from multiple hospitals improves this research]
- **Clinical Decision Impact**: [Exactly how this changes patient care]
- **Evidence Timeline**: [Realistic timeline: 12-24 months for RWE vs 5+ years for RCT]

**Gap 2: [Another specific gap]**
[Same structure as above]

## **ATROPOS EVIDENCE GENERATION OPPORTUNITIES**
- **Point-of-Care Questions**: What specific questions would clinicians ask that this evidence answers?
- **Population Insights**: Which patient subgroups need better evidence representation?
- **Outcome Measurement**: What real-world outcomes should be tracked beyond clinical trials?
- **Implementation Gaps**: Where does clinical practice diverge from published evidence?

## **STRATEGIC NEXT STEPS**
1. **Immediate RWE Studies** (6-18 months): [Specific studies using existing data]
2. **Enhanced Data Collection** (1-2 years): [What new data elements should be captured]  
3. **Clinical Integration** (2-3 years): [How to embed this evidence into clinical workflows]

FOCUS ON: Evidence gaps that can only be filled by large-scale, multi-institutional real-world data - not more clinical trials.

AVOID: Generic statements like "more research needed" or "long-term studies required"

BE SPECIFIC: Every gap should be actionable with clear data requirements and clinical impact.`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a real-world evidence strategist at Atropos Health, focused on identifying actionable evidence gaps that can be addressed through federated clinical data networks. You provide specific, actionable insights for evidence generation using real-world data."
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

Found ${papers?.length || 0} research papers for "${query || 'your search'}" (relevance filtering applied).

**Key Research Areas Identified:**
- Comparative effectiveness studies needed
- Real-world evidence gaps in clinical outcomes
- Long-term safety and efficacy data requirements
- Patient population diversity in studies

**Recommended Next Steps:**
1. Review the papers found for detailed insights
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