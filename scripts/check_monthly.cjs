// Exercise the actual dashboard's date bucketing against boundary cases and source records.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'prototype/event-views.js'),'utf8');
const dates=source.slice(source.indexOf(' const isoDay='),source.indexOf(' const dates='));
const context={window:{}};vm.createContext(context);
vm.runInContext(dates+'\nthis.periods={weekStart,weekEnd,weekCounts,monthList,monthEnd};',context);
const p=context.periods;
assert.equal(p.weekStart('2026-01-01'),'2025-12-28');
assert.equal(p.weekEnd('2025-12-28'),'2026-01-03');
assert.equal(p.monthEnd('2024-02'),'2024-02-29');
assert.equal(p.monthEnd('2026-02'),'2026-02-28');
assert.equal(p.monthList('2025-12','2026-02').join(','),'2025-12,2026-01,2026-02');
const split=[{date:'2026-01-31'},{date:'2026-02-01'}];
for(const month of ['2026-01','2026-02']){
 const selected=split.filter(r=>r.date.startsWith(month));
 assert.equal(p.weekCounts(selected,month+'-01',p.monthEnd(month)).reduce((n,r)=>n+r.count,0),1);
}
vm.runInContext(fs.readFileSync(path.join(root,'prototype/data.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'prototype/context.js'),'utf8'),context);
for(const records of [context.window.DASHBOARD_DATA.ai,context.window.CONTEXT_DATA.eu_debunks]){
 const months=[...new Set(records.map(r=>r.date.slice(0,7)))];let total=0;
 for(const m of months){const selected=records.filter(r=>r.date.startsWith(m));const weekly=p.weekCounts(selected,m+'-01',p.monthEnd(m));assert.equal(weekly.reduce((n,r)=>n+r.count,0),selected.length);assert.ok(weekly.every(r=>new Date(r.week_start+'T00:00:00Z').getUTCDay()===0));total+=selected.length;}
 assert.equal(total,records.length);
}
const html=fs.readFileSync(path.join(root,'prototype/index.html'),'utf8');
assert.equal((html.match(/<button data-tab=/g)||[]).length,3);
assert.ok(!html.includes('type="date"'));
// Check the actual shared filter function on the pinned snapshot, including
// the intended difference between all-risk denominators and the selected risk.
context.values={'month-start':'2023-05','month-end':'2023-05','event-country':'all','event-risk':'all','event-intent':'all'};
vm.runInContext('this.D=window.DASHBOARD_DATA;this.$=id=>({value:values[id]});'+source.slice(source.indexOf(' function scope()'),source.indexOf(' function section('))+'\nthis.currentScope=scope;',context);
assert.equal(context.currentScope().rows.length,18);
context.values['event-risk']='Misinformation';
assert.equal(context.currentScope().rows.length,7);
assert.equal(context.currentScope().base.length,18);
context.values['event-intent']='Unintentional';
assert.equal(context.currentScope().rows.length,5);
assert.equal(context.currentScope().base.filter(r=>r['Risk Domain']).length,10);
context.values['event-country']='US';
assert.equal(context.currentScope().rows.length,0);
context.values['event-country']='unknown';
assert.equal(context.currentScope().rows.length,5);
console.log('PASS: exactly 3 tabs, no day-date filter, Sunday–Saturday boundaries, leap years, cross-month split, and all AIID/EUvsDisinfo monthly counts reconcile to weekly counts.');
console.log('PASS: actual shared filters intersect month/country/risk/intent correctly; misinformation denominator retains all classified risks; empty intersections stay empty.');
