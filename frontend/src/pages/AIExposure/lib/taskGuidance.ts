import type { ProfileTask } from "../../../features/work-profile/types";

type Guidance = {
  title: string;
  help: string;
  steps: string[];
  tools: { name: string; purpose: string }[];
  review: string;
};
const guides: { match: RegExp; guidance: Guidance }[] = [
  {
    // An explicit software activity takes priority over its business domain.
    match: /(?:test|debug|automat).{0,60}(?:software|application|code)|(?:software|application|code).{0,60}(?:test|debug)|(?:write|develop|creat).{0,40}(?:automated tests|unit tests|test cases|code)|\bprogramming\b/i,
    guidance: {
      title: "Software testing and development",
      help: "AI may suggest test cases, explain failures and draft small code changes from a requirement you provide.",
      steps: ["Choose a fictional requirement and its expected result.", "Ask for test cases, including missing or invalid inputs.", "Run the tests in a test environment and review every suggested change."],
      tools: [{ name: "AI coding assistant", purpose: "Suggest tests or explain a small code change." }, { name: "Test environment", purpose: "Check actual behaviour against the expected result." }],
      review: "You decide the expected behaviour, check test coverage and verify the code before approving a release.",
    },
  },
  {
    match: /(?:cost|quantit|labour|labor|material).{0,90}estimat|estimat.{0,90}(?:cost|quantit|labour|labor|material)/i,
    guidance: {
      title: "Cost estimates",
      help: "AI may help structure a draft estimate from approved quantities and rates, and list assumptions or missing inputs.",
      steps: [
        "Choose a small example with approved quantities, units and rates.",
        "Ask for a draft table that leaves missing inputs blank and lists its assumptions.",
        "Check the inputs and recalculate totals with a spreadsheet before approving the estimate.",
      ],
      tools: [{ name: "AI text assistant", purpose: "Structure a draft and list missing information." }, { name: "Spreadsheet", purpose: "Check units, quantities, rates and calculations." }],
      review: "Check quantities, rates, units and calculations. Apply project requirements and approve the final estimate yourself.",
    },
  },
  {
    match: /test results|test readings|unusual readings|analys.{0,30}(?:measurements|readings)/i,
    guidance: {
      title: "Reviewing test results",
      help: "AI may help organise readings and draft a summary of differences. It cannot establish why a result is unusual without the right evidence.",
      steps: [
        "Use a non-sensitive example with units, test conditions and approved limits.",
        "Ask for a summary tied to the original readings, with missing context marked clearly.",
        "Verify each reading, instrument status and explanation using the approved procedure.",
      ],
      tools: [{ name: "AI text assistant", purpose: "Draft a source-linked summary of readings." }],
      review: "Check units, test conditions and instrument reliability. Investigate unusual results and leave safety decisions to the responsible person.",
    },
  },
  {
    match: /(?:assembl|install).{0,60}(?:mechanical|machine|equipment|hydraulic)|(?:mechanical|machine|equipment|hydraulic).{0,60}(?:assembl|install)/i,
    guidance: {
      title: "Mechanical assembly and installation",
      help: "AI may help prepare written notes or a draft checklist from approved instructions. It cannot carry out the physical installation.",
      steps: [
        "Choose approved instructions for a non-sensitive example.",
        "Ask for a preparation checklist that points to the original instructions.",
        "Check every step with the approved procedure before using it.",
      ],
      tools: [{ name: "AI text assistant", purpose: "Help with written preparation only." }],
      review: "Carry out physical work using approved safety procedures. Check equipment, measurements and authorisation before signing off.",
    },
  },
  {
    // Match pricing/marketing intent before incidental words such as budgets or records.
    match: /pric(?:e|ing)|discount|marketing|promotion|campaign|sales methods/i,
    guidance: {
      title: "Pricing and sales planning",
      help: "Explore pricing scenarios and draft campaign options using your own costs, targets and constraints.",
      steps: [
        "Prepare sample costs, current prices, target margins and campaign goals. Include discount limits and delivery conditions.",
        "Ask AI to compare a few pricing or promotion scenarios, stating assumptions and flagging missing information.",
        "Recalculate margins and check feasibility, customer impact and company rules before approving any price or campaign.",
      ],
      tools: [
        {
          name: "AI planning assistant",
          purpose:
            "Draft scenarios and campaign ideas from your confirmed inputs.",
        },
        {
          name: "Spreadsheet",
          purpose: "Check margins, discounts and scenario calculations.",
        },
      ],
      review:
        "You confirm costs and assumptions, assess commercial judgement and approve pricing and promotional claims.",
    },
  },
  {
    match: /budget|record|stock|financial|bookkeep|account|data entry/i,
    guidance: {
      title: "Records and budgeting",
      help: "AI may help organise prepared records, draft summaries and flag entries that need review.",
      steps: [
        "Prepare a small, non-sensitive sample with clear dates, quantities and column names.",
        "Ask an approved AI tool for a summary and a list of missing or unusual entries, with references to source rows.",
        "Recalculate totals in your spreadsheet and check each flagged entry before using the summary.",
      ],
      tools: [
        {
          name: "AI assistant with file analysis",
          purpose:
            "Draft a summary from a prepared table; check that your approved tool supports the file.",
        },
        {
          name: "Spreadsheet",
          purpose:
            "Verify calculations and trace figures back to the original records.",
        },
      ],
      review:
        "You check the numbers, investigate exceptions and approve financial or stock decisions.",
    },
  },
  {
    match: /purchas|supplier|ordering|procure/i,
    guidance: {
      title: "Purchasing and supplier orders",
      help: "AI may help compare supplier quotes and draft orders from requirements you have confirmed.",
      steps: [
        "Gather sample quotes with quantities, prices, delivery dates and payment terms.",
        "Ask AI to build a comparison table and mark missing information instead of guessing.",
        "Check the table against each quote, confirm availability and approve the purchase yourself.",
      ],
      tools: [
        {
          name: "AI document assistant",
          purpose: "Extract and organise information from supplier quotes.",
        },
        {
          name: "Spreadsheet",
          purpose: "Verify unit costs and comparable order totals.",
        },
      ],
      review:
        "You assess supplier reliability, negotiate terms and make the purchasing decision.",
    },
  },
  {
    match: /customer|selling|sales|advis|product use/i,
    guidance: {
      title: "Customer advice and sales",
      help: "AI may draft product explanations or answers to common questions using approved information.",
      steps: [
        "Choose an approved product sheet and a fictional customer question.",
        "Ask AI for a clear answer using only that source, noting any information it cannot find.",
        "Verify every product claim and adapt the response to the customer’s circumstances.",
      ],
      tools: [
        {
          name: "AI writing assistant",
          purpose:
            "Draft and simplify a response based on approved information.",
        },
        {
          name: "Product knowledge base",
          purpose:
            "Check specifications, limitations and current product information.",
        },
      ],
      review:
        "You understand the customer’s needs, verify advice and handle unusual or sensitive situations.",
    },
  },
  {
    match: /\bsoftware\b|\bprogramming\b|\binternet\b|\bwebsite\b|\bweb\b|\bcode\b|\bcoding\b/i,
    guidance: {
      title: "Software and website development",
      help: "AI may help outline an implementation, draft small code changes and suggest test cases.",
      steps: [
        "Describe one small requirement and its constraints using a non-sensitive example.",
        "Ask an approved coding assistant for an approach and a small, explained change.",
        "Review the code and run relevant checks in a test environment before using it.",
      ],
      tools: [
        {
          name: "AI coding assistant",
          purpose: "Draft or explain a focused implementation.",
        },
        {
          name: "Local test environment",
          purpose:
            "Check behaviour, accessibility and failure cases before release.",
        },
      ],
      review:
        "You own requirements, design choices, security review and approval of the final implementation.",
    },
  },
];
export function taskGuidance(task: Pick<ProfileTask, "wording" | "notes">) {
  const affirmative = (value: string) => value.replace(/\b(?:do not|does not|don't|never|not responsible for)\b[^.;!?]*/gi, "");
  const wording = affirmative(task.wording);
  const notes = affirmative(task.notes ?? "");
  // Context can clarify an otherwise vague testing task, without treating the
  // mention of a tool as proof that the user's main task is programming.
  const vagueTesting = /^\s*(?:I\s+)?(?:run|review|check|write|develop|perform)?\s*(?:tests?|testing)(?:\s+results)?[.;\s]*$/i.test(wording);
  const softwareContext = vagueTesting && /\b(?:Python|Playwright|Selenium|unit tests|test automation)\b/i.test(notes);
  const matched = guides.find((item) => item.match.test(wording)) ?? (softwareContext ? guides[0] : undefined);
  const guidance = matched?.guidance ?? {
    title:
      /policies/i.test(task.wording)
        ? "Policy planning and direction"
        : task.wording.length > 45
        ? `${task.wording.slice(0, 42).replace(/\s+\S*$/, "")}…`
        : task.wording,
    help: "Start by checking whether this task includes a planning, writing or summarising step that an AI assistant could support.",
    steps: [
      "Choose one small part of the task and describe the desired output and constraints.",
      "Ask an approved AI assistant for a draft or checklist using non-sensitive example information.",
      "Check it against your requirements and source material. Keep physical actions and final decisions with the responsible person.",
    ],
    tools: [
      {
        name: "AI text assistant",
        purpose:
          "Explore a draft, checklist or plan where the task involves text.",
      },
    ],
    review:
      "Check whether the suggested approach fits your task at all. Verify facts and retain responsibility for real-world actions.",
  };
  return {
    ...guidance,
    prompt: `Help me with this task: ${task.wording}\n${task.notes ? `My working context: ${task.notes}\n` : ""}First identify a small step you can assist with and what input you need. Suggest a practical sequence and a draft output. Mark missing information; do not invent facts. Explain what I should verify myself.`,
  };
}
