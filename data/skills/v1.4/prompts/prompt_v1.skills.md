# WEF Skill Handbook v1.4

## WEF-01 | Analytical thinking
Definition: The ability to examine information, identify patterns or problems, compare alternatives, investigate causes, and draw conclusions based on evidence.
Inclusion: • Compare data, options, or outcomes
• Identify patterns, trends, or anomalies
• Investigate causes of a problem
• Evaluate evidence before making a decision
• Interpret information rather than only collect it
Exclusion: • Copying or entering data without interpretation
• Following a fixed checklist without judgment
• Formatting an existing report without analysing its content
• Sending or collecting information only
Insufficient context: Return insufficient_context=true when the task mentions data or reports but no analysis verb (compare, investigate, evaluate, interpret). Do not infer analysis from the word 'report' alone.
Confusions:
- vs WEF-12: Use Analytical thinking for evidence, patterns, comparisons, and causes. Use Systems thinking when the focus is how multiple parts of a system interact.
- vs WEF-15: Use Analytical thinking to interpret evidence or diagnose causes. Use Quality control to check work against a defined standard.
Examples:
- [positive] Compare monthly sales performance and explain unusual changes.
- [positive] Analyse customer complaint data to identify recurring service issues.
- [negative] Copy daily sales figures into the reporting template.

## WEF-02 | Resilience, flexibility and agility
Definition: The ability to adapt to changing circumstances, recover from setbacks, and adjust approaches in response to new challenges, uncertainty, or stress.
Inclusion: • The task requires adapting to unexpected changes or disruptions
• The task involves working under uncertainty or ambiguity
• The task requires recovering from failures or setbacks
• The task demands switching between different priorities or methods
• The task involves working in volatile or high-pressure environments
Exclusion: • The task follows a completely predictable and stable routine
• The user only executes tasks with clear, unchanging instructions
• The task involves no exposure to change, pressure, or uncertainty
• The user is performing work in a fully controlled environment
Insufficient context: Return insufficient_context=true when the task says work is busy or challenging without describing actual change, pressure, or recovery.
Confusions:
- vs WEF-05: Resilience is about adapting to external change and recovering. Motivation is about internal drive and self-understanding.
- vs WEF-14: Resilience requires adapting under pressure. Dependability is about consistent, accurate execution regardless of pressure.
Examples:
- [positive] Switch to a backup vendor within 24 hours after the main supplier missed the deadline.
- [positive] Continue serving customers calmly during a prolonged system outage and keep the team updated.
- [negative] Process passport applications using the same checklist every weekday.

## WEF-03 | Leadership and social influence
Definition: The ability to guide, motivate, and inspire others, build consensus, and influence stakeholders to achieve shared goals.
Inclusion: • The task requires guiding, directing, or coordinating a team
• The task involves persuading or influencing stakeholders
• The task requires motivating others toward a common goal
• The task involves making decisions that affect a group
• The task requires building consensus or resolving group conflicts
Exclusion: • The task is performed entirely independently with no team interaction
• The user only reports information upward without influencing decisions
• The task involves following someone else's direction without leading
• The user provides input but has no role in shaping group outcomes
Insufficient context: Return insufficient_context=true when the task mentions a team but does not say the person directs, influences, or aligns others.
Confusions:
- vs WEF-16: Leadership is about direction and influence. Teaching is about developing individual skills.
- vs WEF-09: Leadership focuses on guiding the current team. Talent management focuses on attracting, retaining, and developing workforce capacity.
Examples:
- [positive] Convince the cross-functional team to adopt a shared project timeline.
- [positive] Rally the customer service team to meet the month-end target after a slow start.
- [negative] Submit my individual weekly timesheet to HR.

