import Link from "next/link";

import { epicDefinitions } from "@/lib/config/epics";

export default function Home() {
  return (
    <section aria-labelledby="welcome-heading" className="content-card">
      <h2 id="welcome-heading">Starter application shell</h2>
      <p>
        This first pull request sets up the repository foundation only. The eight sections
        below are placeholders so we can test navigation and dependencies.
      </p>
      <p>
        The pilot scope is limited to Christine&apos;s validated MASCO occupation and up
        to two related occupations. We do not claim support for every MASCO occupation
        yet.
      </p>
      <ul>
        {epicDefinitions.map((epic) => (
          <li key={epic.id}>
            <Link href={`/epics/${epic.slug}`}>
              {epic.id}: {epic.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
