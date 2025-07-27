import { NextRequest, NextResponse } from 'next/server';

function extractSearchTerms(question: string): string {
  // Extract key medical terms from the question
  const lowerQuestion = question.toLowerCase();
  
  // Common medical terms to look for
  const medicalTerms = [
    'metformin', 'diabetes', 'type 2', 'type 1', 'insulin', 'glucose',
    'hypertension', 'blood pressure', 'cholesterol', 'obesity',
    'cancer', 'tumor', 'oncology', 'chemotherapy',
    'heart disease', 'cardiovascular', 'stroke', 'heart attack',
    'depression', 'anxiety', 'mental health', 'psychiatry',
    'vaccine', 'immunization', 'infection', 'antibiotic',
    'surgery', 'surgical', 'procedure', 'operation'
  ];
  
  // Find medical terms in the question
  const foundTerms = medicalTerms.filter(term => lowerQuestion.includes(term));
  
  console.log("Found medical terms:", foundTerms);
  
  if (foundTerms.length > 0) {
    // Use the found medical terms
    return foundTerms.join(' AND ');
  }
  
  // If no medical terms found, use the first few words
  const words = question.split(' ').slice(0, 4);
  return words.join(' ');
}

async function scrapePubMed(query: string, maxResults: number = 5) {
  try {
    console.log("Original query:", query);
    
    // Extract search terms from the question
    const searchTerms = extractSearchTerms(query);
    console.log("Extracted search terms:", searchTerms);
    
    // PubMed scraping logic
    const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    
    // Search for papers
    const searchUrl = `${baseUrl}esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: searchTerms,
      retmax: maxResults.toString(),
      retmode: "json"
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
      console.log("No papers found for query:", searchTerms);
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
    
    // Simple XML parsing (we'll use regex for basic extraction)
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
          
          papers.push({
            title,
            abstract,
            authors
          });
          
          console.log("Added paper:", title);
        } catch {
          console.log("Failed to parse article");
          continue;
        }
      }
    }
    
    console.log("Total papers found:", papers.length);
    return { papers };
    
  } catch (error) {
    console.error("Error in scrapePubMed:", error);
    return { error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.question || '';
    const maxResults = body.max_results || 5;
    
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