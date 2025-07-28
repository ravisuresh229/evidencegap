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
  'sglt2': ['sglt2', 'sglt-2', 'sglt2 inhibitors', 'sglt-2 inhibitors', 'sodium-glucose cotransporter-2'],
  'heart': ['heart', 'cardiac', 'cardiovascular', 'cardiology'],
  'failure': ['failure', 'dysfunction', 'disease'],
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
  const conditions = ['diabetes', 'cancer', 'arthritis', 'hypertension', 'copd', 'asthma', 'depression', 'obesity', 'rheumatoid', 'heart failure', 'cardiac'];
  const medicalCondition = conditions.find(condition => lowerQuery.includes(condition)) || null;
  
  // Extract interventions/treatments
  const interventions = ['metformin', 'statins', 'biologics', 'telemedicine', 'telehealth', 'surgery', 'therapy', 'glp-1', 'sglt2', 'sglt-2'];
  const intervention = interventions.find(interv => lowerQuery.includes(interv)) || null;
  
  // Split query into important terms (remove common words)
  const stopWords = ['the', 'of', 'in', 'and', 'or', 'what', 'is', 'effectiveness', 'efficacy', 'outcomes', 'long', 'term'];
  const words = query.toLowerCase().split(' ').filter(word => 
    word.length > 1 && !stopWords.includes(word)
  );
  
  return {
    primaryTerms: words.slice(0, 3), // Most important terms
    secondaryTerms: words.slice(3),
    medicalCondition,
    intervention
  };
};

const validatePaperRelevance = (paper: Paper): boolean => {
  const title = paper.title?.toLowerCase() || '';
  const abstract = paper.abstract?.toLowerCase() || '';
  const fullText = `${title} ${abstract}`;
  
  // TEMPORARILY DISABLE OVERLY RESTRICTIVE FILTERING
  // The papers from PubMed are actually relevant - accept most papers
  if (fullText.length < 50) return false; // Only reject very short/empty papers
  
  // Basic quality check - paper should have some content
  if (!title || title.length < 10) return false;
  
  // Accept papers that have any reasonable content
  return true;
  
  // OLD RESTRICTIVE LOGIC (COMMENTED OUT):
  /*
  // More flexible matching logic
  const primaryMatches = queryAnalysis.primaryTerms.filter(term => 
    fullText.includes(term)
  ).length;
  
  const hasCondition = queryAnalysis.medicalCondition ? 
    fullText.includes(queryAnalysis.medicalCondition) : false;
  
  const hasIntervention = queryAnalysis.intervention ? 
    fullText.includes(queryAnalysis.intervention) : false;
  
  // More flexible scoring logic
  if (primaryMatches >= 2) return true;
  if (primaryMatches >= 1 && (hasCondition || hasIntervention)) return true;
  if (hasCondition && hasIntervention) return true;
  if (primaryMatches >= 1) return true; // Allow single primary term matches
  
  // Special case for biomarker searches - be more lenient
  if (queryAnalysis.primaryTerms.includes('biomarkers') || queryAnalysis.primaryTerms.includes('biomarker')) {
    if (hasCondition) return true; // If it has cancer/diabetes/etc, include it
  }
  
  return false;
  */
};