## WEF-04 | Creative thinking
Definition: The ability to generate novel ideas, approaches, or solutions, and to apply imagination and originality to solve problems or create value.
Inclusion: • The task requires generating new ideas or solutions
• The task involves designing something that does not yet exist
• The task requires finding unconventional approaches to a problem
• The task involves brainstorming or ideation
• The task requires combining existing concepts in new ways
Exclusion: • The task involves only applying established procedures or templates
• The user is reproducing existing designs without modification
• The task requires strict compliance with fixed specifications
• The user is copying or replicating work without original input
Insufficient context: Return insufficient_context=true when the task asks for output but gives no signal of originality, ideation, or new approach.
Confusions:
- vs WEF-18: Creative thinking is broad idea generation. Design applies creative ideas to solve specific user problems with usability constraints.
- vs WEF-20: Creative thinking generates ideas. Marketing applies those ideas to promote and reach audiences.
Examples:
- [positive] Design three alternative onboarding formats for remote interns.
- [positive] Come up with a low-cost campaign idea to promote the new organic product line.
- [negative] Apply the company's standard invoice template to this month's billing.

## WEF-05 | Motivation and self-awareness
Definition: The ability to understand one's own strengths and weaknesses, manage one's emotions and behaviour, and maintain drive and commitment toward goals.
Inclusion: • The task requires self-reflection or evaluating one's own performance
• The task involves managing personal emotions in a work context
• The task requires setting and pursuing personal development goals
• The task involves recognising one's own limitations and seeking improvement
• The task requires sustaining effort and commitment over time
Exclusion: • The task is externally mandated with no personal initiative required
• The user performs tasks without any need for self-assessment
• The task involves no emotional or interpersonal dimension
• The user is simply following orders without internal engagement
Insufficient context: Return insufficient_context=true when the task is externally mandated with no sign of self-reflection, emotion management, or personal drive.
Confusions:
- vs WEF-08: Motivation is about internal drive and self-knowledge. Curiosity is about the desire to learn new things.
- vs WEF-02: Motivation is internal drive. Resilience is recovering from external setbacks.
Examples:
- [positive] Reflect on last quarter's feedback and set three personal improvement goals.
- [positive] Recognise that delegation is a weakness and ask the supervisor for coaching.
- [negative] Complete the assigned data entry because the manager told me to.

## WEF-06 | Technological literacy
Definition: The ability to understand, select, and use digital tools, software, and technologies effectively to accomplish work tasks.
Inclusion: • The task requires using digital tools or software platforms
• The task involves selecting appropriate technology for a given purpose
• The task requires understanding how digital systems work
• The task involves troubleshooting basic technology issues
• The task requires staying current with relevant digital tools
Exclusion: • The task involves only manual or analog methods with no technology
• The user operates technology by rote without understanding it
• The task requires no selection or judgment about which tools to use
• The user is following technology instructions without comprehension
Insufficient context: Return insufficient_context=true when the task only names a software without describing selection, understanding, or troubleshooting.
Confusions:
- vs WEF-23: Technological literacy is using and selecting digital tools. Programming is writing code.
- vs WEF-11: Technological literacy is general tool competence. AI and big data involves advanced analytics and machine learning.
Examples:
- [positive] Choose between two project management apps for the team's remote collaboration.
- [positive] Troubleshoot why the shared printer keeps disconnecting from the network.
- [negative] Type meeting notes into a word processor.

## WEF-07 | Empathy and active listening
Definition: The ability to understand others' perspectives, emotions, and needs, and to listen attentively and respond appropriately in interpersonal interactions.
Inclusion: • The task requires understanding a customer's or colleague's feelings
• The task involves listening carefully to others' concerns or needs
• The task requires responding compassionately to interpersonal situations
• The task involves building trust through genuine understanding
• The task requires recognising non-verbal cues and emotional states
Exclusion: • The task involves only transactional exchanges without emotional engagement
• The user delivers scripted responses without adapting to the listener
• The task requires no understanding of the other person's perspective
• The user is simply relaying information without interpersonal sensitivity
Insufficient context: Return insufficient_context=true when the task involves people but shows no listening, perspective-taking, or emotional response.
Confusions:
- vs WEF-10: Empathy is understanding emotions. Service orientation is about delivering helpful service.
- vs WEF-16: Empathy helps teaching, but teaching also requires structured skill transfer.
Examples:
- [positive] Listen to an upset customer, acknowledge her frustration, and propose a fair resolution.
- [positive] Notice that a teammate seems overwhelmed and offer to redistribute tasks.
- [negative] Read the customer complaint aloud from a script.

