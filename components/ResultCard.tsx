import React from 'react';
import { AnalysisResult } from '../types';

interface ResultCardProps {
  result: AnalysisResult;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  return (
    <div className="bg-gray-700 shadow-lg rounded-lg p-5 transition-all duration-300 hover:shadow-purple-500/30 border border-gray-600">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
        {result.username && result.username !== "N/A" && (
            <p className="text-sm font-semibold text-purple-400">{result.username}</p>
        )}
        {result.timestamp && result.timestamp !== "N/A" && (
             <p className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                Timestamp: <span className="font-bold">{result.timestamp}</span>
            </p>
        )}
      </div>
      <p className="text-gray-300 whitespace-pre-wrap">{result.comment}</p>
      
      {result.clipUrl && result.timestamp && result.timestamp !== "N/A" && (
        <a 
          href={result.clipUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="mt-3 inline-flex items-center text-sm text-purple-400 hover:text-purple-300 hover:underline"
          aria-label={`Watch video clip starting at timestamp ${result.timestamp}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
          Watch clip (starts at {result.timestamp})
        </a>
      )}

      {(!result.timestamp || result.timestamp === "N/A") && (
         <p className="mt-2 text-xs text-yellow-400">Timestamp not explicitly found, but comment identified as music-related.</p>
       )}
    </div>
  );
};