import { NextRequest, NextResponse } from 'next/server';

// Medical term synonyms and related terms
const MEDICAL_SYNONYMS: { [key: string]: string[] } = {
  'metformin': ['metformin', 'biguanide', 'glucophage', 'fortamet', 'glumetza'],
  'diabetes': ['diabetes', 'diabetes mellitus', 'diabetic'],
  'type 2 diabetes': ['type 2 diabetes', 'type 2 diabetes mellitus', 'T2DM', 'non-insulin dependent diabetes'],
  'type 1 diabetes': ['type 1 diabetes', 'type 1 diabetes mellitus', 'T1DM', 'insulin dependent diabetes'],
  'hypertension': ['hypertension', 'high blood pressure', 'HTN'],
  'blood pressure': ['blood pressure', 'hypertension', 'HTN'],
  'cholesterol': ['cholesterol', 'hypercholesterolemia', 'dyslipidemia', 'lipids'],
  'obesity': ['obesity', 'overweight', 'body mass index', 'BMI'],
  'cancer': ['cancer', 'tumor', 'neoplasm', 'oncology', 'malignancy'],
  'depression': ['depression', 'major depressive disorder', 'MDD', 'clinical depression'],
  'anxiety': ['anxiety', 'anxiety disorder', 'generalized anxiety disorder', 'GAD'],
  'vaccine': ['vaccine', 'vaccination', 'immunization', 'immunisation'],
  'surgery': ['surgery', 'surgical', 'operation', 'procedure'],
  'effectiveness': ['effectiveness', 'efficacy', 'outcome', 'benefit', 'impact'],
  'treatment': ['treatment', 'therapy', 'intervention', 'management'],
  'prevention': ['prevention', 'preventive', 'prophylaxis'],
  'diagnosis': ['diagnosis', 'diagnostic', 'screening', 'detection']
};

// MeSH terms for common conditions
const MESH_TERMS: { [key: string]: string[] } = {
  'metformin': ['Metformin[Mesh]', 'Biguanides[Mesh]'],
  'diabetes': ['Diabetes Mellitus[Mesh]', 'Diabetes Mellitus, Type 2[Mesh]'],
  'type 2 diabetes': ['Diabetes Mellitus, Type 2[Mesh]'],
  'hypertension': ['Hypertension[Mesh]', 'Blood Pressure[Mesh]'],
  'cancer': ['Neoplasms[Mesh]', 'Oncology[Mesh]'],
  'depression': ['Depression[Mesh]', 'Depressive Disorder[Mesh]'],
  'vaccine': ['Vaccines[Mesh]', 'Vaccination[Mesh]'],
  'surgery': ['Surgery[Mesh]', 'Surgical Procedures[Mesh]']
};

// Study type filters with priority
const STUDY_TYPES = [
  'systematic review[pt]',
  'meta-analysis[pt]', 
  'randomized controlled trial[pt]',
  'controlled clinical trial[pt]',
  'observational study[pt]'
];

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

function extractSearchTerms(question: string): { terms: string[], meshTerms: string[] } {
  const lowerQuestion = question.toLowerCase();
  const foundTerms: string[] = [];
  const foundMeshTerms: string[] = [];
  
  // Find medical terms and their synonyms
  for (const [term, synonyms] of Object.entries(MEDICAL_SYNONYMS)) {
    if (lowerQuestion.includes(term)) {
      foundTerms.push(...synonyms);
      
      // Add corresponding MeSH terms
      if (MESH_TERMS[term]) {
        foundMeshTerms.push(...MESH_TERMS[term]);
      }
    }
  }
  
  // If no specific medical terms found, extract general terms
  if (foundTerms.length === 0) {
    const words = question.split(' ').slice(0, 4);
    foundTerms.push(...words);
  }
  
  return { terms: foundTerms, meshTerms: foundMeshTerms };
}

function buildAdvancedQuery(question: string): string {
  const { terms, meshTerms } = extractSearchTerms(question);
  
  // Build the main search query with synonyms
  const mainTerms = terms.length > 0 ? `(${terms.join(' OR ')})` : question;
  
  // Add MeSH terms if available
  const meshQuery = meshTerms.length > 0 ? ` AND (${meshTerms.join(' OR ')})` : '';
  
  // Add study type filters
  const studyTypeQuery = ` AND (${STUDY_TYPES.join(' OR ')})`;
  
  // Add date filter for last 10 years
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 10;
  const dateQuery = ` AND (${startYear}:${currentYear}[dp])`;
  
  // Combine all parts
  const fullQuery = `${mainTerms}${meshQuery}${studyTypeQuery}${dateQuery}`;
  
  console.log("Built advanced query:", fullQuery);
  return fullQuery;
}

