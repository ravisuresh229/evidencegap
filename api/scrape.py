from http.server import BaseHTTPRequestHandler
import json
import requests
from bs4 import BeautifulSoup
import os
import openai

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            query = request_data.get('question', '')
            max_results = request_data.get('max_results', 5)
            
            # PubMed scraping logic
            base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
            
            # Search for papers
            search_url = f"{base_url}esearch.fcgi"
            search_params = {
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "retmode": "json"
            }
            
            search_response = requests.get(search_url, params=search_params)
            search_data = search_response.json()
            
            if "esearchresult" not in search_data:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Failed to search PubMed"}).encode())
                return
            
            id_list = search_data["esearchresult"]["idlist"]
            
            if not id_list:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"papers": []}).encode())
                return
            
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
            
            # Send successful response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"papers": papers}).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers() 