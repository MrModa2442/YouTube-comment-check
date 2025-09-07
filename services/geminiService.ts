
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnalysisResult } from '../types';
import { fetchYouTubeComments, YouTubeComment } from './youtubeService';

const MODEL_TEXT_ANALYSIS = "gemini-2.5-flash";

/**
 * Creates an instance of the GoogleGenAI client.
 * The API key is sourced from environment variables, as per project guidelines.
 * Throws an error if the API key is not configured in the environment.
 * @returns {GoogleGenAI} The initialized GoogleGenAI client.
 */
const getGenAIClient = (): GoogleGenAI => {
    // API key is sourced from environment variables, as per project guidelines.
    if (!process.env.API_KEY) {
        console.error("CRITICAL: API_KEY environment variable for Gemini is not set.");
        throw new Error("Gemini API Key is not configured in the environment.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Enhanced helper function to parse timestamp strings to seconds
const parseTimestampToSeconds = (timestampStr: string): number | null => {
  if (!timestampStr || timestampStr.toLowerCase() === "n/a") {
    return null;
  }

  let cleanedTimestamp = timestampStr.toLowerCase();

  // Remove common words and suffixes
  cleanedTimestamp = cleanedTimestamp.replace(/around|approx(?:imately)?|about|ish|mark|onwards|s$/gi, '').trim();

  // Handle ranges (e.g., "X-Y"), take the part before the hyphen
  if (cleanedTimestamp.includes('-')) {
    cleanedTimestamp = cleanedTimestamp.split('-')[0].trim();
  }

  let hours = 0, minutes = 0, seconds = 0;

  // Try HH:MM:SS or MM:SS (with colons)
  let match = cleanedTimestamp.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})$/);
  if (match) {
    if (match[1] !== undefined) { // HH:MM:SS
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      seconds = parseInt(match[3], 10);
    } else { // MM:SS
      minutes = parseInt(match[2], 10);
      seconds = parseInt(match[3], 10);
    }
    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
      return (hours * 3600) + (minutes * 60) + seconds;
    }
  }

  // Try M:SS (single digit minute with colon)
  match = cleanedTimestamp.match(/^(\d{1}):(\d{1,2})$/);
  if (match) {
    minutes = parseInt(match[1], 10);
    seconds = parseInt(match[2], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return (minutes * 60) + seconds;
    }
  }
  
  // Try MM.SS or M.SS (with period)
  match = cleanedTimestamp.match(/^(?:(\d{1,2})\.)?(\d{1,2})\.(\d{1,2})$/); // Support H.M.S (less common)
  if (match) {
     if (match[1] !== undefined) { // H.M.S
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        seconds = parseInt(match[3], 10);
     } else { // M.S (assuming this is MM.SS or M.SS) - need to check one vs two segments
        const parts = cleanedTimestamp.split('.');
        if (parts.length === 2) {
            minutes = parseInt(parts[0], 10);
            seconds = parseInt(parts[1], 10);
        } else if (parts.length === 3) { // H.M.S
             hours = parseInt(parts[0], 10);
             minutes = parseInt(parts[1], 10);
             seconds = parseInt(parts[2], 10);
        }
     }
     if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        return (hours * 3600) + (minutes * 60) + seconds;
     }
  } else { // Fallback for simple M.S if the above HMS/MMS style didn't catch
      match = cleanedTimestamp.match(/^(\d{1,2})\.(\d{1,2})$/);
      if (match) {
          minutes = parseInt(match[1], 10);
          seconds = parseInt(match[2], 10);
          if (!isNaN(minutes) && !isNaN(seconds)) {
            return (minutes * 60) + seconds;
          }
      }
  }


  // Try MM,SS or M,SS (with comma)
  match = cleanedTimestamp.match(/^(?:(\d{1,2}),)?(\d{1,2}),(\d{1,2})$/); // Support H,M,S
   if (match) {
     if (match[1] !== undefined) { // H,M,S
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        seconds = parseInt(match[3], 10);
     } else { // M,S
        const parts = cleanedTimestamp.split(',');
        if (parts.length === 2) {
            minutes = parseInt(parts[0], 10);
            seconds = parseInt(parts[1], 10);
        } else if (parts.length === 3) { // H,M,S
             hours = parseInt(parts[0], 10);
             minutes = parseInt(parts[1], 10);
             seconds = parseInt(parts[2], 10);
        }
     }
     if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        return (hours * 3600) + (minutes * 60) + seconds;
     }
  } else { // Fallback for simple M,S
      match = cleanedTimestamp.match(/^(\d{1,2}),(\d{1,2})$/);
      if (match) {
          minutes = parseInt(match[1], 10);
          seconds = parseInt(match[2], 10);
          if (!isNaN(minutes) && !isNaN(seconds)) {
            return (minutes * 60) + seconds;
          }
      }
  }

  // Try plain number (treat as seconds)
  match = cleanedTimestamp.match(/^(\d+)$/);
  if (match) {
    seconds = parseInt(match[1], 10);
    if (!isNaN(seconds)) {
      return seconds;
    }
  }

  console.warn(`Could not parse timestamp: "${timestampStr}" (cleaned: "${cleanedTimestamp}")`);
  return null;
};


