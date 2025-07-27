"use client";

import React, { useState, useEffect } from "react";

interface PubMedResult {
  title: string;
  abstract?: string;
  authors?: string[];
  journal?: string;
  pubDate?: string | null;
  pmid?: string | null;
  relevanceScore?: number;
}

interface Analysis {
  analysis: string;
  papers_analyzed: number;
  clinical_question?: string;
}

const exampleQuestions = [
  "Effectiveness of statins in elderly patients",
  "Long-term safety of GLP-1 agonists",
  "Comparative effectiveness of biologics in RA",
  "Telemedicine outcomes in diabetes management",
  "Novel biomarkers for early cancer detection"
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PubMedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [expandedPapers, setExpandedPapers] = useState<Set<number>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults([]);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzing(false);
    setExpandedPapers(new Set());
    
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch results");
      }
      
      const data = await res.json();
      setResults(data.papers || []);
    } catch (err: unknown) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    // Reset all analysis states when clicking an example
    setQuestion(example);
    setResults([]);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzing(false);
    setExpandedPapers(new Set());
  };

  const togglePaperExpansion = (index: number) => {
    const newExpanded = new Set(expandedPapers);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPapers(newExpanded);
  };

  useEffect(() => {
    const analyze = async () => {
      if (results.length === 0) return;
      
      console.log("Starting analysis for:", question, "with", results.length, "papers");
      
      setAnalyzing(true);
      setAnalysis(null);
      setAnalysisError(null);
      
      try {
                console.log("Sending API request...");
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
        
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            question, 
            results: results.map((paper: PubMedResult) => ({
              title: paper.title,
              abstract: paper.abstract || "",
              authors: paper.authors || [],
              journal: paper.journal,
              pubDate: paper.pubDate,
              pmid: paper.pmid,
              relevanceScore: paper.relevanceScore
            }))
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log("API response received, status:", res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error("API error:", errorData);
          throw new Error(errorData.error || `Analysis failed (${res.status})`);
        }
        
        const data = await res.json();
        console.log("Analysis data received:", data);
        
        if (data.clinical_question === question) {
          setAnalysis(data);
        }
      } catch (err: unknown) {
        console.error("Analysis error:", err);
        setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
      } finally {
        console.log("Analysis complete, setting analyzing to false");
        setAnalyzing(false);
      }
    };
    
    analyze();
  }, [results, question]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 py-20 px-4">
        <div className="absolute inset-0 bg-black/10"></div>
        
        {/* Floating Icons */}
        <div className="absolute top-10 left-10 animate-float">
          <svg className="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div className="absolute top-20 right-20 animate-float" style={{ animationDelay: '1s' }}>
          <svg className="w-6 h-6 text-white/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div className="absolute bottom-10 left-1/4 animate-float" style={{ animationDelay: '2s' }}>
          <svg className="w-10 h-10 text-white/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            AETHER Evidence Intelligence Platform
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            Accelerating evidence discovery with AI
          </p>
                      <div className="flex items-center justify-center gap-4 text-blue-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>AI-Powered Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span>Evidence Discovery</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span>Research Intelligence</span>
              </div>
            </div>
        </div>
      </section>

      {/* Search Interface */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your clinical research question..."
                                 className="w-full h-32 px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                                 className="absolute bottom-4 right-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Analyzing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Analyze Evidence Intelligence
                  </div>
                )}
              </button>
            </div>

            {/* Example Questions */}
            <div className="space-y-3">
              <p className="text-gray-600 font-medium">Try these example questions:</p>
              <div className="flex flex-wrap gap-3">
                {exampleQuestions.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                                         className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="font-medium">Search Error</span>
              </div>
              <p className="text-red-600 text-sm">{error}</p>
              <p className="text-red-500 text-xs mt-2">Try rephrasing your question or using one of the example questions below.</p>
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      {(results.length > 0 || analyzing) && (
        <section className="py-16 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Research Papers */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Research Papers Found</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {results.length} papers
                  </span>
                </div>
                
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {results.map((paper, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 leading-tight">
                          {paper.title}
                        </h3>
                        <button
                          onClick={() => togglePaperExpansion(index)}
                          className="ml-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg
                            className={`w-5 h-5 transform transition-transform ${
                              expandedPapers.has(index) ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        {paper.authors && paper.authors.length > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            {paper.authors.slice(0, 2).join(', ')}
                            {paper.authors.length > 2 && ' et al.'}
                          </span>
                        )}
                        {paper.journal && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                            {paper.journal}
                          </span>
                        )}
                        {paper.pubDate && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            {paper.pubDate}
                          </span>
                        )}
                        {paper.relevanceScore && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            Score: {paper.relevanceScore}
                          </span>
                        )}
                      </div>
                      
                      {expandedPapers.has(index) && paper.abstract && (
                        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {paper.abstract}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Gap Analysis */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Evidence Intelligence Analysis</h2>
                  {analysis && (
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      Export PDF
                    </button>
                  )}
                </div>

                {analyzing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span className="text-lg font-semibold text-blue-800">Analyzing Evidence Intelligence</span>
                    </div>
                    <p className="text-blue-700">Our AI is analyzing the research landscape and identifying key evidence gaps...</p>
                    <p className="text-blue-600 text-sm mt-2">Analyzing {results.length} papers for &quot;{question}&quot;</p>
                  </div>
                )}

                {analysisError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-center gap-2 text-red-700 mb-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      <span className="font-medium">Analysis Error</span>
                    </div>
                    <p className="text-red-600 text-sm">{analysisError}</p>
                    <p className="text-red-500 text-xs mt-2">The analysis failed to complete. Please try again with a different question.</p>
                    <button 
                      onClick={() => {
                        setAnalysisError(null);
                        setAnalyzing(true);
                        // Trigger re-analysis by updating results
                        setResults([...results]);
                      }}
                      className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Retry Analysis
                    </button>
                  </div>
                )}

                {analysis && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-green-900">Evidence Intelligence Analysis Complete</h3>
                        <p className="text-green-700 text-sm">{analysis.papers_analyzed} papers analyzed for RWE opportunities</p>
                      </div>
                    </div>
                    
                    {analysis.analysis ? (
                      <div className="bg-white rounded-lg p-6 border border-green-200 max-h-96 overflow-y-auto">
                        <div className="text-gray-800 leading-relaxed whitespace-pre-line text-sm">
                          {analysis.analysis}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-6 border border-green-200">
                        <div className="flex items-center justify-center gap-3">
                          <svg className="animate-spin h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          <p className="text-gray-600">Generating evidence intelligence insights...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-white">AETHER</span>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} AETHER Evidence Intelligence Platform. Accelerating evidence discovery with AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
