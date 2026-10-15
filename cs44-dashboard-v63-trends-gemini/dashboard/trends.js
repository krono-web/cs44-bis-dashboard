"use strict";
(() => {
  const data = window.CS44_DATA;
  if (!data?.units) return;
  const host = document.getElementById("weekly-trends");
  const select = document.getElementById("trend-category");
  for (const category of data.categories) {
    const option = document.createElement("option");
    option.value = category.code;
    option.textContent = category.name || category.code.replaceAll("_", " ");
    select.appendChild(option);
  }
  const records = [];
  for (const unit of data.units.filter(u => u.status === "selected")) {
    for (const [category, evidence] of Object.entries(data.evidence?.[unit.code] || {})) {
      for (const item of evidence) {
        const match = item.s === "Weekly schedule" && /^Week\s+(\d+)\s*:/i.exec(item.l || "");
        if (item.k === "p" && match) records.push({ unit: unit.code, level: unit.level, category, week: Number(match[1]) });
      }
    }
  }
  // Only the observed weekly evidence is available, not the complete teaching schedule.
  const lastWeek = Math.max(1, ...records.map(r => r.week));
  const weeks = Array.from({ length: lastWeek }, (_, i) => i + 1);
  function chart(id, series, label) {
    const width = 640, height = 290, left = 48, right = 20, top = 28, bottom = 48;
    const max = Math.max(1, ...series.flatMap(s => s.values));
    const ceiling = Math.ceil(max / 4) * 4;
    const x = i => left + i * (width - left - right) / Math.max(1, weeks.length - 1);
    const y = v => height - bottom - v / ceiling * (height - top - bottom);
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${label}. Exact values are available in the table below.</title>`;
    for (let i = 0; i <= 4; i++) {
      const value = ceiling * i / 4;
      svg += `<path d="M${left} ${y(value)}H${width-right}" stroke="#e3e9ef"/><text x="${left-10}" y="${y(value)+4}" text-anchor="end">${value}</text>`;
    }
    weeks.forEach((week, i) => { svg += `<text x="${x(i)}" y="${height-26}" text-anchor="middle">${week}</text>`; });
    svg += `<text x="${width/2}" y="${height-5}" text-anchor="middle">Teaching week</text>`;
    for (const s of series) {
      svg += `<polyline points="${s.values.map((v,i)=>`${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed?'stroke-dasharray="6 4"':''}/>`;
      s.values.forEach((v,i) => { svg += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"><title>${s.name}, week ${weeks[i]}: ${v}</title></circle>`; });
    }
    svg += "</svg>";
    const legend = `<div class="legend">${series.map(s=>`<span><i class="dot" style="background:${s.color}"></i>${s.name}${s.dashed?' (dashed)':''}</span>`).join("")}</div>`;
    const table = `<details class="trend-data"><summary>View weekly values</summary><div class="trend-scroll"><table><caption>${label}</caption><thead><tr><th>Week</th>${series.map(s=>`<th>${s.name}</th>`).join("")}</tr></thead><tbody>${weeks.map((w,i)=>`<tr><th scope="row">${w}</th>${series.map(s=>`<td>${s.values[i]}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
    document.getElementById(id).innerHTML = legend + svg + table;
  }
  function render() {
    const level = document.querySelector('[data-level][aria-pressed="true"]')?.dataset.level || "ALL";
    const selected = records.filter(r => select.value === "ALL" || r.category === select.value);
    const scoped = selected.filter(r => level === "ALL" || r.level === level);
    document.getElementById("trend-context").textContent = `${level === "ALL" ? "All units" : level} · ${scoped.length} positive weekly category-evidence records`;
    chart("weekly-volume", [{name:"Positive evidence records",color:"#237e91",values:weeks.map(w=>scoped.filter(r=>r.week===w).length)}], "Positive evidence records by week");
    chart("weekly-cohorts", ["UG","PG"].map((level,i)=>({name:level,color:i?"#a96924":"#3165ad",dashed:!!i,values:weeks.map(w=>new Set(selected.filter(r=>r.week===w && r.level===level).map(r=>r.unit)).size)})), "Units with positive weekly evidence");
  }
  select.addEventListener("change", render);
  document.querySelectorAll("[data-level], #reset, #empty-reset").forEach(button=>button.addEventListener("click",()=>queueMicrotask(render)));
  render();
})();
