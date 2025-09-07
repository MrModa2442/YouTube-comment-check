
// The YouTube Data API v3 key is sourced from an environment variable.
// It's crucial that this key is correctly configured in your project's environment settings
// and has the "YouTube Data API v3" enabled in its restrictions in Google Cloud Console.
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const MAX_RESULTS_PER_PAGE = 100; // YouTube API allows up to 100
const TARGET_TOTAL_COMMENTS = 2000; // Target number of comments to fetch
const MAX_PAGES_TO_FETCH = Math.ceil(TARGET_TOTAL_COMMENTS / MAX_RESULTS_PER_PAGE);


export interface YouTubeCommentSnippet {
  textDisplay: string;
  textOriginal: string;
  authorDisplayName: string;
  authorProfileImageUrl: string; // Could be useful for UI later
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
}

export interface YouTubeTopLevelComment {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubeCommentSnippet;
}

export interface YouTubeCommentThreadSnippet {
  videoId: string;
  topLevelComment: YouTubeTopLevelComment;
  canReply: boolean;
  totalReplyCount: number;
  isPublic: boolean;
}

export interface YouTubeCommentThread {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubeCommentThreadSnippet;
  // replies?: { comments: YouTubeReply[] }; // For fetching replies, not implemented here
}

export interface YouTubeCommentApiResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeCommentThread[];
}

// Simplified structure for what we'll use internally
export interface YouTubeComment {
  id: string;
  textDisplay: string;
  authorDisplayName: string;
}

export const fetchYouTubeComments = async (videoId: string): Promise<YouTubeComment[]> => {
  if (!YOUTUBE_API_KEY) {
    console.error("CRITICAL: YOUTUBE_API_KEY environment variable for YouTube Data API is not set.");
    throw new Error("YouTube Data API Key is not configured in the environment. Please ensure the YOUTUBE_API_KEY environment variable is set.");
  }

  let allComments: YouTubeComment[] = [];
  let nextPageToken: string | undefined = undefined;
  let pagesFetched = 0;

  do {
    let apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=${MAX_RESULTS_PER_PAGE}&order=relevance&textFormat=plainText`;
    if (nextPageToken) {
      apiUrl += `&pageToken=${nextPageToken}`;
    }

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown YouTube API error" }));
        console.error('YouTube API Error Response:', errorData);
        let errorMessage = `YouTube API request failed: ${response.status} ${response.statusText}.`;
        if (errorData && errorData.error && errorData.error.message) {
          errorMessage += ` Message: ${errorData.error.message}`;
          if (errorData.error.errors && errorData.error.errors[0] && errorData.error.errors[0].reason) {
               errorMessage += ` Reason: ${errorData.error.errors[0].reason}`;
          }
        }
        if (response.status === 403) {
          errorMessage += " This might be due to an incorrect API key, disabled YouTube Data API, exceeding quota, or the API key not being properly restricted for YouTube Data API v3.";
        }
        if (response.status === 404) {
          errorMessage += " Video not found or comments might be disabled for this video.";
        }
        throw new Error(errorMessage);
      }

      const data: YouTubeCommentApiResponse = await response.json();
      pagesFetched++;
      
      if (data.items && data.items.length > 0) {
        const commentsFromPage = data.items.map((item: YouTubeCommentThread) => ({
          id: item.snippet.topLevelComment.id,
          textDisplay: item.snippet.topLevelComment.snippet.textDisplay,
          authorDisplayName: item.snippet.topLevelComment.snippet.authorDisplayName,
        }));
        allComments = allComments.concat(commentsFromPage);
      }
      
      nextPageToken = data.nextPageToken;

      if (allComments.length >= TARGET_TOTAL_COMMENTS) {
        console.log(`Reached target comment count of ${TARGET_TOTAL_COMMENTS}. Fetched ${allComments.length} comments.`);
        break; 
      }

      if (pagesFetched >= MAX_PAGES_TO_FETCH) {
        console.log(`Reached maximum pages to fetch (${MAX_PAGES_TO_FETCH}). Fetched ${allComments.length} comments.`);
        break;
      }

    } catch (error) {
      console.error('Error fetching a page of YouTube comments:', error);
      // If an error occurs on one page, we might want to return what we have so far,
      // or re-throw. For now, let's re-throw to signal a problem.
      throw error; 
    }
  } while (nextPageToken);

  if (allComments.length === 0 && pagesFetched > 0) {
      console.log(`No comments found for video ID ${videoId} after checking initial pages, or comments might be disabled.`);
  } else if (allComments.length > 0) {
      console.log(`Finished fetching comments. Total fetched: ${allComments.length} from ${pagesFetched} page(s).`);
  }


  return allComments;
};