// Intelligent Query Analysis and Fallback System
const analyzeAndExpandQuery = (originalQuery: string): string[] => {
  const words = originalQuery.toLowerCase().split(' ').filter(word => word.length > 2);
  
  // Medical term expansion dictionary
  const medicalExpansions: { [key: string]: string[] } = {
    // Conditions
    'diabetes': ['diabetes', 'diabetic', 'diabetes mellitus', 'hyperglycemia'],
    'cancer': ['cancer', 'tumor', 'neoplasm', 'malignancy', 'oncology'],
    'arthritis': ['arthritis', 'rheumatoid arthritis', 'RA', 'joint inflammation'],
    'heart': ['heart', 'cardiac', 'cardiovascular', 'coronary'],
    'kidney': ['kidney', 'renal', 'nephrology'],
    
    // Treatments
    'biomarkers': ['biomarkers', 'tumor markers', 'diagnostic markers', 'prognostic markers'],
    'biologics': ['biologics', 'biologic therapy', 'monoclonal antibodies', 'targeted therapy'],
    'telemedicine': ['telemedicine', 'telehealth', 'remote monitoring', 'virtual care'],
    
    // Qualifiers
    'novel': ['novel', 'new', 'emerging', 'innovative'],
    'early': ['early', 'screening', 'detection', 'diagnosis'],
    'effectiveness': ['effectiveness', 'efficacy', 'outcomes', 'results'],
    'safety': ['safety', 'adverse events', 'side effects', 'toxicity']
  };
  
  // Generate progressive fallback queries
  const fallbackStrategies: string[] = [];
  
  // Strategy 1: Remove vague qualifiers
  const vagueWords = ['novel', 'new', 'emerging', 'optimal', 'best', 'improved'];
  const withoutVague = words.filter(word => !vagueWords.includes(word));
  if (withoutVague.length < words.length) {
    fallbackStrategies.push(withoutVague.join(' '));
  }
  
  // Strategy 2: Expand medical terms with synonyms
  const expandedTerms = words.map(word => {
    return medicalExpansions[word] ? medicalExpansions[word][0] : word;
  });
  fallbackStrategies.push(expandedTerms.join(' '));
  
  // Strategy 3: Use only core medical terms (remove connecting words)
  const connectingWords = ['for', 'in', 'of', 'and', 'or', 'the', 'with', 'versus', 'vs'];
  const coreTerms = words.filter(word => !connectingWords.includes(word));
  if (coreTerms.length >= 2) {
    fallbackStrategies.push(coreTerms.slice(0, 3).join(' '));
  }
  
  // Strategy 4: Try individual key terms if query has multiple concepts
  if (words.length > 3) {
    // Find the most important medical terms
    const importantTerms = words.filter(word => 
      medicalExpansions[word] || 
      word.length > 6 || 
      ['diabetes', 'cancer', 'arthritis', 'heart', 'kidney'].some(term => word.includes(term))
    );
    
    if (importantTerms.length > 0) {
      fallbackStrategies.push(importantTerms[0]);
    }
  }
  
  return fallbackStrategies.filter(strategy => strategy && strategy.length > 0);
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
  
  // Special handling for specific query types
  const lowerQuery = userQuery.toLowerCase();
  
  // GLP-1 vs SGLT2 queries
  if (lowerQuery.includes('glp-1') && lowerQuery.includes('sglt2')) {
    return `((GLP-1 OR "glucagon-like peptide") AND (SGLT2 OR "sodium glucose") AND cardiovascular) AND (2019:2024[dp])`;
  }
  
  // Biologic therapy RA queries
  if (lowerQuery.includes('biologic') && (lowerQuery.includes('rheumatoid') || lowerQuery.includes('ra'))) {
    return `(biologic AND ("rheumatoid arthritis" OR RA) AND (sequence OR order OR line OR therapy)) AND (2019:2024[dp])`;
  }
  
  // Biomarker queries
  if (lowerQuery.includes('biomarker') || lowerQuery.includes('biomarkers')) {
    if (lowerQuery.includes('cancer')) {
      return `((biomarker OR biomarkers) AND (cancer OR tumor OR neoplasm) AND (detection OR screening OR diagnosis)) AND (2019:2024[dp])`;
    }
    return `(biomarker OR biomarkers) AND (detection OR screening OR diagnosis) AND (2019:2024[dp])`;
  }
  
  // Construct boolean query
  const queryParts: string[] = [];
  
  // Add primary terms (REQUIRED)
  if (analysis.primaryTerms.length > 0) {
    const primaryQuery = analysis.primaryTerms.map(expandTerm).join(' AND ');
    queryParts.push(primaryQuery);
  }
  
  // Add study type filters (more inclusive)
  queryParts.push('(systematic review[pt] OR meta-analysis[pt] OR randomized controlled trial[pt] OR clinical trial[pt] OR review[pt] OR observational study[pt])');
  
  // Add date filter (last 15 years for broader coverage)
  queryParts.push('(2009:2024[dp])');
  
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
    validatePaperRelevance(paper)
  );
  
  // Stage 2: Quality filtering (more flexible)
  const qualityPapers = relevantPapers.filter(paper => {
    const hasGoodAbstract = paper.abstract && 
      paper.abstract.length > 50 && 
      !paper.abstract.includes('No abstract available');
    const isRecent = paper.pubDate && parseInt(paper.pubDate) >= 2015;
    const hasTitle = paper.title && paper.title.length > 10;
    
    return (hasGoodAbstract || isRecent) && hasTitle;
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

// Smart error messaging with suggestions
const generateSearchSuggestions = (originalQuery: string): string[] => {
  const words = originalQuery.toLowerCase().split(' ');
  const suggestions: string[] = [];
  
  // Suggest removing vague terms
  if (words.some(word => ['novel', 'new', 'optimal', 'best'].includes(word))) {
    const simplified = words.filter(word => !['novel', 'new', 'optimal', 'best'].includes(word));
    suggestions.push(simplified.join(' '));
  }
  
  // Suggest more specific medical terms
  if (words.includes('biomarkers')) {
    suggestions.push('liquid biopsy cancer screening');
    suggestions.push('tumor markers diagnosis');
  }
  
  if (words.includes('treatment') || words.includes('therapy')) {
    suggestions.push(words.join(' ').replace(/treatment|therapy/, 'medication'));
  }
  
  // Add condition-specific alternatives
  if (words.includes('cancer')) {
    suggestions.push('oncology clinical outcomes');
    suggestions.push('tumor therapy effectiveness');
  }
  
  if (words.includes('diabetes')) {
    suggestions.push('diabetic medication effectiveness');
    suggestions.push('glycemic control outcomes');
  }
  
  if (words.includes('arthritis') || words.includes('ra')) {
    suggestions.push('rheumatoid arthritis treatment');
    suggestions.push('joint inflammation therapy');
  }
  
  return suggestions.slice(0, 3); // Return top 3 suggestions
};

const handleSearchFailure = (originalQuery: string) => {
  const suggestions = generateSearchSuggestions(originalQuery);
  
  return {
    error: `No relevant papers found for "${originalQuery}".`,
    suggestions: suggestions,
    message: suggestions.length > 0 
      ? `Try these alternative searches: ${suggestions.map(s => `"${s}"`).join(', ')}`
      : 'Try using more specific medical terms or broader search criteria.'
  };
};

const searchWithIntelligentFallbacks = async (originalQuery: string) => {
  console.log(`🔍 Starting intelligent search for: "${originalQuery}"`);
  
  // Try original query first
  let results = await searchPubMed(buildPubMedQuery(originalQuery));
  let queryUsed = originalQuery;
  let fallbackUsed = false;
  
  if (results.length === 0) {
    console.log('Original query returned 0 results, trying intelligent fallbacks...');
    
    const fallbackQueries = analyzeAndExpandQuery(originalQuery);
    
    for (const fallbackQuery of fallbackQueries) {
      console.log(`🔍 Trying fallback: "${fallbackQuery}"`);
      results = await searchPubMed(buildPubMedQuery(fallbackQuery));
      
      if (results.length > 0) {
        queryUsed = fallbackQuery;
        fallbackUsed = true;
        console.log(`✅ Success with fallback: "${fallbackQuery}" - found ${results.length} papers`);
        break;
      }
    }
  }
  
  // If still no results, try very broad searches
  if (results.length === 0) {
    console.log('Trying very broad searches...');
    const words = originalQuery.toLowerCase().split(' ');
    // const broadTerms = ['medicine', 'treatment', 'therapy', 'clinical', 'patient'];
    
    for (const word of words) {
      if (word.length > 5) {
        console.log(`🔍 Trying very broad search: "${word}"`);
        results = await searchPubMed(`"${word}"[tw] AND (2019:2024[dp])`);
        if (results.length > 0) {
          queryUsed = word;
          fallbackUsed = true;
          console.log(`✅ Success with broad search: "${word}" - found ${results.length} papers`);
          break;
        }
      }
      }
    }
    
    // Filter and score results
  const queryAnalysis = analyzeQuery(queryUsed);
  const filteredPapers = filterAndScorePapers(results, queryAnalysis);
  
  return {
    papers: filteredPapers,
    queryUsed: queryUsed,
    fallbackUsed: fallbackUsed,
    originalQuery: originalQuery
  };
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

async function scrapePubMedWithIntelligentFallbacks(query: string, maxResults: number = 20) {
  try {
    console.log(`🔬 Starting intelligent PubMed scrape for query: "${query}"`);
    
    const searchResult = await searchWithIntelligentFallbacks(query);
    
    if (searchResult.papers.length === 0) {
      const errorInfo = handleSearchFailure(query);
      return { 
        error: errorInfo.error,
        suggestions: errorInfo.suggestions,
        message: errorInfo.message,
        papers: [],
        totalFound: 0,
        totalSearched: 0,
        query: query,
        fallbackUsed: false
      };
    }
    
    // Progressive filtering strategy
    let papersWithAbstracts = searchResult.papers.filter((paper: Paper) => hasQualityAbstract(paper.abstract, 'high'));
    console.log(`High quality papers: ${papersWithAbstracts.length}/${searchResult.papers.length}`);
    
    // If not enough high quality papers, try medium quality
    if (papersWithAbstracts.length < 5) {
      console.log("Not enough high quality papers, trying medium quality...");
      papersWithAbstracts = searchResult.papers.filter((paper: Paper) => hasQualityAbstract(paper.abstract, 'medium'));
      console.log(`Medium quality papers: ${papersWithAbstracts.length}/${searchResult.papers.length}`);
    }
    
    // If still not enough, try low quality
    if (papersWithAbstracts.length < 3) {
      console.log("Not enough medium quality papers, trying low quality...");
      papersWithAbstracts = searchResult.papers.filter((paper: Paper) => hasQualityAbstract(paper.abstract, 'low'));
      console.log(`Low quality papers: ${papersWithAbstracts.length}/${searchResult.papers.length}`);
    }
    
    // Sort papers by relevance score (highest first)
    papersWithAbstracts.sort((a: Paper, b: Paper) => b.relevanceScore - a.relevanceScore);
    
    // Return top results (ensure minimum 3-5 papers if they exist)
    const minResults = Math.min(3, papersWithAbstracts.length);
    const targetResults = Math.max(minResults, Math.min(maxResults, papersWithAbstracts.length));
    const topPapers = papersWithAbstracts.slice(0, targetResults);
    
    console.log("Total papers with abstracts:", papersWithAbstracts.length);
    console.log("Returning top papers:", topPapers.length);
    
    return { 
      papers: topPapers,
      totalFound: papersWithAbstracts.length,
      totalSearched: searchResult.papers.length,
      query: query,
      fallbackUsed: searchResult.fallbackUsed,
      queryUsed: searchResult.queryUsed
    };
    
  } catch (error) {
    console.error("Error in scrapePubMedWithIntelligentFallbacks:", error);
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
    const result = await scrapePubMedWithIntelligentFallbacks(query, maxResults);
    
    if (result.error) {
      console.error("❌ Scrape failed:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    console.log(`✅ Scrape completed: ${result.papers?.length || 0} papers found`);
    console.log(`📄 Papers found:`, result.papers?.map(p => p.title.substring(0, 50) + '...'));
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error in scrape API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to scrape PubMed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Scrape API endpoint' });
} 