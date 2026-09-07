import type { LearningCentreItem } from '@/pages/Skills/skillDirections';
import type { Resource, Selection } from './resources';

export const demoThemes: LearningCentreItem[] = [
  { theme_id: 'demo-critical', skill_id: 1, skill_name: 'Analytical thinking', direction: 'strengthen', title: 'Evaluate AI-generated information', description: 'Learn to check facts, spot unsupported claims and make confident decisions with AI-generated content.', why_relevant: 'You selected preparing reports and reviewing information as regular work tasks. These skills help you check the quality of an AI-assisted draft.', added_at: '2026-09-07' },
  { theme_id: 'demo-communication', skill_id: 2, skill_name: 'Communication', direction: 'keep_building', title: 'Communicate clearly at work', description: 'Turn complex information into clear messages and build confidence in everyday workplace conversations.', why_relevant: 'Your example work profile includes sharing updates with colleagues and responding to customer questions.', added_at: '2026-09-07' },
  { theme_id: 'demo-digital', skill_id: 3, skill_name: 'Digital literacy', direction: 'use_with_ai', title: 'Build an AI-assisted workflow', description: 'Use practical prompts to organise information and draft routine content, while keeping human review in the process.', why_relevant: 'Try small improvements to your example tasks of organising notes and preparing weekly updates.', added_at: '2026-09-07' },
];
const entries: [string, string, string, string, 'Module' | 'Course', number][] = [
  ['fact-check', 'A practical guide to checking AI answers', 'Practise checking claims against reliable sources before using an AI answer in a work report.', 'analytical', 'Module', 20],
  ['bias', 'Spot assumptions, bias and missing evidence', 'Recognise the questions to ask when a confident-sounding answer lacks supporting evidence.', 'analytical', 'Course', 45],
  ['decisions', 'Make evidence-based decisions', 'Compare two recommendations and explain which one is better supported by the available information.', 'analytical', 'Module', 30],
  ['messages', 'Write clear and concise workplace messages', 'Structure an update so your reader can quickly understand the context and next action.', 'communication', 'Module', 15],
  ['listening', 'Listen, clarify and respond', 'Practise questions that help you understand another person’s needs before responding.', 'communication', 'Course', 40],
  ['presenting', 'Explain an idea with confidence', 'Build a short, audience-focused explanation of a complex topic.', 'communication', 'Module', 25],
  ['prompts', 'Write your first useful work prompt', 'Give an AI assistant a clear task, helpful context and a useful output format.', 'digital', 'Module', 20],
  ['workflow', 'From meeting notes to an action list', 'Explore an example workflow for organising notes and reviewing AI-generated actions.', 'digital', 'Course', 60],
  ['review', 'Create a human review checklist', 'Decide what needs to be checked before AI-assisted work is shared with others.', 'digital', 'Module', 15],
];
export const demoResources: Resource[] = entries.map(([id, title, summary, tag, format, minutes]) => ({
  id: `demo-${id}`, title, summary, tags: [tag], format, minutes, provider: 'Demo Learning Studio', url: '',
  access: 'Fictional resource for previewing this page. No external course, registration or payment is available.',
}));
export const demoSelections: Selection[] = [
  {resourceId: 'demo-fact-check', themeTitle: demoThemes[0].title, skillName: demoThemes[0].skill_name, addedAt: '2026-09-07'},
  {resourceId: 'demo-prompts', themeTitle: demoThemes[2].title, skillName: demoThemes[2].skill_name, addedAt: '2026-09-07'},
];
