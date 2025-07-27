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
  'diagnosis': ['diagnosis', 'diagnostic', 'screening', 'detection'],
  'ra': ['rheumatoid arthritis', 'RA', 'rheumatoid', 'arthritis'],
  'rheumatoid arthritis': ['rheumatoid arthritis', 'RA', 'rheumatoid', 'arthritis'],
  'biologics': ['biologics', 'biologic', 'biological', 'biopharmaceutical'],
  'glp-1': ['glp-1', 'glp1', 'glucagon-like peptide-1', 'glucagon like peptide 1'],
  'statins': ['statins', 'statin', 'HMG-CoA reductase inhibitors'],
  'telemedicine': ['telemedicine', 'telehealth', 'remote care', 'virtual care'],
  'dental': ['dental', 'dentistry', 'tooth', 'teeth', 'oral'],
  'cardiology': ['cardiology', 'cardiac', 'heart', 'cardiovascular'],
  'oncology': ['oncology', 'cancer', 'tumor', 'neoplasm', 'malignancy'],
  'neurology': ['neurology', 'neurological', 'brain', 'nervous system'],
  'psychiatry': ['psychiatry', 'psychiatric', 'mental health', 'psychology']
};

// Medical condition categories and their related terms
const MEDICAL_CONDITIONS: { [key: string]: { terms: string[], category: string, specialty: string } } = {
  'rheumatoid arthritis': {
    terms: ['rheumatoid arthritis', 'RA', 'rheumatoid', 'arthritis', 'rheumatology', 'autoimmune', 'joint inflammation'],
    category: 'rheumatology',
    specialty: 'rheumatology'
  },
  'diabetes': {
    terms: ['diabetes', 'diabetes mellitus', 'diabetic', 'glucose', 'insulin', 'endocrinology', 'metabolic'],
    category: 'endocrinology',
    specialty: 'endocrinology'
  },
  'hypertension': {
    terms: ['hypertension', 'high blood pressure', 'HTN', 'cardiovascular', 'cardiac', 'heart'],
    category: 'cardiovascular',
    specialty: 'cardiology'
  },
  'cancer': {
    terms: ['cancer', 'tumor', 'neoplasm', 'malignancy', 'oncology', 'carcinoma', 'sarcoma'],
    category: 'oncology',
    specialty: 'oncology'
  },
  'depression': {
    terms: ['depression', 'major depressive disorder', 'MDD', 'psychiatric', 'mental health', 'psychology'],
    category: 'psychiatry',
    specialty: 'psychiatry'
  },
  'dental': {
    terms: ['dental', 'dentistry', 'tooth', 'teeth', 'oral', 'maxillofacial'],
    category: 'dental',
    specialty: 'dentistry'
  },
  'surgery': {
    terms: ['surgery', 'surgical', 'operation', 'procedure', 'postoperative'],
    category: 'surgical',
    specialty: 'surgery'
  }
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
  'surgery': ['Surgery[Mesh]', 'Surgical Procedures[Mesh]'],
  'ra': ['Arthritis, Rheumatoid[Mesh]', 'Rheumatology[Mesh]'],
  'rheumatoid arthritis': ['Arthritis, Rheumatoid[Mesh]', 'Rheumatology[Mesh]'],
  'biologics': ['Biological Products[Mesh]', 'Biological Therapy[Mesh]']
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

// Abstract quality check function
const hasQualityAbstract = (abstract: string): boolean => {
  return Boolean(abstract && 
         abstract.length > 100 && 
         !abstract.includes("No abstract available") &&
         !abstract.includes("Abstract not available") &&
         !abstract.includes("No abstract") &&
         abstract.trim().length > 100);
};

// Interface for primary condition
interface PrimaryCondition {
  condition: string;
  category: string;
  specialty: string;
}

// Extract primary medical condition from query
function extractPrimaryCondition(query: string): PrimaryCondition | null {
  const lowerQuery = query.toLowerCase();
  
  // Check for specific conditions first
  for (const [condition, data] of Object.entries(MEDICAL_CONDITIONS)) {
    if (data.terms.some(term => lowerQuery.includes(term.toLowerCase()))) {
      return {
        condition,
        category: data.category,
        specialty: data.specialty
      };
    }
  }
  
  // Check for abbreviated conditions
  if (lowerQuery.includes('ra') || lowerQuery.includes('rheumatoid')) {
    return {
      condition: 'rheumatoid arthritis',
      category: 'rheumatology',
      specialty: 'rheumatology'
    };
  }
  
  if (lowerQuery.includes('dm') || lowerQuery.includes('diabetes')) {
    return {
      condition: 'diabetes',
      category: 'endocrinology',
      specialty: 'endocrinology'
    };
  }
  
  return null;
}

// Validate paper relevance to primary condition
function validatePaperRelevance(paper: Paper, primaryCondition: PrimaryCondition): boolean {
  const conditionData = MEDICAL_CONDITIONS[primaryCondition.condition];
  if (!conditionData) return true; // If no specific condition found, allow all papers
  
  const titleLower = paper.title.toLowerCase();
  const abstractLower = paper.abstract.toLowerCase();
  const combinedText = `${titleLower} ${abstractLower}`;
  
  // Check if paper mentions the primary condition or related terms
  const hasRelevantTerms = conditionData.terms.some(term => 
    combinedText.includes(term.toLowerCase())
  );
  
  // Check for conflicting conditions (e.g., dental papers in RA query)
  const conflictingConditions = Object.entries(MEDICAL_CONDITIONS).filter(([key, data]) => 
    key !== primaryCondition.condition && data.category !== primaryCondition.category
  );
  
  const hasConflictingTerms = conflictingConditions.some(([key, data]) => {
    // Skip if it's a general term that might overlap
    if (key === 'surgery' || key === 'treatment') return false;
    return data.terms.some(term => combinedText.includes(term.toLowerCase()));
  });
  
  // Paper must have relevant terms AND not have conflicting terms
  return hasRelevantTerms && !hasConflictingTerms;
}

// Calculate topic consistency score
function calculateTopicConsistencyScore(paper: Paper, primaryCondition: PrimaryCondition): number {
  const conditionData = MEDICAL_CONDITIONS[primaryCondition.condition];
  if (!conditionData) return 50; // Neutral score if no specific condition
  
  const titleLower = paper.title.toLowerCase();
  const abstractLower = paper.abstract.toLowerCase();
  const combinedText = `${titleLower} ${abstractLower}`;
  
  let score = 0;
  
  // Bonus for exact condition matches
  if (combinedText.includes(primaryCondition.condition.toLowerCase())) {
    score += 30;
  }
  
  // Bonus for related terms
  conditionData.terms.forEach(term => {
    if (combinedText.includes(term.toLowerCase())) {
      score += 10;
    }
  });
  
  // Bonus for specialty terms
  if (combinedText.includes(primaryCondition.specialty.toLowerCase())) {
    score += 15;
  }
  
  // Penalty for conflicting terms
  const conflictingConditions = Object.entries(MEDICAL_CONDITIONS).filter(([key, data]) => 
    key !== primaryCondition.condition && data.category !== primaryCondition.category
  );
  
  conflictingConditions.forEach(([key, data]) => {
    if (key === 'surgery' || key === 'treatment') return; // Skip general terms
    data.terms.forEach(term => {
      if (combinedText.includes(term.toLowerCase())) {
        score -= 20; // Heavy penalty for conflicting terms
      }
    });
  });
  
  return Math.max(0, score);
}

function extractSearchTerms(question: string): { terms: string[], meshTerms: string[], primaryCondition: PrimaryCondition | null } {
  const lowerQuestion = question.toLowerCase();
  const foundTerms: string[] = [];
  const foundMeshTerms: string[] = [];
  
  // Extract primary condition first
  const primaryCondition = extractPrimaryCondition(question);
  
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
  
  return { terms: foundTerms, meshTerms: foundMeshTerms, primaryCondition };
}

function buildAdvancedQuery(question: string): { query: string, primaryCondition: PrimaryCondition | null } {
  const { terms, meshTerms, primaryCondition } = extractSearchTerms(question);
  
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
  
  // Add condition-specific filters if primary condition is identified
  let conditionQuery = '';
  if (primaryCondition) {
    const conditionData = MEDICAL_CONDITIONS[primaryCondition.condition];
    if (conditionData) {
      conditionQuery = ` AND (${conditionData.terms.join(' OR ')})`;
    }
  }
  
  // Combine all parts
  const fullQuery = `${mainTerms}${meshQuery}${conditionQuery}${studyTypeQuery}${dateQuery}`;
  
  console.log("Built advanced query:", fullQuery);
  console.log("Primary condition:", primaryCondition);
  
  return { query: fullQuery, primaryCondition };
}

function calculateRelevanceScore(paper: Paper, query: string, primaryCondition: PrimaryCondition | null): number {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  const lowerTitle = paper.title.toLowerCase();
  const lowerAbstract = paper.abstract.toLowerCase();
  
  // Topic consistency score (heavily weighted)
  if (primaryCondition) {
    const topicScore = calculateTopicConsistencyScore(paper, primaryCondition);
    score += topicScore * 2; // Double weight for topic consistency
  }
  
  // Abstract quality penalties and bonuses
  if (!hasQualityAbstract(paper.abstract)) {
    score -= 50; // Heavy penalty for missing/poor abstracts
  } else {
    // Abstract presence bonus
    score += 20;
    
    // Abstract length bonuses
    if (paper.abstract.length < 200) {
      score -= 20; // Penalty for short abstracts
    } else if (paper.abstract.length > 500) {
      score += 10; // Bonus for substantial abstracts
    }
    
    // Abstract relevance
    const queryWords = lowerQuery.split(' ').filter(word => word.length > 3);
    const abstractMatches = queryWords.filter(word => lowerAbstract.includes(word)).length;
    score += (abstractMatches / queryWords.length) * 20;
  }
  
  // Title relevance (highest weight)
  const queryWords = lowerQuery.split(' ').filter(word => word.length > 3);
  const titleMatches = queryWords.filter(word => lowerTitle.includes(word)).length;
  score += (titleMatches / queryWords.length) * 40;
  
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
    
    // Build advanced search query with condition filtering
    const { query: advancedQuery, primaryCondition } = buildAdvancedQuery(query);
    
    // PubMed scraping logic
    const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    
    // Search for papers with increased results to compensate for filtering
    const searchUrl = `${baseUrl}esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: advancedQuery,
      retmax: "40", // Fetch 40 initial results to filter down
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
    const allPapers: Paper[] = [];
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
          
          const paper: Paper = {
            title,
            abstract,
            authors,
            journal,
            pubDate,
            pmid,
            relevanceScore: 0
          };
          
          // Validate topic consistency if primary condition is identified
          if (primaryCondition && !validatePaperRelevance(paper, primaryCondition)) {
            console.log("Rejecting paper due to topic inconsistency:", title);
            continue; // Skip this paper
          }
          
          // Calculate relevance score
          paper.relevanceScore = calculateRelevanceScore(paper, query, primaryCondition);
          
          allPapers.push(paper);
          
          console.log("Added paper:", title, "Score:", paper.relevanceScore, "Has abstract:", hasQualityAbstract(abstract));
        } catch (error) {
          console.log("Failed to parse article:", error);
          continue;
        }
      }
    }
    
    // Filter papers with quality abstracts
    const papersWithAbstracts = allPapers.filter(paper => hasQualityAbstract(paper.abstract));
    console.log(`Papers with quality abstracts: ${papersWithAbstracts.length}/${allPapers.length}`);
    
    // Sort papers by relevance score (highest first)
    papersWithAbstracts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // If we don't have enough papers with abstracts, try a broader search
    if (papersWithAbstracts.length < 10) {
      console.log("Not enough papers with abstracts, trying broader search...");
      
      // Try a simpler query without date restrictions but keep condition filtering
      const broaderQuery = buildAdvancedQuery(query).query.replace(/AND \(20\d{2}:\d{4}\[dp\]\)/, '');
      
      const broaderSearchParams = new URLSearchParams({
        db: "pubmed",
        term: broaderQuery,
        retmax: "60", // Even more results for broader search
        retmode: "json",
        sort: "relevance"
      });
      
      try {
        const broaderSearchResponse = await fetch(`${searchUrl}?${broaderSearchParams}`);
        const broaderSearchData = await broaderSearchResponse.json();
        
        if (broaderSearchData.esearchresult && broaderSearchData.esearchresult.idlist) {
          const broaderIdList = broaderSearchData.esearchresult.idlist;
          
          // Fetch broader results
          const broaderFetchParams = new URLSearchParams({
            db: "pubmed",
            id: broaderIdList.join(","),
            retmode: "xml"
          });
          
          const broaderFetchResponse = await fetch(`${fetchUrl}?${broaderFetchParams}`);
          const broaderXmlText = await broaderFetchResponse.text();
          
          // Parse broader results
          const broaderArticleMatches = broaderXmlText.match(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);
          
          if (broaderArticleMatches) {
            for (const article of broaderArticleMatches) {
              try {
                const titleMatch = article.match(/<ArticleTitle>([^<]*)<\/ArticleTitle>/);
                const title = titleMatch ? titleMatch[1] : "No title available";
                
                const abstractMatch = article.match(/<AbstractText>([^<]*)<\/AbstractText>/);
                const abstract = abstractMatch ? abstractMatch[1] : "No abstract available";
                
                // Only add if we don't already have this paper
                if (!papersWithAbstracts.some(p => p.title === title) && hasQualityAbstract(abstract)) {
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
                  
                  const journalMatch = article.match(/<Journal>([\s\S]*?)<\/Journal>/);
                  let journal = "Unknown Journal";
                  if (journalMatch) {
                    const titleMatch = journalMatch[1].match(/<Title>([^<]*)<\/Title>/);
                    if (titleMatch) {
                      journal = titleMatch[1];
                    }
                  }
                  
                  const pubDateMatch = article.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
                  let pubDate = null;
                  if (pubDateMatch) {
                    const yearMatch = pubDateMatch[1].match(/<Year>([^<]*)<\/Year>/);
                    if (yearMatch) {
                      pubDate = yearMatch[1];
                    }
                  }
                  
                  const pmidMatch = article.match(/<PMID>([^<]*)<\/PMID>/);
                  const pmid = pmidMatch ? pmidMatch[1] : null;
                  
                  const paper: Paper = {
                    title,
                    abstract,
                    authors,
                    journal,
                    pubDate,
                    pmid,
                    relevanceScore: 0
                  };
                  
                  // Validate topic consistency for broader search too
                  if (primaryCondition && !validatePaperRelevance(paper, primaryCondition)) {
                    console.log("Rejecting broader paper due to topic inconsistency:", title);
                    continue;
                  }
                  
                  paper.relevanceScore = calculateRelevanceScore(paper, query, primaryCondition);
                  papersWithAbstracts.push(paper);
                }
              } catch (error) {
                console.log("Failed to parse broader article:", error);
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.log("Broader search failed:", error);
      }
      
      // Re-sort after adding broader results
      papersWithAbstracts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    // Return top results (ensure minimum 10 if available)
    const minResults = Math.min(10, papersWithAbstracts.length);
    const targetResults = Math.max(minResults, Math.min(maxResults, papersWithAbstracts.length));
    const topPapers = papersWithAbstracts.slice(0, targetResults);
    
    console.log("Total papers with abstracts:", papersWithAbstracts.length);
    console.log("Returning top papers:", topPapers.length);
    console.log("Primary condition filtered:", primaryCondition?.condition);
    
    return { 
      papers: topPapers,
      totalFound: papersWithAbstracts.length,
      totalSearched: allPapers.length,
      query: advancedQuery,
      primaryCondition: primaryCondition?.condition
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