const createAnalysisPromptForFetchedComments = (commentsBlock: string): string => {
  return `
You are an AI assistant specialized in meticulously analyzing YouTube video comments. Your ABSOLUTE PRIMARY MISSION is to identify EVERY comment where a user expresses interest in knowing the name, source, or details of any background music, song, track, tune, instrumental, beat, score, BGM, melody, rhythm, or any specific audio element within the video. Be extremely thorough and lean towards inclusion if there's a reasonable chance the user is asking about music. Your goal is to maximize the capture of potential music-related inquiries. When in doubt, especially if a timestamp is present with an inquisitive tone or strong sentiment, lean towards identifying it.

Given a block of text containing multiple YouTube comments (each on a new line, potentially with a username prefix like "Username: comment text" or just the comment text), please perform the following:

1.  **Analyze with Extreme Detail:** Read through all comments with the utmost care. Your goal is to catch every subtle hint or direct question about music. Users are creative and diverse in their language.

2.  **Be Hyper-Perceptive - Identify All Relevant Comments:**
    Look for a WIDE ARRAY of phrasings. Do NOT be conservative. If a human would likely interpret it as a music inquiry, YOU MUST TOO.

    **CRITICAL HIGH-PRIORITY RULE:**
    If a comment explicitly contains the word 'Music' or 'music' (case-insensitive) AND also contains any recognizable timestamp (e.g., '1:23', '00:45:10', 'around 2:15', '2.30', '1,10', 'at the 3 minute mark'), you MUST identify it as a music-related comment. Extract the comment text, username (if available), and the identified timestamp. This rule takes precedence if these two conditions are met.

    **Keywords to watch for (and their variations/misspellings):**
    music, song, track, tune, instrumental, beat, soundtrack, audio, sound, BGM (background music), score, melody, rhythm, jingle, "what is this playing?", "name of this", "ID for this", "source for this", "details on this audio".

    **A. Direct Questions (Examples - be ready for many more variations):**
    *   "What's the song at 2:13?"
    *   "Music at 1:45?"
    *   "Track ID 0:55 please?"
    *   "Anyone know the name of the song playing around 3:10?"
    *   "Song name?"
    *   "Title of this music?"
    *   "What is this beat called?"
    *   "Source for the audio around 1:20?"
    *   "Can someone ID the track playing at 0:33?"
    *   "What's this musical piece at 4:05?"
    *   "Need the song title for 2:50!"
    *   "The name of the music playing is...?"
    *   "Could you tell me the song from 1:11?"
    *   "BGM name at 0:58?"
    *   "What's the name of the instrumental used at 3:21?"
    *   "Anyone know the soundtrack title?"
    *   "Name of the tune at 5:00?"
    *   "What is that awesome audio at 1:50?"

    **B. Indirect Inquiries & Statements of Interest (Examples - be very inclusive):**
    *   "Love that beat around 1:00, anyone know it?"
    *   "That melody at 0:30 is catchy, what is it?"
    *   "The instrumental starting at 1:15 is amazing! Name?"
    *   "I need to find the name of this soundtrack!"
    *   "Wish I knew what this background audio was."
    *   "The tune from 0:45 slaps, what is it?"
    *   "This music makes the video! What is it?"
    *   "0:52 what's this sound piece? Need to know."
    *   "The audio choice at 2:22 is perfect, what is it?"
    *   "I keep replaying the part at 3:05 for the music, anyone know it?"
    *   "That specific sound that starts at 1:48, what's it called?"
    *   "The score used at 0:15 is beautiful, any info?"
    *   "Digging the rhythm around 2:55, what is that?"
    *   "Hook me up with the song at 0:20!"
    *   "Please tell me the song playing at 3:30, it's urgent!"
    *   "The song during 1:12 makes me want to dance, what is it?"
    *   "Wow, that background track at 4:15 is fire. Anyone got a name?"
    *   "Seriously need to know the music at 0:08."
    *   "That part at 1:59, the music is incredible. What is it?"
    *   "The background sound at 0:55 is just what I'm looking for, any ideas?"

    **C. Timestamp-Focused Comments (EXTREMELY High Likelihood - be EXTREMELY sensitive, even with minimal text or just emojis):**
    *   If a comment contains a timestamp AND any inquisitive language, positive/negative sentiment, or relevant emojis (e.g., 🔥, 🙏, 🤔, 👀, ❤️, 🎵, 🎧), it is almost certainly a music inquiry. DO NOT MISS THESE.
    *   Examples:
        *   "2:05 🔥🔥"
        *   "1:17 🙏 what is this?"
        *   "0:33 ?? I need this sound"
        *   "1:23 that audio... wow!"
        *   "0:40 OMG what's playing?"
        *   "3:12 YES! What is this?"
        *   "2:45 that part is amazing!" (Interpret as music interest unless context overwhelmingly suggests otherwise)
        *   "0:10 - this part is insane, what's the tune?"
        *   "Timestamp + what is this sound?" or "Timestamp + that sound tho"
        *   "The vibe at 3:00 is insane, what is it?" (interpret as music inquiry if timestamp is present)
        *   "0:59 this bit!"
        *   "1:21 🤯"
        *   "That audio at 0:25 hits different. Info?"

    **D. Slang & Colloquialisms (Examples - common ways users ask):**
    *   "What's this banger at 1:30?"
    *   "Drop the track name for 0:50!"
    *   "This slaps, track name?"
    *   "Need this in my playlist, what's the song at 2:18?"
    *   "Spill the song name at 0:27?"
    *   "What's the jam at 3:00?"
    *   "This heater at 1:03, anyone?"
    *   "Song? [timestamp]" (very common concise form)
    *   "Music? [timestamp]"
    *   "Audio source for 2:15?"

    **E. Infer User Intent (Critical Skill - use your intelligence):**
    *   Your main objective is to accurately infer the user's desire to discover the music.
    *   If a comment, in context, strongly suggests a desire to identify an audio piece, INCLUDE IT.
    *   Example: "Does anyone have a link for the audio at 1:25?"
    *   Be alert for misspellings, incomplete sentences, abbreviations.

3.  **Extract Information for EACH Identified Comment:**
    a.  **username:** The username if provided (e.g., "ActualUserName: Comment..."). If no username prefix is found, set to "N/A".
    b.  **comment:** The full, original, unaltered comment text.
    c.  **timestamp:** The timestamp mentioned (e.g., "2:13", "01:45:02", "0:55", "0:00-0:15", "around 3:30", "2:10 onwards", "1:12ish", "2.30", "1,10", "3 minute mark", "0:45ish"). Be flexible with formats (colons, periods, commas, "ish", "around", "mark"). Extract the most specific single point in time (prefer start of range). If the comment is clearly music-related but NO specific timestamp is explicitly found, set timestamp to "N/A". Your extracted timestamp should be in a format like MM:SS or HH:MM:SS.

4.  **Output Format:** Return ONLY a JSON array. Each object in the array must follow this structure:
    \`\`\`json
    {
      "username": "string (or N/A)",
      "comment": "string (original comment text)",
      "timestamp": "string (e.g., HH:MM:SS, MM:SS, M:SS, or N/A)"
    }
    \`\`\`

5.  **If No Music-Related Comments Found:** After exhaustive analysis, if absolutely no comments meet the criteria, return an empty array \`[]\`.

Ensure your output is strictly the JSON array, with no additional text, explanations, or markdown formatting around it.

Here is the block of comments to analyze:
---
${commentsBlock}
---
`;
};

