/** Mirror stable reference hashes for offline fixtures only. */
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export function snapshotRole(role) {
  if (!role?.occupation_code || !Array.isArray(role.skills)) return role;
  const tasks = [...new Set(role.tasks ?? [])].filter(text => text.trim()).map(text => ({id:'task:'+hash(role.occupation_code+'\0'+text).slice(0,24),text}));
  const skills = role.skills.map(({skill_id,skill_slug,name})=>({skill_id,skill_slug,name}));
  return {...role, task_references:tasks, reference_fingerprint:hash(JSON.stringify([role.occupation_code,role.title,skills,tasks]))};
}
export function snapshotCourse(row,coreSkill) {
 return {...row,source_fingerprint:hash(JSON.stringify([row.course_id,row.title??'',row.outcomes??'',coreSkill??'']))};
}
