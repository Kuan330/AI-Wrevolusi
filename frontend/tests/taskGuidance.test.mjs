import test from 'node:test';
import assert from 'node:assert/strict';
import { taskGuidance } from '../src/pages/AIExposure/lib/taskGuidance.ts';

test('pricing and promotion intent takes precedence over incidental budgets and records', () => {
  const guidance = taskGuidance({ wording: 'Determining price lists, discount and delivery terms, sales promotion budgets, sales methods, special incentives and campaigns;' });
  assert.equal(guidance.title, 'Pricing and sales planning');
  assert.match(guidance.review, /pricing/);
  assert.equal(taskGuidance({ wording: 'Planning special marketing programmes based on sales records' }).title, 'Pricing and sales planning');
  assert.equal(taskGuidance({ wording: 'Budgeting and maintaining stock and financial records' }).title, 'Records and budgeting');
});

test('full task and working context remain in the prompt', () => {
  const wording = 'A specialist task description that is too long to fit into a compact task card title without wrapping onto many lines';
  const guidance = taskGuidance({ wording, notes: 'Use the approved internal template.' });
  assert.ok(guidance.title.length <= 80);
  assert.ok(guidance.prompt.includes(wording));
  assert.ok(guidance.prompt.includes('Use the approved internal template.'));
});

test('developing safety procedures does not become software development advice', () => {
  const guidance = taskGuidance({wording: 'Developing and monitoring safety standards for marine survey work'});
  assert.doesNotMatch(guidance.help, /code changes/);
  assert.match(taskGuidance({wording:'Developing software test cases'}).help, /code changes/);
});

test('engineering guidance separates drafting, measurement checks and physical work', () => {
  assert.match(taskGuidance({wording:'Preparing detailed estimates of quantities and costs of materials and labour'}).review,/quantities, rates, units/);
  assert.match(taskGuidance({wording:'Review test results and explain unusual readings'}).review,/instrument reliability/);
  assert.match(taskGuidance({wording:'Assemble and install mechanical components'}).help,/cannot carry out the physical installation/);
});

test('software testing takes precedence over the software business domain', () => {
  const task = { wording: 'I test accounting software and write automated tests.', notes: 'I use Python and Playwright. I do not prepare financial accounts.' };
  assert.equal(taskGuidance(task).title, 'Software testing and development');
  assert.doesNotMatch(taskGuidance(task).review, /financial|stock|approve.*price/i);
  assert.equal(taskGuidance({wording:'Maintain financial records using accounting software'}).title, 'Records and budgeting');
  assert.equal(taskGuidance({wording:'Maintain financial records. I do not write automated tests.'}).title, 'Records and budgeting');
});

test('saved context clarifies a vague testing task without classifying by tool alone', () => {
  assert.equal(taskGuidance({wording:'I review tests',notes:'Run unit tests with Python and Playwright.'}).title, 'Software testing and development');
  assert.equal(taskGuidance({wording:'I maintain stock records',notes:'Use accounting software.'}).title, 'Records and budgeting');
  assert.equal(taskGuidance({wording:'Review test results and explain unusual readings',notes:'I use Python for summaries.'}).title, 'Reviewing test results');
  assert.notEqual(taskGuidance({wording:'I test chemical samples',notes:'I use Python for summaries.'}).title, 'Software testing and development');
  assert.notEqual(taskGuidance({wording:'Review unusual readings',notes:'I do not use Python or Playwright.'}).title, 'Software testing and development');
});

test('sales data analysis does not become customer-facing sales advice', () => {
  assert.equal(taskGuidance({ wording: 'Analyse sales data and prepare reports' }).title,'Data analysis and reporting');
  assert.equal(taskGuidance({ wording: 'Analyzing customer data' }).title,'Data analysis and reporting');
});

