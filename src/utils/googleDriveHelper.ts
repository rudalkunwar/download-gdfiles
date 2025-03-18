/**
 * Extract file ID from various Google Drive link formats
 */
export function extractGoogleDriveFileId(url: string): string | null {
  // Handle various Google Drive URL formats
  const patterns = [
    // Format: https://drive.google.com/file/d/{fileId}/view
    /drive\.google\.com\/file\/d\/([^\/\?]+)/,
    
    // Format: https://drive.google.com/open?id={fileId}
    /drive\.google\.com\/open\?id=([^&]+)/,
    
    // Format: https://docs.google.com/document/d/{fileId}/edit
    /docs\.google\.com\/\w+\/d\/([^\/\?]+)/,
    
    // Format: https://drive.google.com/uc?id={fileId}
    /drive\.google\.com\/uc\?id=([^&]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Generate direct download URL for Google Drive files
 */
export function generateDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Generate direct download URL for large Google Drive files (using confirm param)
 */
export function generateLargeFileDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
}

/**
 * Check if the URL is a valid Google Drive link
 */
export function isGoogleDriveLink(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}