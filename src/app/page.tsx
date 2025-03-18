"use client";
import { useState } from 'react';
import Head from 'next/head';
import { FaDownload, FaPaste, FaExclamationTriangle } from 'react-icons/fa';
import { toast, Toaster } from 'react-hot-toast';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    id: string;
    name: string;
    mimeType?: string;
    canDownload?: boolean;
    isGoogleApps?: boolean;
    exportOptions?: string[];
  } | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');

  const extractFileId = (url: string): string | null => {
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /\/document\/d\/([a-zA-Z0-9_-]+)/,
      /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
      /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setUrl(clipboardText);
      toast.success('URL pasted from clipboard');
    } catch (error) {
      toast.error('Unable to access clipboard. Please paste the link manually.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      toast.error('Please enter a Google Drive link');
      return;
    }

    setIsLoading(true);
    setFileInfo(null);

    try {
      const fileId = extractFileId(url);
      if (!fileId) {
        throw new Error('Invalid Google Drive link. Could not extract file ID.');
      }

      // Get file info
      const infoResponse = await fetch(`/api/file-info?fileId=${fileId}`);

      if (!infoResponse.ok) {
        const contentType = infoResponse.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Received HTML instead of file info. File might be inaccessible.');
        }

        const errorText = await infoResponse.text();
        let errorMessage = 'Failed to get file information';

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          // If parsing fails, use the error text or default message
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const contentType = infoResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Received non-JSON response from server');
      }

      const infoData = await infoResponse.json();
      setFileInfo(infoData);

      if (infoData.isGoogleApps && infoData.exportOptions && infoData.exportOptions.length > 0) {
        setSelectedFormat(infoData.exportOptions[0]);
      }

      // For file info, we don't automatically download
      // We'll show the file info and let the user choose to download

    } catch (error: any) {
      setError(error.message || 'Failed to process file information');
      toast.error(error.message || 'Failed to process file information');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async (fileId: string, infoData: any, options: { forcePdf?: boolean, viewOnly?: boolean } = {}) => {
    setIsLoading(true);
    try {
      // Build the download URL with all necessary parameters
      const format = infoData.isGoogleApps && selectedFormat ? `&format=${selectedFormat}` : '';
      const forcePdf = options.forcePdf ? '&forcePdf=true' : '';
      const viewOnly = options.viewOnly ? '&viewOnly=true' : '';

      const downloadUrl = `/api/download?fileId=${fileId}${format}${forcePdf}${viewOnly}`;

      // Create and click the download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = infoData.name || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Download started for: ${infoData.name}`);
    } catch (error: any) {
      setError(error.message || 'Failed to download file');
      toast.error(error.message || 'Failed to download file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFormat(e.target.value);
  };

  const handleDownloadWithFormat = async () => {
    if (!fileInfo?.id) return;
    await downloadFile(fileInfo.id, fileInfo);
  };

  const handleDownloadViewOnlyPdf = async () => {
    if (!fileInfo?.id) return;
    await downloadFile(fileInfo.id, fileInfo, { forcePdf: true, viewOnly: true });
  };

  const handleDirectDownload = async () => {
    if (!fileInfo?.id) return;
    await downloadFile(fileInfo.id, fileInfo);
  };

  return (
    <>
      <Head>
        <title>Google Drive Downloader</title>
        <meta name="description" content="Download files from Google Drive" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-100 py-12">
        <Toaster position="bottom-center" />

        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-blue-600">Google Drive Downloader</h1>
              <p className="text-gray-600 mt-2">
                Paste a Google Drive link to download files quickly
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste Google Drive link here"
                  className="w-full p-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500"
                >
                  <FaPaste size={20} />
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-white font-medium ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaDownload /> Get File Info
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <FaExclamationTriangle className="text-red-500" />
                  <p className="text-red-600 font-medium">{error}</p>
                </div>

                {error.includes('HTML') || error.includes('Unexpected token') ? (
                  <div className="mt-3 text-gray-700">
                    <p>This may be due to one of the following:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>The file requires login or special permissions</li>
                      <li>Google Drive is returning a consent page instead of the file</li>
                      <li>The file is view-only and cannot be downloaded directly</li>
                    </ul>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => url && handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                        className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => {
                          const fileId = extractFileId(url);
                          if (fileId) {
                            downloadFile(fileId, { id: fileId, name: 'file' }, { forcePdf: true, viewOnly: true });
                          }
                        }}
                        className="py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        Force Download as PDF
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {fileInfo && (
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-medium text-gray-800">File Information</h2>
                <p className="text-gray-600 mt-1">Filename: {fileInfo.name}</p>
                <p className="text-gray-500 text-sm mt-2">ID: {fileInfo.id}</p>
                {fileInfo.mimeType && (
                  <p className="text-gray-500 text-sm mt-2">Type: {fileInfo.mimeType}</p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleDirectDownload}
                    disabled={isLoading}
                    className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
                  >
                    <FaDownload /> Download
                  </button>

                  {fileInfo.mimeType && fileInfo.mimeType.includes('pdf') && (
                    <button
                      onClick={handleDownloadViewOnlyPdf}
                      disabled={isLoading}
                      className="py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-400 flex items-center gap-2"
                    >
                      <FaDownload /> Download as View-Only PDF
                    </button>
                  )}
                </div>

                {fileInfo.isGoogleApps && fileInfo.exportOptions && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700">
                      Export Format:
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={selectedFormat}
                        onChange={handleFormatChange}
                        className="p-2 border border-gray-300 rounded-lg"
                      >
                        {fileInfo.exportOptions.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleDownloadWithFormat}
                        disabled={isLoading}
                        className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                      >
                        <FaDownload />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-medium text-gray-800 mb-2">How to Use</h2>
              <ol className="list-decimal pl-5 space-y-2 text-gray-600">
                <li>Copy a Google Drive link from your browser</li>
                <li>Click the paste button or paste it manually</li>
                <li>Click "Get File Info" to retrieve information</li>
                <li>Use the download buttons to download the file</li>
                <li>For view-only PDFs, use the special "Download as View-Only PDF" button</li>
                <li>For Google Docs files, select your preferred export format</li>
              </ol>
            </div>
          </div>

          <div className="text-center mt-8 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Google Drive Downloader</p>
          </div>
        </div>
      </main>
    </>
  );
}