'use strict';
(() => {
 const C=window.CONTEXT_DATA;
 Object.assign(riskNames,{'Privacy & Security':'ความเป็นส่วนตัวและความมั่นคง','Socioeconomic & Environmental Harms':'สังคม เศรษฐกิจ และสิ่งแวดล้อม'});
 const tally=(rows,key)=>{const m=new Map();rows.forEach(r=>{const k=r[key]||'ไม่ระบุ';m.set(k,(m.get(k)||0)+1);});return [...m].sort((a,b)=>b[1]-a[1]);};
 const isoDay=d=>d.toISOString().slice(0,10),asDate=s=>new Date(s+'T00:00:00Z');
 function monthEnd(m){return isoDay(new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)));}
 function monthList(start,end){const rows=[];let d=asDate(start+'-01');while(isoDay(d).slice(0,7)<=end){rows.push(isoDay(d).slice(0,7));d.setUTCMonth(d.getUTCMonth()+1);}return rows;}
 function weekStart(day){const d=asDate(day);d.setUTCDate(d.getUTCDate()-d.getUTCDay());return isoDay(d);}
 function weekEnd(day){const d=asDate(day);d.setUTCDate(d.getUTCDate()+6);return isoDay(d);}
 function weekCounts(rows,start,end){
  const counts=new Map();rows.forEach(r=>{const w=weekStart(r.date);counts.set(w,(counts.get(w)||0)+1);});
  let d=asDate(weekStart(start));const result=[];
  while(isoDay(d)<=end){const w=isoDay(d),e=weekEnd(w);result.push({week_start:w,week_end:e,count:counts.get(w)||0,partial:w<start||e>end});d.setUTCDate(d.getUTCDate()+7);}return result;
 }
 const dates=D.ai.map(r=>r.date).sort(),available=monthList(dates[0].slice(0,7),dates.at(-1).slice(0,7));
 const countryNames={US:'สหรัฐอเมริกา',GB:'สหราชอาณาจักร',CN:'จีน',RU:'รัสเซีย',DE:'เยอรมนี',FR:'ฝรั่งเศส',JP:'ญี่ปุ่น',IN:'อินเดีย',CA:'แคนาดา',AU:'ออสเตรเลีย'};
 let active='ai',focusMonth='2026-10',rangeBackup=null;
 const intentNames={Intentional:'ตั้งใจ',Unintentional:'ไม่ตั้งใจ',Other:'อื่น ๆ',unknown:'ไม่ระบุ'};
 function initFilters(){
  const countries=tally(D.ai,'Country Code').filter(([k])=>k!=='ไม่ระบุ').sort((a,b)=>a[0].localeCompare(b[0]));
  $('event-filters').innerHTML=`<div class="filters"><label>ตั้งแต่เดือน<select id="month-start">${options(available.map(m=>[m,thMonth(m)]),'2020-01')}</select></label><label>ถึงเดือน<select id="month-end">${options(available.map(m=>[m,thMonth(m)]),'2026-10')}</select></label><label>ประเทศที่ AIID ระบุ<select id="event-country">${options([['all','ทั้งหมด รวมไม่ระบุ'],['unknown','ไม่ระบุประเทศ'],...countries.map(([k])=>[k,countryNames[k]||k])],'all')}</select></label><label id="risk-filter-label">หมวดความเสี่ยง<select id="event-risk">${options([['all','ทุกหมวด รวมไม่ระบุ'],...tally(D.ai,'Risk Domain').filter(([k])=>k!=='ไม่ระบุ').map(([k])=>[k,riskNames[k]||k]),['unknown','ไม่ระบุหมวด']],'all')}</select></label><label>เจตนาที่ระบุ<select id="event-intent">${options([['all','ทุกเจตนา รวมไม่ระบุ'],...Object.entries(intentNames)],'all')}</select></label><div class="presets"><button class="small-button" id="export-filtered">ดาวน์โหลด AIID ตามตัวกรอง</button><button class="small-button" id="reset-filters">ล้างตัวกรอง</button><button class="small-button" id="all-months">ข้อมูล AIID ทั้งหมด</button><button class="small-button" id="shared-months">ช่วงร่วม AIID / EUvsDisinfo</button></div></div><div id="selection-actions" class="selection-actions"></div><p class="filter-caption" id="month-caption"></p>`;
  ['month-start','month-end','event-country','event-risk','event-intent'].forEach(id=>$(id).onchange=()=>{if(id.startsWith('month-'))rangeBackup=null;renderEvents();saveState();});
  $('export-filtered').onclick=()=>{const s=scope();if(s.a>s.b)return;const rows=active==='misinformation'?s.base.filter(r=>r['Risk Domain']==='Misinformation'):s.rows;downloadCSV(rows,['Incident ID','date','title','Risk Domain','Intent','Country Code','report_count'],'aiid-filtered.csv');};
  $('reset-filters').onclick=()=>{rangeBackup=null;$('month-start').value='2020-01';$('month-end').value='2026-10';$('event-country').value='all';$('event-risk').value='all';$('event-intent').value='all';renderEvents();saveState();};
  $('all-months').onclick=()=>{rangeBackup=null;$('month-start').value=available[0];$('month-end').value=available.at(-1);renderEvents();saveState();};
  $('shared-months').onclick=()=>{rangeBackup=null;$('month-start').value='2015-01';$('month-end').value='2023-08';renderEvents();saveState();};
 }
 function scope(){
  const a=$('month-start').value,b=$('month-end').value,country=$('event-country').value;
  const start=a+'-01',end=monthEnd(b),risk=$('event-risk').value,intent=$('event-intent').value;
  const base=D.ai.filter(r=>r.date>=start&&r.date<=end&&(country==='all'||(country==='unknown'?!r['Country Code']:r['Country Code']===country))&&(intent==='all'||(intent==='unknown'?!r.Intent:r.Intent===intent)));
  return {a,b,start,end,country,risk,intent,base,rows:base.filter(r=>risk==='all'||(risk==='unknown'?!r['Risk Domain']:r['Risk Domain']===risk))};
 }
 function section(n,title,explanation){return `<div class="section-heading"><div><p class="eyebrow">${n}</p><h2>${title}</h2><p>${explanation}</p></div></div>`;}
 function monthlyLine(rows,series,unit,source='ai'){
  if(!rows.length)return empty();
  const w=850,h=265,l=55,right=20,t=20,b=50,pw=w-l-right,ph=h-t-b,max=Math.max(4,Math.ceil(Math.max(...rows.flatMap(r=>series.map(s=>r[s.key]??0)),1)*1.1/4)*4);
  const x=i=>l+(rows.length===1?pw/2:pw*i/(rows.length-1)),y=v=>t+ph-v/max*ph;
  let s=`<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="แนวโน้มรายเดือน คลิกเดือนเพื่อกรอง">`;
  for(let i=0;i<=4;i++){const v=max*i/4;s+=`<line class="gridline" x1="${l}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}
  series.forEach(ss=>{let path='';rows.forEach((r,i)=>{path+=`${i?'L':'M'}${x(i)},${y(r[ss.key])} `;});s+=`<path d="${path}" fill="none" stroke="${ss.color}" stroke-width="2.5"/>`;rows.forEach((r,i)=>s+=`<circle data-month="${r.month}" data-source="${source}" role="button" aria-label="กรองเดือน ${esc(thMonth(r.month))}" ${tip(`${thMonth(r.month)}\n${ss.label}: ${fmt(r[ss.key])} ${unit}\nเดือนนี้ครอบคลุมสัปดาห์ ${shortDate(weekStart(r.month+'-01'))}–${shortDate(weekEnd(weekStart(monthEnd(r.month))))}`)} cx="${x(i)}" cy="${y(r[ss.key])}" r="${rows.length<25?4:2.8}" fill="${ss.color}"/>`);});
  const tickCount=Math.min(6,rows.length),ticks=[...new Set(Array.from({length:tickCount},(_,i)=>Math.round(i*(rows.length-1)/Math.max(1,tickCount-1))))];
  ticks.forEach(i=>s+=`<text x="${x(i)}" y="${h-20}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(thMonth(rows[i].month))}</text>`);
  return `<div class="legend">${series.map(ss=>`<span><i style="background:${ss.color}"></i>${ss.label}</span>`).join('')}</div><div class="chart">${s}</svg></div>`;
 }
 function weeklyTable(rows,start,end,unit){
  const weeks=weekCounts(rows,start,end);
  return `<div class="table-wrap"><table><thead><tr><th>ช่วงสัปดาห์ (อาทิตย์–เสาร์)</th><th>ช่วงที่นำมานับในเดือน</th><th>${unit}</th></tr></thead><tbody>${weeks.map(w=>`<tr><td>${shortDate(w.week_start)}–${shortDate(w.week_end)}</td><td>${shortDate(w.week_start<start?start:w.week_start)}–${shortDate(w.week_end>end?end:w.week_end)}${w.partial?' <span class="tag warn">บางส่วนของสัปดาห์</span>':''}</td><td class="num">${fmt(w.count)}</td></tr>`).join('')}</tbody></table></div><p class="subtitle">สัปดาห์ที่คร่อมเดือนนับเฉพาะวันที่อยู่ในเดือนนี้ จึงไม่ซ้ำกับเดือนถัดไป · 0 = ไม่มีรายการบันทึกในช่วง ไม่ได้แปลว่าไม่มีเหตุเกิดจริง</p>`;
 }
 function caseTable(rows){
  const list=[...rows].sort((a,b)=>(b.report_count||0)-(a.report_count||0)).slice(0,5);
  return list.length?`<div class="table-wrap"><table><thead><tr><th>สัปดาห์เกิดเหตุ</th><th>เหตุการณ์และคำอธิบาย</th><th>ข่าวที่รายงาน</th></tr></thead><tbody>${list.map(r=>`<tr><td>${shortDate(weekStart(r.date))}–${shortDate(weekEnd(weekStart(r.date)))}</td><td><a href="https://incidentdatabase.ai/cite/${encodeURIComponent(r['Incident ID'])}/" target="_blank" rel="noopener">${esc(r.title)} ↗</a><details><summary>อ่านคำอธิบายต้นทาง</summary>${esc(r.description)}</details></td><td class="num">${fmt(r.report_count)}</td></tr>`).join('')}</tbody></table></div>`:empty('ไม่มีเหตุการณ์ตรงกับตัวกรอง');
 }
 function methodology(text){return `<details class="method-details"><summary>วิธีนับ ที่มา และข้อจำกัดของส่วนนี้</summary><div class="method">${text}</div></details>`;}
 function renderEvents(){
  if($('month-start').value>$('month-end').value){$('month-caption').textContent='เดือนเริ่มต้นต้องไม่เกินเดือนสิ้นสุด';$('ai').innerHTML=empty('กรุณาเลือกช่วงเดือนใหม่');$('misinformation').innerHTML=empty('กรุณาเลือกช่วงเดือนใหม่');return;}
  const s=scope(),months=monthList(s.a,s.b);
  if(!months.includes(focusMonth))focusMonth=s.b;
  $('month-caption').textContent=`${thMonth(s.a)}–${thMonth(s.b)} · ครอบคลุมสัปดาห์ ${shortDate(weekStart(s.start))}–${shortDate(weekEnd(weekStart(s.end)))} · นับเฉพาะวันภายในเดือนที่เลือก · เวลา/ประเทศ/เจตนาใช้ร่วมกันในส่วน AIID ของแท็บ 1–2${s.b===dates.at(-1).slice(0,7)?' · เดือนสุดท้ายยังไม่เต็มเดือน · เหตุการณ์ล่าสุดที่บันทึกวันที่ '+shortDate(dates.at(-1)):''}`;
  $('selection-actions').innerHTML=`<span class="tag">AIID: ${esc(countryNames[s.country]||({all:'ทุกประเทศ',unknown:'ไม่ระบุประเทศ'}[s.country])||s.country)} · ${esc(s.intent==='all'?'ทุกเจตนา':intentNames[s.intent])}</span>${rangeBackup?'<button class="small-button" id="restore-range">กลับช่วงเดือนก่อนคลิกกราฟ</button>':''}<span class="kpi-note">คลิกเดือนหรือแท่งหมวดเพื่อกรองกราฟและรายละเอียดร่วมกัน</span>`;
  if($('restore-range'))$('restore-range').onclick=()=>{const r=rangeBackup;rangeBackup=null;$('month-start').value=r[0];$('month-end').value=r[1];renderEvents();saveState();};
  renderOverview(s,months);renderMisinformation(s,months);
  bindChartFilters();
 }
 function renderOverview(s,months){
  const rows=s.rows,classified=rows.filter(r=>r['Risk Domain']),mis=rows.filter(r=>r['Risk Domain']==='Misinformation'),groups=tally(classified,'Risk Domain'),intentNames={Intentional:'ตั้งใจ',Unintentional:'ไม่ตั้งใจ',Other:'อื่น ๆ','ไม่ระบุ':'ไม่ระบุ'};
  const trend=months.map(month=>({month,total:rows.filter(r=>r.date.startsWith(month)).length,mis:mis.filter(r=>r.date.startsWith(month)).length}));
  let html=`<div class="kpis">${kpi('เหตุการณ์ตามตัวกรอง',fmt(rows.length),'เหตุการณ์','นับ Incident ID ไม่ซ้ำ')}${kpi('มีหมวดความเสี่ยง',fmt(classified.length),'เหตุการณ์',`ไม่ระบุ ${fmt(rows.length-classified.length)} เหตุการณ์`)}${kpi('ในหมวดข้อมูลเท็จ',fmt(mis.length),'เหตุการณ์','เป็นส่วนหนึ่งของเหตุการณ์ทั้งหมด')}${kpi('มีประเทศระบุ',fmt(rows.filter(r=>r['Country Code']).length),'เหตุการณ์','ข้อมูลประเทศไม่ครบ จึงไม่ทำแผนที่ยอดเหตุการณ์')}</div>`;
  html+=section('คำถามที่ 1 / แนวโน้ม','เหตุการณ์ AI ที่ถูกบันทึกเปลี่ยนแปลงอย่างไรในแต่ละเดือน?','อ่านแนวโน้มก่อน แล้วดูว่าหมวดความเสี่ยงใดประกอบอยู่ในภาพนั้น');
  html+=card('เหตุการณ์ที่บันทึกในแต่ละเดือน','เส้นข้อมูลเท็จเป็นส่วนหนึ่งของยอดรวม ไม่ใช่ยอดเพิ่มเติม · คลิกจุดเดือนเพื่อกรองทุกกราฟในส่วนเหตุการณ์ AI พร้อมตารางรายสัปดาห์',monthlyLine(trend,[{key:'total',label:'ทั้งหมดตามตัวกรอง',color:'#8ba8b8'},{key:'mis',label:'ในหมวดข้อมูลเท็จ',color:'#147f79'}],'เหตุการณ์'),'Q1');
  html+=section('คำถามที่ 2 / ประเภทปัญหา','ความเสี่ยงประเภทใดถูกบันทึกมากที่สุด?','ทั้งสองกราฟใช้เหตุการณ์ชุดเดียวกับกราฟรายเดือน ไม่เปลี่ยนตัวหารโดยไม่บอก');
  html+=`<div class="grid equal">${card('หมวดความเสี่ยงที่ถูกบันทึก','เรียงจำนวนจากมากไปน้อย · ไม่ระบุหมวดแสดงในการ์ดด้านบน',bars(groups.map(([k,n])=>({label:riskNames[k]||k,value:n,filterRisk:k,color:k==='Misinformation'?'#147f79':'#8ba8b8'})),{left:255}),'Q2')}${card('เจตนาที่ฐานข้อมูลระบุ','ไม่อนุมานเจตนาจากข้อความ',bars(tally(rows,'Intent').map(([k,n])=>({label:intentNames[k]||k,value:n,filterIntent:k==='ไม่ระบุ'?'unknown':k})))+`<p class="subtitle">Intent เป็นป้ายจัดหมวดของต้นทาง ไม่ใช่ข้อสรุปว่า AI มีเจตนาแบบมนุษย์</p>`,'รายละเอียด Q2')}</div>`;
  const first=groups[0];
  html+=`<div class="insight">${first?`ในผลที่เลือก หมวดที่มีจำนวนมากที่สุดคือ <strong>${esc(riskNames[first[0]]||first[0])}</strong> (${fmt(first[1])} เหตุการณ์)<br>`:''}อ่านต่อแท็บ 2 เพื่อเจาะ <strong>ข้อมูลเท็จ ${fmt(s.base.filter(r=>r['Risk Domain']==='Misinformation').length)} เหตุการณ์</strong> ในช่วงเวลา ประเทศ และเจตนาเดียวกัน โดยแท็บ 2 จะไม่ใช้ตัวกรองหมวดความเสี่ยงของแท็บนี้</div>`;
  html+=section('ลงรายละเอียดภาพรวม','จากเดือนที่เลือก สู่ช่วงสัปดาห์และเหตุการณ์จริง','เลือกเดือนเพื่อตรวจว่าตัวเลขมาจากสัปดาห์ไหน ก่อนเปิดดูเหตุการณ์');
  html+=card('รายละเอียดรายสัปดาห์ในเดือน','ใช้สัปดาห์อาทิตย์–เสาร์ แต่ตัดการนับที่ขอบเดือน เพื่อไม่ให้ยอดข้ามเดือนซ้ำ',`<label class="week-picker">เดือนที่ต้องการเจาะ <select id="focus-month">${options(months.map(m=>[m,thMonth(m)]),focusMonth)}</select></label><div id="weekly-overview"></div>`,'DETAIL');
  html+=methodology(`AIID_Excel_Export-20261026.xlsx ชีต Incidents เป็นตารางหลัก ตรึง snapshot เดียว 1,775 เหตุการณ์ · วันที่เป็นวันเกิดเหตุ ไม่ใช่วันข่าวเผยแพร่ · ฐานคัดจากข่าว จำนวนจึงขึ้นกับการบันทึก ไม่ใช่เหตุทั้งหมดในโลก · ช่วงท้ายของฐานยังไม่เต็มเดือน/ปี · จำนวนข่าว report_count ไม่ใช่ความรุนแรง<br><a class="download" href="../data/processed/ai_incidents_clean.csv" download>ข้อมูล AIID สะอาด ↓</a>`);
  $('ai').innerHTML=html;
  $('focus-month').onchange=()=>{focusMonth=$('focus-month').value;renderWeeklyOverview(s);};renderWeeklyOverview(s);
 }
 function renderWeeklyOverview(s){const start=focusMonth+'-01',end=monthEnd(focusMonth),rows=s.rows.filter(r=>r.date>=start&&r.date<=end);$('weekly-overview').innerHTML=weeklyTable(rows,start,end,'เหตุการณ์ AIID')+`<h3>ตัวอย่างในเดือนนี้ เรียงจำนวนข่าวรายงาน</h3>`+caseTable(rows);}
 function renderMisinformation(s,months){
  const mis=s.base.filter(r=>r['Risk Domain']==='Misinformation'),classified=s.base.filter(r=>r['Risk Domain']),intentNames={Intentional:'ตั้งใจ',Unintentional:'ไม่ตั้งใจ',Other:'อื่น ๆ','ไม่ระบุ':'ไม่ระบุ'};
  let html=`<div class="notice neutral">ต่อจากภาพรวม AI: ส่วนแรกกรองเฉพาะ Risk Domain = Misinformation โดยคงช่วงเดือนและประเทศและเจตนาเดิม · ไม่ใช้ตัวกรองหมวดของแท็บ 1 · ส่วน EUvsDisinfo ด้านล่างเป็นบริบทแยก ไม่ใช่เหตุการณ์เดียวกันและไม่ได้ยืนยันว่าใช้ AI</div><div class="kpis">${kpi('เหตุการณ์ AI ด้านข้อมูลเท็จ',fmt(mis.length),'เหตุการณ์','นับจาก AIID ตามเดือน ประเทศ และเจตนาที่เลือก')}${kpi('สัดส่วนในกลุ่มที่มีหมวด',classified.length?fmt(100*mis.length/classified.length,1):'—','%',`ตัวหาร ${fmt(classified.length)} เหตุการณ์ที่ระบุ Risk Domain`)}${kpi('ไม่ระบุหมวดความเสี่ยง',fmt(s.base.length-classified.length),'เหตุการณ์','ไม่ตีความว่าไม่เกี่ยวกับข้อมูลเท็จ')}${kpi('มีประเทศระบุในกลุ่มข้อมูลเท็จ',fmt(mis.filter(r=>r['Country Code']).length),'เหตุการณ์','นับเฉพาะเหตุการณ์ตามตัวกรองปัจจุบัน')}</div>`;
  html+=section('คำถามที่ 3 / เจาะข้อมูลเท็จ','ข้อมูลเท็จจาก AI มีสัดส่วนเท่าไร และเกิดปัญหาลักษณะใด?','ใช้กลุ่ม Misinformation เดียวกันทั้งแนวโน้ม เจตนา และกรณีศึกษา');
  html+=card('แนวโน้มเหตุการณ์ AI ด้านข้อมูลเท็จ','รายเดือนตามวันเกิดเหตุ',monthlyLine(months.map(month=>({month,count:mis.filter(r=>r.date.startsWith(month)).length})),[{key:'count',label:'Misinformation ใน AIID',color:'#147f79'}],'เหตุการณ์'),'Q3');
  html+=`<div class="grid equal">${card('เจตนาในเหตุการณ์ด้านข้อมูลเท็จ','แยกข้อมูลที่ไม่ระบุไว้ ไม่เดาจากเนื้อหา',bars(tally(mis,'Intent').map(([k,n])=>({label:intentNames[k]||k,value:n,filterIntent:k==='ไม่ระบุ'?'unknown':k}))),'รายละเอียด Q3')}${card('ตัวอย่างเหตุการณ์ข้อมูลเท็จ','เรียงตามจำนวนข่าวที่รายงาน เปิดอ่านคำอธิบายได้',caseTable(mis),'CASES')}</div>`;
  html+=section('คำถามที่ 4 / บริบทการหักล้าง','EUvsDisinfo บันทึกการหักล้างมากในช่วงใด?','EUvsDisinfo เป็นฐานเฉพาะข้อมูลเท็จฝั่งสนับสนุนรัสเซีย ไม่ใช่ภาพรวมโลกและไม่ใช่ยอดเหตุการณ์ AI');
  const euStart=s.start>C.eu_meta.start?s.start:C.eu_meta.start,euEnd=s.end<C.eu_meta.end?s.end:C.eu_meta.end;
  if(euStart>euEnd){html+=`<div class="notice">ช่วงเดือนที่เลือกไม่ทับซ้อน EUvsDisinfo ซึ่งมีตั้งแต่ ${shortDate(C.eu_meta.start)} ถึง ${shortDate(C.eu_meta.end)} · ใช้ปุ่ม “ช่วงร่วม AIID / EUvsDisinfo” เพื่อดูช่วงที่ทั้งสองฐานมีข้อมูล ไม่แสดงเดือนนอกขอบเขตเป็นศูนย์</div>`;}
  else{
   const eu=C.eu_debunks.filter(r=>r.date>=euStart&&r.date<=euEnd),euMonths=monthList(euStart.slice(0,7),euEnd.slice(0,7)),peak=euMonths.map(month=>({month,count:eu.filter(r=>r.date.startsWith(month)).length})).sort((a,b)=>b.count-a.count)[0];
   html+=`<div class="notice">ขอบเขต EUvsDisinfo ที่ใช้จริง: ${shortDate(euStart)}–${shortDate(euEnd)} · ครอบคลุมสัปดาห์ ${shortDate(weekStart(euStart))}–${shortDate(weekEnd(weekStart(euEnd)))} · ตัวกรองประเทศและเจตนาใช้กับ AIID เท่านั้น เพราะ EUvsDisinfo ไม่มีประเทศเหตุการณ์ที่เทียบกันได้${euEnd===C.eu_meta.end?' · สิงหาคม 2023 มีข้อมูลถึงวันที่ 1 เท่านั้น':''}</div>`;
   html+=card('จำนวนการหักล้างข้อมูลบิดเบือนรายเดือน','นับ debunk_id ไม่ซ้ำ · ใช้วันเผยแพร่การหักล้าง ไม่ใช่วันเผยแพร่บทความ',monthlyLine(euMonths.map(month=>({month,count:eu.filter(r=>r.date.startsWith(month)).length})),[{key:'count',label:'การหักล้างใน EUvsDisinfo',color:'#628ba5'}],'เรื่อง','eu')+`<div class="insight">ช่วงนี้มีการหักล้าง <strong>${fmt(eu.length)} เรื่อง</strong>${peak?` · เดือนที่บันทึกมากที่สุดคือ <strong>${esc(thMonth(peak.month))}</strong> (${fmt(peak.count)} เรื่อง)`:''}<br>ใช้เล่าบริบทการตรวจสอบข้อมูลบิดเบือน ไม่รวมยอดกับ AIID และไม่สรุปว่าเดือนที่เพิ่มเกิดจาก AI</div>`,'Q4');
   html+=`<details class="method-details"><summary>ดูช่วงสัปดาห์ของเดือนที่มีการหักล้างมากที่สุด</summary>${weeklyTable(eu.filter(r=>r.date.startsWith(peak.month)),peak.month+'-01'>euStart?peak.month+'-01':euStart,monthEnd(peak.month)<euEnd?monthEnd(peak.month):euEnd,'การหักล้างไม่ซ้ำ')}</details>`;
  }
  html+=`<div class="insight">อ่านต่อแท็บ 3 เพื่อสำรวจ <strong>เสรีภาพอินเทอร์เน็ตของแต่ละประเทศ</strong> เป็นบริบทอีกด้าน โดยไม่ใช้คะแนนเสรีภาพอธิบายสาเหตุของเหตุการณ์ AI</div>`;
  html+=methodology(`AIID นับเหตุการณ์ตาม Incident ID ส่วน EUvsDisinfo นับ debunk_id ไม่ซ้ำจาก 18,249 แถวบทความ เหลือ 8,522 เรื่อง · ไม่ใช้ class = trustworthy เป็นข่าวปลอม · ไม่จับคู่ข้ามฐานด้วยเดือนเพียงอย่างเดียว · วันหักล้างไม่ใช่วันเกิดเหตุ จึงไม่วางยอดสองฐานซ้อนเป็นยอดรวมเดียวกัน<br><a class="download" href="../data/processed/eu_debunks_clean.csv" download>การหักล้างไม่ซ้ำ ↓</a>`);
  $('misinformation').innerHTML=html;
 }
 function downloadCSV(rows,columns,name){
  const quote=value=>{let text=String(value??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
  const csv='\ufeff'+[columns,...rows.map(r=>columns.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function applyMonth(month){
  if(!rangeBackup)rangeBackup=[$('month-start').value,$('month-end').value];
  $('month-start').value=month;$('month-end').value=month;focusMonth=month;
  renderEvents();saveState();
 }
 function bindChartFilters(){
  document.querySelectorAll('[data-risk],[data-intent]').forEach(el=>{el.onclick=()=>{if(el.dataset.risk)$('event-risk').value=el.dataset.risk;if(el.dataset.intent)$('event-intent').value=el.dataset.intent;renderEvents();saveState();};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};});
 }
 function saveState(){
  const q=new URLSearchParams();
  for(const id of ['month-start','month-end','event-country','event-risk','event-intent','freedom-start','freedom-end','freedom-country']){const el=$(id);if(el)q.set(id,el.value);}
  history.replaceState(null,'','?'+q.toString()+'#'+active);
 }
 function restoreState(){
  const q=new URLSearchParams(location.search);
  for(const [id,value] of q){const el=$(id);if(el&&el.tagName==='SELECT'&&[...el.options].some(o=>o.value===value))el.value=value;}
  window.FreedomView.update();
 }
 const pages={ai:['01 / ภาพรวมเหตุการณ์','AI ก่อปัญหาอะไร?','เริ่มจากช่วงเวลาที่บันทึกมาก แล้วอ่านประเภทความเสี่ยง เจตนา และเหตุการณ์ในสัปดาห์นั้น'],misinformation:['02 / เจาะประเด็นต่อจากภาพรวม','เจาะเรื่องข้อมูลเท็จ','จากเหตุการณ์ AI ในแท็บแรก สู่รายละเอียดข้อมูลเท็จ แล้วขยายบริบทการหักล้างจากอีกฐาน'],freedom:['03 / บริบทเสรีภาพอินเทอร์เน็ต','แต่ละประเทศมีเสรีภาพแค่ไหน?','เลือกประเทศและช่วงปี ดูคะแนน แผนที่ และองค์ประกอบ โดยไม่ใช้แทนความเสี่ยงจาก AI']};
 function route(name){if(name==='eu')name='misinformation';if(!pages[name])name='ai';active=name;document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==name);document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-selected',String(b.dataset.tab===name));});['eyebrow','page-title','page-lead'].forEach((id,i)=>$(id).textContent=pages[name][i]);$('event-filters').hidden=name==='freedom';$('risk-filter-label').hidden=name==='misinformation';saveState();}
 initFilters();window.FreedomView.setup();restoreState();renderEvents();
 // The country/year dataset has no monthly observations: explain this inside tab 3.
 $('freedom').insertAdjacentHTML('afterbegin',`<div class="insight" style="margin:0 0 18px">แท็บนี้ใช้ <strong>รายปี</strong> เพราะ Freedom on the Net ไม่มีคะแนนรายเดือนหรือรายสัปดาห์ จึงไม่แบ่งคะแนนขึ้นเอง · แผนที่และรายละเอียดใช้ปีปลายช่วงเดียวกัน ส่วนกราฟเส้นใช้ช่วงปีที่เลือก</div>`);
 $('freedom').insertAdjacentHTML('beforeend',methodology(`Freedom on the Net: 940 แถวประเทศ–ปี ครอบคลุม 72 ประเทศตลอดปี 2010–2024 · คะแนนสูงหมายถึงเสรีมากขึ้น ไม่ใช่ปลอดภัยจาก AI มากขึ้น · กลุ่มประเทศในแนวโน้มภาพรวมต้องมีข้อมูลครบทุกปีในช่วงเพื่อให้สมาชิกคงที่ · ประเทศไม่มีข้อมูลเป็นสีเทา ไม่ใช่ 0 · ไม่สร้างคะแนนรายเดือนหรือสัปดาห์ · AIID มีประเทศระบุเพียง 140/1,775 เหตุการณ์ จึงไม่ใช้สร้างแผนที่ยอดเหตุการณ์ · เชื่อมคะแนนประเทศ–ปีแบบตรงกันได้ ${C.ai_join_coverage.matched} เหตุการณ์เท่านั้น จึงไม่ใช้พิสูจน์ความสัมพันธ์ระดับโลก<br><a class="download" href="../data/processed/ai_country_year_context.csv" download>ตารางเชื่อมประเทศ–ปี ↓</a>`));
 window.addEventListener('signal-freedom-change',saveState);
 document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>route(b.dataset.tab));document.querySelector('.brand').href='#ai';document.querySelector('.brand').onclick=e=>{e.preventDefault();route('ai');};
 const tooltip=$('tooltip');document.addEventListener('pointermove',e=>{const el=e.target.closest('[data-tip]');if(!el){tooltip.hidden=true;return;}tooltip.textContent=el.dataset.tip;tooltip.hidden=false;tooltip.style.left=Math.max(8,Math.min(e.clientX+12,innerWidth-tooltip.offsetWidth-12))+'px';tooltip.style.top=Math.max(8,Math.min(e.clientY+12,innerHeight-tooltip.offsetHeight-12))+'px';});
 document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(!el)return;const r=el.getBoundingClientRect();tooltip.textContent=el.dataset.tip;tooltip.hidden=false;tooltip.style.left=Math.max(8,Math.min(r.left,innerWidth-tooltip.offsetWidth-12))+'px';tooltip.style.top=Math.max(8,Math.min(r.bottom+5,innerHeight-tooltip.offsetHeight-12))+'px';});document.addEventListener('focusout',()=>tooltip.hidden=true);document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-month]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 document.addEventListener('click',e=>{const point=e.target.closest('[data-month]');if(point)applyMonth(point.dataset.month);});
 route(location.hash.slice(1));
 // Expose pure date/count helpers for the validation script, not data mutations.
 window.SignalChecks={weekStart,weekEnd,weekCounts,monthEnd,monthList};
})();
