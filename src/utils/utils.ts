/**
 * Extract file ID from various Google Drive link formats
 */
export function extractFileId(url: string): string | null {
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
      
      // Format: https://docs.google.com/spreadsheets/d/{fileId}/edit
      /docs\.google\.com\/spreadsheets\/d\/([^\/\?]+)/,
  
      // Format: https://docs.google.com/presentation/d/{fileId}/edit
      /docs\.google\.com\/presentation\/d\/([^\/\?]+)/
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
   * Determine file type from URL
   */
  export function getFileType(url: string): string {
    if (url.includes('/document/')) return 'Google Doc';
    if (url.includes('/spreadsheets/')) return 'Google Sheet';
    if (url.includes('/presentation/')) return 'Google Slides';
    if (url.includes('/folders/')) return 'Google Drive Folder';
    if (url.includes('/file/')) return 'Google Drive File';
    if (url.includes('docs.google.com')) return 'Google Document';
    return 'Unknown Google Drive File';
  }
  
  /**
   * Get export formats based on file type
   */
  export function getExportFormats(fileType: string): string[] {
    switch (fileType) {
      case 'Google Doc':
        return ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html', 'epub'];
      case 'Google Sheet':
        return ['pdf', 'xlsx', 'ods', 'csv', 'tsv'];
      case 'Google Slides':
        return ['pdf', 'pptx', 'odp', 'txt'];
      case 'Google Document':
        return ['pdf', 'docx', 'odt', 'rtf', 'txt'];
      default:
        return [];
    }
  }
  
  /**
   * Generate the correct viewer URL based on file type
   */
  export function getViewerUrl(fileId: string, fileType: string, originalUrl: string): string {
    // Use the original URL format if possible to maintain permissions
    if (originalUrl && originalUrl.includes('/edit')) {
      return originalUrl;
    }
    
    switch (fileType) {
      case 'Google Doc':
        return `https://docs.google.com/document/d/${fileId}/view`;
      case 'Google Sheet':
        return `https://docs.google.com/spreadsheets/d/${fileId}/view`;
      case 'Google Slides':
        return `https://docs.google.com/presentation/d/${fileId}/view`;
      case 'Google Drive Folder':
        return `https://drive.google.com/drive/folders/${fileId}`;
      case 'Google Document':
        // Try to determine the specific type from the URL
        if (originalUrl) {
          if (originalUrl.includes('/document/')) {
            return `https://docs.google.com/document/d/${fileId}/view`;
          }
          if (originalUrl.includes('/spreadsheets/')) {
            return `https://docs.google.com/spreadsheets/d/${fileId}/view`;
          }
          if (originalUrl.includes('/presentation/')) {
            return `https://docs.google.com/presentation/d/${fileId}/view`;
          }
        }
        // Default to standard file viewer
        return `https://drive.google.com/file/d/${fileId}/view`;
      default:
        // For standard files use the file viewer
        return `https://drive.google.com/file/d/${fileId}/view`;
    }
  }