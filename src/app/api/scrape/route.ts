import { NextRequest, NextResponse } from 'next/server';

// Query Analysis Interface
interface QueryAnalysis {
  primaryTerms: string[];
  secondaryTerms: string[];
  medicalCondition: string | null;
  intervention: string | null;
}

// Enhanced synonym mappings for better search
const SYNONYM_MAPPINGS: Record<string, string[]> = {
  'telemedicine': ['telemedicine', 'telehealth', 'remote monitoring', 'digital health', 'virtual care'],
  'diabetes': ['diabetes', 'diabetic', 'diabetes mellitus'],
  'effectiveness': ['effectiveness', 'efficacy', 'outcomes'],
  'safety': ['safety', 'adverse events', 'side effects'],
  'metformin': ['metformin', 'biguanide', 'glucophage'],
  'biologics': ['biologics', 'biologic therapy', 'monoclonal antibodies'],
  'cancer': ['cancer', 'neoplasm', 'tumor', 'oncology'],
  'arthritis': ['arthritis', 'rheumatoid arthritis', 'RA'],
  'rheumatoid': ['rheumatoid arthritis', 'RA', 'rheumatoid'],
  'statins': ['statins', 'statin', 'HMG-CoA reductase inhibitors'],
  'glp-1': ['glp-1', 'glp1', 'glucagon-like peptide-1', 'glucagon like peptide 1'],
  'outcomes': ['outcomes', 'effectiveness', 'efficacy', 'results'],
  'management': ['management', 'treatment', 'therapy', 'intervention'],
  'biomarkers': ['biomarkers', 'biomarker', 'markers', 'marker'],
  'detection': ['detection', 'screening', 'diagnosis', 'diagnostic'],
  'elderly': ['elderly', 'older adults', 'geriatric', 'aging'],
  'cardiovascular': ['cardiovascular', 'cardiac', 'heart', 'cardiology']
};

// Progressive filtering strategy
const hasQualityAbstract = (abstract: string, filterLevel: 'high' | 'medium' | 'low' = 'high'): boolean => {
  const baseCheck = Boolean(abstract && 
         !abstract.includes("No abstract available") &&
         !abstract.includes("Abstract not available") &&
         !abstract.includes("No abstract") &&
         abstract.trim().length > 0);
  
  if (!baseCheck) return false;
  
  switch (filterLevel) {
    case 'high':
      return abstract.length > 200;
    case 'medium':
      return abstract.length > 100;
    case 'low':
      return abstract.length > 50;
    default:
      return abstract.length > 100;
  }
};

// Interface for paper object
interface Paper {
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  pubDate: string | null;
  pmid: string | null;
  relevanceScore: number;
}

// Query Analysis Functions
const analyzeQuery = (query: string): QueryAnalysis => {
  const lowerQuery = query.toLowerCase();
  
  // Extract medical conditions
  const conditions = ['diabetes', 'cancer', 'arthritis', 'hypertension', 'copd', 'asthma', 'depression', 'obesity', 'rheumatoid'];
  const medicalCondition = conditions.find(condition => lowerQuery.includes(condition)) || null;
  
  // Extract interventions/treatments
  const interventions = ['metformin', 'statins', 'biologics', 'telemedicine', 'telehealth', 'surgery', 'therapy', 'glp-1'];
  const intervention = interventions.find(interv => lowerQuery.includes(interv)) || null;
  
  // Split query into important terms (remove common words)
  const stopWords = ['the', 'of', 'in', 'for', 'and', 'or', 'what', 'is', 'effectiveness', 'efficacy', 'outcomes', 'long', 'term', 'term', 'early', 'novel'];
  const words = query.toLowerCase().split(' ').filter(word => 
    word.length > 2 && !stopWords.includes(word)
  );
  
  return {
    primaryTerms: words.slice(0, 3), // Most important terms
    secondaryTerms: words.slice(3),
    medicalCondition,
    intervention
  };
};

const validatePaperRelevance = (paper: Paper, queryAnalysis: QueryAnalysis): boolean => {
  const title = paper.title?.toLowerCase() || '';
  const abstract = paper.abstract?.toLowerCase() || '';
  const fullText = `${title} ${abstract}`;
  
  // MUST contain at least 2 primary terms OR 1 primary + medical condition
  const primaryMatches = queryAnalysis.primaryTerms.filter(term => 
    fullText.includes(term)
  ).length;
  
  const hasCondition = queryAnalysis.medicalCondition ? 
    fullText.includes(queryAnalysis.medicalCondition) : false;
  
  const hasIntervention = queryAnalysis.intervention ? 
    fullText.includes(queryAnalysis.intervention) : false;
  
  // Scoring logic
  if (primaryMatches >= 2) return true;
  if (primaryMatches >= 1 && (hasCondition || hasIntervention)) return true;
  if (hasCondition && hasIntervention) return true;
  
  return false;
};

