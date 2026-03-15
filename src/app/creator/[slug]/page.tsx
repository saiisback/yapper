import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

// Creator pages use the same layout as place pages
// Reuse the entity page component
export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;

  // For now, redirect to a unified entity view
  // In the future, creator pages will have custom layouts (portfolio, social links, etc.)
  redirect(`/place/${slug}`);
}
