/* AIID is the primary fact table. Context pages have independent time filters. */
(() => {
 const C=window.CONTEXT_DATA;
 Object.assign(riskNames,{'Privacy & Security':'ความเป็นส่วนตัวและความมั่นคง','Socioeconomic & Environmental Harms':'สังคม เศรษฐกิจ และสิ่งแวดล้อม'});
 const tally=(rows,key)=>{const m=new Map();for(const r of rows){const k=r[key]||'ไม่ระบุ';m.set(k,(m.get(k)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]);};
 const options=(items,selected)=>items.map(x=>{const value=Array.isArray(x)?x[0]:x,label=Array.isArray(x)?x[1]:x;return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;}).join('');
 const safeLink=id=>`https://incidentdatabase.ai/cite/${encodeURIComponent(id)}/`;
 function annualChart(rows,series,{score=false,unit='เหตุการณ์'}={}){
  if(!rows.length)return empty();
  const w=800,h=265,l=55,r=25,t=18,b=42,pw=w-l-r,ph=h-t-b,max=score?100:Math.max(...rows.flatMap(x=>series.map(s=>x[s.key]??0)),1)*1.12;
  const step=pw/rows.length,bw=Math.min(32,step/(series.length+1)),y=v=>t+ph-v/max*ph;
  let s=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="แนวโน้มรายปี">`;
  for(let i=0;i<=4;i++){const v=max*i/4;s+=`<line class="gridline" x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}
  series.forEach((ss,j)=>{
   if(score){let path='',on=false;rows.forEach((rr,i)=>{if(rr[ss.key]==null){on=false;return;}const x=l+step*(i+.5);path+=`${on?'L':'M'}${x},${y(rr[ss.key])} `;on=true;});s+=`<path d="${path}" fill="none" stroke="${ss.color}" stroke-width="3"/>`;}
   rows.forEach((rr,i)=>{const v=rr[ss.key];if(v==null)return;const x=l+step*(i+.5);const text=`${rr.year}\n${ss.label}: ${fmt(v,score?1:0)}${score?' / 100':' '+unit}`;s+=score?`<circle ${tip(text)} cx="${x}" cy="${y(v)}" r="5" fill="${ss.color}"/>`:`<rect ${tip(text)} x="${x+(j-series.length/2)*bw}" y="${y(v)}" width="${bw-2}" height="${t+ph-y(v)}" rx="2" fill="${ss.color}"/>`;});
  });
  rows.forEach((rr,i)=>{if(i%Math.max(1,Math.ceil(rows.length/15))===0)s+=`<text x="${l+step*(i+.5)}" y="${h-13}" text-anchor="middle">${rr.year}</text>`;});
  return `<div class="legend">${series.map(ss=>`<span><i style="background:${ss.color}"></i>${ss.label}</span>`).join('')}</div><div class="chart">${s}</svg></div>`;
 }

 function setupAI(){
  const years=[...new Set(D.ai.map(r=>r.year))].sort((a,b)=>a-b),risks=tally(D.ai,'Risk Domain').filter(([k])=>k!=='ไม่ระบุ'),countries=tally(D.ai,'Country Code').filter(([k])=>k!=='ไม่ระบุ').sort((a,b)=>a[0].localeCompare(b[0]));
  $('ai').innerHTML=`<div class="notice neutral"><strong>ตารางหลัก: AIID_Excel_Export-20261026.xlsx · ชีต Incidents</strong><br>1 แถว = 1 เหตุการณ์ · นับ Incident ID ไม่ซ้ำ · เลือกช่วงปีเหตุการณ์ได้ · ปี 2026 ยังไม่เต็มปี และจำนวนที่บันทึกไม่ใช่จำนวนเหตุทั้งหมดที่เกิดขึ้นจริง</div><div class="filters" style="margin-bottom:18px"><label>ปีเหตุการณ์เริ่มต้น<select id="main-ai-start">${options(years,2015)}</select></label><label>ถึงปี<select id="main-ai-end">${options(years,2026)}</select></label><label>ประเภทความเสี่ยง<select id="main-ai-risk">${options([['all','ทุกหมวด รวมไม่ระบุ'],...risks.map(([k])=>[k,riskNames[k]||k]),['unknown','ไม่ระบุหมวด']],'all')}</select></label><label>ประเทศที่ระบุใน AIID<select id="main-ai-country">${options([['all','ทั้งหมด รวมไม่ระบุ'],['unknown','ไม่ระบุประเทศ'],...countries.map(([k,n])=>[k,`${k} · ${n} เหตุการณ์ทั้งฐาน`])],'all')}</select></label></div><div id="main-ai-results"></div>`;
  ['main-ai-start','main-ai-end','main-ai-risk','main-ai-country'].forEach(id=>$(id).onchange=updateAI);
  updateAI();
 }
 function updateAI(){
  const start=+$('main-ai-start').value,end=+$('main-ai-end').value,risk=$('main-ai-risk').value,country=$('main-ai-country').value;
  if(start>end){$('main-ai-results').innerHTML=empty('ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด');return;}
  const rows=D.ai.filter(r=>r.year>=start&&r.year<=end&&(risk==='all'||(risk==='unknown'?!r['Risk Domain']:r['Risk Domain']===risk))&&(country==='all'||(country==='unknown'?!r['Country Code']:r['Country Code']===country)));
  const classified=rows.filter(r=>r['Risk Domain']),mis=rows.filter(r=>r['Risk Domain']==='Misinformation'),knownCountry=rows.filter(r=>r['Country Code']);
  const years=Array.from({length:end-start+1},(_,i)=>start+i),trend=years.map(year=>({year,total:rows.filter(r=>r.year===year).length,mis:mis.filter(r=>r.year===year).length}));
  const risks=tally(classified,'Risk Domain'),intents=tally(rows,'Intent'),intentNames={Intentional:'ตั้งใจ',Unintentional:'ไม่ตั้งใจ',Other:'อื่น ๆ','ไม่ระบุ':'ไม่ระบุ'};
  const top=rows.filter(r=>r.report_count!=null).sort((a,b)=>b.report_count-a.report_count).slice(0,5);
  let html=`<div class="kpis">${kpi('เหตุการณ์ในช่วงและตัวกรองที่เลือก',fmt(rows.length),'เหตุการณ์',`จาก ${fmt(D.ai.length)} เหตุการณ์ใน snapshot หลัก`)}${kpi('ได้รับการจัดหมวดความเสี่ยง',fmt(classified.length),'เหตุการณ์',`${rows.length?fmt(100*classified.length/rows.length,1):'—'}% ของผลที่เลือก`)}${kpi('หมวด Misinformation',fmt(mis.length),'เหตุการณ์',`${classified.length?fmt(100*mis.length/classified.length,1)+'%':'—'} ของเหตุการณ์ที่มี Risk Domain`)}${kpi('มีประเทศระบุ',fmt(knownCountry.length),'เหตุการณ์',`ไม่ระบุประเทศ ${fmt(rows.length-knownCountry.length)} เหตุการณ์`)}</div>`;
  html+=`<div class="notice">ทั้ง snapshot มีประเทศระบุ ${fmt(D.ai.filter(r=>r['Country Code']).length)} / ${fmt(D.ai.length)} เหตุการณ์ จึงไม่ใช้ยอด AIID ทำแผนที่ความเสี่ยงประเทศ · การกรองประเทศเลือกเฉพาะรายการที่ระบุ ไม่ได้แปลว่าประเทศที่ไม่มีรายการไม่มีเหตุการณ์</div>`;
  html+=card('ฐานนี้บันทึกเหตุการณ์และข้อมูลเท็จเปลี่ยนไปอย่างไร?','ปีจาก date ของเหตุการณ์ · แท่ง Misinformation เป็นส่วนหนึ่งของแท่งทั้งหมด ไม่ใช่ยอดที่นำมาบวกกัน · ปีล่าสุดยังไม่เต็มปี',annualChart(trend,[{key:'total',label:'เหตุการณ์ทั้งหมดที่เลือก',color:'#8daab9'},{key:'mis',label:'ในหมวด Misinformation',color:'#147f79'}]),'Q1');
  html+=`<div class="grid equal">${card('ประเภทความเสี่ยงใดถูกบันทึกมากที่สุด?','ตัวหารของสัดส่วนใช้เฉพาะรายการที่มี Risk Domain',bars(risks.map(([k,n])=>({label:riskNames[k]||k,value:n,color:k==='Misinformation'?'#147f79':'#8daab9',tip:`${k}\n${n} เหตุการณ์ · ${fmt(100*n/classified.length,1)}% ของที่มีหมวด`})),{left:255})+`<div class="insight">ไม่ระบุหมวด <strong>${fmt(rows.length-classified.length)} เหตุการณ์</strong>${risks.length?`<br>อันดับหนึ่งในผลที่เลือก: <strong>${esc(riskNames[risks[0][0]]||risks[0][0])}</strong> (${fmt(risks[0][1])} เหตุการณ์)`:''}</div>`,'Q2')}${card('เจตนาที่ฐานข้อมูลระบุเป็นอย่างไร?','ใช้ Intent ตามการจัดหมวดเดิม ไม่อนุมานเจตนาจากข้อความ',bars(intents.map(([k,n])=>({label:intentNames[k]||k,value:n,color:k==='ไม่ระบุ'?'#bac6cc':'#628ba5'})))+`<p class="subtitle">เจตนาที่มีการระบุอาจมาจากมนุษย์หรือ AI ตามระบบจัดหมวด ไม่ใช่ข้อสรุปว่า AI มีเจตนาเหมือนมนุษย์</p>`,'Q3')}</div>`;
  html+=card('เหตุการณ์ใดมีข่าวรายงานมากในฐานนี้?','เรียง report_count · จำนวนข่าวไม่ใช่ระดับความรุนแรงหรือจำนวนผู้เสียหาย',`<div class="table-wrap"><table><thead><tr><th>วันที่เกิดเหตุ</th><th>เหตุการณ์</th><th>หมวดความเสี่ยง</th><th>จำนวนข่าว</th></tr></thead><tbody>${top.map(r=>`<tr><td>${shortDate(r.date)}</td><td><a href="${safeLink(r['Incident ID'])}" target="_blank" rel="noopener">${esc(r.title)} ↗</a><details><summary>อ่านคำอธิบายต้นทาง</summary>${esc(r.description)}</details></td><td>${esc(riskNames[r['Risk Domain']]||r['Risk Domain']||'ไม่ระบุ')}</td><td class="num">${fmt(r.report_count)}</td></tr>`).join('')}</tbody></table>${!top.length?empty():''}</div>`,'Q4');
  $('main-ai-results').innerHTML=html;
 }

 function setupFreedom(){
  const countries=[...new Map(C.freedom.map(r=>[r.iso3,r.country])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const years=Array.from({length:15},(_,i)=>2010+i);
  $('freedom').innerHTML=`<div class="notice neutral">Freedom on the Net เป็นคะแนนประเมินเสรีภาพอินเทอร์เน็ต ไม่ใช่คะแนนความปลอดภัยหรือปริมาณข่าวปลอม · ข้อมูล 72 ประเทศตลอดปี 2010–2024 แต่แต่ละปีมีประเทศไม่เท่ากัน · ดูแยกจากเหตุการณ์ AI ไม่อ้างความสัมพันธ์เชิงเหตุผล</div><div class="filters" style="margin-bottom:20px"><label>ช่วงปีเริ่มต้น<select id="freedom-start">${options(years,2015)}</select></label><label>ถึงปี / ปีบนแผนที่<select id="freedom-end">${options(years,2024)}</select></label><label>ประเทศสำหรับรายละเอียด<select id="freedom-country">${options([['all','ภาพรวมประเทศที่มีข้อมูล'],...countries],'all')}</select></label></div><div id="freedom-results"></div>`;
  ['freedom-start','freedom-end','freedom-country'].forEach(id=>$(id).onchange=updateFreedom);
  updateFreedom();
 }
 function scoreColor(v){if(v==null)return '#dce3e8';const a=v<=50?[197,113,93]:[219,185,111],b=v<=50?[219,185,111]:[31,139,121],t=v<=50?v/50:(v-50)/50;return `rgb(${a.map((n,i)=>Math.round(n+(b[i]-n)*t)).join(',')})`;}
 function worldMap(rows,selected){
  const byISO=new Map(rows.map(r=>[r.iso3,r]));
  const project=([lon,lat])=>[(lon+180)*2.4+8,(85-Math.min(85,Math.max(-60,lat)))*2.4+8];
  function ringPath(ring){let last=null,s='';for(const p of ring){const xy=project(p);s+=(!last||Math.abs(p[0]-last[0])>180?'M':'L')+xy.map(n=>n.toFixed(1)).join(',');last=p;}return s+'Z';}
  let paths='';
  for(const f of C.world){if(f.iso3==='ATA')continue;const data=byISO.get(f.iso3),g=f.geometry,polys=g.type==='MultiPolygon'?g.coordinates:[g.coordinates],d=polys.map(p=>p.map(ringPath).join(' ')).join(' ');const t=`${data?.country||f.name}\n${data?`${data.data_year}: ${data.total_score}/100 · ${data.status_th}`:'ไม่มีข้อมูลในปีที่เลือก'}`;
   paths+=`<path d="${d}" fill="${scoreColor(data?.total_score)}" stroke="${selected===f.iso3?'#d57532':'#fff'}" stroke-width="${selected===f.iso3?2:.5}" ${tip(t)} ${data?`data-country="${f.iso3}" role="button" aria-label="ดู ${esc(data.country)}" class="country-hit"`:''}/>`;
  }
  const mapped=new Set(C.world.map(f=>f.iso3));
  return `<div class="world-chart"><svg viewBox="0 0 880 370" role="group" aria-label="แผนที่คะแนนเสรีภาพอินเทอร์เน็ต">${paths}</svg></div><div class="map-legend"><span>0 · คะแนนต่ำ</span><span class="score-gradient"></span><span>100 · เสรีมากขึ้น</span><span><i style="background:#dce3e8"></i>ไม่มีข้อมูล</span></div><p class="subtitle">แสดงขอบเขตได้ ${rows.filter(r=>mapped.has(r.iso3)).length} จาก ${rows.length} ประเทศที่มีคะแนนปีนี้ ประเทศขนาดเล็กอาจเลือกบนแผนที่ไม่ได้ ให้เลือกจากเมนูแทน · ขอบเขต Natural Earth 1:110m ไม่ใช่ข้อยืนยันสถานะทางการเมือง</p>`;
 }
 function updateFreedom(){
  const start=+$('freedom-start').value,end=+$('freedom-end').value,iso=$('freedom-country').value;
  if(start>end){$('freedom-results').innerHTML=empty('ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด');return;}
  const latest=C.freedom.filter(r=>r.data_year===end),years=Array.from({length:end-start+1},(_,i)=>start+i),one=latest.find(r=>r.iso3===iso),selected=C.freedom.filter(r=>r.iso3===iso),first=selected.find(r=>r.data_year===start);
  const countrySet=[...new Set(C.freedom.map(r=>r.iso3))].filter(c=>years.every(y=>C.freedom.some(r=>r.iso3===c&&r.data_year===y)));
  const trend=years.map(year=>{const r=selected.find(x=>x.data_year===year),cohort=C.freedom.filter(x=>x.data_year===year&&countrySet.includes(x.iso3));return {year,score:iso==='all'?(cohort.length?sum(cohort,'total_score')/cohort.length:null):(r?.total_score??null)};});
  let html=`<div class="kpis">${kpi('ประเทศที่มีคะแนนปี '+end,fmt(latest.length),'ประเทศ','ไม่ได้ครอบคลุมทุกประเทศในโลก')}${kpi(iso==='all'?'กลุ่มประเทศครบทุกปีในช่วง':(one?.country||selected[0]?.country||'ประเทศที่เลือก'),iso==='all'?fmt(countrySet.length):(one?fmt(one.total_score):'—'),iso==='all'?'ประเทศ':'/100',iso==='all'?'ใช้กลุ่มคงที่เมื่อคำนวณแนวโน้มเฉลี่ย':(one?.status_th||'ไม่มีคะแนนในปีปลายช่วง'))}${kpi(iso==='all'?'ช่วงปีที่เลือก':'คะแนนเปลี่ยนจากต้นถึงปลายช่วง',iso==='all'?`${start}–${end}`:(one&&first?`${one.total_score-first.total_score>0?'+':''}${fmt(one.total_score-first.total_score)}`:'—'),iso==='all'?'':'จุด',iso==='all'?'แผนที่ใช้คะแนนปีปลายช่วง':'คำนวณเมื่อมีข้อมูลทั้งสองปีเท่านั้น')}${kpi('ทิศทางคะแนน','สูง = เสรี','','คะแนนนี้ไม่ใช่ระดับความปลอดภัยจาก AI')}</div>`;
  html+=card('เสรีภาพอินเทอร์เน็ตในประเทศที่มีข้อมูล','แผนที่ใช้คะแนนปี '+end+' · คลิกประเทศเพื่อดูรายละเอียดด้านล่าง · ไม่เฉลี่ยคะแนนหลายปีลงแผนที่',worldMap(latest,iso),'MAP');
  html+=card(iso==='all'?'แนวโน้มกลุ่มประเทศเดิมตลอดช่วง':'แนวโน้ม '+esc(selected[0]?.country||iso),iso==='all'?`ค่าเฉลี่ยไม่ถ่วงน้ำหนัก ${countrySet.length} ประเทศที่มีข้อมูลครบทุกปี ไม่ใช่ค่าเฉลี่ยของประชากรโลก`:'ใช้ data_year เป็นปีข้อมูล · เว้นช่องเมื่อไม่มีคะแนน · ไม่เติมศูนย์',annualChart(trend,[{key:'score',label:iso==='all'?'คะแนนเฉลี่ยกลุ่มประเทศเดิม':'คะแนนรวม',color:'#147f79'}],{score:true}),'Q5');
  if(iso!=='all')html+=card('คะแนนองค์ประกอบในปี '+end,'แต่ละด้านคะแนนเต็มต่างกัน ต้องอ่านคู่กับคะแนนเต็ม',one?`<div class="mini-grid"><div class="mini">การเข้าถึงอินเทอร์เน็ต<b>${one.obstacles_to_access} / 25</b></div><div class="mini">การจำกัดเนื้อหา<b>${one.limits_on_content} / 35</b></div><div class="mini">สิทธิผู้ใช้<b>${one.violations_of_user_rights} / 40</b></div></div><p class="subtitle">ปีข้อมูล ${one.data_year} · รายงานฉบับ ${one.report_edition} · คะแนนสูงหมายถึงเสรีมากขึ้น</p>`:empty('ไม่มีข้อมูลประเทศนี้ในปีปลายช่วง'),'DETAIL');
  html+=`<a class="download" href="../data/processed/freedom_country_year_clean.csv" download>ดาวน์โหลดคะแนนประเทศ–ปี ↓</a>`;
  $('freedom-results').innerHTML=html;
  $('freedom-results').querySelectorAll('[data-country]').forEach(el=>{const choose=()=>{$('freedom-country').value=el.dataset.country;updateFreedom();};el.onclick=choose;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
 }

 function setupEU(){
  const years=Array.from({length:9},(_,i)=>2015+i);
  $('eu').innerHTML=`<div class="notice neutral">EUvsDisinfo ติดตามข้อมูลเท็จฝั่งสนับสนุนรัสเซีย ไม่ใช่ตัวแทนข้อมูลเท็จทั่วโลก และไม่ได้ระบุว่าบทความเหล่านี้ใช้ AI · วิเคราะห์เป็นบริบทแยกจาก AIID</div><div class="filters" style="margin-bottom:20px"><label>ปีหักล้างเริ่มต้น<select id="eu-start">${options(years,2015)}</select></label><label>ถึงปี<select id="eu-end">${options(years,2022)}</select></label></div><div id="eu-results"></div>`;
  ['eu-start','eu-end'].forEach(id=>$(id).onchange=updateEU);updateEU();
 }
 function updateEU(){
  const start=+$('eu-start').value,end=+$('eu-end').value;
  if(start>end){$('eu-results').innerHTML=empty('ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด');return;}
  const months=C.eu_month.filter(r=>+r.month.slice(0,4)>=start&&+r.month.slice(0,4)<=end),count=sum(months,'count'),years=Array.from({length:end-start+1},(_,i)=>start+i),trend=years.map(year=>({year,count:sum(months.filter(m=>+m.month.slice(0,4)===year),'count')}));
  $('eu-results').innerHTML=`<div class="kpis">${kpi('การหักล้างในช่วงที่เลือก',fmt(count),'เรื่อง','นับ debunk_id ไม่ซ้ำ ไม่ใช่นับจำนวนแถวบทความ')}${kpi('การหักล้างทั้งไฟล์',fmt(C.eu_meta.debunks),'เรื่อง',`${fmt(C.eu_meta.rows)} แถวบทความที่ผูกกับการหักล้าง`)}${kpi('วันหักล้างสุดท้ายในไฟล์',shortDate(C.eu_meta.end),'','ปี 2023 มีถึง 1 สิงหาคมเท่านั้น')}${kpi('ความเชื่อมโยงกับ AI','ไม่ระบุ','','ไม่นับรายการในฐานนี้ว่าเป็นเหตุการณ์ AI')}</div>${end===2023?'<div class="notice">ปี 2023 ไม่เต็มปี ห้ามเทียบยอดทั้งปีกับปีก่อนเพื่อสรุปว่าลดลง</div>':''}${card('การหักล้างข้อมูลบิดเบือนถูกบันทึกมากช่วงใด?','ใช้ debunk_date: วันเผยแพร่การหักล้าง ไม่ใช่วันเผยแพร่บทความหรือวันเกิดเหตุ · ปีในหน้านี้เป็นตัวกรองอิสระ',annualChart(trend,[{key:'count',label:'จำนวนการหักล้างไม่ซ้ำ',color:'#628ba5'}],{unit:'เรื่อง'}),'Q6')}<div class="insight">ใช้เป็นบริบทของงานตรวจสอบข้อมูลบิดเบือน ไม่รวมยอดกับ Misinformation ของ AIID และไม่จับคู่เหตุการณ์ด้วยปีเพียงอย่างเดียว</div><a class="download" href="../data/processed/eu_debunks_clean.csv" download>ดาวน์โหลดการหักล้างไม่ซ้ำ ↓</a>`;
 }

 // Keep the prepared Thai pages available as supplements, without treating them as the primary fact table.
 const oldQuality=renderQuality;
 renderQuality=function(){oldQuality();const box=$('quality');box.insertAdjacentHTML('afterbegin',card('แกนหลักใหม่และขอบเขตแต่ละแหล่ง','AIID ฉบับ 26 ต.ค. 2026 เป็นข้อมูลหลักของ dashboard',`<div class="method"><strong>3 แหล่งหลัก:</strong> AIID (เหตุการณ์), Freedom on the Net (ประเทศ–ปี), EUvsDisinfo (การหักล้าง)<br>แต่ละแหล่งตอบคนละคำถาม มีตัวกรองเวลาอิสระ ไม่รวมยอดเหตุการณ์ข้ามฐาน<br><strong>เชื่อมประเทศ–ปี:</strong> AIID left join คะแนน Freedom ด้วย ISO3 + ปีเหตุการณ์ ได้ ${C.ai_join_coverage.matched} จาก ${D.ai.length} เหตุการณ์ แถวไม่เพิ่มและคะแนนที่ไม่ตรงเป็นค่าว่าง ไม่ใช้ปีใกล้เคียงทดแทน<br><a class="download" href="../data/processed/ai_country_year_context.csv" download>ดาวน์โหลดตารางเชื่อมประเทศ–ปี ↓</a><br>EUvsDisinfo ไม่มีคีย์เหตุการณ์ร่วม จึงแสดงเป็นบริบทแยก<br><strong>ส่วนเสริมไทย:</strong> AFNC + ACSC เชื่อมใน weekly_panel ตามเดิม<br>แผนที่แสดงคะแนนเสรีภาพ ไม่ใช่จำนวนเหตุการณ์ AI เพราะประเทศ AIID ขาดเป็นส่วนใหญ่<br>บริบท Freedom: ปีข้อมูล 2010–2024 · EUvsDisinfo: 2015–1 ส.ค. 2023<br>แผนที่ใช้ Natural Earth public-domain boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">ที่มาและเงื่อนไข</a></div>`));};
 const pages={ai:['01 / AI INCIDENT DATABASE — PRIMARY','เหตุการณ์ AI บอกอะไรเรา?','เริ่มจากเหตุการณ์จริงที่ฐานข้อมูลบันทึก แล้วสำรวจเวลา ประเภทความเสี่ยง และเจตนาที่มีการระบุ'],freedom:['02 / FREEDOM ON THE NET','สำรวจเสรีภาพอินเทอร์เน็ตโลก','เลือกประเทศและช่วงปี เพื่อดูคะแนนและองค์ประกอบ โดยไม่ใช้แทนระดับความปลอดภัย'],eu:['03 / DISINFORMATION CONTEXT','บริบทการหักล้างข้อมูลบิดเบือน','สำรวจฐานเฉพาะของ EUvsDisinfo แยกจากเหตุการณ์ AI และคะแนนเสรีภาพ'],news:['04 / THAILAND — SUPPLEMENT','ข่าวไทยที่ถูกตรวจสอบ','ส่วนเสริมจาก AFNC ไม่ใช่ตารางหลักของงาน'],overview:['05 / THAILAND — SUPPLEMENT','คดีมาก ≠ เสียหายหนัก','ส่วนเสริมไทยจาก AFNC + ACSC ผ่าน weekly_panel'],quality:['06 / DATA NOTES','ที่มาและคุณภาพข้อมูล','แยกข้อมูลหลัก บริบท และส่วนเสริม พร้อมอธิบายสิ่งที่เชื่อมได้จริง']};
 function route(name){if(!pages[name])name='ai';tab=name;document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==name);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));['eyebrow','page-title','page-lead'].forEach((id,i)=>$(id).textContent=pages[name][i]);const thai=name==='overview'||name==='news';$('thai-filters').style.display=thai?'':'none';$('thai-filters').hidden=!thai;$('filter-caption').hidden=!thai;$('error').hidden=true;history.replaceState(null,'','#'+name);}
 document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>route(b.dataset.tab));
 document.querySelector('.brand').href='#ai';document.querySelector('.brand').onclick=e=>{e.preventDefault();route('ai');};
 setupAI();setupFreedom();setupEU();renderQuality();route(window.INITIAL_DASHBOARD_PAGE||'ai');
})();