## WEF-08 | Curiosity and lifelong learning
Definition: The ability and willingness to continuously seek new knowledge, acquire new skills, and adapt one's understanding in response to changing contexts.
Inclusion: • The task requires learning new concepts, tools, or methods
• The task involves actively seeking information beyond what is required
• The task requires updating existing knowledge or skills
• The task involves exploring unfamiliar topics or domains
• The task requires asking questions and pursuing deeper understanding
Exclusion: • The task relies entirely on existing knowledge with no new learning
• The user performs repetitive work without seeking improvement
• The task involves no exploration or inquiry beyond immediate requirements
• The user is resistant to updating methods or acquiring new skills
Insufficient context: Return insufficient_context=true when the task uses existing knowledge only, with no learning, exploration, or inquiry.
Confusions:
- vs WEF-06: Curiosity drives learning. Technological literacy is the resulting competence with tools.
- vs WEF-02: Curiosity is about seeking knowledge. Resilience is about adapting to change.
Examples:
- [positive] Spend a weekend learning the new data visualisation tool before the training session.
- [positive] Ask follow-up questions in the workshop to understand how AI could help the team.
- [negative] Use the same Excel formula every month because it still works.

## WEF-09 | Talent management
Definition: The ability to attract, develop, retain, and deploy people with the right skills to meet organisational needs.
Inclusion: • The task involves recruiting, hiring, or onboarding staff
• The task requires identifying skill gaps and development needs
• The task involves succession planning or career pathing
• The task requires coaching or developing team members' capabilities
• The task involves workforce planning or talent allocation
Exclusion: • The task involves managing projects or resources without people focus
• The user only performs their own individual work
• The task requires no decisions about other people's careers or growth
• The user coordinates tasks but does not develop people
Insufficient context: Return insufficient_context=true when the task coordinates people's work but involves no hiring, skill-gap, retention, or career decision.
Confusions:
- vs WEF-03: Talent management develops workforce capacity. Leadership guides people day-to-day.
- vs WEF-16: Talent management plans development at organisational level. Teaching is direct skill transfer.
Examples:
- [positive] Interview candidates for the new customer service associate positions.
- [positive] Identify skill gaps in the marketing team and recommend a training plan.
- [negative] Assign tasks to team members based only on current workload.

## WEF-10 | Service orientation and customer service
Definition: The ability to understand customer needs, provide helpful and responsive support, and ensure positive experiences for clients or users.
Inclusion: • The task involves directly assisting customers or clients
• The task requires anticipating customer needs and proactively helping
• The task involves resolving customer complaints or issues
• The task requires maintaining positive customer relationships
• The task involves gathering customer feedback to improve service
Exclusion: • The task involves internal operations with no customer interaction
• The user performs back-end work invisible to customers
• The task requires no understanding of customer needs or satisfaction
• The user only processes requests mechanically without service mindset
Insufficient context: Return insufficient_context=true when the task is internal or back-end with no customer interaction or service intent.
Confusions:
- vs WEF-07: Service orientation is about helpful action. Empathy is emotional understanding.
- vs WEF-20: Service supports existing customers. Marketing attracts new customers.
Examples:
- [positive] Greet walk-in customers warmly and guide them to the right counter.
- [positive] Anticipate that a regular client might need early check-in and arrange it in advance.
- [negative] Hand a customer the form without explaining how to fill it.

## WEF-11 | AI and big data
Definition: The ability to work with artificial intelligence tools, machine learning concepts, and large-scale data analytics to derive insights and automate processes.
Inclusion: • The task requires using AI tools or machine learning models
• The task involves analysing large datasets using advanced analytics
• The task requires understanding AI capabilities and limitations
• The task involves training, tuning, or deploying AI systems
• The task requires deriving insights from complex or unstructured data
Exclusion: • The task involves only basic data entry or simple spreadsheet work
• The user uses standard software without any AI or analytics component
• The task requires no understanding of data science or AI concepts
• The user performs routine reporting without advanced analysis
Insufficient context: Return insufficient_context=true when the task involves basic data handling or routine reporting with no AI, model, or advanced analytics component.
Confusions:
- vs WEF-23: AI focuses on data-driven models. Programming is general code writing.
- vs WEF-01: AI uses algorithms on large data. Analytical thinking is human reasoning with evidence.
Examples:
- [positive] Use a machine learning model to predict next month's demand for childcare slots.
- [positive] Use a machine-learning churn model on large-scale loyalty-app behaviour data to identify customers at risk of leaving.
- [negative] Export the monthly report from the CRM.

