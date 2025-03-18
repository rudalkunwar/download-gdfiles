import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "File ID is required" }, { status: 400 });
  }

  try {
    // Try to get public file metadata using Google Drive API
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size,capabilities,permissions`,
      {
        validateStatus: (status) => true,
      }
    );

    if (response.status !== 200) {
      // Try fallback approach for files that might be view-only
      try {
        const fallbackResponse = await axios.get(
          `https://drive.google.com/file/d/${fileId}/view`,
          {
            validateStatus: (status) => true,
            maxRedirects: 5,
          }
        );

        // Extract title from HTML if possible
        let name = `file_${fileId}`;
        if (
          fallbackResponse.data &&
          typeof fallbackResponse.data === "string"
        ) {
          const titleMatch = fallbackResponse.data.match(
            /<title>(.*?)<\/title>/
          );
          if (titleMatch && titleMatch[1]) {
            name = titleMatch[1].replace(" - Google Drive", "");
          }
        }

        // Determine if it's likely a PDF
        const isProbablyPdf =
          fallbackResponse.data &&
          typeof fallbackResponse.data === "string" &&
          (fallbackResponse.data.includes("pdf.js") ||
            fallbackResponse.data.includes("PDF viewer"));

        return NextResponse.json({
          id: fileId,
          name: name,
          mimeType: isProbablyPdf
            ? "application/pdf"
            : "application/octet-stream",
          isViewOnly: true,
          canDownload: false,
          isGoogleApps: false,
          exportOptions: isProbablyPdf ? ["pdf"] : [],
        });
      } catch (fallbackError) {
        console.error("Fallback approach failed:", fallbackError);
        return NextResponse.json(
          {
            error: "File not found or not accessible",
            status: response.status,
          },
          { status: 404 }
        );
      }
    }

    const data = response.data;
    const isGoogleApps = data.mimeType?.startsWith(
      "application/vnd.google-apps"
    );

    let exportOptions: string[] = [];
    if (isGoogleApps) {
      switch (data.mimeType) {
        case "application/vnd.google-apps.document":
          exportOptions = ["pdf", "docx", "txt", "rtf"];
          break;
        case "application/vnd.google-apps.spreadsheet":
          exportOptions = ["xlsx", "csv", "pdf"];
          break;
        case "application/vnd.google-apps.presentation":
          exportOptions = ["pptx", "pdf"];
          break;
        default:
          exportOptions = ["pdf"];
      }
    }

    return NextResponse.json({
      id: fileId,
      name: data.name,
      mimeType: data.mimeType,
      size: data.size,
      canDownload: data.capabilities?.canDownload || false,
      isGoogleApps: isGoogleApps,
      exportOptions: exportOptions,
    });
  } catch (error) {
    console.error("Error fetching file info:", error);
    return NextResponse.json(
      { error: "Failed to get file information" },
      { status: 500 }
    );
  }
}