// Enhanced PubMed Query Builder
const buildPubMedQuery = (userQuery: string): string => {
  const analysis = analyzeQuery(userQuery);
  
  // Build query with synonyms
  const expandTerm = (term: string): string => {
    const synonyms = SYNONYM_MAPPINGS[term] || [term];
    if (synonyms.length > 1) {
      return `(${synonyms.map(s => `"${s}"[tw]`).join(' OR ')})`;
    }
    return `"${term}"[tw]`;
  };
  
  // Construct boolean query
  const queryParts: string[] = [];
  
  // Add primary terms (REQUIRED)
  if (analysis.primaryTerms.length > 0) {
    const primaryQuery = analysis.primaryTerms.map(expandTerm).join(' AND ');
    queryParts.push(primaryQuery);
  }
  
  // Add study type filters
  queryParts.push('(systematic review[pt] OR meta-analysis[pt] OR randomized controlled trial[pt] OR clinical trial[pt])');
  
  // Add date filter (last 10 years)
  queryParts.push('(2014:2024[dp])');
  
  return queryParts.join(' AND ');
};

const calculateRelevanceScore = (paper: Paper, queryAnalysis: QueryAnalysis): number => {
  const title = paper.title?.toLowerCase() || '';
  const abstract = paper.abstract?.toLowerCase() || '';
  const fullText = `${title} ${abstract}`;
  
  let score = 0;
  
  // Primary term matches in title (high weight)
  queryAnalysis.primaryTerms.forEach(term => {
    if (title.includes(term)) score += 30;
    else if (abstract.includes(term)) score += 15;
  });
  
  // Medical condition match
  if (queryAnalysis.medicalCondition && fullText.includes(queryAnalysis.medicalCondition)) {
    score += 25;
  }
  
  // Intervention match
  if (queryAnalysis.intervention && fullText.includes(queryAnalysis.intervention)) {
    score += 25;
  }
  
  // Quality bonuses
  if (paper.abstract && paper.abstract.length > 300) score += 10;
  if (paper.pubDate && parseInt(paper.pubDate) >= 2020) score += 15;
  
  // Study type bonuses
  const studyTypes = ['systematic review', 'meta-analysis', 'randomized controlled trial'];
  studyTypes.forEach(type => {
    if (fullText.includes(type)) score += 20;
  });
  
  return score;
};

const filterAndScorePapers = (papers: Paper[], queryAnalysis: QueryAnalysis) => {
  // Stage 1: Relevance filtering
  const relevantPapers = papers.filter(paper => 
    validatePaperRelevance(paper, queryAnalysis)
  );
  
  // Stage 2: Quality filtering (abstracts, recent papers)
  const qualityPapers = relevantPapers.filter(paper => {
    const hasGoodAbstract = paper.abstract && 
      paper.abstract.length > 100 && 
      !paper.abstract.includes('No abstract available');
    const isRecent = paper.pubDate && parseInt(paper.pubDate) >= 2019;
    
    return hasGoodAbstract || isRecent;
  });
  
  // Stage 3: Scoring and ranking
  const scoredPapers = qualityPapers.map(paper => ({
    ...paper,
    relevanceScore: calculateRelevanceScore(paper, queryAnalysis)
  }));
  
  // Fallback if too few results
  if (scoredPapers.length < 5) {
    return relevantPapers.slice(0, 15).map(paper => ({
      ...paper,
      relevanceScore: calculateRelevanceScore(paper, queryAnalysis)
    }));
  }
  
  return scoredPapers.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 15);
};