## WEF-12 | Systems thinking
Definition: The ability to understand how different parts of a system interact, identify feedback loops, and recognise how changes in one area affect the whole.
Inclusion: • The task requires understanding interactions between multiple components
• The task involves identifying feedback loops or cascading effects
• The task requires seeing the big picture rather than isolated parts
• The task involves mapping or modelling complex processes
• The task requires predicting unintended consequences of changes
Exclusion: • The task involves only a single, isolated step or component
• The user executes tasks without understanding broader context
• The task requires no consideration of interdependencies
• The user follows a linear procedure without seeing systemic connections
Insufficient context: Return insufficient_context=true when the task involves a single isolated step with no interdependency or cascading effect described.
Confusions:
- vs WEF-01: Systems thinking sees interconnections. Analytical thinking breaks down evidence.
- vs WEF-13: Systems thinking understands interactions. Resource management allocates specific resources.
Examples:
- [positive] Map how delayed supplier payments affect inventory, staffing, and customer satisfaction.
- [positive] Model the flow of patients from registration to discharge to find bottlenecks.
- [negative] Compare this month's sales to last month's sales.

## WEF-13 | Resource management and operations
Definition: The ability to plan, allocate, and optimise resources—including time, money, materials, and people—to achieve operational efficiency and organisational goals.
Inclusion: • The task requires budgeting, scheduling, or allocating resources
• The task involves optimising processes for efficiency
• The task requires managing supply chains or logistics
• The task involves capacity planning or workload balancing
• The task requires tracking and controlling operational costs
Exclusion: • The task involves only executing work without planning resources
• The user performs tasks without any allocation or scheduling responsibility
• The task requires no consideration of cost, time, or material constraints
• The user follows a pre-set plan without managing the resources behind it
Insufficient context: Return insufficient_context=true when the person executes work but makes no scheduling, budgeting, or allocation decision.
Confusions:
- vs WEF-15: Resource management allocates resources. Quality control checks outputs against standards.
- vs WEF-09: Resource management allocates people as resources. Talent management develops them.
Examples:
- [positive] Schedule staff shifts for the retail store to cover peak hours without exceeding budget.
- [positive] Reorder stock based on predicted demand and warehouse capacity.
- [negative] Serve customers at the counter during my assigned shift.

## WEF-14 | Dependability and attention to detail
Definition: The ability to be reliable, consistent, and thorough in completing tasks, ensuring accuracy and meeting commitments without close supervision.
Inclusion: • The task requires high accuracy and careful checking of work
• The task involves meeting deadlines and keeping commitments reliably
• The task requires following precise instructions or specifications
• The task involves detecting errors, omissions, or inconsistencies
• The task requires maintaining standards over repetitive work
Exclusion: • The task allows for approximate or rough completion
• The user performs work without any need for verification or checking
• The task involves creative or exploratory work where precision is not required
• The user is intentionally prototyping or drafting rather than finalising
Insufficient context: Return insufficient_context=true when the task allows rough output, or is exploratory drafting where precision is not expected.
Confusions:
- vs WEF-15: Dependability is personal reliability. Quality control is checking outputs against standards.
- vs WEF-23: Programming often requires precision, but it is a technology skill.
Examples:
- [positive] Double-check every passport application form for missing signatures before submission.
- [positive] Submit the weekly payroll report on time for six consecutive months.
- [negative] Estimate quantities because exact numbers do not matter.

