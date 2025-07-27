import { NextRequest, NextResponse } from 'next/server';

async function scrapePubMed(query: string, maxResults: number = 5) {
  try {
    // PubMed scraping logic
    const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
    
    // Search for papers
    const searchUrl = `${baseUrl}esearch.fcgi`;
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: maxResults.toString(),
      retmode: "json"
    });
    
    const searchResponse = await fetch(`${searchUrl}?${searchParams}`);
    const searchData = await searchResponse.json();
    
    if (!searchData.esearchresult) {
      return { error: "Failed to search PubMed" };
    }
    
    const idList = searchData.esearchresult.idlist;
    
    if (!idList || idList.length === 0) {
      return { papers: [] };
    }
    
    // Fetch paper details
    const fetchUrl = `${baseUrl}efetch.fcgi`;
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      id: idList.join(","),
      retmode: "xml"
    });
    
    const fetchResponse = await fetch(`${fetchUrl}?${fetchParams}`);
    const xmlText = await fetchResponse.text();
    
    // Simple XML parsing (we'll use regex for basic extraction)
    const papers = [];
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
          
          papers.push({
            title,
            abstract,
            authors
          });
        } catch {
          continue;
        }
      }
    }
    
    return { papers };
    
  } catch (error) {
    return { error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.question || '';
    const maxResults = body.max_results || 5;
    
    const result = await scrapePubMed(query, maxResults);
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