import { accountStorage } from "@/services/accountStorage";
export const skills = [
    { id: 'organisation', name: 'Organisation', learning: false, description: 'Bring people, tasks and timelines together so work can move forward.', evidence: ['Coordinate meeting times and agendas', 'Follow up on actions across a team'], contexts: ['Keeping project activities on track', 'Organising training sessions'], icon: 'calendar' },
    { id: 'communication', name: 'Communication', learning: false, description: 'Make information clear and adapt your message to the people receiving it.', evidence: ['Share updates with colleagues', 'Respond to everyday customer enquiries'], contexts: ['Explaining next steps to a customer', 'Keeping stakeholders informed'], icon: 'message' },
    { id: 'analysis', name: 'Analytical thinking', learning: false, description: 'Compare information, ask useful questions and explain your reasoning.', evidence: ['Check information before preparing a report', 'Compare records and flag inconsistencies'], contexts: ['Reviewing operational reports', 'Investigating a customer issue'], icon: 'brain' },
    { id: 'detail', name: 'Attention to detail', learning: false, description: 'Notice missing information and check that records are accurate and complete.', evidence: ['Maintain accurate records', 'Review documents before sharing them'], contexts: ['Maintaining project documentation', 'Checking service records'], icon: 'check' },
    { id: 'ai', name: 'AI collaboration', learning: true, description: 'Practise using AI for routine tasks while keeping human review in the process.', evidence: ['Example learning topic: write a useful work prompt', 'Example practice goal: review an AI-generated action list'], contexts: ['Drafting a first version of a team update', 'Organising notes for human review'], icon: 'sparkles' },
    { id: 'data', name: 'Data storytelling', learning: true, description: 'Practise turning a small dataset into a clear explanation for another person.', evidence: ['Example learning topic: explain a chart', 'Example practice goal: summarise a weekly trend'], contexts: ['Presenting a service trend', 'Communicating an operational insight'], icon: 'chart' },
];
export type Career = {
    id: string;
    title: string;
    area: string;
    intro: string;
    skillIds: string[];
    reason: string;
    learn: string;
    tasks: string[];
    tryIt: string;
};
export const careers: Career[] = [
    { id: 'project', title: 'Project coordinator', area: 'PLANNING & DELIVERY', intro: 'Help people stay aligned around a shared piece of work.', skillIds: ['organisation', 'communication', 'detail', 'ai'], reason: 'Arranging meetings and following up on actions can carry over into coordinating project activities.', learn: 'Project tracking methods and risk logs', tasks: ['Keep an action list and follow up on progress', 'Coordinate meetings and share updates', 'Maintain project documents'], tryIt: 'Imagine organising a small team event. List the tasks, owners and deadlines, then identify one potential delay.' },
    { id: 'training', title: 'Training coordinator', area: 'PEOPLE & LEARNING', intro: 'Help learning activities run smoothly for a group of people.', skillIds: ['organisation', 'communication', 'detail'], reason: 'Your example experience with schedules, records and clear messages connects with organising learning sessions.', learn: 'Learning administration and participant support', tasks: ['Arrange session logistics and invitations', 'Keep attendance and learning records', 'Answer participant questions'], tryIt: 'Plan a short workshop: draft an invitation, a simple schedule and a checklist of what participants need.' },
    { id: 'customer', title: 'Customer success coordinator', area: 'RELATIONSHIPS & SUPPORT', intro: 'Help customers understand next steps and get useful support.', skillIds: ['communication', 'analysis', 'organisation'], reason: 'Responding to enquiries and coordinating follow-up can also be useful in customer-facing support work.', learn: 'Product knowledge and customer support tools', tasks: ['Clarify customer questions', 'Coordinate follow-up with colleagues', 'Maintain notes on customer needs'], tryIt: 'Choose a fictional customer question. Draft a response that acknowledges the issue, clarifies the need and explains the next step.' },
    { id: 'operations', title: 'Operations support coordinator', area: 'SYSTEMS & PROCESSES', intro: 'Keep everyday processes organised and information reliable.', skillIds: ['detail', 'analysis', 'organisation', 'data'], reason: 'Checking records and tracking routine tasks can connect with supporting day-to-day operations.', learn: 'Process mapping and operational reporting', tasks: ['Maintain operational records', 'Track routine requests', 'Summarise recurring issues'], tryIt: 'Draw the steps in a routine request, from arrival to completion. Find one place where information might get lost.' },
    { id: 'reporting', title: 'Reporting support assistant', area: 'INFORMATION & INSIGHT', intro: 'Help turn reliable information into understandable updates.', skillIds: ['analysis', 'detail', 'data'], reason: 'Checking source information provides a starting point; your example data storytelling learning adds another area to explore.', learn: 'Spreadsheet reporting and data quality methods', tasks: ['Check report inputs', 'Prepare simple summaries', 'Explain changes and flag missing information'], tryIt: 'Take a small fictional table of weekly activity and write three observations without claiming more than the data supports.' },
];
export const skillById = (id: string) => skills.find(s => s.id === id)!;
export function readSaved(): string[] { try {
    const data: unknown = JSON.parse(accountStorage.getItem('aiwrevolusi.possibilities.saved') || '[]');
    return Array.isArray(data) ? [...new Set(data.filter((id): id is string => typeof id === 'string' && careers.some(c => c.id === id)))] : [];
}
catch {
    return [];
} }