test('ICT task families receive specific, ordered guidance', () => {
  const cases = [
    ["Evaluate technology needs and recommend system upgrades", /technology needs/i, /fitness for purpose|stakeholder impact/i],
    ["Oversee ICT security controls and incident compliance", /security oversight/i, /protect sensitive information|assess risk/i],
    ["Set ICT operations workflow priorities for service delivery", /operations and priorities/i, /set priorities|operational risk/i],
    ["Select and deploy ICT resources, then train users", /selecting and deploying/i, /authorise changes|approve selection/i],
    ["Maintain operational and administrative procedures", /operational and administrative/i, /approvals, records|responsibility/i],
    ["Develop the ICT strategy and technology roadmap", /strategy and planning/i, /set the strategy|organisational trade-offs/i],
    ["Consult with users, management, vendors and technicians", /consultation with stakeholders/i, /listen to people|requirements/i],
    ["Develop software and write automated unit tests", /software testing and development/i, /expected behaviour|test coverage/i],
  ];
  const seen = new Set();
  for (const [wording, title, review] of cases) {
    const guidance = taskGuidance({ wording });
    assert.match(guidance.title, title);
    assert.match(guidance.review, review);
    assert.ok(guidance.help.length > 40);
    seen.add(`${guidance.help}|${guidance.review}`);
  }
  assert.equal(seen.size, cases.length);
});

test('fallback guidance carries the selected task wording instead of using one generic message', () => {
  const first = taskGuidance({ wording: 'Coordinate archival handover for the regional project' });
  const second = taskGuidance({ wording: 'Inspect the public display before opening the venue' });
  assert.match(first.help, /Coordinate archival handover/i);
  assert.match(second.review, /Inspect the public display/i);
  assert.notEqual(`${first.help}|${first.review}`, `${second.help}|${second.review}`);
});

test('business-services management tasks use semantically distinct guidance families', () => {
  const cases = [
    ['Developing and implementing administrative and procedural statements and guidelines for use by staff in the organization;', 'Administrative policy and procedure design', /policy draft structure|roles and hand-offs/i, /policy intent|obligations/i],
    ['Providing information and support for the preparation of financial reports and budgets;', 'Financial reporting preparation', /reporting outline|source schedules/i, /accounting treatment|disclosures/i],
    ['Analysing complex resource management issues and initiatives that affect the organization, and preparing associated reports, correspondence and submissions;', 'Resource-management analysis', /options paper|issue evidence/i, /operational consequences|evidence quality/i],
    ["Developing and managing the organization's administrative and physical resources;", 'Administrative and physical resource management', /asset or facilities action plan|maintenance requests/i, /safety impacts|allocated/i],
    ['Leading, managing and developing administrative staff to ensure smooth business operations and the provision of accurate and timely information;', 'Administrative staff leadership', /workload handover|development goals/i, /staffing decisions|sensitive conversations/i],
    ['Representing the enterprise or organization in negotiations, and at conventions, seminars, public hearings and forums;', 'Organisational representation and negotiation', /briefing pack|agreed positions/i, /make commitments|represent the organisation/i],
    ['Establishing and managing budgets, controlling expenditure and ensuring the efficient use of resources;', 'Budget and expenditure control', /budget lines|material variances/i, /control expenditure|value for money/i],
    ['Planning and directing daily operations;', 'Daily operational planning', /shift or daily run-sheet|handover summary/i, /direct daily work|operational decisions/i],
    ['Providing administrative, strategic planning and operational support, research and advice to senior management on matters such as the management of building facilities and administrative services;', 'Strategic and management advice', /decision brief|senior-management consideration/i, /organisational priorities|decision-makers/i],
    ['Overseeing the selection, training and performance of staff.', 'Staff selection, training and performance', /interview questions|training plan/i, /employment and performance decisions|legal obligations/i],
  ];
  const pairs = new Set();
  for (const [wording, title, help, review] of cases) {
    const guidance = taskGuidance({ wording });
    assert.equal(guidance.title, title);
    assert.match(guidance.help, help);
    assert.match(guidance.review, review);
    assert.doesNotMatch(guidance.help, /For “.*”, AI may help draft a checklist, summary or small planning step/i);
    pairs.add(`${guidance.help}|${guidance.review}`);
  }
  assert.equal(pairs.size, cases.length);
});
