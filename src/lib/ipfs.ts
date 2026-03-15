import { pinata } from "@/utils/config";

const PUBLIC_GROUP_ID = process.env.PINATA_PUBLIC_GROUP_ID || "";

export async function uploadToIPFS(content: string | object): Promise<string> {
  const jsonContent = typeof content === "string" ? { text: content } : content;
  const blob = new Blob([JSON.stringify(jsonContent)], { type: "application/json" });
  const file = new File([blob], "data.json", { type: "application/json" });

  const upload = await pinata.upload.public.file(file).group(PUBLIC_GROUP_ID);
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

  const upload = await pinata.upload.public.file(uploadFile).group(PUBLIC_GROUP_ID);
  return upload.cid;
}

export function ipfsUrl(hash: string): string {
  const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";
  return `https://${gateway}/files/${hash}`;
}

/**
 * Fix legacy IPFS URLs that used /ipfs/ path to use /files/ path.
 * Safe to use on both old and new URLs.
 */
export function fixLegacyIpfsUrl(url: string): string {
  return url.replace("/ipfs/", "/files/");
}
