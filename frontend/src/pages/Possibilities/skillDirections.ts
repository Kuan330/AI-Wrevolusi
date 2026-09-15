// Editorial exploration associations, not occupational eligibility requirements.
export const directions = [
  { title: 'Data and insights', skills: ['Analytical thinking', 'AI and big data', 'Reading, writing and mathematics'], description: 'Explore work involving reports, patterns and evidence-based decisions.', next: 'Create a small analysis from a familiar work task and explain one useful finding.' },
  { title: 'Digital products and technology', skills: ['Programming', 'Technological literacy', 'Design and user experience', 'AI and big data'], description: 'Explore work involving digital tools, product improvements and software.', next: 'Build or prototype one small improvement to a tool you use at work.' },
  { title: 'People and customer support', skills: ['Empathy and active listening', 'Service orientation and customer service', 'Multi-lingualism'], description: 'Explore work helping people understand options and resolve problems.', next: 'Document a customer or colleague problem and how you would respond.' },
  { title: 'Team and project coordination', skills: ['Leadership and social influence', 'Resource management and operations', 'Talent management', 'Resilience, flexibility and agility'], description: 'Explore work coordinating people, priorities and delivery.', next: 'Plan a small team activity with clear responsibilities and review its outcome.' },
  { title: 'Communication and learning', skills: ['Creative thinking', 'Teaching and mentoring', 'Curiosity and lifelong learning', 'Marketing and media'], description: 'Explore work explaining ideas, creating content and supporting learning.', next: 'Prepare a short guide that teaches someone a useful part of your work.' },
  { title: 'Security and quality', skills: ['Networks and cybersecurity', 'Quality control', 'Dependability and attention to detail', 'Systems thinking'], description: 'Explore work checking systems, reducing errors and improving reliability.', next: 'Review a familiar process and identify one risk and a practical safeguard.' },
  { title: 'Sustainability and community', skills: ['Environmental stewardship', 'Global citizenship', 'Leadership and social influence'], description: 'Explore work involving environmental improvements and community initiatives.', next: 'Identify a small environmental or community improvement and the people needed to support it.' },
];
export function matchDirections(names: string[]) {
  const selected = new Set(names.map(name => name.toLowerCase()));
  return directions.map(direction => ({ direction, matched: direction.skills.filter(name => selected.has(name.toLowerCase())) }))
    .filter(item => item.matched.length > 0).sort((a, b) => b.matched.length - a.matched.length);
}
