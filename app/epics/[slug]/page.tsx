import { notFound } from "next/navigation";

import { epicBySlug, epicDefinitions } from "@/lib/config/epics";

type EpicPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return epicDefinitions.map((epic) => ({ slug: epic.slug }));
}

export default async function EpicPage({ params }: EpicPageProps) {
  const { slug } = await params;
  const epic = epicBySlug[slug];

  if (!epic) {
    notFound();
  }

  return (
    <section aria-labelledby="epic-title" className="content-card">
      <h2 id="epic-title">
        {epic.id}: {epic.title}
      </h2>
      <p>{epic.summary}</p>
      <p>This is a placeholder page for the starter repository foundation.</p>
      <p>
        AI/ML in this epic: <strong>{epic.usesAiMl ? "Yes" : "No"}</strong>
      </p>
    </section>
  );
}
