const PINATA_API_URL = "https://api.pinata.cloud";

export async function uploadToIPFS(content: string | object): Promise<string> {
  const res = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: typeof content === "string" ? { text: content } : content,
    }),
  });

  if (!res.ok) {
    throw new Error(`IPFS upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
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

  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: filename })
  );

  const res = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`IPFS file upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

export function ipfsUrl(hash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}
