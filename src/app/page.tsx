"use client";
import { useState, useEffect } from 'react';
import { FaDownload, FaPaste, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import { Toaster, toast } from 'react-hot-toast';
import { extractFileId, getExportFormats, getFileType, getViewerUrl } from '@/utils/utils';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    id: string;
    name: string;
    fileType: string;
    isGoogleApps: boolean;
    exportFormats: string[];
    originalUrl: string;
  } | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handlePaste = async () => {
    if (!hasMounted) return;
    try {
      const clipboardText = await navigator.clipboard.readText();
      setUrl(clipboardText);
      toast.success('URL pasted from clipboard');

      // Auto-process the link when pasted
      const tempEvent = { preventDefault: () => { } } as React.FormEvent;
      handleUrlProcessing(clipboardText, tempEvent);
    } catch (error) {
      toast.error('Unable to access clipboard. Please paste the link manually.');
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // Clear any previous errors when the URL is changed
    if (error) setError(null);
  };

  const handleUrlProcessing = async (inputUrl: string, e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inputUrl.trim()) {
      toast.error('Please enter a Google Drive link');
      return;
    }

    setIsLoading(true);

    try {
      const fileId = extractFileId(inputUrl);
      if (!fileId) {
        throw new Error('Invalid Google Drive link. Could not extract file ID.');
      }

      const fileType = getFileType(inputUrl);
      const isGoogleApps = ['Google Doc', 'Google Sheet', 'Google Slides', 'Google Document'].includes(fileType);
      const exportFormats = isGoogleApps ? getExportFormats(fileType) : [];

      let fileName = 'file';
      // Try to get a more user-friendly name
      const nameMatch = inputUrl.match(/\/([^\/]+?)(?:\?|$)/);
      if (nameMatch && nameMatch[1]) {
        fileName = decodeURIComponent(nameMatch[1])
          .replace(fileId, '')
          .replace(/^[- ._]+|[- ._]+$/g, '')
          .replace(/\.[^/.]+$/, ''); // Remove file extension
      }

      // If we couldn't extract a good name, use the file type
      if (!fileName || fileName === '' || fileName === 'view' || fileName === 'edit') {
        fileName = fileType.replace('Google ', '');
      }

      setFileInfo({
        id: fileId,
        name: fileName,
        fileType,
        isGoogleApps,
        exportFormats,
        originalUrl: inputUrl
      });

      if (isGoogleApps && exportFormats.length > 0) {
        setSelectedFormat(exportFormats[0]);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process file information');
      setError(error.message || 'Failed to process file information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    handleUrlProcessing(url, e);
  };

  const downloadFile = (fileId: string, options: { format?: string } = {}) => {
    if (!hasMounted || !fileId) return;
    let downloadUrl: string;

    if (options.format && fileInfo?.isGoogleApps) {
      downloadUrl = `https://docs.google.com/export/download?id=${fileId}&exportFormat=${options.format}`;
    } else {
      downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    }

    // Open in a new tab
    window.open(downloadUrl, '_blank');
    toast.success('Download initiated! Check your browser downloads.');
  };

  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFormat(e.target.value);
  };

  const handleDownloadWithFormat = () => {
    if (!hasMounted || !fileInfo?.id) return;
    downloadFile(fileInfo.id, { format: selectedFormat });
  };

  const handleDirectDownload = () => {
    if (!hasMounted || !fileInfo?.id) return;
    downloadFile(fileInfo.id);
  };

  if (!hasMounted) {
    return null; // Or a loading indicator
  }

  return (
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
                onChange={handleUrlChange}
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
                  <FaDownload /> Process Drive Link
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

              <div className="mt-3 text-gray-700">
                <p>This may be due to one of the following:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>The file requires login or special permissions</li>
                  <li>The link format is not recognized</li>
                  <li>The file is view-only and cannot be downloaded directly</li>
                </ul>

                <div className="mt-4">
                  <button
                    onClick={() => url && handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                    className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {fileInfo && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h2 className="text-lg font-medium text-gray-800">File Information</h2>
              <p className="text-gray-600 mt-1">Filename: {fileInfo.name}</p>
              <p className="text-gray-500 text-sm mt-2">Type: {fileInfo.fileType}</p>
              <p className="text-gray-500 text-sm mt-2">ID: {fileInfo.id}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleDirectDownload}
                  className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <FaDownload /> Direct Download
                </button>

                <a
                  href={getViewerUrl(fileInfo.id, fileInfo.fileType, fileInfo.originalUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
                >
                  <FaEye /> View in Drive
                </a>
              </div>

              {fileInfo.isGoogleApps && fileInfo.exportFormats && fileInfo.exportFormats.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Export as a different format:
                  </label>
                  <div className="flex items-center flex-wrap gap-2">
                    <select
                      value={selectedFormat}
                      onChange={handleFormatChange}
                      className="p-2 border border-gray-300 rounded-lg"
                    >
                      {fileInfo.exportFormats.map((format) => (
                        <option key={format} value={format}>
                          {format.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleDownloadWithFormat}
                      className="py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                    >
                      <FaDownload /> Download as {selectedFormat.toUpperCase()}
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
              <li>Click "Process Drive Link" to extract file information</li>
              <li>Use "Direct Download" to download the file in its original format</li>
              <li>For Google Docs, Sheets, or Slides, select your preferred export format</li>
              <li>Use "View in Drive" to open the file in Google Drive</li>
            </ol>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded text-yellow-800 text-sm">
              <p><strong>Note:</strong> This tool works best with files that are publicly accessible or have been shared with "Anyone with the link" access.</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Google Drive Downloader | {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </main>
  );
}