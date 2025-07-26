"use client";

import React, { useState, useEffect } from "react";

interface PubMedResult {
  title: string;
  abstract?: string;
  authors?: string;
  publication_date?: string;
  pmid?: string;
  url?: string;
}

interface Analysis {
  summary: string;
  evidence_gaps: string[];
  research_suggestions: string[];
  confidence_score: number;
  priorities: string[];
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PubMedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to fetch results");
      }
      const data = await res.json();
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const analyze = async () => {
      if (results.length === 0) return;
      setAnalyzing(true);
      setAnalysis(null);
      setAnalysisError(null);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, results }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Failed to analyze evidence gap");
        }
        const data = await res.json();
        setAnalysis(data);
      } catch (err: unknown) {
        setAnalysisError(err instanceof Error ? err.message : "An error occurred during analysis");
      } finally {
        setAnalyzing(false);
      }
    };
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-100 flex flex-col items-center justify-center font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2 tracking-tight">GENEVA Evidence Gap Detector</h1>
        <p className="text-lg text-blue-700 max-w-xl mx-auto">A tool for healthcare researchers to identify evidence gaps in clinical questions using PubMed and AI.</p>
      </header>
      <main className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col gap-6 border border-blue-100">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label htmlFor="clinical-question" className="font-semibold text-blue-800">Enter your clinical question</label>
          <textarea
            id="clinical-question"
            name="clinical-question"
            rows={4}
            className="border border-blue-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-blue-900"
            placeholder="e.g. What is the effectiveness of telemedicine for diabetes management in older adults?"
            required
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
          <button
            type="submit"
            className="mt-2 bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                Analyzing...
              </span>
            ) : (
              "Analyze Evidence Gap"
            )}
          </button>
        </form>
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        {results.length > 0 && (
          <div className="mt-6 max-h-96 overflow-y-auto border-t border-blue-100 pt-4">
            <h2 className="text-lg font-bold text-blue-800 mb-2">PubMed Results</h2>
            <ul className="flex flex-col gap-4">
              {results.map((item, idx) => (
                <li key={item.pmid || idx} className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-100">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-900 font-semibold hover:underline">
                    {item.title}
                  </a>
                  <div className="text-xs text-blue-700 mb-1">{item.authors} | {item.publication_date}</div>
                  {item.abstract && <div className="text-sm text-blue-800 mt-2">{item.abstract}</div>}
                  <div className="text-xs text-blue-500 mt-2">PMID: {item.pmid}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Evidence Gap Analysis Section */}
        {analyzing && results.length > 0 && (
          <div className="mt-8 flex flex-col items-center">
            <span className="flex items-center gap-2 text-blue-700">
              <svg className="animate-spin h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              Analyzing evidence gaps with AI...
            </span>
          </div>
        )}
        {analysisError && (
          <div className="text-red-600 text-sm mt-4">{analysisError}</div>
        )}
        {analysis && (
          <div className="mt-8 p-6 rounded-xl bg-green-50 border border-green-200 shadow flex flex-col gap-4">
            <h2 className="text-xl font-bold text-green-900 mb-2">Evidence Gap Analysis</h2>
            <div>
              <span className="font-semibold text-green-800">Summary:</span>
              <div className="text-green-900 mt-1">{analysis.summary}</div>
            </div>
            <div>
              <span className="font-semibold text-green-800">Evidence Gaps:</span>
              <ul className="list-disc ml-6 mt-1 text-green-900">
                {analysis.evidence_gaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-semibold text-green-800">Suggested Research:</span>
              <ul className="list-decimal ml-6 mt-1 text-green-900">
                {analysis.research_suggestions.map((sugg, i) => (
                  <li key={i}>{sugg}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-green-800">Confidence Score:</span>
              <div className="text-green-900">{(analysis.confidence_score * 100).toFixed(1)}%</div>
            </div>
            <div>
              <span className="font-semibold text-green-800">Research Priorities:</span>
              <ul className="list-disc ml-6 mt-1 text-green-900">
                {analysis.priorities.map((priority, i) => (
                  <li key={i}>{priority}</li>
                ))}
              </ul>
            </div>
        </div>
        )}
      </main>
      <footer className="mt-10 text-blue-600 text-sm opacity-80">&copy; {new Date().getFullYear()} GENEVA Evidence Gap Detector</footer>
    </div>
  );
}
