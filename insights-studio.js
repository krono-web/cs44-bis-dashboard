"use strict";
(() => {
  const h = window.CS44_HISTORY, $ = id => document.getElementById(id);
  if (!h || !$("studio")) return;
  const years = [2024, 2025, 2026], cats = h.years[2026].categories;
  const short = n => n.replace("Work-Integrated and Applied Learning","Work-integrated").replace("Project- and Problem-Based Learning","Project / problem").replace("Technology-Mediated Learning","Technology-mediated").replace("Entrepreneurial Learning","Entrepreneurial").replace("Community Learning","Community").replace("Case-Based Learning","Case-based").replace("Simulation","Simulation").replace("Research-Integrated Learning","Research-integrated");
  const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let activeYear=2024, timer=null, selectedCategory=cats[0].code;
  const selectedUnits = year => h.years[year].units.filter(u=>u.status==="selected" && h.commonUnits.includes(u.code));
  const catFor = (u,code) => u.categories.find(c=>c.code===code) || {positive:false,items:0,review:0,score:0};
  const rate = (year,code,level="ALL") => { const us=selectedUnits(year).filter(u=>level==="ALL"||u.level===level); return us.length?us.filter(u=>catFor(u,code).positive).length/us.length*100:0; };
  const fmt = n => `${n>=0?"+":""}${n.toFixed(1)} pp`;

  function heatmap(){
    const cells = cats.map(c=>`<div class="heat-row"><span>${esc(short(c.name))}</span>${years.map(y=>{const v=rate(y,c.code);const light=96-v*.42;return `<button type="button" class="heat-cell${y===activeYear&&c.code===selectedCategory?' selected':''}" data-heat-year="${y}" data-heat-cat="${c.code}" style="--heat:${light}%" aria-label="${esc(c.name)}, ${y}: ${v.toFixed(1)}%"><strong>${v.toFixed(0)}%</strong></button>`}).join("")}</div>`).join("");
    $("annual-heatmap").innerHTML=`<div class="heat-head"><span>Teaching category</span>${years.map(y=>`<b>${y}</b>`).join("")}</div>${cells}<div class="heat-scale"><span>Lower</span><i></i><span>Higher prevalence</span></div>`;
    $("annual-heatmap").querySelectorAll("[data-heat-year]").forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.heatCat;setYear(+b.dataset.heatYear)});
  }

  function changeCards(){
    const changes=cats.map(c=>({c,start:rate(2024,c.code),end:rate(2026,c.code)})).map(x=>({...x,d:x.end-x.start}));
    const rise=[...changes].sort((a,b)=>b.d-a.d)[0], fall=[...changes].sort((a,b)=>a.d-b.d)[0];
    const stable=[...changes].sort((a,b)=>Math.abs(a.d)-Math.abs(b.d))[0];
    const current=[...cats].map(c=>({c,v:rate(activeYear,c.code)})).sort((a,b)=>b.v-a.v)[0];
    const cards=[
      ["Largest rise",short(rise.c.name),fmt(rise.d),"up"],
      ["Largest fall",short(fall.c.name),fmt(fall.d),fall.d<0?"down":"flat"],
      [`${activeYear} leader`,short(current.c.name),`${current.v.toFixed(1)}%`,"current"],
      ["Most stable",short(stable.c.name),`${Math.abs(stable.d).toFixed(1)} pp change`,"flat"]
    ];
    $("change-cards").innerHTML=cards.map(([k,n,v,t])=>`<article class="change-card ${t}"><span>${k}</span><strong>${esc(n)}</strong><b class="count-up" data-number="${parseFloat(v)}">${esc(v)}</b><small>Common-course cohort · positive evidence</small></article>`).join("");
  }

  function radar(){
    const w=520,ht=360,cx=260,cy=178,r=128,n=cats.length,pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/n,rr=r*v/100;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]};
    let svg=`<svg viewBox="0 0 ${w} ${ht}" role="img" aria-label="UG and PG teaching profile for ${activeYear}">`;
    [25,50,75,100].forEach(v=>svg+=`<polygon points="${cats.map((_,i)=>pt(i,v).join(',')).join(' ')}" class="radar-grid"/>`);
    cats.forEach((c,i)=>{const p=pt(i,100),l=pt(i,118);svg+=`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" class="radar-axis"/><text x="${l[0]}" y="${l[1]}" text-anchor="${Math.abs(l[0]-cx)<12?'middle':l[0]<cx?'end':'start'}">${esc(short(c.name))}</text>`});
    [["UG","#2e6db1"],["PG","#c8732f"]].forEach(([level,color])=>{const vals=cats.map(c=>rate(activeYear,c.code,level));svg+=`<polygon points="${vals.map((v,i)=>pt(i,v).join(',')).join(' ')}" fill="${color}" stroke="${color}" class="radar-area"><title>${level}: ${vals.map((v,i)=>`${short(cats[i].name)} ${v.toFixed(1)}%`).join('; ')}</title></polygon>`});
    svg+=`</svg><div class="legend radar-legend"><span><i class="dot" style="background:#2e6db1"></i>UG</span><span><i class="dot" style="background:#c8732f"></i>PG</span></div>`;
    $("cohort-radar").innerHTML=svg; $("radar-year-label").textContent=activeYear;
  }

  function timeline(){
    const code=$("timeline-unit").value || h.commonUnits[0];
    $("course-timeline").innerHTML=years.map(y=>{const u=h.years[y].units.find(x=>x.code===code), positives=cats.filter(c=>u&&catFor(u,c.code).positive);return `<article class="timeline-year${y===activeYear?' active':''}"><div class="timeline-marker"><span>${y}</span></div><div><strong>${positives.length} of ${cats.length} categories</strong><div class="timeline-dots">${cats.map(c=>`<i class="${u&&catFor(u,c.code).positive?'on':''}" title="${esc(c.name)}: ${u&&catFor(u,c.code).positive?'positive evidence':'no positive evidence'}"></i>`).join("")}</div><p>${positives.length?positives.map(c=>esc(short(c.name))).join(" · "):"No positive category evidence in the saved outline"}</p></div></article>`}).join("");
  }

  function flow(){
    const yr=h.years[activeYear], units=yr.units.filter(u=>u.status==="selected"), ev=yr.evidence||{};
    const sections=["Overview","Learning outcome","Assessment","Assessment detail","Weekly schedule"];
    const top=cats.map(c=>({c,n:units.reduce((n,u)=>n+(ev[u.code]?.[c.code]||[]).filter(e=>e.k==="p").length,0)})).sort((a,b)=>b.n-a.n).slice(0,5);
    const links=[]; top.forEach((x,ci)=>sections.forEach((s,si)=>{const n=units.reduce((a,u)=>a+(ev[u.code]?.[x.c.code]||[]).filter(e=>e.k==="p"&&e.s===s).length,0);if(n)links.push({si,ci,n,level:null})}));
    top.forEach((x,ci)=>["UG","PG"].forEach((level,li)=>{const n=units.filter(u=>u.level===level).reduce((a,u)=>a+(ev[u.code]?.[x.c.code]||[]).filter(e=>e.k==="p").length,0);if(n)links.push({ci,n,li,level})}));
    const max=Math.max(1,...links.map(l=>l.n)), x1=120,x2=390,x3=655, svg=[];
    links.filter(l=>!l.level).forEach(l=>{const y1=42+l.si*55,y2=42+l.ci*64,sw=1+l.n/max*13;svg.push(`<path d="M${x1},${y1} C240,${y1} 270,${y2} ${x2},${y2}" class="flow-link source" style="stroke-width:${sw}"><title>${sections[l.si]} → ${short(top[l.ci].c.name)}: ${l.n} records</title></path>`)});
    links.filter(l=>l.level).forEach(l=>{const y1=42+l.ci*64,y2=118+l.li*120,sw=1+l.n/max*13;svg.push(`<path d="M${x2},${y1} C500,${y1} 545,${y2} ${x3},${y2}" class="flow-link ${l.level.toLowerCase()}" style="stroke-width:${sw}"><title>${short(top[l.ci].c.name)} → ${l.level}: ${l.n} records</title></path>`)});
    sections.forEach((s,i)=>svg.push(`<text x="${x1-9}" y="${46+i*55}" text-anchor="end">${s.replace('Learning outcome','Outcomes').replace('Assessment detail','Assessment detail').replace('Weekly schedule','Weekly')}</text>`));
    top.forEach((x,i)=>svg.push(`<text x="${x2}" y="${46+i*64}" text-anchor="middle">${esc(short(x.c.name))}</text>`));
    ["UG","PG"].forEach((l,i)=>svg.push(`<text x="${x3+9}" y="${122+i*120}">${l}</text>`));
    $("evidence-flow").innerHTML=`<svg viewBox="0 0 760 330" role="img" aria-label="Evidence flow for ${activeYear}">${svg.join("")}</svg>`; $("flow-year-label").textContent=activeYear;
  }

  function insights(){
    const us=selectedUnits(activeYear), ranked=cats.map(c=>({c,r:rate(activeYear,c.code),ug:rate(activeYear,c.code,"UG"),pg:rate(activeYear,c.code,"PG"),items:us.reduce((n,u)=>n+catFor(u,c.code).items,0)})).sort((a,b)=>b.r-a.r);
    const lead=ranked[0], gap=[...ranked].sort((a,b)=>Math.abs(b.ug-b.pg)-Math.abs(a.ug-a.pg))[0], volume=[...ranked].sort((a,b)=>b.items-a.items)[0];
    const prev=activeYear===2024?null:cats.map(c=>({c,d:rate(activeYear,c.code)-rate(activeYear-1,c.code)})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))[0];
    const list=[
      ["Most prevalent",`${short(lead.c.name)} appears in ${lead.r.toFixed(1)}% of the common-course cohort.`],
      ["Largest cohort gap",`${short(gap.c.name)} differs by ${Math.abs(gap.ug-gap.pg).toFixed(1)} percentage points between UG and PG.`],
      ["Highest evidence volume",`${short(volume.c.name)} contains ${volume.items} positive evidence records across the common cohort.`],
      [prev?"Biggest year-on-year movement":"Baseline year",prev?`${short(prev.c.name)} moved ${fmt(prev.d)} from ${activeYear-1}.`:`${activeYear} provides the baseline for year-on-year comparisons.`]
    ];
    $("smart-insight-cards").innerHTML=list.map((x,i)=>`<article class="smart-card"><span>0${i+1}</span><h3>${x[0]}</h3><p>${esc(x[1])}</p><button type="button" data-insight-question="Explain the ${activeYear} ${x[0].toLowerCase()}: ${esc(x[1])}">Explore evidence ↗</button></article>`).join("");
    $("smart-insight-cards").querySelectorAll("[data-insight-question]").forEach(b=>b.onclick=()=>ask(b.dataset.insightQuestion));
  }

  function summary(){
    const ranked=cats.map(c=>({c,r:rate(activeYear,c.code)})).sort((a,b)=>b.r-a.r), top=ranked[0], bottom=ranked.at(-1);
    const selectedName=cats.find(c=>c.code===selectedCategory)?.name||selectedCategory;
    return `CS-44 BIS Evidence Dashboard — Executive Summary\nSelected year: ${activeYear}\nTaxonomy: v6.3.1 (${h.ruleCount} rules)\nCohort: ${h.commonUnits.length} courses available in all three years\n\n• Highest recorded prevalence: ${short(top.c.name)} (${top.r.toFixed(1)}%).\n• Lowest recorded prevalence: ${short(bottom.c.name)} (${bottom.r.toFixed(1)}%).\n• 2024–2026 change for ${short(selectedName)}: ${fmt(rate(2026,selectedCategory)-rate(2024,selectedCategory))}.\n\nInterpretation: Results describe evidence recorded in saved public unit outlines. They are preliminary automated classifications, not ratings of teaching quality. No match does not prove that a method is absent.`;
  }
  function ask(q){const input=$("ask-question");if(input){input.value=q;$("assistant").scrollIntoView({behavior:"smooth"});input.focus()}}
  function setYear(y){activeYear=y;$("studio-year").textContent=y;document.querySelectorAll("[data-studio-year]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.studioYear===y)));changeCards();heatmap();radar();timeline();flow();insights()}

  h.commonUnits.forEach(code=>{const u=h.years[2026].units.find(x=>x.code===code),o=document.createElement("option");o.value=code;o.textContent=`${code}${u?.title?` · ${u.title}`:""}`;$("timeline-unit").append(o)}); $("timeline-unit").value=h.commonUnits.includes("INFS6600")?"INFS6600":h.commonUnits[0];
  $("timeline-unit").onchange=timeline; document.querySelectorAll("[data-studio-year]").forEach(b=>b.onclick=()=>setYear(+b.dataset.studioYear));
  $("year-play").onclick=()=>{if(timer){clearInterval(timer);timer=null;$("year-play").textContent="▶ Play";return}$("year-play").textContent="❚❚ Pause";timer=setInterval(()=>setYear(years[(years.indexOf(activeYear)+1)%years.length]),1500)};
  const dark=localStorage.getItem("cs44-theme")==="dark";document.documentElement.dataset.theme=dark?"dark":"light";$("theme-toggle").setAttribute("aria-pressed",dark);$("theme-toggle").textContent=dark?"☀ Light mode":"◐ Dark mode";
  $("theme-toggle").onclick=()=>{const on=document.documentElement.dataset.theme!=="dark";document.documentElement.dataset.theme=on?"dark":"light";localStorage.setItem("cs44-theme",on?"dark":"light");$("theme-toggle").setAttribute("aria-pressed",on);$("theme-toggle").textContent=on?"☀ Light mode":"◐ Dark mode"};
  $("summary-copy").onclick=async()=>{await navigator.clipboard.writeText(summary());const b=$("summary-copy"),old=b.textContent;b.textContent="Copied ✓";setTimeout(()=>b.textContent=old,1600)};
  $("summary-download").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([summary()],{type:"text/plain"}));a.download=`CS44-executive-summary-${activeYear}.txt`;a.click();URL.revokeObjectURL(a.href)};
  $("ask-insights").onclick=()=>ask(`Summarise the most important evidence patterns for ${activeYear}, compare UG and PG, and cite the relevant saved evidence.`);
  setYear(2024);
})();
