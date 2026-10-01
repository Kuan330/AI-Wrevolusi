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
    // Keep ICT strategy ahead of generic planning or software mentions.
    match: /(?:ICT|information technology|digital|technology).{0,60}(?:strategy|strategic|roadmap|plan(?:ning)?)|(?:strategy|strategic|roadmap).{0,60}(?:ICT|information technology|digital|technology)/i,
    guidance: {
      title: "ICT strategy and planning",
      help: "AI may organise current-state notes, compare stated options and draft a roadmap outline from priorities you provide.",
      steps: ["Set out the intended outcomes, constraints, stakeholders and approved evidence.", "Ask AI to structure options and assumptions without filling evidence gaps.", "Check alignment with governance, budget, risk and the organisation’s longer-term direction."],
      tools: [{ name: "AI planning assistant", purpose: "Structure a roadmap or options paper from confirmed inputs." }],
      review: "You set the strategy, weigh organisational trade-offs and approve priorities, investment and accountability.",
    },
  },
  {
    match: /(?:cyber|information|ICT|technology).{0,45}security|security.{0,45}(?:ICT|technology|system|network|information)|(?:security|risk|compliance).{0,45}(?:control|incident|breach|policy)/i,
    guidance: {
      title: "ICT security oversight",
      help: "AI may help turn approved control requirements into a review checklist or summarise non-sensitive incident notes.",
      steps: ["Use approved controls, system scope and non-sensitive evidence.", "Ask for a checklist that links each item to the stated control or policy.", "Validate technical findings, escalate incidents and keep access or response decisions with authorised people."],
      tools: [{ name: "AI documentation assistant", purpose: "Draft a control checklist or evidence summary." }],
      review: "You assess risk, verify evidence, protect sensitive information and decide whether controls or incident actions are adequate.",
    },
  },
  {
    match: /(?:evaluat|assess|review).{0,70}(?:technology|ICT|system|digital).{0,70}(?:need|improv|upgrade|option)?|(?:recommend|improv|upgrade).{0,70}(?:technology|ICT|system|digital)|(?:technology|ICT).{0,50}(?:need|improv|upgrade)/i,
    guidance: {
      title: "Evaluating technology needs",
      help: "AI may compare stated needs, constraints and options in a draft recommendation matrix without choosing a solution for you.",
      steps: ["List the user needs, current limitations, success measures and non-negotiable constraints.", "Ask for an options matrix that marks unknown costs, dependencies and assumptions.", "Verify supplier claims, technical fit, lifecycle implications and the evidence behind each recommendation."],
      tools: [{ name: "AI analysis assistant", purpose: "Organise a needs-and-options comparison." }, { name: "Requirements matrix", purpose: "Trace recommendations to confirmed needs and constraints." }],
      review: "You judge fitness for purpose, risk, cost and stakeholder impact before recommending an improvement.",
    },
  },
  {
    match: /(?:select|deploy|implement|install|configur|procur).{0,70}(?:ICT|technology|hardware|software|system|platform|network|resource)|(?:ICT|technology|hardware|software|system|platform|network|resource).{0,70}(?:select|deploy|implement|install|configur)/i,
    guidance: {
      title: "Selecting and deploying ICT resources",
      help: "AI may draft a rollout checklist, compare confirmed requirements and flag deployment dependencies for review.",
      steps: ["Confirm the resource scope, compatibility needs, ownership and rollout constraints.", "Ask for a staged checklist with dependencies, rollback points and unanswered questions visible.", "Test the plan in the approved environment and validate security, access and operational readiness."],
      tools: [{ name: "AI project assistant", purpose: "Structure deployment steps and dependency questions." }, { name: "Change checklist", purpose: "Record approvals, testing and rollback readiness." }],
      review: "You approve selection, verify compatibility and security, and authorise changes to live systems.",
    },
  },
  {
    match: /(?:ICT|technology|system|service).{0,60}(?:operation|workflow|priorit|support|service delivery)|(?:operation|workflow|priorit|service delivery).{0,60}(?:ICT|technology|system|service)/i,
    guidance: {
      title: "ICT operations and priorities",
      help: "AI may cluster non-sensitive work requests, draft handover notes and suggest a queue view using priorities you define.",
      steps: ["State the service commitments, impact criteria and current work items.", "Ask for a queue or handover summary that keeps missing ownership and dependencies visible.", "Check urgency, service impact and technical dependencies with the responsible team before acting."],
      tools: [{ name: "AI operations assistant", purpose: "Draft a queue summary or handover from confirmed information." }],
      review: "You set priorities, assess operational risk and decide which work can proceed or must be escalated.",
    },
  },
  {
    // Administrative policy work needs a document-control focus, not a generic checklist.
    match: /(?:develop|implement|draft|revise).{0,70}(?:administrative|procedural).{0,45}(?:statement|guideline|policy)|(?:administrative|procedural).{0,45}(?:statement|guideline|policy).{0,70}(?:develop|implement|draft|revise)/i,
    guidance: {
      title: "Administrative policy and procedure design",
      help: "AI may turn approved requirements into a policy draft structure, map roles and hand-offs, and flag places where an exception or approval rule is missing.",
      steps: ["Gather the approved obligations, current procedure and the staff groups affected.", "Ask for a structured draft that separates mandatory rules, responsibilities, records and exceptions.", "Check legal, governance and document-control requirements with the authorised owners before publishing guidance."],
      tools: [{ name: "AI policy drafting assistant", purpose: "Structure a controlled draft from confirmed administrative requirements." }],
      review: "You determine the policy intent, validate obligations and exceptions, and authorise the procedure that staff must follow.",
    },
  },
  {
    match: /(?:financial|finance).{0,55}(?:report|reporting)|(?:report|reporting).{0,55}(?:financial|finance)|(?:prepar|support).{0,55}(?:budget|financial)/i,
    guidance: {
      title: "Financial reporting preparation",
      help: "AI may organise confirmed figures into a reporting outline, reconcile a narrative to source schedules, and list variances that need an accountant's explanation.",
      steps: ["Use approved reporting periods, source schedules and definitions for the figures.", "Ask for a draft management narrative that labels variances, assumptions and missing evidence.", "Reconcile totals to the source records and have authorised finance staff review classifications and disclosures."],
      tools: [{ name: "AI reporting assistant", purpose: "Draft a source-linked reporting outline and variance questions." }, { name: "Spreadsheet", purpose: "Reconcile totals and trace figures to approved schedules." }],
      review: "You verify the figures, accounting treatment and disclosures, and ensure only authorised financial information is reported.",
    },
  },
  {
    match: /(?:analys|assess|investigat).{0,70}(?:resource management|resources?).{0,70}(?:issue|initiative|impact|report|submission)|(?:resource management).{0,70}(?:issue|initiative|impact|report|submission)/i,
    guidance: {
      title: "Resource-management analysis",
      help: "AI may organise issue evidence into an options paper, separate impacts by stakeholder or resource, and expose assumptions that need further investigation.",
      steps: ["Define the decision, affected resources, evidence sources and criteria for evaluating options.", "Ask for an issue map or options table that keeps uncertainty, dependencies and trade-offs visible.", "Validate impacts with operational owners and check that the recommendation is supported by current evidence."],
      tools: [{ name: "AI analysis assistant", purpose: "Structure an evidence-led resource issue analysis." }],
      review: "You assess evidence quality, weigh operational consequences and recommend the action the organisation should take.",
    },
  },
  {
    match: /(?:develop|manag|maintain).{0,65}(?:administrative|physical|building|facilit).{0,45}resources?|(?:administrative|physical|building|facilit).{0,45}resources?.{0,65}(?:develop|manag|maintain)/i,
    guidance: {
      title: "Administrative and physical resource management",
      help: "AI may draft an asset or facilities action plan, consolidate maintenance requests and identify ownership, service-level or lifecycle questions for review.",
      steps: ["Confirm the asset or facility scope, current condition, owners and service commitments.", "Ask for a prioritised action list that distinguishes urgent maintenance, planned work and unresolved dependencies.", "Check site conditions, supplier commitments, safety requirements and budget authority before allocating resources."],
      tools: [{ name: "AI operations assistant", purpose: "Structure facilities or administrative-resource actions from confirmed records." }],
      review: "You decide priorities, verify operational and safety impacts, and approve how organisational resources are allocated.",
    },
  },
  {
    match: /(?:lead|manag|develop).{0,65}(?:administrative|office).{0,45}staff|(?:administrative|office).{0,45}staff.{0,65}(?:lead|manag|develop)/i,
    guidance: {
      title: "Administrative staff leadership",
      help: "AI may prepare a workload handover, draft development goals and turn agreed performance evidence into neutral discussion prompts.",
      steps: ["Use role expectations, approved performance evidence and the team's current workload.", "Ask for a structured conversation guide that separates observed facts, support needs and next actions.", "Check fairness, privacy, workload impact and organisational policy before giving feedback or changing responsibilities."],
      tools: [{ name: "AI people-management assistant", purpose: "Draft neutral coaching or handover materials from confirmed information." }],
      review: "You lead people, assess performance fairly, make staffing decisions and handle sensitive conversations directly.",
    },
  },
  {
    match: /(?:select|recruit|appoint).{0,55}staff.{0,55}(?:train|performance)|(?:train|performance).{0,55}staff.{0,55}(?:select|recruit|appoint)|oversee.{0,55}(?:selection|training|performance).{0,55}staff/i,
    guidance: {
      title: "Staff selection, training and performance",
      help: "AI may draft role-based interview questions, a training plan and a factual performance-review template from approved criteria.",
      steps: ["Set the approved role criteria, learning requirements and performance measures.", "Ask for materials that distinguish selection evidence, training support and performance observations.", "Check equal-opportunity, privacy and employment-policy requirements before using any material with staff."],
      tools: [{ name: "AI HR documentation assistant", purpose: "Draft structured, criteria-based people-process materials." }],
      review: "You make employment and performance decisions, evaluate evidence fairly and remain accountable for staff wellbeing and legal obligations.",
    },
  },
  {
    match: /(?:represent|speak).{0,75}(?:organisation|organization|enterprise).{0,75}(?:negotia|convention|seminar|hearing|forum)|(?:negotia|convention|seminar|hearing|forum).{0,75}(?:organisation|organization|enterprise)/i,
    guidance: {
      title: "Organisational representation and negotiation",
      help: "AI may prepare a briefing pack, compare agreed positions and draft questions or a neutral record for an external meeting.",
      steps: ["Confirm the organisation's mandate, negotiation boundaries, audience and approved background material.", "Ask for a briefing that separates agreed positions, open questions and items requiring escalation.", "Validate commitments, public statements and the meeting record with the authorised decision-makers."],
      tools: [{ name: "AI briefing assistant", purpose: "Structure an external-meeting briefing from approved positions." }],
      review: "You represent the organisation, judge trade-offs in the room and only make commitments within your authority.",
    },
  },
  {
    match: /(?:establish|manag|control).{0,70}budget|budget.{0,70}(?:expenditure|spend|efficient|resource)|(?:control|monitor).{0,55}(?:expenditure|spend)/i,
    guidance: {
      title: "Budget and expenditure control",
      help: "AI may organise approved budget lines, highlight material variances and draft questions for forecast or expenditure review.",
      steps: ["Use the approved budget, actuals, commitments and delegated spending limits.", "Ask for a variance view that identifies drivers, timing differences and unanswered questions without changing figures.", "Reconcile amounts, test forecast assumptions and obtain the required approval before changing spending priorities."],
      tools: [{ name: "AI budget review assistant", purpose: "Structure variance and forecast-review questions." }, { name: "Spreadsheet", purpose: "Reconcile budget, actual and committed expenditure." }],
      review: "You control expenditure, assess value for money and authorise reallocations or escalations within delegated authority.",
    },
  },
  {
    match: /(?:plan|direct|coordinat).{0,60}(?:daily|day-to-day).{0,40}operations?|(?:daily|day-to-day).{0,40}operations?.{0,60}(?:plan|direct|coordinat)/i,
    guidance: {
      title: "Daily operational planning",
      help: "AI may turn confirmed work demands into a shift or daily run-sheet, surface dependencies and prepare a concise handover summary.",
      steps: ["State the day's service commitments, staffing, deadlines and known constraints.", "Ask for a run-sheet that keeps priorities, owners, dependencies and contingency points explicit.", "Check live conditions with the responsible team and adjust work only through the appropriate operational authority."],
      tools: [{ name: "AI operations planner", purpose: "Draft a daily plan or handover from confirmed work demands." }],
      review: "You direct daily work, respond to changing conditions and make the operational decisions that affect service delivery.",
    },
  },
  {
    match: /(?:administrative|strategic|operational).{0,80}(?:support|research|advice).{0,80}(?:senior management|building|facilit)|(?:senior management).{0,80}(?:administrative|strategic|operational).{0,80}(?:support|research|advice)/i,
    guidance: {
      title: "Strategic and management advice",
      help: "AI may synthesise approved research into a decision brief, distinguish evidence from assumptions and prepare questions for senior-management consideration.",
      steps: ["Clarify the management decision, evidence base, operational constraints and options that are in scope.", "Ask for a concise brief that traces each option to supporting evidence and flags unresolved risks.", "Validate recommendations with subject-matter owners and ensure senior management receives the trade-offs, not just a summary."],
      tools: [{ name: "AI briefing assistant", purpose: "Structure an evidence-led management brief." }],
      review: "You advise on organisational priorities, test the evidence and ensure decision-makers understand risk, resource and service implications.",
    },
  },
  {
    match: /(?:train|coach|enable|support).{0,55}(?:user|staff|employee|team|customer)|(?:user|staff|employee|team).{0,55}(?:train|coach|enable|support)/i,
    guidance: {
      title: "User training and enablement",
      help: "AI may draft a role-appropriate walkthrough, practice questions and a plain-language explanation from approved materials.",
      steps: ["Choose approved source material and identify the learner’s task and access level.", "Ask for a short walkthrough that separates instructions from assumptions.", "Check accuracy, accessibility, local procedures and whether the learner can complete the task safely."],
      tools: [{ name: "AI writing assistant", purpose: "Draft a training outline or practice questions." }],
      review: "You confirm that the training is accurate, suitable for the user and safe for the real system and workplace.",
    },
  },
  {
    match: /(?:consult|liais|advise|communicat|negotia).{0,70}(?:user|management|manager|vendor|supplier|technician|stakeholder)|(?:user|management|manager|vendor|supplier|technician|stakeholder).{0,70}(?:consult|liais|advise|communicat|negotia)/i,
    guidance: {
      title: "Consultation with stakeholders",
      help: "AI may prepare a meeting agenda, turn confirmed notes into a comparison and list questions that need a stakeholder answer.",
      steps: ["Set the decision to be discussed and the stakeholders’ known requirements.", "Ask for a neutral agenda or options summary with open questions clearly marked.", "Check the record with participants and resolve trade-offs, commitments and approvals directly."],
      tools: [{ name: "AI meeting assistant", purpose: "Draft an agenda, question list or neutral summary." }],
      review: "You listen to people, test whether requirements are understood and make or escalate the decisions that affect them.",
    },
  },
  {
    match: /(?:operational|administrative|office|business).{0,55}(?:procedure|process|workflow)|(?:procedure|process|workflow).{0,55}(?:operational|administrative|office|business)/i,
    guidance: {
      title: "Operational and administrative procedures",
      help: "AI may turn an approved process into a draft checklist, identify hand-off points and flag missing instructions.",
      steps: ["Provide the approved procedure, expected outcome and any mandatory controls.", "Ask for a step-by-step checklist that preserves exceptions and approval points.", "Compare the draft with the procedure and confirm ownership, records and escalation steps."],
      tools: [{ name: "AI process assistant", purpose: "Draft a readable checklist from an approved procedure." }],
      review: "You decide whether the procedure fits the real case and retain responsibility for approvals, records and exceptions.",
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
    match: /\b(?:data analysis|analysis of|analy[sz](?:e|ing) (?:sales |customer |financial )?data|data visuali[sz]ation)\b/i,
    guidance: {
      title: "Data analysis and reporting",
      help: "AI may help organise data, suggest visualisations and draft explanations of patterns for you to verify.",
      steps: [
        "Prepare an approved sample, define the question and explain what each column means.",
        "Ask for a clear analysis or chart, with calculations and assumptions shown.",
        "Check the source rows, calculations and interpretation before sharing the findings.",
      ],
      tools: [{ name: "AI analysis assistant", purpose: "Explore patterns in an approved data sample." }, { name: "Spreadsheet", purpose: "Verify calculations and chart source data." }],
      review: "You verify data quality and calculations, explain the business context and make the final decision.",
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
  const focus = task.wording.trim().replace(/\s+/g, " ");
  const conciseFocus = focus.length > 88 ? `${focus.slice(0, 85).replace(/\s+\S*$/, "")}…` : focus;
  const guidance = matched?.guidance ?? {
    title:
      /policies/i.test(task.wording)
        ? "Policy planning and direction"
        : task.wording.length > 45
        ? `${task.wording.slice(0, 42).replace(/\s+\S*$/, "")}…`
        : task.wording,
    help: `For “${conciseFocus}”, AI may help draft a checklist, summary or small planning step from the constraints you provide.`,
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
    review: `You decide whether a suggested approach fits “${conciseFocus}”, verify facts and retain responsibility for real-world actions.`,
  };
  return {
    ...guidance,
    prompt: `Help me with this task: ${task.wording}\n${task.notes ? `My working context: ${task.notes}\n` : ""}First identify a small step you can assist with and what input you need. Suggest a practical sequence and a draft output. Mark missing information; do not invent facts. Explain what I should verify myself.`,
  };
}
