import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

// Product pages use the same layout as place pages
// Reuse the entity page component
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  // For now, redirect to a unified entity view
  // In the future, product pages will have custom layouts (specs, purchase links, etc.)
  redirect(`/place/${slug}`);
}