## WEF-15 | Quality control
Definition: The ability to inspect, test, and verify that outputs, processes, or services meet defined standards, specifications, and customer requirements.
Inclusion: • The task requires checking outputs against standards or specifications
• The task involves testing products, services, or processes for defects
• The task requires identifying deviations from quality requirements
• The task involves conducting audits or compliance checks
• The task requires documenting and reporting quality issues
Exclusion: • The task involves creating or designing outputs without inspecting them
• The user performs work without any verification or testing step
• The task requires only subjective opinion without defined standards
• The user is analysing trends rather than checking specific outputs
Insufficient context: Return insufficient_context=true when the task creates or analyses outputs without any inspection, testing, or standards comparison.
Confusions:
- vs WEF-14: Quality control checks against external standards. Dependability is a personal trait of reliability.
- vs WEF-01: Quality control verifies standards. Analytical thinking diagnoses causes.
Examples:
- [positive] Inspect finished garments against size and stitching standards.
- [positive] Test each batch of baked goods for temperature and texture before display.
- [negative] Analyse why defect rates increased over the past quarter.

## WEF-16 | Teaching and mentoring
Definition: The ability to help others learn, develop skills, and grow professionally through instruction, guidance, feedback, and coaching.
Inclusion: • The task involves training or instructing others in a skill
• The task requires providing feedback to help someone improve
• The task involves coaching or guiding a less experienced colleague
• The task requires designing learning materials or training sessions
• The task involves sharing expertise to develop others' capabilities
Exclusion: • The task involves only managing people's work without developing them
• The user delivers information once without follow-up or feedback
• The task requires no adaptation to the learner's needs or level
• The user is simply delegating tasks without teaching how to do them
Insufficient context: Return insufficient_context=true when the task assigns or informs others without developing their skills or checking understanding.
Confusions:
- vs WEF-10: Teaching develops skills. Service orientation helps customers.
- vs WEF-09: Teaching transfers skills to individuals. Talent management plans workforce development.
Examples:
- [positive] Show a new cashier how to handle returns and watch them practise.
- [positive] Coach an intern on how to structure a client email.
- [negative] Tell a new employee their daily to-do list.

## WEF-17 | Networks and cybersecurity
Definition: The ability to design, manage, and secure computer networks, protect systems from threats, and ensure data integrity and privacy.
Inclusion: • The task involves configuring or managing network infrastructure
• The task requires implementing security measures or protocols
• The task involves monitoring for security threats or vulnerabilities
• The task requires responding to cyber incidents or breaches
• The task involves ensuring data privacy and access controls
Exclusion: • The task involves only using networks without managing them
• The user performs general IT support without security focus
• The task requires no understanding of network architecture or threats
• The user is simply following security policies without technical implementation
Insufficient context: Return insufficient_context=true when the task only uses a network or follows security policy without technical security work.
Confusions:
- vs WEF-23: Networks focuses on infrastructure security. Programming is software development.
- vs WEF-06: Technological literacy includes basic security awareness. Networks is specialised.
Examples:
- [positive] Configure the office firewall to block unauthorised access.
- [positive] Monitor network logs for signs of a phishing attack.
- [negative] Connect my laptop to the office Wi-Fi.

## WEF-18 | Design and user experience
Definition: The ability to create user-centred designs for products, interfaces, or services, ensuring usability, accessibility, and aesthetic quality.
Inclusion: • The task involves creating visual or interactive designs
• The task requires researching user needs and behaviours
• The task involves prototyping or wireframing interfaces
• The task requires conducting usability testing
• The task involves improving accessibility or user satisfaction
Exclusion: • The task involves only implementing designs created by others
• The user makes arbitrary visual choices without user research
• The task requires no consideration of end-user needs
• The user is only doing graphic decoration without UX intent
Insufficient context: Return insufficient_context=true when the task implements someone else's design or decorates without user research or usability intent.
Confusions:
- vs WEF-04: Design applies creativity to user problems. Creative thinking is broader idea generation.
- vs WEF-20: Design is about user experience. Marketing is about promotion and reach.
Examples:
- [positive] Redesign the clinic appointment booking page to reduce confusion for elderly users.
- [positive] Prototype a mobile checkout flow and test it with five customers.
- [negative] Implement a UI exactly as provided by the designer.

