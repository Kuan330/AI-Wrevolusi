import type { Course, FocusSkill } from "./types";

// Imported from the supplied Epic 5 prototype; provider metadata is not live-verified.
export const focusSkills: FocusSkill[] = [
  {
    id: "data-analysis",
    en: "Data Analysis",
    ico: "📊",
    hint: "Tidy tables, summarise data, read reports",
  },
  {
    id: "critical-thinking",
    en: "Critical Thinking",
    ico: "🧠",
    hint: "Judge information, break down problems",
  },
  {
    id: "communication",
    en: "Communication",
    ico: "💬",
    hint: "Present conclusions, write clear docs",
  },
  {
    id: "digital-literacy",
    en: "Digital Literacy",
    ico: "💻",
    hint: "Use digital tools and online collaboration well",
  },
  {
    id: "project-management",
    en: "Project Management",
    ico: "🗂",
    hint: "Break down tasks, plan and follow through",
  },
  {
    id: "ai-literacy",
    en: "AI Literacy",
    ico: "🤖",
    hint: "Understand and put AI tools to work",
  },
];
export const courses: Course[] = [
  {
    id: "c1",
    title: "Intro to Python",
    provider: "Kaggle Learn",
    level: "beginner",
    language: "English",
    format: "Interactive exercises",
    selfPaced: true,
    durationMin: 300,
    register: "required",
    url: "https://www.kaggle.com/learn/python",
    skills: ["data-analysis", "digital-literacy"],
    match: {
      "data-analysis":
        "The standard first language for data analysis — learn to read, write and tidy data right in the browser.",
      "digital-literacy":
        "Write and run code entirely in the browser and build the habit of working with online tools.",
    },
    intro:
      "The Kaggle Learn intro Python course: 7 lessons, each a tutorial notebook plus exercises that run directly in the browser. Provider states about 5 hours to the completion certificate.",
    outcomes: [
      "Read and modify simple Python code",
      "Handle small datasets with lists, loops and functions",
      "Complete 7 lessons of tutorials and exercises",
    ],
    prereq:
      "No programming experience needed; English interface, free Kaggle account required.",
    chapters: [
      {
        title: "Hello, Python",
        min: null,
      },
      {
        title: "Functions and Getting Help",
        min: null,
      },
      {
        title: "Booleans and Conditionals",
        min: null,
      },
      {
        title: "Lists",
        min: null,
      },
      {
        title: "Loops and List Comprehensions",
        min: null,
      },
      {
        title: "Strings and Dictionaries",
        min: null,
      },
      {
        title: "Working with External Libraries",
        min: null,
      },
    ],
    advice:
      "Do the exercises first, then read the explanations — search error messages verbatim when stuck. Afterwards, try loading a spreadsheet you tidy up by hand into code.",
  },
  {
    id: "c2",
    title: "Pandas",
    provider: "Kaggle Learn",
    level: "beginner",
    language: "English",
    format: "Interactive exercises",
    selfPaced: true,
    durationMin: 240,
    register: "required",
    url: "https://www.kaggle.com/learn/pandas",
    skills: ["data-analysis"],
    match: {
      "data-analysis":
        'Maps directly to the everyday "tidy tables, summarise data" step — you can clean a real report on your own by the end.',
    },
    intro:
      "Reading, filtering, grouping and merging tabular data (DataFrames) across 6 lessons — the most common data-tidying toolkit beyond Excel. Provider states about 4 hours to the certificate.",
    outcomes: [
      "Read CSV files and inspect data structures",
      "Filter, sort and group data",
      "Handle missing values and merge tables",
    ],
    prereq:
      "Basic Python required (provider notes it builds on the Python course).",
    chapters: [
      {
        title: "Creating, Reading and Writing",
        min: null,
      },
      {
        title: "Indexing, Selecting & Assigning",
        min: null,
      },
      {
        title: "Summary Functions and Maps",
        min: null,
      },
      {
        title: "Grouping and Sorting",
        min: null,
      },
      {
        title: "Data Types and Missing Values",
        min: null,
      },
      {
        title: "Renaming and Combining",
        min: null,
      },
    ],
    advice:
      'Practise on a real spreadsheet from your own work. After "Grouping and Sorting", script the summary steps you repeat every month.',
  },
  {
    id: "c3",
    title: "Data Visualization",
    provider: "Kaggle Learn",
    level: "beginner",
    language: "English",
    format: "Interactive exercises",
    selfPaced: true,
    durationMin: 240,
    register: "required",
    url: "https://www.kaggle.com/learn/data-visualization",
    skills: ["data-analysis", "communication"],
    match: {
      "data-analysis":
        "Turning results into charts is how analysis actually gets seen.",
      communication:
        "Replace long paragraphs with one clear chart and cut the explanation cost when reporting.",
    },
    intro:
      "Plot lines, bars and heatmaps with Seaborn across 8 lessons, ending with a final project. Provider states about 4 hours to the certificate.",
    outcomes: [
      "Pick the right chart for the relationship you want to show",
      "Draw line, bar, heatmap and distribution charts in code",
      "Tune styles and labels so charts read clearly",
    ],
    prereq: "Python and basic spreadsheet handling required.",
    chapters: [
      {
        title: "Hello, Seaborn",
        min: null,
      },
      {
        title: "Line Charts",
        min: null,
      },
      {
        title: "Bar Charts and Heatmaps",
        min: null,
      },
      {
        title: "Scatter Plots",
        min: null,
      },
      {
        title: "Distributions",
        min: null,
      },
      {
        title: "Choosing Plot Types and Custom Styles",
        min: null,
      },
      {
        title: "Final Project",
        min: null,
      },
      {
        title: "Creating Your Own Notebooks",
        min: null,
      },
    ],
    advice:
      "Ask one question before every chart: what should the viewer see? One chart plus one takeaway on a page beats a pile of numbers.",
  },
  {
    id: "c4",
    title: "Intro to SQL",
    provider: "Kaggle Learn",
    level: "beginner",
    language: "English",
    format: "Interactive exercises",
    selfPaced: true,
    durationMin: 180,
    register: "required",
    url: "https://www.kaggle.com/learn/intro-to-sql",
    skills: ["data-analysis", "digital-literacy"],
    match: {
      "data-analysis":
        "Data lives in databases at most companies — writing your own queries means no more waiting on someone else for numbers.",
      "digital-literacy":
        "Understanding how data is stored helps you make fewer mistakes in day-to-day systems.",
    },
    intro:
      "Learn SQL on Google BigQuery across 6 lessons. Provider states about 3 hours to the certificate.",
    outcomes: [
      "Write queries with conditions (Select / From / Where)",
      "Group, count and sort results",
      "Join data across multiple tables",
    ],
    prereq:
      "No programming experience; English interface, free Kaggle account required.",
    chapters: [
      {
        title: "Getting Started With SQL and BigQuery",
        min: null,
      },
      {
        title: "Select, From & Where",
        min: null,
      },
      {
        title: "Group By, Having & Count",
        min: null,
      },
      {
        title: "Order By",
        min: null,
      },
      {
        title: "As & With",
        min: null,
      },
      {
        title: "Joining Data",
        min: null,
      },
    ],
    advice:
      "Decide the columns and conditions first, then write the query. Once you can pull your own numbers, reports stop queueing behind other people.",
  },
  {
    id: "c5",
    title: "Excel: Foundations",
    provider: "GCFGlobal (LearnFree)",
    level: "beginner",
    language: "English",
    format: "Tutorials + exercises",
    selfPaced: true,
    durationMin: null,
    register: "not-required",
    url: "https://edu.gcfglobal.org/en/excel/",
    skills: ["data-analysis", "digital-literacy"],
    match: {
      "data-analysis":
        "Start from the tool you already know — nail cells, formulas and tidy data before moving to heavier tools.",
      "digital-literacy":
        "Master a universal workplace tool and cut repeated manual work.",
    },
    intro:
      "A beginner-friendly illustrated Excel tutorial, from workbooks and cells up to formulas, functions and data cleanup.",
    outcomes: [
      "Create and save workbooks; handle cells confidently",
      "Write common formulas and functions",
      "Sort and filter a column of data",
    ],
    prereq: "None; no registration needed — start learning directly.",
    chapters: null,
    advice:
      "Take one table you tidy every month and replace the repeated steps with formulas — the fastest visible payoff of any course here.",
  },
  {
    id: "c6",
    title: "Design Effective Reports in Power BI",
    provider: "Microsoft Learn",
    level: "intermediate",
    language: "Chinese",
    format: "Blended (videos + hands-on labs)",
    selfPaced: true,
    durationMin: 307,
    register: "not-required",
    url: "https://learn.microsoft.com/zh-cn/training/paths/create-use-analytics-reports-power-bi/",
    skills: ["data-analysis", "digital-literacy"],
    match: {
      "data-analysis":
        'From pulling data to a reusable dashboard — the "keep data visible" work scenario end to end.',
      "digital-literacy":
        "Get familiar with the business-intelligence tools and workflows common at companies.",
    },
    intro:
      "Microsoft Learn path: create insight-rich Power BI reports with data visualisation and storytelling. Provider marks it intermediate, 4 modules, about 5 hr 7 min, no prerequisites.",
    outcomes: [
      "Scope report design requirements (audience, report type, interface and experience)",
      "Design consistent, interactive Power BI reports",
      "Enhance designs for user experience so data is easier to browse",
      "Perform analysis in Power BI and identify trends",
    ],
    prereq: "None (provider lists no prerequisites).",
    chapters: [
      {
        title: "Scope report design requirements",
        min: 29,
      },
      {
        title: "Design Power BI reports",
        min: 115,
      },
      {
        title: "Enhance Power BI report design for user experience",
        min: 96,
      },
      {
        title: "Perform analysis in Power BI",
        min: 67,
      },
    ],
    advice:
      'Build one report from monthly data you already work with. Then turn the monthly write-up into "open the report and say three sentences".',
  },
  {
    id: "c7",
    title: "Statistics & Probability",
    provider: "Khan Academy",
    level: "intermediate",
    language: "English",
    format: "Videos + exercises",
    selfPaced: true,
    durationMin: null,
    register: "not-required",
    url: "https://www.khanacademy.org/math/statistics-probability",
    skills: ["data-analysis", "critical-thinking"],
    match: {
      "data-analysis":
        'Understand distributions, averages and sampling error so a "nice-looking" dataset cannot fool you.',
      "critical-thinking":
        "Learn to question whether the sample and assumptions behind a conclusion hold up.",
    },
    intro:
      "Khan Academy course on descriptive statistics, probability and inferential statistics through videos with practice exercises. Free to browse, no registration.",
    outcomes: [
      "Summarise a dataset with descriptive statistics",
      "Grasp basic probability and random variables",
      "Read what confidence intervals and significance tests actually say",
    ],
    prereq: "Basic algebra; no programming.",
    chapters: null,
    advice:
      "Recompute every statistic you meet with numbers from your own work. It sharpens the questions you ask in meetings where data is quoted but shaky.",
  },
  {
    id: "c8",
    title: "Extending and Developing Your Thinking Skills",
    provider: "OpenLearn (The Open University)",
    level: "beginner",
    language: "English",
    format: "Reading",
    selfPaced: true,
    durationMin: 360,
    register: "not-required",
    url: "https://www.open.edu/openlearn/education-development/extending-and-developing-your-thinking-skills/content-section-0",
    skills: ["critical-thinking", "communication"],
    match: {
      "critical-thinking":
        "The course is built around asking good questions and organising and testing an argument.",
      communication:
        "Structuring ideas with diagrams, tables and outlines underpins both reporting and writing.",
    },
    intro:
      "Free OpenLearn course, 10 chapters, 6 hours as published by the provider. It covers flowcharts, mind maps and decision trees for organising thought, and treats questioning and argument as the core of high-quality thinking. You can start directly without registration.",
    outcomes: [
      "Feel more confident about improving how you learn",
      "Organise ideas with structured methods (hierarchies, diagrams, mind maps)",
      "Connect balanced argument with analysis and critical thinking",
    ],
    prereq: "None (provider lists no prerequisites; start directly).",
    chapters: [
      {
        title: "Overview",
        min: null,
      },
      {
        title: "Understanding the importance of thinking skills",
        min: null,
      },
      {
        title: "Different kinds of thinking",
        min: null,
      },
      {
        title: "A thinking disposition and the process of development",
        min: null,
      },
      {
        title: "Other people",
        min: null,
      },
      {
        title: "Questions",
        min: null,
      },
      {
        title: "Giving structure to thinking",
        min: null,
      },
      {
        title: "Analysis, argument and critical thinking",
        min: null,
      },
      {
        title: "Putting it all together",
        min: null,
      },
      {
        title: "Conclusion",
        min: null,
      },
    ],
    advice:
      'After each chapter, take a recent ad or report claim and write a three-line rebuttal using the course method. You are training the "ask why first" habit.',
  },
  {
    id: "c9",
    title: "Effective Communication in the Workplace",
    provider: "OpenLearn (The Open University)",
    level: "intermediate",
    language: "English",
    format: "Reading + reflection",
    selfPaced: true,
    durationMin: 1440,
    register: "not-required",
    url: "https://www.open.edu/openlearn/money-business/effective-communication-the-workplace/content-section-0",
    skills: ["communication"],
    match: {
      communication:
        "From listening and non-verbal cues to written communication and difficult conversations — the full workplace chain.",
    },
    intro:
      "Free OpenLearn course organised in 8 weeks, 24 hours as published. Covers verbal and non-verbal communication, written communication, and using communication skills in challenging, multicultural settings, with weekly reflection and improvement goals.",
    outcomes: [
      "Describe workplace communication types and when to use them",
      "Identify the concrete skills effective communication needs",
      "Understand how your communication shapes how others see you",
      "Stay effective in difficult situations (disagreement, bad news, emotion)",
      "Reflect on and keep improving how you communicate",
    ],
    prereq: "None; provider lists no prerequisites.",
    chapters: [
      {
        title: "Week 1: Why communication matters at work",
        min: null,
      },
      {
        title:
          "Week 2: Communication skills (listening, questioning, empathy, adaptability)",
        min: null,
      },
      {
        title: "Week 3: Understanding non-verbal communication",
        min: null,
      },
      {
        title:
          "Week 4: Verbal communication at work (meetings, presentations, networking)",
        min: null,
      },
      {
        title: "Week 5: Written communication (email, reports)",
        min: null,
      },
      {
        title: "Week 6: Handling challenging situations",
        min: null,
      },
      {
        title: "Week 7: Communication and diversity",
        min: null,
      },
      {
        title: "Week 8: The future of workplace communication",
        min: null,
      },
    ],
    advice:
      "Rewrite one important email for next week using the course structure: conclusion first, then reasons, then what you need the reader to do — and watch how replies change.",
  },
  {
    id: "c10",
    title: "Technical Writing One",
    provider: "Google",
    level: "unknown",
    language: "English",
    format: "Reading + exercises",
    selfPaced: true,
    durationMin: 120,
    register: "not-required",
    url: "https://developers.google.com/tech-writing/one",
    skills: ["communication", "digital-literacy"],
    match: {
      communication:
        "Turning complex content into readable text underpins reports, docs and explanations.",
      "digital-literacy":
        "Practise producing and maintaining documents in common formats like Markdown.",
    },
    intro:
      "Google Technical Writing One pre-course material: 13 units with per-unit time estimates totalling about 2 hours. Covers words, active voice and sentence length through paragraphs, audience and document organisation; the grammar, punctuation and Markdown units are optional.",
    outcomes: [
      "Write short sentences in active voice with clear structure",
      "Split long paragraphs into scannable structure",
      "Adjust detail and order for your audience",
      "Write maintainable documents in Markdown",
    ],
    prereq: "Not listed (aimed at people who write technical documentation).",
    chapters: [
      {
        title: "Introduction",
        min: 3,
      },
      {
        title: "Just enough grammar (optional)",
        min: 10,
      },
      {
        title: "Words",
        min: 10,
      },
      {
        title: "Active voice",
        min: 15,
      },
      {
        title: "Clear sentences",
        min: 10,
      },
      {
        title: "Short sentences",
        min: 20,
      },
      {
        title: "Lists and tables",
        min: 15,
      },
      {
        title: "Paragraphs",
        min: 10,
      },
      {
        title: "Audience",
        min: 10,
      },
      {
        title: "Documents",
        min: 10,
      },
      {
        title: "Punctuation (optional)",
        min: 5,
      },
      {
        title: "Markdown (optional)",
        min: null,
      },
      {
        title: "Summary",
        min: 2,
      },
    ],
    advice:
      "Pick a process you explain every day and write a one-page doc for it. Next time someone asks, send the doc — the most direct payoff.",
  },
  {
    id: "c11",
    title: "Computers and the Internet",
    provider: "Khan Academy",
    level: "unknown",
    language: "English",
    format: "Videos + exercises",
    selfPaced: true,
    durationMin: null,
    register: "not-required",
    url: "https://www.khanacademy.org/computing/computers-and-internet",
    skills: ["digital-literacy"],
    match: {
      "digital-literacy":
        "Connects computing, internet and security fundamentals so scattered hands-on experience starts to fit together.",
    },
    intro:
      "Khan Academy basics course: how computers work, the internet, network protocols and online safety. Free to browse, no registration.",
    outcomes: [
      "Explain how computers and the internet basically work",
      "Understand networks and data transfer basics",
      "Know common online security and privacy risks",
    ],
    prereq: "None.",
    chapters: null,
    advice:
      'While learning, build your own "tools and accounts list": which task goes to which tool, how accounts are managed. That list is a workplace asset.',
  },
  {
    id: "c12",
    title: "Get Started with AI on Azure",
    provider: "Microsoft Learn",
    level: "beginner",
    language: "Chinese",
    format: "Blended (videos + hands-on labs)",
    selfPaced: true,
    durationMin: 337,
    register: "not-required",
    url: "https://learn.microsoft.com/zh-cn/training/paths/get-started-with-artificial-intelligence-on-azure/",
    skills: ["ai-literacy", "digital-literacy"],
    match: {
      "ai-literacy":
        "Clarifies AI workload types and boundaries (generative AI, text, speech, vision, information extraction) and builds judgment about AI output; provider notes it prepares for the AI-901 fundamentals credential.",
      "digital-literacy":
        "See how AI capabilities plug into daily workflows and systems.",
    },
    intro:
      "Microsoft Learn path: get started with AI workloads and solutions. Provider marks it beginner, 7 modules, about 5 hr 37 min; prerequisites are basic computing concepts and Python.",
    outcomes: [
      "Describe how AI applications are built on Azure",
      "Tell apart generative AI, text analytics, speech and computer vision workloads",
      "Understand basics of knowledge retrieval and agents",
      "Finish hands-on exercises and knowledge checks",
    ],
    prereq:
      "Provider note: basic understanding of computing concepts and Python before starting.",
    chapters: [
      {
        title: "Get started with AI on Azure",
        min: 56,
      },
      {
        title: "Generative AI and agents on Azure",
        min: 58,
      },
      {
        title: "Text analysis on Azure",
        min: 45,
      },
      {
        title: "Speech on Azure",
        min: 47,
      },
      {
        title: "Computer vision on Azure",
        min: 50,
      },
      {
        title: "AI-powered information extraction on Azure",
        min: 43,
      },
      {
        title: "Get started with Microsoft Foundry IQ",
        min: 38,
      },
    ],
    advice:
      "Pick one repetitive writing task you do weekly, do it once with AI help, and note the time saved and what still needed human checking.",
  },
  {
    id: "c13",
    title: "Machine Learning with Python (Certification)",
    provider: "freeCodeCamp",
    level: "advanced",
    language: "English",
    format: "Reading + hands-on projects",
    selfPaced: true,
    durationMin: null,
    register: "required",
    url: "https://www.freecodecamp.org/learn/machine-learning-with-python/",
    skills: ["ai-literacy", "data-analysis"],
    match: {
      "ai-literacy":
        "Build neural networks yourself in TensorFlow — machine learning stops being a concept and becomes code you can run.",
      "data-analysis":
        "Extend data handling into modelling and prediction with one small end-to-end analysis.",
    },
    intro:
      "freeCodeCamp certification with TensorFlow (32 exercises), How Neural Networks Work (4 exercises) and 5 hands-on projects (rock-paper-scissors, cat vs dog image classifier, text classifier). Total hours not published; a free freeCodeCamp account saves progress.",
    outcomes: [
      "Build and train neural networks in TensorFlow",
      "Understand basics of deep, recurrent and convolutional networks",
      "Complete intro NLP and reinforcement learning exercises",
      "Finish 5 certification projects independently",
    ],
    prereq:
      "Python required; neural networks and TensorFlow — some data analysis and basic ML concepts recommended.",
    chapters: [
      {
        title: "TensorFlow (32 exercises)",
        min: null,
      },
      {
        title: "How Neural Networks Work (4 exercises)",
        min: null,
      },
      {
        title: "Machine Learning with Python Projects (5 projects)",
        min: null,
      },
    ],
    advice:
      "Skip straight to the certification projects. Finishing something like the cat-vs-dog classifier makes your sense of model limits far more real.",
  },
  {
    id: "c14",
    title: "Advanced SQL",
    provider: "Kaggle Learn",
    level: "advanced",
    language: "English",
    format: "Interactive exercises",
    selfPaced: true,
    durationMin: 240,
    register: "required",
    url: "https://www.kaggle.com/learn/advanced-sql",
    skills: ["data-analysis"],
    match: {
      "data-analysis":
        'Push from "pulling numbers" to multi-table joins and within-group calculation for more complex metrics.',
    },
    intro:
      "Kaggle Learn Advanced SQL: 4 lessons on joins, analytic functions and query efficiency. Provider states about 4 hours to the certificate.",
    outcomes: [
      "Combine tables with JOINs and UNIONs",
      "Do complex within-group calculations with analytic functions",
      "Query nested and repeated data",
      "Write faster queries that scan less data",
    ],
    prereq: "Intro to SQL first (provider notes it builds on Intro to SQL).",
    chapters: [
      {
        title: "JOINs and UNIONs",
        min: null,
      },
      {
        title: "Analytic Functions",
        min: null,
      },
      {
        title: "Nested and Repeated Data",
        min: null,
      },
      {
        title: "Writing Efficient Queries",
        min: null,
      },
    ],
    advice:
      "Take one metric you always ask a data colleague for and write the query yourself. Independent data pulls end most of the queueing.",
  },
  {
    id: "c15",
    title: "Project Management: The Start of the Project Journey",
    provider: "OpenLearn (The Open University)",
    level: "intermediate",
    language: "English",
    format: "Reading",
    selfPaced: true,
    durationMin: 2100,
    register: "not-required",
    url: "https://www.open.edu/openlearn/money-business/leadership-management/project-management-the-start-the-project-journey/content-section-0",
    skills: ["project-management"],
    match: {
      "project-management":
        "Covers what a project is, feasibility studies, decisions and the life cycle — good for a first small project of your own.",
    },
    intro:
      "Free OpenLearn course, 5 chapters on what projects are, key roles (including the project manager), feasibility studies, decisions and the project life cycle. Provider states 35 hours of learning.",
    outcomes: [
      "Explain what a project is",
      "Understand the role of risk in projects",
      "List the key questions decision makers should ask",
      "Describe the main activities and tasks of a project manager",
      "Tell phased development, prototyping and agile methods apart",
    ],
    prereq: "None; provider lists no prerequisites.",
    chapters: [
      {
        title: "1 Conception: starting the project journey",
        min: null,
      },
      {
        title: "2 Feasibility: the feasibility study",
        min: null,
      },
      {
        title: "3 Making decisions",
        min: null,
      },
      {
        title: "4 Life cycle, project managers and project success",
        min: null,
      },
      {
        title: "5 Software development",
        min: null,
      },
    ],
    advice:
      "Use something you are driving right now as the exercise: write the goal and risks first, then check them against the course feasibility approach.",
  },
];
