import type { ComponentProps } from "react";
import { ExternalLink } from "lucide-react";

import SkillsInfoPopover from "@/pages/Skills/components/SkillsInfoPopover";

const WEF_REPORT_URL =
  "https://www.weforum.org/publications/the-future-of-jobs-report-2025/";

const SkillOutlookInfo = () => (
  <SkillsInfoPopover
    {...({
      ariaLabel: "Sources and methodology for the external outlook",
      title: "Sources & methodology",
      placement: "side-start",
      triggerText: "Sources & methodology",
    } satisfies Partial<ComponentProps<typeof SkillsInfoPopover>>)}
  >
    <div className="skills-outlook-info__sections">
      <section>
        <h5>Valued today</h5>
        <p>
          <strong>How to read it:</strong> The share of surveyed employers that
          consider this a core skill for their workforce in 2025.
        </p>
        <p>
          <strong>Source:</strong> World Economic Forum, Future of Jobs Report
          2025, Figure 3.3.
        </p>
      </section>
      <section>
        <h5>Future use by 2030</h5>
        <p>
          <strong>How to read it:</strong> Net outlook is the share of employers
          expecting use to increase minus the share expecting it to decrease.
        </p>
        <p>
          <strong>Source:</strong> World Economic Forum, Future of Jobs Report
          2025, Figure 3.4, based on the Future of Jobs Survey 2024.
        </p>
      </section>
      <section>
        <h5>GenAI substitution capacity</h5>
        <p>
          <strong>How to read it:</strong> This is a research category, not an
          exact percentage or a prediction about your role.
        </p>
        <p>
          <strong>Source:</strong> World Economic Forum, Figure B3.1, drawing on
          Indeed&apos;s analysis of more than 2,800 granular skills in August
          2024.
        </p>
      </section>
    </div>
    <p className="skills-outlook-info__limitations">
      These are global research signals. They are not calculated from your
      tasks, specific to Malaysia, measures of your proficiency, or predictions
      that your job will be replaced.
    </p>
    <a
      className="skills-outlook-info__source-link"
      href={WEF_REPORT_URL}
      target="_blank"
      rel="noreferrer"
    >
      View the WEF report
      <ExternalLink
        {...({ className: "size-3", "aria-hidden": true } satisfies Partial<
          ComponentProps<typeof ExternalLink>
        >)}
      />
    </a>
  </SkillsInfoPopover>
);

export default SkillOutlookInfo;