## WEF-19 | Multi-lingualism
Definition: The ability to communicate effectively in multiple languages, adapting content and tone for different linguistic and cultural contexts.
Inclusion: • The task requires communicating in more than one language
• The task involves translating or localising content
• The task requires interpreting spoken or written language
• The task involves working across different cultural or linguistic contexts
• The task requires adapting messaging for multilingual audiences
Exclusion: • The task is performed entirely in a single language
• The user uses automated translation without human adaptation
• The task requires no cultural or linguistic sensitivity
• The user is simply copying text without language skills
Insufficient context: Return insufficient_context=true when the task is single-language, or uses machine translation without human adaptation.
Confusions:
- vs WEF-20: Multi-lingualism is language ability. Marketing is messaging strategy.
- vs WEF-10: Multi-lingualism enables service in multiple languages, but service is about help.
Examples:
- [positive] Translate the patient intake form into Mandarin and Malay for the local community.
- [positive] Interpret between the Korean supplier and the English-speaking procurement team.
- [negative] Use Google Translate to convert a memo without checking it.

## WEF-20 | Marketing and media
Definition: The ability to create, distribute, and manage content and campaigns that promote products, services, or ideas to target audiences.
Inclusion: • The task involves creating promotional or brand content
• The task requires managing advertising or media campaigns
• The task involves analysing audience engagement or market trends
• The task requires managing social media or public relations
• The task involves positioning products or services in the market
Exclusion: • The task involves only internal communication without promotion
• The user shares information without any marketing intent
• The task requires no understanding of audience or market
• The user is simply posting content without strategic purpose
Insufficient context: Return insufficient_context=true when the task shares information internally with no promotional intent or audience targeting.
Confusions:
- vs WEF-04: Marketing uses creative ideas strategically to reach audiences.
- vs WEF-10: Marketing attracts customers. Service supports existing customers.
Examples:
- [positive] Create a social media campaign to attract young mothers to the parenting workshop.
- [positive] Write a press release announcing the new sustainability initiative.
- [negative] Answer a customer's question about store location.

## WEF-21 | Reading, writing and mathematics
Definition: The ability to comprehend written information, communicate clearly through writing, and apply mathematical reasoning to solve problems.
Inclusion: • The task requires comprehending complex written documents
• The task involves producing clear, structured written communication
• The task requires performing calculations or mathematical reasoning
• The task involves interpreting numerical data or statistics
• The task requires using literacy or numeracy for decision-making
Exclusion: • The task involves only copying text without comprehension
• The user performs simple arithmetic with a calculator without reasoning
• The task requires no reading, writing, or calculation
• The user is only filling in templates without original composition
Insufficient context: Return insufficient_context=true when the task copies text or enters numbers without comprehension, composition, or reasoning.
Confusions:
- vs WEF-01: Reading/writing/math are foundational skills. Analytical thinking is higher-level reasoning.
- vs WEF-19: Reading/writing is about literacy. Multi-lingualism is about multiple languages.
Examples:
- [positive] Summarise the key points from a 20-page contract for the manager.
- [positive] Write a clear incident report after a workplace accident.
- [negative] Copy text from one document to another.

## WEF-22 | Environmental stewardship
Definition: The ability to understand environmental impacts, promote sustainable practices, and make decisions that minimise harm to the natural environment.
Inclusion: • The task requires assessing environmental impact or sustainability
• The task involves implementing green or eco-friendly practices
• The task requires compliance with environmental regulations
• The task involves reducing waste, emissions, or resource consumption
• The task requires educating others about environmental responsibility
Exclusion: • The task involves standard operations with no environmental consideration
• The user performs work without any sustainability awareness
• The task requires no knowledge of environmental issues
• The user is only following procedures that happen to be green
Insufficient context: Return insufficient_context=true when the task has no environmental consideration, even if the activity happens to be low-impact.
Confusions:
- vs WEF-25: Environmental stewardship focuses on nature. Global citizenship is broader social responsibility.
- vs WEF-13: Environmental stewardship may reduce resource use, but it is motivated by sustainability.
Examples:
- [positive] Assess the carbon footprint of the company's courier choices.
- [positive] Switch the office to reusable catering supplies for meetings.
- [negative] Order office supplies from the cheapest vendor.

