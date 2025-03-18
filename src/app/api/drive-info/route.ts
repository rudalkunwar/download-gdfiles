import { NextRequest, NextResponse } from 'next/server';
import { extractGoogleDriveFileId } from '@/utils/googleDriveHelper';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    const fileId = extractGoogleDriveFileId(url);
    
    if (!fileId) {
      return NextResponse.json({ success: false, message: 'Invalid Google Drive URL' }, { status: 400 });
    }

    try {
      // Fetch the file metadata to get the file name
      const response = await fetch(`https://drive.google.com/uc?id=${fileId}&export=download`, {
        method: 'HEAD',
      });

      let fileName = 'file';
      
      // Try to extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const matches = /filename="(.+?)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          fileName = matches[1];
        } else {
          const matches = /filename\*=UTF-8''(.+)/.exec(contentDisposition);
          if (matches && matches[1]) {
            fileName = decodeURIComponent(matches[1]);
          }
        }
      }

      return NextResponse.json({
        success: true,
        fileId,
        fileName,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        largeSizeUrl: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      });
      
    } catch (error) {
      console.error('Error fetching file metadata:', error);
      
      // Return just the file ID if we couldn't get metadata
      return NextResponse.json({
        success: true,
        fileId,
        fileName: 'file',
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        largeSizeUrl: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      });
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ success: false, message: 'Failed to process request' }, { status: 500 });
  }
}