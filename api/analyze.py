from http.server import BaseHTTPRequestHandler
import json
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
            
            papers = request_data.get('results', [])
            
            if not papers:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "No papers provided"}).encode())
                return
            
            # Prepare papers for analysis
            papers_text = ""
            for i, paper in enumerate(papers, 1):
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
            
            result = {
                "analysis": analysis,
                "papers_analyzed": len(papers)
            }
            
            # Send successful response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
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