import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { fileId, format } = req.query;

  if (!fileId || typeof fileId !== "string") {
    return res.status(400).json({ error: "File ID is required" });
  }

  try {
    // Get file metadata
    let fileMetadata;
    try {
      const metadataResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,capabilities`,
        {
          validateStatus: (status) => true,
        }
      );

      if (metadataResponse.status === 200) {
        fileMetadata = metadataResponse.data;
      } else if (
        metadataResponse.status === 403 ||
        metadataResponse.status === 404
      ) {
        // File exists but might be view-only or restricted
        fileMetadata = { name: "unknown_file", mimeType: "" };
      }
    } catch (error) {
      console.error("Error fetching file metadata:", error);
      fileMetadata = { name: "unknown_file", mimeType: "" };
    }

    const isGoogleApps = fileMetadata?.mimeType?.startsWith(
      "application/vnd.google-apps"
    );
    const isPdf = fileMetadata?.mimeType === "application/pdf";
    const exportFormat =
      typeof format === "string" && isGoogleApps ? format : null;

    const contentTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };

    // Function to check if response is HTML
    const isHtmlResponse = (headers: any) => {
      const contentType = headers["content-type"] || "";
      return (
        contentType.includes("text/html") ||
        contentType.includes("application/xhtml+xml")
      );
    };

    // Try direct download first if not a Google Apps file or no specific format
    if (!exportFormat) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const fileResponse = await axios.get(downloadUrl, {
        responseType: "stream",
        validateStatus: (status) => true,
        maxRedirects: 5,
      });

      if (
        fileResponse.status === 200 &&
        !isHtmlResponse(fileResponse.headers)
      ) {
        res.setHeader(
          "Content-Type",
          fileResponse.headers["content-type"] || "application/octet-stream"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileMetadata?.name || "file"}"`
        );
        return fileResponse.data.pipe(res);
      }
    }

    // Handle Google Apps files or specified export format
    if (isGoogleApps || exportFormat) {
      const defaultFormat =
        (
          {
            "application/vnd.google-apps.document": "pdf",
            "application/vnd.google-apps.spreadsheet": "xlsx",
            "application/vnd.google-apps.presentation": "pptx",
          } as Record<string, string>
        )[fileMetadata?.mimeType || ""] || "pdf";

      const finalFormat = exportFormat || defaultFormat;
      const exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}&format=${finalFormat}`;

      const exportResponse = await axios.get(exportUrl, {
        responseType: "stream",
        validateStatus: (status) => true,
        maxRedirects: 5,
      });

      if (
        exportResponse.status === 200 &&
        !isHtmlResponse(exportResponse.headers)
      ) {
        res.setHeader(
          "Content-Type",
          contentTypes[finalFormat as keyof typeof contentTypes] ||
            "application/octet-stream"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${
            fileMetadata?.name || "document"
          }.${finalFormat}"`
        );
        return exportResponse.data.pipe(res);
      }
    }

    // Try alternative download URL format with confirmation token
    const altUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
    const altResponse = await axios.get(altUrl, {
      responseType: "stream",
      validateStatus: (status) => true,
      maxRedirects: 5,
    });

    if (altResponse.status === 200 && !isHtmlResponse(altResponse.headers)) {
      res.setHeader(
        "Content-Type",
        altResponse.headers["content-type"] || "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileMetadata?.name || "file"}"`
      );
      return altResponse.data.pipe(res);
    }

    // Special handling for view-only PDFs
    if (isPdf || fileMetadata?.mimeType?.includes("pdf")) {
      // Try the print version URL for PDFs (often works for view-only PDFs)
      const printUrl = `https://drive.google.com/print?id=${fileId}`;

      try {
        const printResponse = await axios.get(printUrl, {
          responseType: "stream",
          validateStatus: (status) => true,
          maxRedirects: 5,
        });

        if (
          printResponse.status === 200 &&
          !isHtmlResponse(printResponse.headers)
        ) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileMetadata?.name || "document"}.pdf"`
          );
          return printResponse.data.pipe(res);
        }
      } catch (printError) {
        console.error("Print version download error:", printError);
      }

      // Try the preview URL for PDFs
      const previewUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

      try {
        const previewResponse = await axios.get(previewUrl, {
          responseType: "stream",
          validateStatus: (status) => true,
          maxRedirects: 5,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        if (
          previewResponse.status === 200 &&
          !isHtmlResponse(previewResponse.headers)
        ) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileMetadata?.name || "document"}.pdf"`
          );
          return previewResponse.data.pipe(res);
        }
      } catch (previewError) {
        console.error("Preview download error:", previewError);
      }

      // Last resort: Try to get the embedded viewer URL content
      const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

      try {
        const embedResponse = await axios.get(embedUrl, {
          responseType: "stream",
          validateStatus: (status) => true,
          maxRedirects: 5,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        if (embedResponse.status === 200) {
          // Even if it's HTML, it might contain the PDF data or a redirect to it
          res.setHeader(
            "Content-Type",
            embedResponse.headers["content-type"] || "text/html"
          );
          return embedResponse.data.pipe(res);
        }
      } catch (embedError) {
        console.error("Embed viewer error:", embedError);
      }
    }

    // If all fails, return an error message
    return res.status(403).json({
      error: "File is view-only or not publicly accessible",
      suggestion:
        'Ask the owner to enable download permissions or share with "Anyone with the link" access',
    });
  } catch (error) {
    console.error("Download error:", error);
    return res.status(500).json({ error: "Failed to download file" });
  }
}