## WEF-23 | Programming
Definition: The ability to write, debug, and maintain code in programming languages to build software, automate tasks, or solve computational problems.
Inclusion: • The task requires writing or modifying code in any programming language
• The task involves debugging or testing software
• The task requires automating tasks through scripts or programs
• The task involves developing algorithms or data structures
• The task requires maintaining or refactoring existing codebases
Exclusion: • The task involves only using software without writing code
• The user configures tools through graphical interfaces only
• The task requires no understanding of programming logic
• The user is copying code without comprehension of how it works
Insufficient context: Return insufficient_context=true when the task uses software, no-code tools, or copies code without understanding.
Confusions:
- vs WEF-11: Programming is general coding. AI is a specialised application.
- vs WEF-06: Programming creates software. Technological literacy uses existing tools.
Examples:
- [positive] Write a Python script to automate monthly invoice generation.
- [positive] Debug why the online form validation is failing for mobile users.
- [negative] Use Excel formulas to calculate monthly totals.

## WEF-24 | Manual dexterity, endurance and precision
Definition: The ability to perform physical tasks requiring fine motor control, sustained physical effort, and accurate hand-eye coordination.
Inclusion: • The task requires fine motor skills or hand-eye coordination
• The task involves sustained physical effort or stamina
• The task requires precise physical manipulation of tools or materials
• The task involves physical assembly, crafting, or repair work
• The task requires maintaining physical accuracy over repetitive actions
Exclusion: • The task is entirely mental or digital with no physical component
• The user operates machines that perform the physical work
• The task requires only gross motor movement without precision
• The user is supervising physical work without doing it
Insufficient context: Return insufficient_context=true when the task is digital, machine-operated, or only gross motor movement.
Confusions:
- vs WEF-26: Manual dexterity is physical execution. Sensory-processing is perception.
- vs WEF-15: Manual dexterity may be used in inspection, but quality control is about standards.
Examples:
- [positive] Assemble delicate jewellery pieces using small tools for eight hours.
- [positive] Sew intricate embroidery patterns on traditional garments.
- [negative] Type data into a spreadsheet.

## WEF-25 | Global citizenship
Definition: The ability to understand and act on responsibilities toward broader society, including ethical behaviour, diversity and inclusion, and awareness of global interdependencies.
Inclusion: • The task requires considering ethical implications of decisions
• The task involves promoting diversity, equity, or inclusion
• The task requires understanding global or cultural contexts
• The task involves social responsibility or community engagement
• The task requires navigating ethical dilemmas or conflicts of interest
Exclusion: • The task involves purely technical execution with no ethical dimension
• The user performs work without considering broader social impact
• The task requires no awareness of diversity or global context
• The user is following orders without questioning ethical implications
Insufficient context: Return insufficient_context=true when the task is purely technical or administrative with no ethical, diversity, or social dimension.
Confusions:
- vs WEF-22: Global citizenship is broad social/ethical responsibility. Environmental stewardship is specifically environmental.
- vs WEF-07: Global citizenship involves ethical action. Empathy is interpersonal understanding.
Examples:
- [positive] Review a supplier contract for ethical labour practices.
- [positive] Advocate for a more inclusive hiring process for women returning to work.
- [negative] File expense reports on time.

## WEF-26 | Sensory-processing abilities
Definition: The ability to perceive, interpret, and respond to sensory information such as visual, auditory, tactile, or olfactory stimuli in the work environment.
Inclusion: • The task requires detecting visual details or colour differences
• The task involves distinguishing sounds, tones, or auditory cues
• The task requires sensing tactile differences in materials or surfaces
• The task involves perceiving smells or tastes for quality or safety
• The task requires integrating multiple sensory inputs for decision-making
Exclusion: • The task relies entirely on instruments or sensors instead of human senses
• The user performs work where sensory input is irrelevant
• The task involves only data or abstract reasoning
• The user is operating equipment that automates sensory detection
Insufficient context: Return insufficient_context=true when detection is done by instruments or sensors rather than human senses.
Confusions:
- vs WEF-24: Sensory-processing is perceiving stimuli. Manual dexterity is acting on them.
- vs WEF-15: Sensory-processing can aid inspection, but quality control is standards-based.
Examples:
- [positive] Detect colour variations in fabric dye lots before production approval.
- [positive] Identify abnormal sounds from a production machine during routine checks.
- [negative] Use a digital scanner to check product barcodes.
