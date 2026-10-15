"use strict";
(() => {
  const h = window.CS44_HISTORY;
  if (!h) return;
  const $ = id => document.getElementById(id);
  const years = [2024, 2025, 2026];
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  h.years[2026].categories.forEach(c => { const o = document.createElement("option"); o.value = c.code; o.textContent = c.name; $("annual-category").append(o); });
  $("annual-category").value = "project_problem_based";
  $("annual-baseline").textContent = `All three years use the same ${h.ruleCount}-rule taxonomy (${h.taxonomyVersion}). The recomputed 2026 dataset exactly reproduces the original dashboard's category results and evidence records. Missing outlines are excluded, not counted as zero evidence.`;
  function rows() {
    const category = $("annual-category").value, common = $("annual-cohort").value === "common";
    return years.map(year => {
      const units = h.years[year].units.filter(u => u.status === "selected" && (!common || h.commonUnits.includes(u.code)));
      const totals = level => {
        const cohort = units.filter(u => level === "ALL" || u.level === level);
        const cats = cohort.map(u => u.categories.find(c => c.code === category));
        const positive = cats.filter(c => c.positive).length;
        return { analysed: cohort.length, positive, rate: cohort.length ? positive / cohort.length * 100 : null, items: cats.reduce((n,c)=>n+c.items,0), review: cats.reduce((n,c)=>n+c.review,0) };
      };
      return { year, ALL: totals("ALL"), UG: totals("UG"), PG: totals("PG") };
    });
  }
  function chart(target, series, percent, title) {
    const w = 600, ht = 285, left = 48, top = 28, bottom = 48;
    const max = percent ? 100 : Math.max(4, Math.ceil(Math.max(...series.flatMap(s=>s.values).filter(v=>v!==null)) / 4) * 4);
    const x = i => left + i * 250, y = v => ht - bottom - (ht-top-bottom)*v/max;
    let svg = `<svg viewBox="0 0 ${w} ${ht}" role="img" aria-label="${esc(title)}. Exact values in the annual table below.">`;
    for (let i=0;i<=4;i++) { const v=max*i/4; svg+=`<path d="M${left} ${y(v)}H570" stroke="#e3e9ef"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${v}${percent?'%':''}</text>`; }
    years.forEach((year,i)=>{svg+=`<text x="${x(i)}" y="263" text-anchor="middle">${year}</text>`;});
    series.forEach(s=>{
      let path="";
      s.values.forEach((v,i)=>{if(v!==null)path+=`${i&&s.values[i-1]!==null?'L':'M'}${x(i)} ${y(v)} `;});
      svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash?'stroke-dasharray="6 4"':''}/>`;
      s.values.forEach((v,i)=>{if(v!==null)svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="${s.color}"><title>${s.name}, ${years[i]}: ${v.toFixed(percent?1:0)}${percent?'%':''}</title></circle>`;});
    });
    svg+='</svg>';
    $(target).innerHTML=`<div class="legend">${series.map(s=>`<span><i class="dot" style="background:${s.color}"></i>${s.name}${s.dash?' (dashed)':''}</span>`).join('')}</div>`+svg;
  }
  function render() {
    const data = rows();
    const common = $("annual-cohort").value === "common";
    $("annual-context").textContent = common ? `Same ${h.commonUnits.length} courses in every year. Sessions can differ; inspect coverage below.` : `All available courses: ${data.map(r=>`${r.year}: ${r.ALL.analysed}/27`).join(' · ')}. Changing coverage can affect the trend.`;
    const colors=['#237e91','#3165ad','#a96924'];
    chart('annual-prevalence',['ALL','UG','PG'].map((l,i)=>({name:l==='ALL'?'All courses':l,color:colors[i],dash:i===2,values:data.map(r=>r[l].rate)})),true,'Share of courses with positive evidence');
    chart('annual-volume',[{name:'Positive records',color:'#237e91',values:data.map(r=>r.ALL.analysed?r.ALL.items:null)},{name:'Review-only records',color:'#a96924',dash:true,values:data.map(r=>r.ALL.analysed?r.ALL.review:null)}],false,'Category evidence records by year');
    $("annual-values").innerHTML=data.map(r=>['ALL','UG','PG'].map(l=>{const t=r[l];return `<tr><td>${r.year}</td><td>${l}</td><td>${t.analysed}</td><td>${t.positive}</td><td>${t.rate===null?'—':t.rate.toFixed(1)+'%'}</td><td>${t.items}</td><td>${t.review}</td></tr>`;}).join('')).join('');
    const start=data[0].ALL.rate,end=data[2].ALL.rate;
    $("annual-change").textContent=start===null||end===null?'Insufficient coverage to calculate a change.':`2024 → 2026: ${start.toFixed(1)}% → ${end.toFixed(1)}% (${end-start>=0?'+':''}${(end-start).toFixed(1)} percentage points). This measures recorded outline evidence, not teaching quality or causation.`;
  }
  $("annual-category").addEventListener('change',render); $("annual-cohort").addEventListener('change',render);
  $("annual-coverage").innerHTML=years.map(year=>h.years[year].units.map(u=>`<tr><td>${year}</td><td>${esc(u.code)}</td><td>${u.level}</td><td>${u.status==='selected'?'Available':'Unavailable'}</td><td>${esc(u.session||u.error||'Missing')}</td><td>${u.status==='selected'?`<a href="${esc(u.url)}" target="_blank" rel="noopener noreferrer">Outline ↗</a>`:'—'}</td></tr>`).join('')).join('');
  render();
})();
