import test from 'node:test';
import assert from 'node:assert/strict';
import { taskSourceLabel } from '../src/features/work-profile/taskSourceLabel.ts';
test('source labels distinguish original suggestions, edited suggestions and own wording',()=>{
 const source={source:'ilo',wording:'Check orders',originalWording:'Check orders'};
 assert.equal(taskSourceLabel(source),'Suggested task · ILO reference');
 assert.equal(taskSourceLabel({...source,wording:'Check orders for missing addresses'}),'Edited by you · originally an ILO suggestion');
 assert.equal(taskSourceLabel({source:'user',wording:'Check orders'}),'Written by you');
 assert.equal(source.originalWording,'Check orders');
});
test('legacy missing source wording is not presented as unchanged evidence',()=>{
 assert.equal(taskSourceLabel({source:'ilo',wording:'Check orders'}),'ILO suggestion · original wording not recorded');
 assert.equal(taskSourceLabel({wording:'Check orders'}),'Source not recorded');
});