export const analyzeFetchedYouTubeComments = async (commentsBlock: string): Promise<AnalysisResult[]> => {
  if (!commentsBlock || commentsBlock.trim() === "") {
    console.warn("analyzeFetchedYouTubeComments called with empty or no comments block.");
    return [];
  }

  const prompt = createAnalysisPromptForFetchedComments(commentsBlock);
  try {
    const client = getGenAIClient();
    const response: GenerateContentResponse = await client.models.generateContent({
      model: MODEL_TEXT_ANALYSIS,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawJsonText = response.text;
    let jsonStr = rawJsonText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    if (jsonStr === "") {
        return [];
    }
    
    if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
        console.warn("Gemini analysis response, after cleaning, might not be valid JSON:", jsonStr.substring(0,100)+"...");
        if (jsonStr.toLowerCase().includes("no music-related comments found") || jsonStr.toLowerCase().includes("no relevant comments")) {
            return [];
        }
        const arrayMatch = jsonStr.match(/(\[.*\])/s);
        if (arrayMatch && arrayMatch[1]) {
            jsonStr = arrayMatch[1];
        } else {
            if (jsonStr !== "[]") { // Avoid throwing error if it's legitimately an empty array string
                 // Added an extra cleaning step for rogue characters before final parse attempt
                const garbageCleanRegex = /(")\s*([^A-Za-z0-9"'{}\[\]\s:,.-]+)\s*([,}])/g;
                const potentiallyCleanerJsonStr = jsonStr.replace(garbageCleanRegex, '$1$3');
                if (jsonStr !== potentiallyCleanerJsonStr) {
                    console.log("Applied additional cleaning for rogue characters. Before:", jsonStr.substring(0,100), "After:", potentiallyCleanerJsonStr.substring(0,100));
                    jsonStr = potentiallyCleanerJsonStr;
                }
                // Re-check if it looks like an array now
                 if (!jsonStr.startsWith('[') && jsonStr !== "[]") {
                    throw new Error("AI analysis response is not in the expected JSON array format after cleaning and recovery attempts. Response starts with: " + jsonStr.substring(0, 50));
                 }
            }
        }
    }
    
    if (jsonStr === "[]") {
        return [];
    }
        
    try {
        const parsedData = JSON.parse(jsonStr);
        if (!Array.isArray(parsedData)) {
            if (typeof parsedData === 'object' && parsedData !== null && 'comment' in parsedData && parsedData.comment) { 
                 return [{
                    username: parsedData.username || "N/A",
                    comment: parsedData.comment,
                    timestamp: parsedData.timestamp || "N/A",
                }];
            }
            console.error("Parsed analysis data is not an array:", parsedData);
            throw new Error("AI analysis response was not a JSON array as expected.");
        }
        return parsedData.filter(item => item && typeof item.comment === 'string').map(item => ({ 
          username: item.username || "N/A",
          comment: item.comment,
          timestamp: item.timestamp || "N/A",
        })) as AnalysisResult[];
    } catch (e) {
        console.error("Failed to parse JSON from analysis response:", e, "\nCleaned string for analysis:", jsonStr, "\nOriginal raw analysis response:", rawJsonText);
        if (jsonStr === "[]") return []; 
        throw new Error("Failed to parse the AI's analysis response as JSON.");
    }

  } catch (error) {
    console.error("Error calling Gemini API for analysis:", error);
    if (error instanceof Error && (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid"))) {
        throw new Error("The provided Gemini API key is invalid. Please check the key and try again.");
    }
    throw new Error(`Failed to analyze comments with AI. ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const fetchAndAnalyzeVideoComments = async (videoId: string): Promise<{commentsFetched: number, analysisResults: AnalysisResult[]}> => {
  let fetchedComments: YouTubeComment[] = [];
  try {
    fetchedComments = await fetchYouTubeComments(videoId);
  } catch (youtubeError) {
    console.error("Error fetching comments from YouTube:", youtubeError);
    if (youtubeError instanceof Error && youtubeError.message.includes("API key")) {
        throw new Error(`YouTube Data API Error: ${youtubeError.message}. Please ensure the YouTube API key in services/youtubeService.ts is correct.`);
    }
    throw new Error(`Failed to fetch comments from YouTube: ${youtubeError instanceof Error ? youtubeError.message : String(youtubeError)}`);
  }
  
  if (!fetchedComments || fetchedComments.length === 0) {
    console.warn("No comments fetched from YouTube for video ID:", videoId);
    return { commentsFetched: 0, analysisResults: [] };
  }
  
  const commentsBlockForAnalysis = fetchedComments
    .map(c => `${c.authorDisplayName}: ${c.textDisplay.replace(/\n/g, ' ')}`)
    .join('\n');

  const analysisResultsFromAI = await analyzeFetchedYouTubeComments(commentsBlockForAnalysis);

  const resultsWithClipUrls: AnalysisResult[] = analysisResultsFromAI.map(result => {
    if (result.timestamp && result.timestamp.toLowerCase() !== "n/a") { // Ensure timestamp is valid before parsing
      const seconds = parseTimestampToSeconds(result.timestamp);
      if (seconds !== null) {
        return {
          ...result,
          clipUrl: `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`
        };
      } else {
         // Log if parsing failed for a non-"N/A" timestamp
         console.warn(`Timestamp parsing failed for: "${result.timestamp}" from comment by ${result.username}. No clip URL generated.`);
      }
    }
    return result; // Return original result if no valid timestamp for clip or parsing failed
  });

  return { commentsFetched: fetchedComments.length, analysisResults: resultsWithClipUrls };
};
