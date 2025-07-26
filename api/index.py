from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import requests
from bs4 import BeautifulSoup
import openai
from typing import List, Dict, Any
import json

# Initialize FastAPI app
app = FastAPI(title="Evidence Gap Analysis API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

class ScrapeRequest(BaseModel):
    query: str
    max_results: int = 5

class AnalyzeRequest(BaseModel):
    papers: List[Dict[str, Any]]

@app.get("/")
async def root():
    return {"message": "Evidence Gap Analysis API"}

@app.post("/api/scrape")
async def scrape_papers(request: ScrapeRequest):
    try:
        # PubMed scraping logic
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
        
        # Search for papers
        search_url = f"{base_url}esearch.fcgi"
        search_params = {
            "db": "pubmed",
            "term": request.query,
            "retmax": request.max_results,
            "retmode": "json"
        }
        
        search_response = requests.get(search_url, params=search_params)
        search_data = search_response.json()
        
        if "esearchresult" not in search_data:
            raise HTTPException(status_code=500, detail="Failed to search PubMed")
        
        id_list = search_data["esearchresult"]["idlist"]
        
        if not id_list:
            return {"papers": []}
        
        # Fetch paper details
        fetch_url = f"{base_url}efetch.fcgi"
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "retmode": "xml"
        }
        
        fetch_response = requests.get(fetch_url, params=fetch_params)
        soup = BeautifulSoup(fetch_response.content, "xml")
        
        papers = []
        for article in soup.find_all("PubmedArticle"):
            try:
                title_elem = article.find("ArticleTitle")
                abstract_elem = article.find("AbstractText")
                authors_elem = article.find("AuthorList")
                
                title = title_elem.get_text() if title_elem else "No title available"
                abstract = abstract_elem.get_text() if abstract_elem else "No abstract available"
                
                authors = []
                if authors_elem:
                    for author in authors_elem.find_all("Author"):
                        last_name = author.find("LastName")
                        first_name = author.find("ForeName")
                        if last_name and first_name:
                            authors.append(f"{first_name.get_text()} {last_name.get_text()}")
                
                papers.append({
                    "title": title,
                    "abstract": abstract,
                    "authors": authors
                })
            except Exception as e:
                continue
        
        return {"papers": papers}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_papers(request: AnalyzeRequest):
    try:
        if not request.papers:
            raise HTTPException(status_code=400, detail="No papers provided")
        
        # Prepare papers for analysis
        papers_text = ""
        for i, paper in enumerate(request.papers, 1):
            papers_text += f"Paper {i}:\n"
            papers_text += f"Title: {paper.get('title', 'N/A')}\n"
            papers_text += f"Abstract: {paper.get('abstract', 'N/A')}\n"
            papers_text += f"Authors: {', '.join(paper.get('authors', []))}\n\n"
        
        # Analyze with OpenAI
        prompt = f"""
        Analyze the following research papers and identify evidence gaps in the field:

        {papers_text}

        Please provide:
        1. A summary of the current research landscape
        2. Key evidence gaps that need to be addressed
        3. Recommendations for future research directions
        4. Potential research questions that could fill these gaps

        Format your response in a clear, structured manner.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a research analyst specializing in identifying evidence gaps in scientific literature."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        analysis = response.choices[0].message.content
        
        return {
            "analysis": analysis,
            "papers_analyzed": len(request.papers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# For Vercel serverless functions
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 