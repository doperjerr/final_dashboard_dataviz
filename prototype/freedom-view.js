'use strict';
(() => {
 const C=window.CONTEXT_DATA;
 function setupFreedom(){
  const countries=[...new Map(C.freedom.map(r=>[r.iso3,r.country])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const years=Array.from({length:15},(_,i)=>2010+i);
  $('freedom').innerHTML=`<div class="notice neutral">Freedom on the Net เป็นคะแนนประเมินเสรีภาพอินเทอร์เน็ต ไม่ใช่คะแนนความปลอดภัยหรือปริมาณข่าวปลอม · ข้อมูล 72 ประเทศตลอดปี 2010–2024 แต่แต่ละปีมีประเทศไม่เท่ากัน · ดูแยกจากเหตุการณ์ AI ไม่อ้างความสัมพันธ์เชิงเหตุผล</div><div class="filters" style="margin-bottom:20px"><label>ช่วงปีเริ่มต้น<select id="freedom-start">${options(years,2015)}</select></label><label>ถึงปี / ปีบนแผนที่<select id="freedom-end">${options(years,2024)}</select></label><label>ประเทศสำหรับรายละเอียด<select id="freedom-country">${options([['all','ภาพรวมประเทศที่มีข้อมูล'],...countries],'all')}</select></label><button class="small-button" id="freedom-reset">ล้างตัวกรองแผนที่</button></div><div id="freedom-results"></div>`;
  ['freedom-start','freedom-end','freedom-country'].forEach(id=>$(id).onchange=updateFreedom);
  $('freedom-reset').onclick=()=>{$('freedom-start').value='2015';$('freedom-end').value='2024';$('freedom-country').value='all';updateFreedom();};
  updateFreedom();
 }
 function scoreColor(v){if(v==null)return 'url(#no-score)';const a=v<=50?[245,231,198]:[255,109,31],b=v<=50?[255,109,31]:[34,34,34],t=v<=50?v/50:(v-50)/50;return `rgb(${a.map((n,i)=>Math.round(n+(b[i]-n)*t)).join(',')})`;}
 function worldMap(rows,selected){
  const byISO=new Map(rows.map(r=>[r.iso3,r]));
  const project=([lon,lat])=>[(lon+180)*2.4+8,(85-Math.min(85,Math.max(-60,lat)))*2.4+8];
  function ringPath(ring){let last=null,s='';for(const p of ring){const xy=project(p);s+=(!last||Math.abs(p[0]-last[0])>180?'M':'L')+xy.map(n=>n.toFixed(1)).join(',');last=p;}return s+'Z';}
  let paths='';
  for(const f of C.world){if(f.iso3==='ATA')continue;const data=byISO.get(f.iso3),g=f.geometry,polys=g.type==='MultiPolygon'?g.coordinates:[g.coordinates],d=polys.map(p=>p.map(ringPath).join(' ')).join(' ');const t=`${data?.country||f.name}\n${data?`${data.data_year}: ${data.total_score}/100 · ${data.status_th}`:'ไม่มีข้อมูลในปีที่เลือก'}`;
   paths+=`<path d="${d}" fill="${scoreColor(data?.total_score)}" stroke="${selected===f.iso3?'#FF6D1F':'#BBAE95'}" stroke-width="${selected===f.iso3?2:.5}" ${tip(t)} ${data?`data-country="${f.iso3}" role="button" aria-label="ดู ${esc(data.country)}" class="country-hit"`:''}/>`;
  }
  const mapped=new Set(C.world.map(f=>f.iso3));
  return `<div class="world-chart"><svg viewBox="0 0 880 370" role="group" aria-label="แผนที่คะแนนเสรีภาพอินเทอร์เน็ต"><defs><pattern id="no-score" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="#E1DDD4"/><path d="M0,6 L6,0" stroke="#BEB7AB" stroke-width="1"/></pattern></defs>${paths}</svg></div><div class="map-legend"><span>0 · คะแนนต่ำ</span><span class="score-gradient"></span><span>100 · เสรีมากขึ้น</span><span><i class="no-score"></i>ไม่มีข้อมูล</span></div><p class="subtitle">แสดงขอบเขตได้ ${rows.filter(r=>mapped.has(r.iso3)).length} จาก ${rows.length} ประเทศที่มีคะแนนปีนี้ ประเทศขนาดเล็กอาจเลือกบนแผนที่ไม่ได้ ให้เลือกจากเมนูแทน · ขอบเขต Natural Earth 1:110m ไม่ใช่ข้อยืนยันสถานะทางการเมือง</p>`;
 }
 function updateFreedom(){
  const start=+$('freedom-start').value,end=+$('freedom-end').value,iso=$('freedom-country').value;
  if(start>end){$('freedom-results').innerHTML=empty('ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด');return;}
  const latest=C.freedom.filter(r=>r.data_year===end),years=Array.from({length:end-start+1},(_,i)=>start+i),one=latest.find(r=>r.iso3===iso),selected=C.freedom.filter(r=>r.iso3===iso),first=selected.find(r=>r.data_year===start);
  const countrySet=[...new Set(C.freedom.map(r=>r.iso3))].filter(c=>years.every(y=>C.freedom.some(r=>r.iso3===c&&r.data_year===y)));
  const trend=years.map(year=>{const r=selected.find(x=>x.data_year===year),cohort=C.freedom.filter(x=>x.data_year===year&&countrySet.includes(x.iso3));return {year,score:iso==='all'?(cohort.length?sum(cohort,'total_score')/cohort.length:null):(r?.total_score??null)};});
  let html=`<div class="section-heading"><div><p class="eyebrow">คำถามที่ 5 / บริบทประเทศ</p><h2>ประเทศที่เลือกมีเสรีภาพระดับใด และเปลี่ยนแปลงอย่างไร?</h2><p>แผนที่ คะแนนรวม แนวโน้ม และองค์ประกอบ ใช้ประเทศกับช่วงปีเดียวกัน</p></div></div><div class="kpis">${kpi('ประเทศที่มีคะแนนปี '+end,fmt(latest.length),'ประเทศ','ไม่ได้ครอบคลุมทุกประเทศในโลก')}${kpi(iso==='all'?'กลุ่มประเทศครบทุกปีในช่วง':(one?.country||selected[0]?.country||'ประเทศที่เลือก'),iso==='all'?fmt(countrySet.length):(one?fmt(one.total_score):'—'),iso==='all'?'ประเทศ':'/100',iso==='all'?'ใช้กลุ่มคงที่เมื่อคำนวณแนวโน้มเฉลี่ย':(one?.status_th||'ไม่มีคะแนนในปีปลายช่วง'))}${kpi(iso==='all'?'ช่วงปีที่เลือก':'คะแนนเปลี่ยนจากต้นถึงปลายช่วง',iso==='all'?`${start}–${end}`:(one&&first?`${one.total_score-first.total_score>0?'+':''}${fmt(one.total_score-first.total_score)}`:'—'),iso==='all'?'':'จุด',iso==='all'?'แผนที่ใช้คะแนนปีปลายช่วง':'คำนวณเมื่อมีข้อมูลทั้งสองปีเท่านั้น')}${kpi('ทิศทางคะแนน','สูง = เสรี','','คะแนนนี้ไม่ใช่ระดับความปลอดภัยจาก AI')}</div>`;
  html+=card('เสรีภาพอินเทอร์เน็ตในประเทศที่มีข้อมูล','แผนที่ใช้คะแนนปี '+end+' · คลิกประเทศเพื่อดูรายละเอียดด้านล่าง · ไม่เฉลี่ยคะแนนหลายปีลงแผนที่',worldMap(latest,iso),'MAP');
  html+=card(iso==='all'?'แนวโน้มกลุ่มประเทศเดิมตลอดช่วง':'แนวโน้ม '+esc(selected[0]?.country||iso),iso==='all'?`ค่าเฉลี่ยไม่ถ่วงน้ำหนัก ${countrySet.length} ประเทศที่มีข้อมูลครบทุกปี ไม่ใช่ค่าเฉลี่ยของประชากรโลก`:'ใช้ data_year เป็นปีข้อมูล · คลิกจุดปีเพื่อปรับปีบนแผนที่และคะแนน · เว้นช่องเมื่อไม่มีคะแนน',annualChart(trend,[{key:'score',label:iso==='all'?'คะแนนเฉลี่ยกลุ่มประเทศเดิม':'คะแนนรวม',color:'#FF6D1F'}],{score:true}),'Q5');
  if(iso!=='all')html+=card('คะแนนองค์ประกอบในปี '+end,'แต่ละด้านคะแนนเต็มต่างกัน ต้องอ่านคู่กับคะแนนเต็ม',one?`<div class="mini-grid"><div class="mini">การเข้าถึงอินเทอร์เน็ต<b>${one.obstacles_to_access} / 25</b></div><div class="mini">การจำกัดเนื้อหา<b>${one.limits_on_content} / 35</b></div><div class="mini">สิทธิผู้ใช้<b>${one.violations_of_user_rights} / 40</b></div></div><p class="subtitle">ปีข้อมูล ${one.data_year} · รายงานฉบับ ${one.report_edition} · คะแนนสูงหมายถึงเสรีมากขึ้น</p>`:empty('ไม่มีข้อมูลประเทศนี้ในปีปลายช่วง'),'DETAIL');
  html+=`<a class="download" href="../data/processed/freedom_country_year_clean.csv" download>ดาวน์โหลดคะแนนประเทศ–ปี ↓</a>`;
  if(iso!=='all'&&one){html+=`<div class="insight">${esc(one.country)} ปี ${end}: <strong>${one.total_score}/100 · ${esc(one.status_th)}</strong>${first?` · ${one.total_score-first.total_score>0?'เพิ่มขึ้น':one.total_score-first.total_score<0?'ลดลง':'คงเดิม'} ${Math.abs(one.total_score-first.total_score)} จุดจากปี ${start}`:' · ไม่มีคะแนนปีต้นช่วงสำหรับคำนวณการเปลี่ยนแปลง'}<br>การเปลี่ยนแปลงคะแนนนี้เป็นบริบทเสรีภาพ ไม่ใช่หลักฐานว่าความเสี่ยง AI เพิ่มหรือลด</div>`;}
  $('freedom-results').innerHTML=html;
  window.dispatchEvent(new CustomEvent('signal-freedom-change'));
  $('freedom-results').querySelectorAll('[data-freedom-year]').forEach(el=>{const choose=()=>{$('freedom-end').value=el.dataset.freedomYear;updateFreedom();};el.onclick=choose;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
  $('freedom-results').querySelectorAll('[data-country]').forEach(el=>{const choose=()=>{$('freedom-country').value=el.dataset.country;updateFreedom();};el.onclick=choose;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
 }


 window.FreedomView={setup:setupFreedom,update:updateFreedom};
})();
