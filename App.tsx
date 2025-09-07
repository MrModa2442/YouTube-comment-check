
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
    
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube Video URL. Please check the URL and try again.');
      return;
    }

    setIsLoading(true);

    try {
      const { commentsFetched, analysisResults: results } = await fetchAndAnalyzeVideoComments(videoId);
      setFetchedCommentsCount(commentsFetched);
      if (commentsFetched === 0 && results.length === 0) {
         setError("No comments were fetched from the video, or the video has no comments. Analysis was not performed.");
      } else if (results.length === 0 && commentsFetched > 0) {
        // The message for this case is handled further down in the JSX
      }
      setAnalysisResults(results);
    } catch (err) {
      console.error('Fetch/Analysis error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during fetching or analysis.';
      
      if (errorMessage.includes("YouTube Data API Key is not configured")) {
          setError("Configuration Error: The YouTube API Key is missing. Please ensure the YOUTUBE_API_KEY environment variable is set by the application host.");
      } else if (errorMessage.includes("Gemini API Key is not configured")) {
          setError("Configuration Error: The Gemini API Key is missing. Please ensure the API_KEY environment variable is set by the application host.");
      } else {
          setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [youtubeUrl]);

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
        </div>


        <div className="flex flex-col sm:flex-row sm:justify-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Button
            onClick={handleFetchAndAnalyze}
            disabled={isLoading || !youtubeUrl.trim()}
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
          <div role="alert" className="mt-4 p-4 bg-red-800 border border-red-900 text-red-100 rounded-lg shadow-lg">
             <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-red-300 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="font-semibold">An Error Occurred</p>
            </div>
            <p className="mt-2 ml-9">{error}</p>
            {(error.includes('API Key is missing') || error.includes('API Key is not configured')) && (
               <div className="mt-4 ml-9 pt-3 border-t border-red-700 text-sm">
                <p className="font-bold mb-2 text-red-200">What does this mean?</p>
                <p className="mb-3 text-red-200">
                  This application requires API keys to be configured by its host to communicate with YouTube and Google AI services. 
                  Since they are not available, the application cannot fetch live data. Please ensure the necessary environment variables (YOUTUBE_API_KEY and API_KEY) are set by the application host.
                </p>
              </div>
            )}
            {error.includes('YouTube API') && (error.includes('403') || error.includes('forbidden')) && (
              <div className="mt-3 ml-9 pt-3 border-t border-red-700 text-sm">
                <p className="font-bold mb-2 text-red-200">Troubleshooting a YouTube API "Forbidden" Error:</p>
                <p className="mb-2">This error almost always means there's a problem with your YouTube API key setup in the Google Cloud Console, not with the app's code.</p>
                <ul className="list-disc list-inside space-y-1 text-red-200">
                  <li>
                    <strong>Check API Key Restrictions:</strong> In Google Cloud Console, go to "APIs & Services" &gt; "Credentials". Click on your key. Under "API restrictions", ensure "YouTube Data API v3" is selected.
                  </li>
                  <li>
                    <strong>Check API is Enabled:</strong> In "APIs & Services" &gt; "Library", search for "YouTube Data API v3" and make sure it's enabled for your project.
                  </li>
                  <li>
                    <strong>Check Billing:</strong> Ensure your Google Cloud project is linked to an active billing account. Some APIs require this even for free tiers.
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        {!isLoading && fetchedCommentsCount > 0 && analysisResults.length === 0 && !error && (
          <div className="mt-6 p-4 bg-gray-700 rounded-md text-center text-gray-300">
            <p>Fetched {fetchedCommentsCount} comment(s), but the AI did not identify any music-related inquiries. You can try a different video.</p>
          </div>
        )}

        {!isLoading && !error && youtubeUrl && fetchedCommentsCount === 0 && analysisResults.length === 0 && !isLoading && (
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
         
         {!isLoading && !error && !youtubeUrl && (
            <div className="mt-8 text-center text-gray-400">
                <p>Enter a YouTube video URL, then click "Fetch & Analyze Comments" to begin.</p>
            </div>
         )}
      </main>
      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} AI Music Comment Analyzer. For demonstration purposes only.</p>
        <p className="mt-1">Powered by the YouTube Data API and the Gemini API.</p>
      </footer>
    </div>
  );
};

export default App;
