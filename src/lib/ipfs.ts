const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";

export async function uploadToIPFS(content: string | object): Promise<string> {
  const jsonContent = typeof content === "string" ? { text: content } : content;
  const blob = new Blob([JSON.stringify(jsonContent)], { type: "application/json" });
  const formData = new FormData();
  formData.append("file", blob, "data.json");

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`IPFS upload failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.data.cid as string;
}

/**
 * Upload a binary file (e.g. photo) to IPFS via Pinata's pinFileToIPFS endpoint.
 * Accepts a File/Blob from FormData or a raw Buffer.
 */
export async function uploadFileToIPFS(
  file: Blob | Buffer,
  filename: string
): Promise<string> {
  const formData = new FormData();

  if (file instanceof Blob) {
    formData.append("file", file, filename);
  } else {
    formData.append("file", new Blob([new Uint8Array(file)]), filename);
  }

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`IPFS file upload failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.data.cid as string;
}

export function ipfsUrl(hash: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${hash}`;
}
