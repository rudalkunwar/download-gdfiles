import { NextRequest } from "next/server";
import axios from "axios";

export const config = {
  api: {
    responseLimit: "50mb",
  },
};

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");
  const format = request.nextUrl.searchParams.get("format");
  const forcePdf = request.nextUrl.searchParams.get("forcePdf") === "true";
  const viewOnly = request.nextUrl.searchParams.get("viewOnly") === "true";

  if (!fileId) {
    return new Response(JSON.stringify({ error: "File ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get file metadata if possible
    let fileName = `file_${fileId}`;
    let mimeType = "application/octet-stream";

    try {
      const metadataResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
        {
          validateStatus: (status) => status < 500,
        }
      );

      if (metadataResponse.status === 200) {
        fileName = metadataResponse.data.name || fileName;
        mimeType = metadataResponse.data.mimeType || mimeType;
      }
    } catch (error) {
      console.log("Could not get file metadata, using defaults");
    }

    // Comprehensive MIME type to file extension mapping
    const mimeToExtension: Record<string, string> = {
      // Document formats
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/msword": "doc",
      "application/vnd.oasis.opendocument.text": "odt",
      "application/rtf": "rtf",
      "text/plain": "txt",
      "text/html": "html",
      "text/css": "css",
      "text/javascript": "js",
      "text/markdown": "md",

      // Spreadsheet formats
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.oasis.opendocument.spreadsheet": "ods",
      "text/csv": "csv",
      "text/tab-separated-values": "tsv",

      // Presentation formats
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.oasis.opendocument.presentation": "odp",

      // Image formats
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/bmp": "bmp",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/tiff": "tiff",

      // Audio formats
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
      "audio/flac": "flac",
      "audio/aac": "aac",

      // Video formats
      "video/mp4": "mp4",
      "video/mpeg": "mpeg",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "video/x-msvideo": "avi",

      // Archive formats
      "application/zip": "zip",
      "application/x-zip-compressed": "zip",
      "application/x-rar-compressed": "rar",
      "application/x-tar": "tar",
      "application/x-7z-compressed": "7z",
      "application/gzip": "gz",

      // Google formats
      "application/vnd.google-apps.document": "docx",
      "application/vnd.google-apps.spreadsheet": "xlsx",
      "application/vnd.google-apps.presentation": "pptx",
      "application/vnd.google-apps.drawing": "png",
      "application/vnd.google-apps.form": "html",
      "application/vnd.google-apps.script": "json",
    };

    // Function to ensure proper filename with extension
    const getProperFilename = (
      baseName: string,
      contentType: string,
      specifiedFormat: string | null = null
    ): string => {
      // First, use the specified format if provided
      if (specifiedFormat) {
        // Remove any existing extension from the filename
        const nameWithoutExt = baseName.replace(/\.[^/.]+$/, "");
        return `${nameWithoutExt}.${specifiedFormat}`;
      }

      // Try to extract extension from the filename
      const extMatch = baseName.match(/\.([^.]+)$/);
      if (extMatch && extMatch[1]) {
        // File already has an extension, check if it matches the content type
        const existingExt = extMatch[1].toLowerCase();
        const expectedExt = mimeToExtension[contentType];

        // If the extension matches the content type, keep it
        if (expectedExt && existingExt === expectedExt) {
          return baseName;
        }

        // If content type suggests a different extension, change it
        if (expectedExt) {
          const nameWithoutExt = baseName.replace(/\.[^/.]+$/, "");
          return `${nameWithoutExt}.${expectedExt}`;
        }

        // If we don't know the expected extension but file has one, keep it
        return baseName;
      }

      // No extension in the filename, determine from content type
      const extension = mimeToExtension[contentType] || "bin";
      return `${baseName}.${extension}`;
    };

    // Special handling for view-only PDFs
    if ((viewOnly || forcePdf) && (mimeType.includes("pdf") || forcePdf)) {
      try {
        // Try the printout approach for PDFs
        const printUrl = `https://drive.google.com/uc?id=${fileId}&export=download&format=pdf`;

        const printResponse = await axios.get(printUrl, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
            Accept: "application/pdf",
          },
          maxRedirects: 5,
          validateStatus: (status) => true,
        });

        if (
          printResponse.status === 200 &&
          printResponse.data &&
          printResponse.data.byteLength > 1000 &&
          !printResponse.headers["content-type"]?.includes("text/html")
        ) {
          const finalFilename = getProperFilename(
            fileName,
            "application/pdf",
            "pdf"
          );

          return new Response(printResponse.data, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${finalFilename}"`,
            },
          });
        }

        // Alternative approach for view-only PDFs
        const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

        const embedResponse = await axios.get(embedUrl, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
          },
          validateStatus: (status) => true,
        });

        if (embedResponse.status === 200) {
          const finalFilename = getProperFilename(
            fileName,
            "application/pdf",
            "pdf"
          );

          return new Response(embedResponse.data, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${finalFilename}"`,
            },
          });
        }
      } catch (error) {
        console.error("View-only PDF approach failed:", error);
      }
    }

    // Google Docs handling
    if (mimeType.startsWith("application/vnd.google-apps")) {
      let exportFormat = format || "pdf";

      if (!format) {
        // Choose appropriate default format
        if (mimeType === "application/vnd.google-apps.spreadsheet") {
          exportFormat = "xlsx";
        } else if (mimeType === "application/vnd.google-apps.presentation") {
          exportFormat = "pptx";
        } else if (mimeType === "application/vnd.google-apps.document") {
          exportFormat = "docx";
        }
      }

      const exportUrl = `https://docs.google.com/export/download?id=${fileId}&exportFormat=${exportFormat}`;

      const exportResponse = await axios.get(exportUrl, {
        responseType: "arraybuffer",
        maxRedirects: 5,
        validateStatus: (status) => status === 200,
      });

      if (exportResponse.status === 200 && exportResponse.data) {
        const contentTypeMap: Record<string, string> = {
          pdf: "application/pdf",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          csv: "text/csv",
          txt: "text/plain",
          rtf: "application/rtf",
        };

        const contentType =
          contentTypeMap[exportFormat] || "application/octet-stream";
        const finalFilename = getProperFilename(
          fileName,
          contentType,
          exportFormat
        );

        return new Response(exportResponse.data, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${finalFilename}"`,
          },
        });
      }
    }

    // Standard file download approach
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t`;

    const fileResponse = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      },
      validateStatus: (status) =>
        status === 200 || status === 303 || status === 302,
    });

    if (fileResponse.status === 200 && fileResponse.data) {
      // Get content type from response if available
      const responseContentType =
        fileResponse.headers["content-type"] || mimeType;

      // Make sure it's not HTML (which would indicate an error page)
      if (
        responseContentType.includes("text/html") &&
        fileResponse.data.byteLength < 1000000
      ) {
        // This might be an error page - try another approach
        const alternativeUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        const altResponse = await axios.get(alternativeUrl, {
          responseType: "arraybuffer",
          maxRedirects: 5,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
          },
          validateStatus: (status) => true,
        });

        if (altResponse.status === 200) {
          const altContentType =
            altResponse.headers["content-type"] || mimeType;
          if (
            !altContentType.includes("text/html") ||
            altResponse.data.byteLength > 1000000
          ) {
            const finalFilename = getProperFilename(fileName, altContentType);

            return new Response(altResponse.data, {
              status: 200,
              headers: {
                "Content-Type": altContentType,
                "Content-Disposition": `attachment; filename="${finalFilename}"`,
              },
            });
          }
        }
      }

      const finalFilename = getProperFilename(fileName, responseContentType);

      return new Response(fileResponse.data, {
        status: 200,
        headers: {
          "Content-Type": responseContentType,
          "Content-Disposition": `attachment; filename="${finalFilename}"`,
        },
      });
    }

    // Direct download with different URL structure as a last resort
    const directUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

    const directResponse = await axios.get(directUrl, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      },
      validateStatus: (status) => status === 200,
    });

    if (directResponse.status === 200 && directResponse.data) {
      const contentType = directResponse.headers["content-type"] || mimeType;
      const finalFilename = getProperFilename(fileName, contentType);

      return new Response(directResponse.data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${finalFilename}"`,
        },
      });
    }

    // If all approaches fail, redirect to Google's viewer
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://drive.google.com/file/d/${fileId}/view`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: "Failed to download file",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