const searchPubMedWithFallback = async (query: string) => {
  const queryAnalysis = analyzeQuery(query);
  
  try {
    // Primary search
    const pubmedQuery = buildPubMedQuery(query);
    let papers = await searchPubMed(pubmedQuery);
    
    if (papers.length === 0) {
      // Fallback 1: Broader search without study type filters
      const broadQuery = queryAnalysis.primaryTerms.map(term => `"${term}"[tw]`).join(' AND ');
      papers = await searchPubMed(broadQuery + ' AND (2019:2024[dp])');
    }
    
    if (papers.length === 0) {
      // Fallback 2: Individual term search
      const singleTermQuery = `"${queryAnalysis.primaryTerms[0]}"[tw] AND (2018:2024[dp])`;
      papers = await searchPubMed(singleTermQuery);
    }
    
    // Filter and score results
    const filteredPapers = filterAndScorePapers(papers, queryAnalysis);
    
    if (filteredPapers.length === 0) {
      throw new Error(`No relevant papers found for "${query}". Try broader search terms.`);
    }
    
    return filteredPapers;
    
  } catch (error) {
    console.error('Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Search failed: ${errorMessage}`);
  }
};

async function searchPubMed(query: string) {
    const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    
    // Search for papers
    const searchUrl = `${baseUrl}esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
    term: query,
    retmax: "50",
    retmode: "json",
    sort: "relevance"
  });
  
    const searchResponse = await fetch(`${searchUrl}?${searchParams}`);
    const searchData = await searchResponse.json();
    
  if (!searchData.esearchresult || !searchData.esearchresult.idlist) {
    return [];
    }
    
    const idList = searchData.esearchresult.idlist;
    
    // Fetch paper details
    const fetchUrl = `${baseUrl}efetch.fcgi`;
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      id: idList.join(","),
      retmode: "xml"
    });
    
    const fetchResponse = await fetch(`${fetchUrl}?${fetchParams}`);
    const xmlText = await fetchResponse.text();
    
  // Parse XML and extract papers
  const papers: Paper[] = [];
    const articleMatches = xmlText.match(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);
    
    if (articleMatches) {
      for (const article of articleMatches) {
        try {
          // Extract title
          const titleMatch = article.match(/<ArticleTitle>([^<]*)<\/ArticleTitle>/);
          const title = titleMatch ? titleMatch[1] : "No title available";
          
          // Extract abstract
          const abstractMatch = article.match(/<AbstractText>([^<]*)<\/AbstractText>/);
          const abstract = abstractMatch ? abstractMatch[1] : "No abstract available";
          
          // Extract authors
          const authors = [];
          const authorMatches = article.match(/<Author>([\s\S]*?)<\/Author>/g);
          if (authorMatches) {
            for (const author of authorMatches) {
              const lastNameMatch = author.match(/<LastName>([^<]*)<\/LastName>/);
              const firstNameMatch = author.match(/<ForeName>([^<]*)<\/ForeName>/);
              if (lastNameMatch && firstNameMatch) {
                authors.push(`${firstNameMatch[1]} ${lastNameMatch[1]}`);
              }
            }
          }
        
        // Extract journal
        const journalMatch = article.match(/<Journal>([\s\S]*?)<\/Journal>/);
        let journal = "Unknown Journal";
        if (journalMatch) {
          const titleMatch = journalMatch[1].match(/<Title>([^<]*)<\/Title>/);
          if (titleMatch) {
            journal = titleMatch[1];
          }
        }
        
        // Extract publication date
        const pubDateMatch = article.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
        let pubDate = null;
        if (pubDateMatch) {
          const yearMatch = pubDateMatch[1].match(/<Year>([^<]*)<\/Year>/);
          if (yearMatch) {
            pubDate = yearMatch[1];
          }
        }
        
        // Extract PMID
        const pmidMatch = article.match(/<PMID>([^<]*)<\/PMID>/);
        const pmid = pmidMatch ? pmidMatch[1] : null;
          
          papers.push({
            title,
            abstract,
          authors,
          journal,
          pubDate,
          pmid,
          relevanceScore: 0
        });
      } catch (error) {
        console.log("Failed to parse article:", error);
          continue;
        }
      }
    }
    
  return papers;
}

async function scrapePubMed(query: string, maxResults: number = 20) {
  try {
    console.log(`🔬 Starting PubMed scrape for query: "${query}"`);
    
    const papers = await searchPubMedWithFallback(query);
    
    // Progressive filtering strategy
    let papersWithAbstracts = papers.filter(paper => hasQualityAbstract(paper.abstract, 'high'));
    console.log(`High quality papers: ${papersWithAbstracts.length}/${papers.length}`);
    
    // If not enough high quality papers, try medium quality
    if (papersWithAbstracts.length < 5) {
      console.log("Not enough high quality papers, trying medium quality...");
      papersWithAbstracts = papers.filter(paper => hasQualityAbstract(paper.abstract, 'medium'));
      console.log(`Medium quality papers: ${papersWithAbstracts.length}/${papers.length}`);
    }
    
    // If still not enough, try low quality
    if (papersWithAbstracts.length < 3) {
      console.log("Not enough medium quality papers, trying low quality...");
      papersWithAbstracts = papers.filter(paper => hasQualityAbstract(paper.abstract, 'low'));
      console.log(`Low quality papers: ${papersWithAbstracts.length}/${papers.length}`);
    }
    
    // Sort papers by relevance score (highest first)
    papersWithAbstracts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Return top results (ensure minimum 3-5 papers if they exist)
    const minResults = Math.min(3, papersWithAbstracts.length);
    const targetResults = Math.max(minResults, Math.min(maxResults, papersWithAbstracts.length));
    const topPapers = papersWithAbstracts.slice(0, targetResults);
    
    console.log("Total papers with abstracts:", papersWithAbstracts.length);
    console.log("Returning top papers:", topPapers.length);
    
    return { 
      papers: topPapers,
      totalFound: papersWithAbstracts.length,
      totalSearched: papers.length,
      query: query
    };
    
  } catch (error) {
    console.error("Error in scrapePubMed:", error);
    return { error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 Scrape API called");
    
    const body = await request.json();
    const query = body.question || '';
    const maxResults = body.max_results || 20;
    
    console.log(`📝 Query: "${query}"`);
    console.log(`📊 Max results: ${maxResults}`);
    
    if (!query || query.trim() === '') {
      console.error("❌ Empty query provided");
      return NextResponse.json(
        { error: 'No query provided' },
        { status: 400 }
      );
    }
    
    console.log("🚀 Starting PubMed scrape...");
    const result = await scrapePubMed(query, maxResults);
    
    if (result.error) {
      console.error("❌ Scrape failed:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    console.log(`✅ Scrape completed: ${result.papers?.length || 0} papers found`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error in scrape API route:', error);
    return NextResponse.json(
      { error: 'Failed to scrape PubMed. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Scrape API endpoint' });
} 