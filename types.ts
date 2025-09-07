export interface AnalysisResult {
  username: string;
  comment: string;
  timestamp: string;
  clipUrl?: string; // New field for the YouTube clip URL
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // Other types of chunks can be added here if needed
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  // Other metadata fields can be added here
}

export interface Candidate {
  groundingMetadata?: GroundingMetadata;
  // Other candidate fields can be added here
}