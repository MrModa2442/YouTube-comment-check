
import React, { useState, useCallback } from 'react';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultCard } from './components/ResultCard';
import { AnalysisResult } from './types';
import { fetchAndAnalyzeVideoComments } from './services/geminiService';

// Helper to extract Video ID from various YouTube URL formats
const extractVideoId = (url: string): string | null => {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const App: React.FC = () => {
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedCommentsCount, setFetchedCommentsCount] = useState<number>(0);

  const handleFetchAndAnalyze = useCallback(async () => {
    setError(null);
    setAnalysisResults([]);
    setFetchedCommentsCount(0);

    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube Video URL.');
      return;
    }
    
    if (!geminiApiKey.trim()) {
      setError('Please enter your Gemini API Key.');
      return;
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube Video URL. Please check the URL and try again.');
      return;
    }

    setIsLoading(true);

    try {
      const { commentsFetched, analysisResults: results } = await fetchAndAnalyzeVideoComments(videoId, geminiApiKey);
      setFetchedCommentsCount(commentsFetched);
      if (commentsFetched === 0 && results.length === 0) {
         setError("No comments were fetched from the video, or the video has no comments. Analysis was not performed.");
      } else if (results.length === 0 && commentsFetched > 0) {
        // setError will be handled by the specific message below for no results
      }
      setAnalysisResults(results);
    } catch (err) {
      console.error('Fetch/Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during fetching or analysis.');
    } finally {
      setIsLoading(false);
    }
  }, [youtubeUrl, geminiApiKey]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          YouTube Music Comment Analyzer
        </h1>
        <p className="mt-3 text-lg text-gray-300 max-w-2xl mx-auto">
          Enter a YouTube video URL to fetch its comments and let AI analyze them for music-related inquiries and timestamps.
          Powered by YouTube Data API & Gemini AI.
        </p>
      </header>

      <main className="w-full max-w-3xl bg-gray-800 shadow-2xl rounded-lg p-6 md:p-8 space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-300 mb-1">
              YouTube Video URL (Required)
            </label>
            <Input
              id="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="bg-gray-700 border-gray-600 placeholder-gray-500 text-white focus:ring-purple-500 focus:border-purple-500"
              aria-describedby="youtubeUrlHelp"
              required
            />
          </div>
          <div>
            <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-300 mb-1">
              Gemini API Key (Required)
            </label>
            <Input
              id="geminiApiKey"
              type="password"
              placeholder="Enter your Gemini API Key"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="bg-gray-700 border-gray-600 placeholder-gray-500 text-white focus:ring-purple-500 focus:border-purple-500"
              aria-describedby="geminiApiHelp"
              required
            />
            <p id="geminiApiHelp" className="mt-1 text-xs text-gray-400">
              Your Gemini API key is required for analysis and is not stored. Get a key from Google AI Studio.
            </p>
          </div>
        </div>


        <div className="flex flex-col sm:flex-row sm:justify-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Button
            onClick={handleFetchAndAnalyze}
            disabled={isLoading || !youtubeUrl.trim() || !geminiApiKey.trim()}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            aria-label="Fetch comments from the YouTube URL and analyze them for music inquiries"
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="mr-2 h-5 w-5 animate-spin" />
                Fetching & Analyzing...
              </>
            ) : (
              'Fetch & Analyze Comments'
            )}
          </Button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 bg-red-700 border border-red-900 text-red-100 rounded-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        {!isLoading && fetchedCommentsCount > 0 && analysisResults.length === 0 && !error && (
          <div className="mt-6 p-4 bg-gray-700 rounded-md text-center text-gray-300">
            <p>Fetched {fetchedCommentsCount} comment(s), but the AI did not identify any music-related inquiries. You can try a different video.</p>
          </div>
        )}

        {!isLoading && !error && youtubeUrl && geminiApiKey && fetchedCommentsCount === 0 && analysisResults.length === 0 && !isLoading && (
             <div className="mt-6 p-4 bg-gray-700 rounded-md text-center text-gray-300">
                <p>No comments were fetched. This could be due to the video having no comments, comments being disabled, or an issue with the YouTube API (e.g., quota, permissions).</p>
             </div>
        )}


        {analysisResults.length > 0 && !isLoading && (
          <section className="mt-8" aria-labelledby="analysis-results-heading">
            <h2 id="analysis-results-heading" className="text-2xl font-semibold text-gray-100 mb-2">Analysis Results</h2>
            <p className="text-sm text-gray-400 mb-4">Found {analysisResults.length} music-related comment(s) out of {fetchedCommentsCount} fetched comments.</p>
            <div className="space-y-4">
              {analysisResults.map((result, index) => (
                <ResultCard key={index} result={result} />
              ))}
            </div>
          </section>
        )}
         
         {!isLoading && !error && (!youtubeUrl || !geminiApiKey) && (
            <div className="mt-8 text-center text-gray-400">
                <p>Enter a YouTube video URL and your Gemini API Key, then click "Fetch & Analyze Comments" to begin.</p>
            </div>
         )}
      </main>
      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} AI Music Comment Analyzer. For demonstration purposes only.</p>
        <p className="mt-1">Requires user-provided Gemini API Key and a pre-configured YouTube Data API Key in `services/youtubeService.ts`.</p>
      </footer>
    </div>
  );
};

export default App;