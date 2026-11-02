'use strict';
const D=window.DASHBOARD_DATA;
const $=id=>document.getElementById(id);
const fmt=(v,d=0)=>v===null||v===undefined||!Number.isFinite(v)?'—':v.toLocaleString('th-TH',{maximumFractionDigits:d,minimumFractionDigits:d});
const sum=(rows,k)=>rows.reduce((s,r)=>s+(Number(r[k])||0),0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=s=>s?`${Number(s.slice(8,10))}/${Number(s.slice(5,7))}/${s.slice(0,4)}`:'—';
const thMonth=s=>`${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][Number(s.slice(5,7))-1]} ${s.slice(0,4)}`;
const million=v=>fmt(v/1e6,1);
const catNames={'Government policy & news':'นโยบายรัฐและข่าวสาร','Health products':'ผลิตภัณฑ์สุขภาพ','Finance & stocks':'การเงินและหุ้น','Disasters':'ภัยพิบัติ','Public order & security':'ความสงบและความมั่นคง','Economy':'เศรษฐกิจ','Drugs':'ยาเสพติด','Online crime':'ภัยออนไลน์','Other news':'ข่าวอื่น ๆ'};
const riskNames={'Misinformation':'ข้อมูลเท็จ','Malicious Actors & Misuse':'ผู้ประสงค์ร้ายและการใช้ผิดทาง','Discrimination and Toxicity':'การเลือกปฏิบัติและเนื้อหาเป็นพิษ','AI system safety, failures, and limitations':'ความปลอดภัยและข้อจำกัดระบบ','Privacy and Security':'ความเป็นส่วนตัวและความมั่นคง','Human-Computer Interaction':'ปฏิสัมพันธ์มนุษย์กับคอมพิวเตอร์','Socioeconomic and Environmental':'สังคม เศรษฐกิจ และสิ่งแวดล้อม'};
const colors=['#FF6D1F','#FF6D1F','#B45B2A','#B8936B','#C4AB7D','#A79C87','#C17F54'];
function card(title,sub,content,id=''){return `<article class="card"><div class="card-top"><h2>${title}</h2>${id?`<span class="card-id">${id}</span>`:''}</div><p class="subtitle">${sub}</p>${content}</article>`;}
function kpi(label,value,unit,note){return `<article class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}<small>${unit}</small></div><div class="kpi-note">${note}</div></article>`;}
function empty(text='ไม่มีข้อมูลในช่วงที่เลือก'){return `<div class="empty">${text}</div>`;}
function tip(text){return `data-tip="${esc(text)}" tabindex="0"`;}
function bars(items,{percent=false,color='#FF6D1F',unit='',height=35,left=180,width=620,decimals=0}={}){
 if(!items.length)return empty();
 const w=width,right=95,h=items.length*height+12,max=percent?100:Math.max(...items.map(r=>r.value),1),plot=w-left-right;
 let s=`<svg viewBox="0 0 ${w} ${h}" role="${items.some(r=>r.filterRisk||r.filterIntent)?'group':'img'}" aria-label="กราฟแท่งแนวนอน">`;
 items.forEach((r,i)=>{const y=i*height+8,bw=Math.max(0,r.value/max*plot);s+=`<text class="label" x="${left-12}" y="${y+14}" text-anchor="end">${esc(r.label)}</text><rect x="${left}" y="${y}" width="${plot}" height="20" rx="3" fill="#F5E7C6"/><rect ${r.filterRisk?`data-risk="${esc(r.filterRisk)}" role="button" aria-label="กรองหมวด ${esc(r.label)}"`:r.filterIntent?`data-intent="${esc(r.filterIntent)}" role="button" aria-label="กรองเจตนา ${esc(r.label)}"`:""} ${tip(r.tip||`${r.label}\n${fmt(r.value,percent?1:decimals)} ${unit}`)} x="${left}" y="${y}" width="${bw}" height="20" rx="3" fill="${r.color||color}"/><text class="value" x="${left+plot+9}" y="${y+14}">${fmt(r.value,percent?1:decimals)}${unit}</text>`;});return `<div class="chart">${s}</svg></div>`;
}

 const options=(items,selected)=>items.map(x=>{const value=Array.isArray(x)?x[0]:x,label=Array.isArray(x)?x[1]:x;return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;}).join('');

 function annualChart(rows,series,{score=false,unit='เหตุการณ์'}={}){
  if(!rows.length)return empty();
  const w=800,h=265,l=55,r=25,t=18,b=42,pw=w-l-r,ph=h-t-b,max=score?100:Math.max(...rows.flatMap(x=>series.map(s=>x[s.key]??0)),1)*1.12;
  const step=pw/rows.length,bw=Math.min(32,step/(series.length+1)),y=v=>t+ph-v/max*ph;
  let s=`<svg viewBox="0 0 ${w} ${h}" role="${score?'group':'img'}" aria-label="แนวโน้มรายปี">`;
  for(let i=0;i<=4;i++){const v=max*i/4;s+=`<line class="gridline" x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}
  series.forEach((ss,j)=>{
   if(score){let path='',on=false;rows.forEach((rr,i)=>{if(rr[ss.key]==null){on=false;return;}const x=l+step*(i+.5);path+=`${on?'L':'M'}${x},${y(rr[ss.key])} `;on=true;});s+=`<path d="${path}" fill="none" stroke="${ss.color}" stroke-width="3"/>`;}
   rows.forEach((rr,i)=>{const v=rr[ss.key];if(v==null)return;const x=l+step*(i+.5);const text=`${rr.year}\n${ss.label}: ${fmt(v,score?1:0)}${score?' / 100':' '+unit}`;s+=score?`<circle data-freedom-year="${rr.year}" role="button" aria-label="ใช้ปี ${rr.year} บนแผนที่" ${tip(text)} cx="${x}" cy="${y(v)}" r="5" fill="${ss.color}"/>`:`<rect ${tip(text)} x="${x+(j-series.length/2)*bw}" y="${y(v)}" width="${bw-2}" height="${t+ph-y(v)}" rx="2" fill="${ss.color}"/>`;});
  });
  rows.forEach((rr,i)=>{if(i%Math.max(1,Math.ceil(rows.length/15))===0)s+=`<text x="${l+step*(i+.5)}" y="${h-13}" text-anchor="middle">${rr.year}</text>`;});
  return `<div class="legend">${series.map(ss=>`<span><i style="background:${ss.color}"></i>${ss.label}</span>`).join('')}</div><div class="chart">${s}</svg></div>`;
 }

