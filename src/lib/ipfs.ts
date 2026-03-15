const PINATA_API_URL = "https://api.pinata.cloud";

export async function uploadToIPFS(content: string | object): Promise<string> {
  const body = typeof content === "string" ? content : JSON.stringify(content);

  const res = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: process.env.PINATA_API_KEY!,
      pinata_secret_api_key: process.env.PINATA_SECRET_KEY!,
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

export function ipfsUrl(hash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}
