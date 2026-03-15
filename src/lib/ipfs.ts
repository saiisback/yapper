import { pinata } from "@/utils/config";

export async function uploadToIPFS(content: string | object): Promise<string> {
  const jsonContent = typeof content === "string" ? { text: content } : content;
  const blob = new Blob([JSON.stringify(jsonContent)], { type: "application/json" });
  const file = new File([blob], "data.json", { type: "application/json" });

  const upload = await pinata.upload.public.file(file);
  return upload.cid;
}

/**
 * Upload a binary file (e.g. photo) to IPFS via Pinata SDK.
 * Accepts a File/Blob from FormData or a raw Buffer.
 */
export async function uploadFileToIPFS(
  file: Blob | Buffer,
  filename: string
): Promise<string> {
  let uploadFile: File;

  if (file instanceof Blob) {
    uploadFile = new File([file], filename, { type: file.type || "image/jpeg" });
  } else {
    uploadFile = new File([new Uint8Array(file)], filename, { type: "image/jpeg" });
  }

  const upload = await pinata.upload.public.file(uploadFile);
  return upload.cid;
}

export async function ipfsUrl(hash: string): Promise<string> {
  return await pinata.gateways.public.convert(hash);
}

/**
 * Fix legacy IPFS URLs that used /ipfs/ path (v2) to use /files/ path (v3).
 * Safe to use on both old and new URLs.
 */
export function fixLegacyIpfsUrl(url: string): string {
  return url.replace("/ipfs/", "/files/");
}
