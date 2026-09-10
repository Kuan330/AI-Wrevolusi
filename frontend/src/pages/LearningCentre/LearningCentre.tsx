import type { ComponentProps } from "react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
} from "@/components/ui/drawer";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { FormSelect } from "@/components/ui/form-field";
import { AppButton } from "@/components/ui/app-button";
import JourneyIntro from "@/components/account/JourneyIntro";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  BookOpen,
  Bookmark,
  Check,
  Clock3,
  Download,
  Globe2,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";
import {
  readLearningCentreItems,
  removeLearningCentreItem,
} from "@/pages/Skills/skillDirections";
import {
  resources as catalogue,
  matches,
  readSelections,
  saveSelections,
  type Resource,
} from "./resources";
import "./learning-resources.css";
import { demoThemes, demoResources, demoSelections } from "./demoData";

export default function LearningCentre() {
  const [params] = useSearchParams();
  // Example content is opt-in only.
  const demo = import.meta.env.DEV && params.get("demo") === "1";
  return <LearningResourcesContent key={String(demo)} demo={demo} />;
}

function LearningResourcesContent(props: { demo: boolean }) {
  const { demo } = props;
  const resources = demo ? demoResources : catalogue;
  const [themes, setThemes] = useState(() =>
    demo ? demoThemes : readLearningCentreItems(),
  );
  const [activeId, setActiveId] = useState(themes[0]?.theme_id ?? "");
  const [selected, setSelected] = useState(() =>
    demo ? demoSelections : readSelections(),
  );
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("All formats");
  const [provider, setProvider] = useState("All providers");
  const [detail, setDetail] = useState<Resource | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice || notice.includes("could not")) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const theme = themes.find((t) => t.theme_id === activeId);
  const matching = theme ? resources.filter((r) => matches(r, theme)) : [];
  const filtered = matching.filter(
    (r) =>
      (format === "All formats" || r.format === format) &&
      (provider === "All providers" || r.provider === provider) &&
      `${r.title} ${r.summary}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  function chooseTheme(id: string) {
    setActiveId(id);
    setQuery("");
    setFormat("All formats");
    setProvider("All providers");
  }
  function removeTheme() {
    if (!theme) return;
    try {
      const index = themes.findIndex(
        (item) => item.theme_id === theme.theme_id,
      );
      const next = demo
        ? themes.filter((item) => item.theme_id !== theme.theme_id)
        : removeLearningCentreItem(theme.theme_id);
      setThemes(next);
      chooseTheme(next[Math.min(index, next.length - 1)]?.theme_id ?? "");
      setNotice("Theme removed. Your saved resources and plan are unchanged.");
    } catch {
      setNotice("This theme could not be removed. Please try again.");
    }
  }
  function toggle(resource: Resource) {
    const exists = selected.some((s) => s.resourceId === resource.id);
    if (!exists && !theme) return;
    const next = exists
      ? selected.filter((s) => s.resourceId !== resource.id)
      : [
          ...selected,
          {
            resourceId: resource.id,
            themeTitle: theme!.title,
            skillName: theme!.skill_name,
            addedAt: new Date().toISOString(),
          },
        ];
    setSelected(next);
    try {
      if (!demo) saveSelections(next);
      setNotice(
        exists
          ? "Resource removed from your shortlist."
          : "Resource saved to your shortlist.",
      );
    } catch {
      setNotice("Your selection could not be saved. Please try again.");
    }
  }
  function exportList() {
    const body = [
      demo
        ? "DEMO LEARNING SHORTLIST — FICTIONAL RESOURCES"
        : "MY LEARNING SHORTLIST",
      "",
      ...selected.flatMap((s) => {
        const r = resources.find((r) => r.id === s.resourceId)!;
        return [
          r.title,
          `Topic: ${s.themeTitle}`,
          `Skill: ${s.skillName}`,
          `Provider: ${r.provider}`,
          r.url,
          r.minutes
            ? `Example study time: ${r.minutes} minutes`
            : "Study time: to be confirmed",
          "",
        ];
      }),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-learning-shortlist.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!themes.length) return <JourneyIntro kind="resources" />;
  const appButtonProps1 = { tone: "gradient", asChild: true } satisfies Partial<
    ComponentProps<typeof AppButton>
  >;
  const formSelectProps2 = {
    label: "Learning theme",
    placeholder: "Choose a theme",
    value: activeId,
    onValueChange: chooseTheme,
    options: themes.map((t) => ({ value: t.theme_id, label: t.title })),
  } satisfies Partial<ComponentProps<typeof FormSelect>>;
  const appButtonProps3 = {
    tone: "gradient",
    asChild: true,
    className: "lr-edit-themes",
  } satisfies Partial<ComponentProps<typeof AppButton>>;
  const appButtonProps7 = {
    tone: "gradient",
    className: "lr-export",
    disabled: !selected.length,
    onClick: exportList,
  } satisfies Partial<ComponentProps<typeof AppButton>>;
  const dialogProps8 = {
    open: !!detail,
    onOpenChange: (open) => {
      if (!open) setDetail(null);
    },
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  return (
    <Drawer>
      <div className="lr-page">
        <PageHeader
          title="Learning Resources"
          description="Find your next learning step. Make room for it when you’re ready."
          actions={
            <div className="lr-header-actions">
              <DrawerTrigger asChild>
                <AppButton tone="gradient">
                  <Bookmark size={16} /> My shortlist · {selected.length}
                </AppButton>
              </DrawerTrigger>
              <AppButton {...appButtonProps1}>
                <Link to={ROUTES.skills}>
                  <ArrowLeft size={16} /> Back to skills
                </Link>
              </AppButton>
            </div>
          }
        />
        {demo && (
          <div className="lr-demo-banner">
            <div>
              <strong>Demo preview</strong>
              <span>
                {" "}
                Sample themes, fictional resources and example study times. Your
                own selections are unchanged.
              </span>
            </div>
            <Link to={`${ROUTES.learningCentre}?demo=0`}>Exit demo ↗</Link>
          </div>
        )}
        <div className="lr-theme-workspace">
          <section className="lr-topics" aria-labelledby="topics-title">
            <p className="lr-eyebrow">CHOSEN BY YOU</p>
            <h2 id="topics-title">Your learning themes</h2>
            <p className="lr-theme-hint">
              Choose a theme to explore its resources.
            </p>
            <div className="lr-mobile-theme">
              <FormSelect {...formSelectProps2} />
            </div>
            <div className="lr-theme-list" aria-label="Learning themes">
              {themes.map((t) => (
                <button
                  type="button"
                  key={t.theme_id}
                  className="lr-theme-choice"
                  aria-pressed={activeId === t.theme_id}
                  onClick={() => chooseTheme(t.theme_id)}
                >
                  <span>
                    <strong>{t.title}</strong>
                    <small>{t.skill_name}</small>
                  </span>
                  <ChevronRight
                    {...({ size: 18, "aria-hidden": "true" } satisfies Partial<
                      ComponentProps<typeof ChevronRight>
                    >)}
                  />
                </button>
              ))}
            </div>
            <AppButton {...appButtonProps3}>
              <Link to={`${ROUTES.skills}#skill-directions`}>
                Edit themes <ArrowUpRight size={15} />
              </Link>
            </AppButton>
          </section>
          <div className="lr-main">
            {theme && (
              <>
                <section
                  className="lr-context"
                  aria-labelledby="active-theme-title"
                >
                  <div>
                    <div className="lr-context-heading">
                      <p className="lr-eyebrow">YOUR NEXT CHAPTER</p>
                      <AppButton
                        {...({
                          tone: "gradient",
                          onClick: removeTheme,
                        } satisfies Partial<ComponentProps<typeof AppButton>>)}
                      >
                        <Trash2 size={15} /> Remove theme
                      </AppButton>
                    </div>
                    <h2 id="active-theme-title">{theme.title}</h2>
                    <p>
                      Explore resources to develop {theme.skill_name} in your
                      work.
                    </p>
                    <div className="lr-theme-meta">
                      <span className="lr-skill">{theme.skill_name}</span>
                      {theme.source === "template" && (
                        <span className="lr-template-label">
                          Template suggestion
                        </span>
                      )}
                    </div>
                    <Accordion
                      key={activeId}
                      {...({
                        type: "single",
                        collapsible: true,
                      } satisfies Partial<ComponentProps<typeof Accordion>>)}
                    >
                      <AccordionItem
                        {...({
                          value: "about",
                          className: "border-0",
                        } satisfies Partial<
                          ComponentProps<typeof AccordionItem>
                        >)}
                      >
                        <AccordionTrigger>About this theme</AccordionTrigger>
                        <AccordionContent>
                          <p>{theme.description}</p>
                          {theme.why_relevant && (
                            <p className="lr-relevance">{theme.why_relevant}</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </section>
                <div className="lr-section-heading lr-results-heading">
                  <div>
                    <h2>Resources for this theme</h2>
                    <p>
                      A small selection of free learning content from
                      established providers.
                    </p>
                  </div>
                  <span className="lr-count">{filtered.length} found</span>
                </div>
                <div className="lr-filters">
                  <label className="lr-search">
                    <Search size={16} />
                    <input
                      aria-label="Search resources"
                      placeholder="Search within this theme"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <FormSelect
                    {...({
                      label: "Resource format",
                      placeholder: "All formats",
                      value: format,
                      onValueChange: setFormat,
                      options: ["All formats", "Module", "Course"].map(
                        (value) => ({ value, label: value }),
                      ),
                    } satisfies Partial<ComponentProps<typeof FormSelect>>)}
                  />
                  <FormSelect
                    {...({
                      label: "Provider",
                      placeholder: "All providers",
                      value: provider,
                      onValueChange: setProvider,
                      options: [
                        "All providers",
                        ...Array.from(
                          new Set(resources.map((r) => r.provider)),
                        ),
                      ].map((value) => ({ value, label: value })),
                    } satisfies Partial<ComponentProps<typeof FormSelect>>)}
                  />
                </div>
                <div className="lr-source-note">
                  <Check size={14} />{" "}
                  {demo
                    ? "Demo content · English · Example data for layout preview"
                    : "Free content · English · Curated links checked 7 Sep 2026"}
                </div>
                <div className="lr-cards">
                  {filtered.map((r) => {
                    const added = selected.some((s) => s.resourceId === r.id);
                    const appButtonProps4 = {
                      tone: "gradient",
                      onClick: () => setDetail(r),
                    } satisfies Partial<ComponentProps<typeof AppButton>>;
                    const appButtonProps5 = {
                      tone: "gradient",
                      "aria-pressed": added,
                      onClick: () => toggle(r),
                    } satisfies Partial<ComponentProps<typeof AppButton>>;
                    return (
                      <article className="lr-card" key={r.id}>
                        <div className="lr-card-top">
                          <span
                            className={`lr-provider-icon ${r.provider === "OpenLearn" ? "lr-ou" : ""}`}
                          >
                            <BookOpen size={21} />
                          </span>
                          <div>
                            <p className="lr-provider">{r.provider}</p>
                            <span className="lr-type">{r.format}</span>
                          </div>
                          <span className="lr-free">Free content</span>
                        </div>
                        <h3>{r.title}</h3>
                        <p className="lr-summary">{r.summary}</p>
                        <div className="lr-meta">
                          <span>
                            <Globe2 size={14} /> English
                          </span>
                          {r.minutes && (
                            <span>
                              <Clock3 size={14} /> {r.minutes} min · example
                            </span>
                          )}
                        </div>
                        <div className="lr-card-actions">
                          <AppButton {...appButtonProps4}>
                            View details <ArrowUpRight size={15} />
                          </AppButton>
                          <AppButton {...appButtonProps5}>
                            {added ? <Check size={16} /> : <Plus size={16} />}{" "}
                            {added ? "Added to shortlist" : "Add to shortlist"}
                          </AppButton>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!filtered.length && (
                  <div className="lr-empty lr-card">
                    <SlidersHorizontal />
                    <h3>
                      {matching.length
                        ? "No resources match these filters"
                        : "We’re still finding resources for this theme"}
                    </h3>
                    <p>
                      {matching.length
                        ? "Try another format, provider or search term."
                        : "Our starter collection does not cover every skill yet. Try another chosen theme."}
                    </p>
                    {matching.length > 0 && (
                      <AppButton
                        {...({
                          tone: "gradient",
                          onClick: () => {
                            setQuery("");
                            setFormat("All formats");
                            setProvider("All providers");
                          },
                        } satisfies Partial<ComponentProps<typeof AppButton>>)}
                      >
                        Clear filters
                      </AppButton>
                    )}
                  </div>
                )}
                <p className="lr-footnote">
                  Learning takes place on the provider’s website. Check
                  prerequisites and access conditions before starting.
                </p>
              </>
            )}
          </div>
        </div>
        <p className="lr-notice" role="status">
          {notice}
        </p>
        <DrawerContent className="lr-shortlist-drawer">
          <DrawerHeader>
            <DrawerTitle>My learning shortlist · {selected.length}</DrawerTitle>
            <DrawerDescription>
              Save resources here, then make room for learning in My Plan.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="lr-shortlist">
            {!selected.length ? (
              <div className="lr-shortlist-empty">
                <BookOpen size={28} />
                <h3>Your next step starts here</h3>
                <p>
                  Add a resource that interests you. Your choices stay here as
                  you explore other themes.
                </p>
              </div>
            ) : (
              <ul>
                {selected.map((s) => {
                  const r = resources.find((r) => r.id === s.resourceId)!;
                  const appButtonProps6 = {
                    tone: "gradient",
                    size: "icon",
                    className: "lr-remove",
                    "aria-label": `Remove ${r.title}`,
                    onClick: () => toggle(r),
                  } satisfies Partial<ComponentProps<typeof AppButton>>;
                  return (
                    <li key={s.resourceId}>
                      <div>
                        <span>{s.skillName}</span>
                        <a
                          href={r.url || undefined}
                          onClick={(e) => {
                            if (!r.url) {
                              e.preventDefault();
                              setDetail(r);
                            }
                          }}
                          role={!r.url ? "button" : undefined}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (
                              !r.url &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              setDetail(r);
                            }
                          }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.title} <ArrowUpRight size={13} />
                        </a>
                        <small>{r.provider}</small>
                      </div>
                      <AppButton {...appButtonProps6}>
                        <Trash2 size={16} />
                      </AppButton>
                    </li>
                  );
                })}
              </ul>
            )}
            {selected.length > 0 && (
              <p className="lr-duration">
                <Clock3 size={16} />{" "}
                {demo
                  ? `${selected.reduce((total, s) => total + (resources.find((r) => r.id === s.resourceId)?.minutes || 0), 0)} min total · example estimate`
                  : "Confirm study time with each provider."}
              </p>
            )}
          </DrawerBody>
          <div className="lr-drawer-footer">
            {selected.length > 0 && (
              <AppButton
                {...({
                  tone: "gradient",
                  asChild: true,
                  className: "lr-plan-action",
                } satisfies Partial<ComponentProps<typeof AppButton>>)}
              >
                <Link
                  {...({
                    to: `${ROUTES.plan}${demo ? "" : "?demo=0"}`,
                    state: { shortlist: selected },
                  } satisfies Partial<ComponentProps<typeof Link>>)}
                >
                  Go to My Plan <ArrowUpRight size={16} />
                </Link>
              </AppButton>
            )}
            <AppButton {...appButtonProps7}>
              <Download size={16} /> Export shortlist
            </AppButton>
            <p className="lr-save-note">
              {demo
                ? "Demo selections reset on refresh."
                : "Saved to your account. You can also export a copy."}
            </p>
            <p role="status">{notice}</p>
          </div>
        </DrawerContent>
        <Dialog {...dialogProps8}>
          <DialogContent className="lr-detail">
            {detail && (
              <>
                <p className="lr-eyebrow">
                  {detail.provider} · {detail.format}
                </p>
                <DialogTitle>{detail.title}</DialogTitle>
                <DialogDescription>{detail.summary}</DialogDescription>
                <div className="lr-detail-info">
                  <h3>Before you begin</h3>
                  <p>{detail.access}</p>
                  <p>
                    Language: English. Check the source for duration, level and
                    prerequisites.
                  </p>
                  <h3>Why it appears here</h3>
                  <p>
                    This resource shares topic keywords with your selected
                    learning theme. Review the outline to decide whether it fits
                    your goal.
                  </p>
                </div>
                {detail.url && (
                  <AppButton
                    {...({ tone: "gradient", asChild: true } satisfies Partial<
                      ComponentProps<typeof AppButton>
                    >)}
                  >
                    <a
                      href={detail.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open provider website <ArrowUpRight size={16} />
                    </a>
                  </AppButton>
                )}
                <AppButton
                  {...({
                    tone: "gradient",
                    onClick: () => toggle(detail),
                  } satisfies Partial<ComponentProps<typeof AppButton>>)}
                >
                  {selected.some((s) => s.resourceId === detail.id)
                    ? "Remove from shortlist"
                    : "Add to my shortlist"}
                </AppButton>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Drawer>
  );
}
