import os
from fastapi import FastAPI, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests
from bs4 import BeautifulSoup
import time
import openai
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("[ERROR] OPENAI_API_KEY not set in environment.")
openai_client = openai.OpenAI(api_key=openai_api_key)

@app.get("/health")
def health_check():
    return {"status": "ok"}

class PubMedResult(BaseModel):
    title: str
    abstract: Optional[str]
    authors: Optional[str]
    publication_date: Optional[str]
    pmid: Optional[str]
    url: Optional[str]

class ScrapeRequest(BaseModel):
    question: str

class AnalyzeRequest(BaseModel):
    question: str
    results: List[PubMedResult]

class AnalyzeResponse(BaseModel):
    summary: str
    evidence_gaps: List[str]
    research_suggestions: List[str]
    confidence_score: float
    priorities: List[str]

@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_evidence_gap(request: AnalyzeRequest):
    print(f"[DEBUG] Received analyze request for question: {request.question}")
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not set.")
    # Compose the context for GPT-4o-mini
    abstracts = "\n\n".join([
        f"Title: {r.title}\nAbstract: {r.abstract or 'N/A'}\nAuthors: {r.authors or 'N/A'}\nDate: {r.publication_date or 'N/A'}" for r in request.results
    ])
    prompt = f"""
You are an expert medical evidence analyst. Given the following clinical question and recent PubMed abstracts, perform a comprehensive evidence gap analysis. Your response should:
- Summarize the current state of evidence
- Identify what evidence exists vs. what is missing
- Highlight missing patient populations (age, demographics, comorbidities)
- Note missing study types (RCTs, real-world evidence, long-term outcomes)
- Point out gaps in comparisons or endpoints
- Suggest specific, actionable research opportunities, ranked by priority
- Assign a confidence score (0-1) for the completeness of current evidence

Clinical Question:
"""
    prompt += request.question + "\n\nRecent PubMed Abstracts:\n" + abstracts + "\n\nRespond in this JSON format:\n{\n  \"summary\": string,\n  \"evidence_gaps\": [string],\n  \"research_suggestions\": [string],\n  \"confidence_score\": float,\n  \"priorities\": [string]\n}"
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "You are a world-class medical evidence analyst."},
                      {"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.7
        )
        print("[DEBUG] OpenAI API call successful.")
        # Try to extract JSON from the response
        import json, re
        content = response.choices[0].message.content
        print(f"[DEBUG] OpenAI raw response: {content}")
        # Extract JSON from the response
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return AnalyzeResponse(**data)
        else:
            raise HTTPException(status_code=500, detail="OpenAI response did not contain valid JSON.")
    except Exception as e:
        print(f"[ERROR] OpenAI analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {e}")

@app.post("/api/scrape", response_model=List[PubMedResult])
def scrape_pubmed(request: ScrapeRequest):
    base_url = "https://pubmed.ncbi.nlm.nih.gov/"
    params = {"term": request.question, "sort": "date"}
    resp = requests.get(base_url, params=params, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    articles = soup.select(".search-results .docsum-content")
    results = []
    for article in articles[:8]:
        title_tag = article.select_one("a.docsum-title")
        title = title_tag.get_text(strip=True) if title_tag else None
        url = f"https://pubmed.ncbi.nlm.nih.gov{title_tag['href']}" if title_tag else None
        pmid = url.split("/")[-2] if url else None
        authors_tag = article.select_one(".docsum-authors.full-authors")
        authors = authors_tag.get_text(strip=True) if authors_tag else None
        date_tag = article.select_one(".docsum-journal-citation.full-journal-citation")
        publication_date = date_tag.get_text(strip=True).split(".")[0] if date_tag else None
        # Fetch abstract from article page
        abstract = None
        if url:
            try:
                abs_resp = requests.get(url, timeout=10)
                abs_resp.raise_for_status()
                abs_soup = BeautifulSoup(abs_resp.text, "html.parser")
                abs_tag = abs_soup.select_one(".abstract-content.selected")
                abstract = abs_tag.get_text(strip=True) if abs_tag else None
            except Exception:
                abstract = None
        results.append({
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "publication_date": publication_date,
            "pmid": pmid,
            "url": url
        })
    if not results:
        raise HTTPException(status_code=404, detail="No results found.")
    return results 