import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { fileId } = req.query;

  if (!fileId || typeof fileId !== "string") {
    return res.status(400).json({ error: "File ID is required" });
  }

  try {
    // Try to get public file metadata using Google Drive API
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size,capabilities,permissions`,
      {
        headers: {
          // No authentication for public access
        },
        validateStatus: (status) => true,
      }
    );

    if (response.status !== 200) {
      return res.status(404).json({
        error: "File not found or not accessible",
        status: response.status,
      });
    }

    const data = response.data;
    const isGoogleApps = data.mimeType?.startsWith(
      "application/vnd.google-apps"
    );
    const canDownload = data.capabilities?.canDownload || false;
    const isPublic =
      data.permissions?.some(
        (p: any) => p.role !== "owner" && p.type === "anyone"
      ) || false;

    return res.status(200).json({
      id: fileId,
      name: data.name,
      mimeType: data.mimeType,
      size: data.size,
      canDownload,
      isGoogleApps,
      isPublic,
      exportOptions: isGoogleApps
              ? ({
                  "application/vnd.google-apps.document": ["pdf", "docx"],
                  "application/vnd.google-apps.spreadsheet": ["pdf", "xlsx"],
                  "application/vnd.google-apps.presentation": ["pdf", "pptx"],
                } as { [key: string]: string[] })[data.mimeType] || ["pdf"]
              : null,
    });
  } catch (error) {
    console.error("Error fetching file info:", error);
    return res.status(500).json({ error: "Failed to get file information" });
  }
}
