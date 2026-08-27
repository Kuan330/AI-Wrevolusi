import type { Metadata } from "next";
import Link from "next/link";

import { epicDefinitions } from "@/lib/config/epics";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Wrevolusi",
  description:
    "AI-Wrevolusi helps working women in Malaysia prepare for practical changes from AI at work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="container">
            <h1>AI-Wrevolusi</h1>
            <p>A practical planning pilot for Christine, Sales Supervisor in Selangor.</p>
          </div>
        </header>
        <div className="container layout">
          <nav aria-label="Epic navigation" className="side-nav">
            <h2>Journey Sections</h2>
            <ol>
              {epicDefinitions.map((epic) => (
                <li key={epic.id}>
                  <Link href={`/epics/${epic.slug}`}>{epic.title}</Link>
                </li>
              ))}
            </ol>
          </nav>
          <main id="main-content" className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