function calculateRelevanceScore(paper: Paper, query: string): number {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  const lowerTitle = paper.title.toLowerCase();
  const lowerAbstract = paper.abstract.toLowerCase();
  
  // Title relevance (highest weight)
  const queryWords = lowerQuery.split(' ').filter(word => word.length > 3);
  const titleMatches = queryWords.filter(word => lowerTitle.includes(word)).length;
  score += (titleMatches / queryWords.length) * 40;
  
  // Abstract presence and relevance
  if (paper.abstract && paper.abstract !== "No abstract available") {
    score += 20;
    const abstractMatches = queryWords.filter(word => lowerAbstract.includes(word)).length;
    score += (abstractMatches / queryWords.length) * 20;
  }
  
  // Study type priority
  const studyTypePriority = {
    'systematic review': 15,
    'meta-analysis': 15,
    'randomized controlled trial': 10,
    'controlled clinical trial': 8,
    'observational study': 5
  };
  
  for (const [studyType, priority] of Object.entries(studyTypePriority)) {
    if (lowerTitle.includes(studyType) || lowerAbstract.includes(studyType)) {
      score += priority;
      break;
    }
  }
  
  // Journal impact (basic heuristic)
  const highImpactJournals = [
    'lancet', 'nejm', 'jama', 'bmj', 'nature', 'science', 
    'cell', 'new england journal', 'british medical journal'
  ];
  
  if (paper.journal) {
    const lowerJournal = paper.journal.toLowerCase();
    for (const journal of highImpactJournals) {
      if (lowerJournal.includes(journal)) {
        score += 10;
        break;
      }
    }
  }
  
  // Recency bonus (papers from last 5 years get bonus)
  if (paper.pubDate) {
    const pubYear = parseInt(paper.pubDate);
    const currentYear = new Date().getFullYear();
    if (currentYear - pubYear <= 5) {
      score += 5;
    }
  }
  
  return Math.round(score);
}

async function scrapePubMed(query: string, maxResults: number = 20) {
  try {
    console.log("Original query:", query);
    
    // Build advanced search query
    const advancedQuery = buildAdvancedQuery(query);
    
    // PubMed scraping logic
    const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    
    // Search for papers with increased results
    const searchUrl = `${baseUrl}esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: advancedQuery,
      retmax: Math.max(maxResults, 20).toString(), // Ensure at least 20 results
      retmode: "json",
      sort: "relevance" // Sort by relevance
    });
    
    console.log("Search URL:", `${searchUrl}?${searchParams}`);
    const searchResponse = await fetch(`${searchUrl}?${searchParams}`);
    const searchData = await searchResponse.json();
    
    console.log("Search response:", searchData);
    
    if (!searchData.esearchresult) {
      console.error("No esearchresult in response");
      return { error: "Failed to search PubMed" };
    }
    
    const idList = searchData.esearchresult.idlist;
    console.log("Found IDs:", idList);
    
    if (!idList || idList.length === 0) {
      console.log("No papers found for query:", advancedQuery);
      return { papers: [] };
    }
    
    // Fetch paper details
    const fetchUrl = `${baseUrl}efetch.fcgi`;
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      id: idList.join(","),
      retmode: "xml"
    });
    
    console.log("Fetch URL:", `${fetchUrl}?${fetchParams}`);
    const fetchResponse = await fetch(`${fetchUrl}?${fetchParams}`);
    const xmlText = await fetchResponse.text();
    
    console.log("XML response length:", xmlText.length);
    
    // Parse XML and extract papers with relevance scoring
    const papers = [];
    const articleMatches = xmlText.match(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);
    
    console.log("Found article matches:", articleMatches ? articleMatches.length : 0);
    
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
          
          const paper = {
            title,
            abstract,
            authors,
            journal,
            pubDate,
            pmid,
            relevanceScore: 0
          };
          
          // Calculate relevance score
          paper.relevanceScore = calculateRelevanceScore(paper, query);
          
          papers.push(paper);
          
          console.log("Added paper:", title, "Score:", paper.relevanceScore);
        } catch (error) {
          console.log("Failed to parse article:", error);
          continue;
        }
      }
    }
    
    // Sort papers by relevance score (highest first)
    papers.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Return top results
    const topPapers = papers.slice(0, maxResults);
    
    console.log("Total papers found:", papers.length);
    console.log("Returning top papers:", topPapers.length);
    
    return { 
      papers: topPapers,
      totalFound: papers.length,
      query: advancedQuery
    };
    
  } catch (error) {
    console.error("Error in scrapePubMed:", error);
    return { error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.question || '';
    const maxResults = body.max_results || 20; // Default to 20 results
    
    console.log("Received request for query:", query);
    
    const result = await scrapePubMed(query, maxResults);
    console.log("Returning result:", result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in scrape API route:', error);
    return NextResponse.json(
      { error: 'Failed to scrape PubMed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Scrape API endpoint' });
} 