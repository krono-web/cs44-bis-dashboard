"use strict";
(() => {
const data = window.CS44_DATA;
const datasetYear = data?.meta?.year || 2026;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
if (!data || !data.units) { $("metrics").innerHTML='<p class="empty">The saved dataset could not be loaded. Reload this page.</p>'; return; }
const order=["work_integrated_applied","project_problem_based","case_based","entrepreneurial_learning","community_learning","hybrid_learning","simulation","technology_mediated_learning"];
const names={work_integrated_applied:"Work-integrated & applied",project_problem_based:"Project & problem-based",case_based:"Case-based",entrepreneurial_learning:"Entrepreneurial",community_learning:"Community",hybrid_learning:"Hybrid",simulation:"Simulation",technology_mediated_learning:"Technology-mediated"};
const state={level:"ALL",measure:"count",category:"ALL",search:"",selected:"INFS6600",sections:"rate",rankCategory:"project_problem_based",rankMeasure:"share",rankZero:false,expanded:new Set(),strength:"ALL",section:"ALL",only:"ALL",sortKey:"code",sortDir:1,compare:"rate"};
const cat = (unit, code) => unit.categories.find(c => c.code===code);
const positiveCount = unit => unit.categories.filter(c=>c.positive===true).length;
const percent = (n,d) => d ? (100*n/d).toFixed(1) : "0.0";
const formatScore = n => Number(n).toFixed(1);
const levelUnits = () => data.units.filter(u => state.level==="ALL" || u.level===state.level);
const totalItems = u => u.categories.reduce((n,c)=>n+(c.items||0),0);
const totalScore = u => u.categories.reduce((n,c)=>n+(c.score||0),0);
const totalReview = u => u.categories.reduce((n,c)=>n+(c.review||0),0);
/* Sections holding this unit's positive evidence, limited to the category filter when one is set. */
function unitSections(u){
 const found=new Set();
 const codes=state.category==="ALL"?order:[state.category];
 for(const code of codes) for(const e of evidenceFor(u.code,code)) if(e.k==="p") found.add(e.s);
 return found;
}
function passesFilters(u){
 if(state.category!=="ALL" && cat(u,state.category)?.positive!==true) return false;
 if(!(u.code+" "+u.title).toLowerCase().includes(state.search.toLowerCase().trim())) return false;
 /* Units without an outline have no result at all, so they are not "zero evidence". */
 if(state.strength!=="ALL" && u.status!=="selected") return false;
 if(state.strength==="evidence" && positiveCount(u)===0) return false;
 if(state.strength==="none" && positiveCount(u)>0) return false;
 /* "review-only" means a category where evidence exists but nothing reached the threshold. */
 if(state.strength==="review"){
  const codes=state.category==="ALL"?order:[state.category];
  if(!codes.some(code=>{const c=cat(u,code);return c&&c.review>0&&c.positive!==true;})) return false;
 }
 if(state.section!=="ALL" && !unitSections(u).has(state.section)) return false;
 if(state.only!=="ALL"){ const s=unitSections(u); if(s.size!==1 || !s.has(state.only)) return false; }
 return true;
}
const sortValue=(u,key)=>key==="code"?u.code:key==="level"?u.level+u.code:key==="cats"?positiveCount(u):key==="items"?totalItems(u):key==="score"?totalScore(u):totalReview(u);
const filtered = () => levelUnits().filter(passesFilters).sort((a,b)=>{
 const x=sortValue(a,state.sortKey),y=sortValue(b,state.sortKey);
 const cmp=typeof x==="string"?x.localeCompare(y):x-y;
 return (cmp||a.code.localeCompare(b.code))*state.sortDir;
});
const categoryDefinition = code => data.categories.find(c=>c.code===code)?.definition || "";
for (const code of order) { const o=document.createElement("option"); o.value=code; o.textContent=names[code]; $("category").appendChild(o);
 const r=document.createElement("option"); r.value=code; r.textContent=names[code]; r.selected=code===state.rankCategory; $("rank-category").appendChild(r); }
function renderMetrics() {
 const units=levelUnits(), evaluated=units.filter(u=>u.status==="selected"), missing=units.length-evaluated.length;
 const rows=[
 ["Units in scope",units.length,state.level==="ALL"?"12 undergraduate · 15 postgraduate":state.level==="UG"?"Undergraduate BIS units":"Postgraduate BIS units",""],
 ["Units analysed",evaluated.length,percent(evaluated.length,units.length)+"% outline coverage","accent"],
 ["Missing outlines",missing,missing?units.filter(u=>u.status!=="selected").map(u=>u.code).join(" · ")+" unavailable":"All scoped outlines available",missing?"warning":""],
 ["Units with positive evidence",evaluated.filter(u=>positiveCount(u)>0).length,"of "+evaluated.length+" analysed · "+evaluated.filter(u=>positiveCount(u)===0).length+" with none in any category",""]
 ];
 $("metrics").innerHTML=rows.map(([label,value,sub,style])=>'<article class="metric '+style+'"><div class="metric-label">'+label+'</div><div class="metric-value">'+value+'</div><div class="metric-sub">'+sub+'</div></article>').join("");
 $("filter-context").textContent=(state.level==="ALL"?"Full BIS scope":state.level==="UG"?"Undergraduate scope":"Postgraduate scope")+" · "+datasetYear;
}
/* Per-category totals, summed from the per-unit records rather than re-scored here. */
function categoryTotals(units){
 return order.map(code=>{
  let u0=0,items=0,score=0,review=0;
  for(const u of units){const c=cat(u,code);if(!c)continue;
   if(c.positive===true)u0++;items+=c.items||0;score+=c.score||0;review+=c.review||0;}
  return {code,units:u0,items,score:Math.round(score*10)/10,review};
 });
}
function renderDistribution() {
 const units=evaluated(),denom=units.length;
 const value=r=>state.measure==="items"?r.items:state.measure==="score"?r.score:r.units;
 // Ordered by the measure on screen so the chart always reads top-down; empty categories sink.
 const rows=categoryTotals(units).sort((x,y)=>value(y)-value(x)||order.indexOf(x.code)-order.indexOf(y.code));
 const max=state.measure==="rate"?100:Math.max(...rows.map(value),1);
 $("chart-cohort").textContent=denom+" analysed "+(state.level==="ALL"?"units":state.level+" units");
 const hint=document.querySelector(".distribution .chart-meta>span:last-child");
 if(hint){
  if(state.category==="ALL"){hint.textContent="Click a category to list its units";hint.classList.remove("active");}
  else{hint.textContent="Listing "+filtered().length+" "+names[state.category].toLowerCase()+" units below · click again to clear";hint.classList.add("active");}
 }
 $("distribution").innerHTML=rows.map(r=>{
  const width=100*(state.measure==="rate"?100*r.units/(denom||1):value(r))/max;
  const label=state.measure==="rate"?percent(r.units,denom)+"%":state.measure==="score"?formatScore(r.score):value(r);
  const sub=r.units+" unit"+(r.units===1?"":"s")+" · "+r.items+" item"+(r.items===1?"":"s")+" · "+formatScore(r.score)+" score"+(r.review?' · <b class="rev">'+r.review+" review</b>":"");
  // In Items mode both bars are item counts on one axis, so the comparison is honest.
  const reviewBar=state.measure==="items"&&r.review?'<span class="bar-track review" aria-hidden="true" title="'+esc(r.review+" review-only items")+'"><span class="bar-fill amber" style="display:block;width:'+(100*r.review/max)+'%"></span></span>':"";
  const aria=names[r.code]+": "+r.units+" of "+denom+" units, "+r.items+" evidence items, "+formatScore(r.score)+" score, "+r.review+" review items. Filter units.";
  return '<button class="bar-row stacked'+(value(r)===0?" zero":"")+(state.category===r.code?" selected":"")+'" data-category="'+r.code+'" aria-pressed="'+(state.category===r.code)+'" aria-label="'+esc(aria)+'" title="'+esc(categoryDefinition(r.code))+'"><span class="bar-name">'+names[r.code]+'<small>'+sub+'</small></span><span class="bar-stack"><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:'+width+'%"></span></span>'+reviewBar+'</span><span class="bar-number">'+label+'</span></button>';
 }).join("");
}
function renderComparison() {
 const legend=$("comparison-legend");
 if(legend) legend.innerHTML=["UG","PG"].map(l=>'<span><i class="dot '+(l==="PG"?"pg":"ug")+'"></i> '+l+' · '
   +data.units.filter(u=>u.level===l&&u.status==="selected").length+' analysed</span>').join("");
 const cohort={};
 for(const level of ["UG","PG"]){
  const units=data.units.filter(u=>u.level===level && u.status==="selected");
  cohort[level]={units,totals:categoryTotals(units)};
 }
 const mode=state.compare;
 const pick=(t,n)=>mode==="items"?t.items:mode==="score"?t.score:100*t.units/(n||1);
 const peak=Math.max(1,...["UG","PG"].flatMap(l=>cohort[l].totals.map(t=>pick(t,cohort[l].units.length))));
 $("comparison-sub").textContent=mode==="items"?"Evidence items per cohort":mode==="score"?"Weighted score per cohort":"Share of analysed units";
 $("comparison").innerHTML=order.map((code,i)=>'<div class="compare-row"><span class="compare-name">'+names[code]+'</span><div class="compare-bars">'+["UG","PG"].map(level=>{
  const t=cohort[level].totals[i],n=cohort[level].units.length,v=pick(t,n);
  const width=mode==="rate"?v:100*v/peak;
  const label=mode==="rate"?v.toFixed(1)+"%":mode==="score"?formatScore(v):v;
  const detail=level+": "+t.units+" of "+n+" units · "+t.items+" items · "+formatScore(t.score)+" score · "+t.review+" review";
  return '<div class="compare-line" aria-label="'+esc(names[code]+" "+detail)+'" title="'+esc(detail)+'"><span class="compare-track" aria-hidden="true"><span class="compare-fill '+(level==="PG"?"pg":"")+'" style="display:block;width:'+width+'%"></span></span><span class="compare-value">'+label+'</span></div>';
 }).join("")+'</div></div>').join("");
}
function renderUnits() {
 const units=filtered();
 if (!units.some(u=>u.code===state.selected)) state.selected=units[0]?.code || null;
 // the list keeps units without an outline, the charts do not — say so rather than let the two counts clash
 const noOutline=units.filter(u=>u.status!=="selected").length;
 $("unit-count").textContent=units.length+" of "+levelUnits().length+" units"+(noOutline?" · "+noOutline+" without an outline, not counted in the charts":"");
 $("filter-note").hidden=state.category==="ALL";
 $("filter-note").textContent=state.category==="ALL"?"":"Showing units with positive "+names[state.category].toLowerCase()+" evidence. Overview totals remain based on the selected study level.";
 const ok=u=>u.status==="selected";
 $("units").innerHTML=units.map(u=>{
  const dots=order.map(code=>{const c=cat(u,code),on=c&&c.positive===true,rev=c&&!on&&c.review>0;
   return '<i class="cat-dot'+(on?" on":rev?" rev":"")+'" title="'+esc(names[code]+(on?" · positive":rev?" · review-only":" · no match"))+'"></i>';}).join("");
  // the whole row is the hit area; the button inside stays for keyboard users
  return '<tr data-unit="'+u.code+'" class="'+(u.code===state.selected?"selected":"")+'"><td><button class="unit-link" data-unit="'+u.code+'" aria-label="View '+u.code+' '+esc(u.title)+'" aria-pressed="'+(u.code===state.selected)+'">'+u.code+'</button><span class="unit-name">'+esc(u.title)+'</span></td>'
   +'<td><span class="level-badge '+(u.level==="PG"?"pg":"")+'">'+u.level+'</span></td>'
   +'<td class="dots-cell">'+(ok(u)?'<span class="cat-dots" aria-label="'+esc(order.filter(c=>cat(u,c)?.positive).map(c=>names[c]).join(", ")||"No positive category")+'">'+dots+'</span>':"—")+'</td>'
   +'<td class="count-cell">'+(ok(u)?totalItems(u):"—")+'</td>'
   +'<td class="count-cell score-cell">'+(ok(u)?formatScore(totalScore(u)):"—")+'</td>'
   +'<td class="count-cell'+(ok(u)&&totalReview(u)?" review-number":"")+'">'+(ok(u)?totalReview(u):"—")+'</td>'
   +'<td><span class="coverage '+(ok(u)?"available":"missing")+'">'+(ok(u)?"Available":"Missing")+'</span></td></tr>';
 }).join("");
 document.querySelectorAll(".sort-th").forEach(b=>{b.classList.toggle("active",b.dataset.sort===state.sortKey);b.dataset.dir=state.sortDir>0?"asc":"desc";});
 $("empty").hidden=!!units.length;
 document.querySelector(".unit-table").hidden=!units.length;
 renderDetail();
}
function renderDetail() {
 const u=data.units.find(u=>u.code===state.selected);
 if(!u){$("unit-detail").innerHTML='<div class="empty"><strong>No unit selected</strong><p>Change the filters to explore unit results.</p></div>';return;}
 let html='<div class="detail-kicker"><span>UNIT PROFILE</span><span>'+esc(u.level==="UG"?"UNDERGRADUATE":"POSTGRADUATE")+'</span></div><h3 class="detail-code">'+u.code+'</h3><p class="detail-title">'+esc(u.title)+'</p>';
 if(u.status!=="selected"){
  html+='<span class="pill preliminary">Outline unavailable</span><div class="missing-box"><strong>No eligible outline for this year</strong><p>This unit is retained in scope but excluded from the analysed denominator. No other year is substituted.</p></div><p class="detail-note">Classification results are unavailable. Missing data must not be read as zero evidence.</p>';
 } else {
  const reviewTotal=u.categories.reduce((n,c)=>n+c.review,0);
  html+='<div class="detail-meta"><span class="level-badge '+(u.level==="PG"?"pg":"")+'">'+u.level+'</span><span>'+datasetYear+' · '+esc(u.session)+'</span><span>·</span><span>Automated classification</span></div>';
  html+='<div class="detail-stats"><div class="detail-stat"><strong>'+positiveCount(u)+' <span>/ 8</span></strong><span>Positive categories</span></div><div class="detail-stat"><strong>'+reviewTotal+'</strong><span>Review item–category records</span></div></div>';
  html+=unitSectionChart(u);
  html+='<table class="results-table"><thead><tr><th scope="col">CATEGORY / RESULT</th><th scope="col">POSITIVE<br>ITEMS</th><th scope="col">POSITIVE<br>SCORE</th><th scope="col">REVIEW<br>ITEMS</th></tr></thead><tbody>';
  html+=order.map(code=>{
   const c=cat(u,code),status=c.positive?"Positive":c.review>0?"Review-only":"No match";
   const rows=evidenceFor(u.code,code),open=state.expanded.has(code),can=rows.length>0;
   let out='<tr class="'+(state.category===code?"highlighted ":"")+(can?"expandable":"")+'" title="'+esc(categoryDefinition(code))+'"><td>'+(can?'<button class="result-toggle" data-expand="'+code+'" aria-expanded="'+open+'"><span class="caret" aria-hidden="true">'+(open?"▾":"▸")+'</span>':'<span class="result-pad">')+'<span class="result-category">'+names[code]+'</span><span class="result-status '+(c.positive?"positive":c.review>0?"review":"")+'">'+status+(can?" · "+rows.length+" item"+(rows.length===1?"":"s"):"")+'</span>'+(can?"</button>":"</span>")+'</td><td>'+c.items+'</td><td class="score-cell">'+formatScore(c.score)+'</td><td class="'+(c.review>0?"review-number":"")+'">'+c.review+'</td></tr>';
   if(can&&open) out+='<tr class="evidence-row"><td colspan="4"><ul class="evidence-list">'+rows.map(e=>'<li class="evidence'+(e.k==="r"?" review":"")+'"><div class="evidence-head"><span class="evidence-where">'+esc(e.l||e.s)+'</span><span class="evidence-score">'+(e.k==="r"?"review · ":"")+formatScore(e.sc)+'</span></div><p class="evidence-text">'+highlight(e.t,e.p,e.r)+'</p><p class="evidence-rules">'+esc(e.rules.join(" · "))+'</p></li>').join("")+'</ul></td></tr>';
   return out;
  }).join("");
  html+='</tbody></table><p class="detail-note">Positive scores exclude review results. The same item may appear in multiple categories. Human validation is pending. <mark class="hit">Yellow</mark> marks a phrase from a positive rule; <mark class="hit review">violet</mark> marks a review-only phrase, which cannot classify a unit on its own.</p><a class="outline-link" href="'+esc(u.url)+'" target="_blank" rel="noopener noreferrer">Open original unit outline <span aria-hidden="true">↗</span></a><p class="detail-note" style="margin-bottom:0">The live outline may have changed since the saved capture.</p>';
 }
 $("unit-detail").innerHTML=html;
}
const SECTIONS=["Overview","Learning outcome","Assessment","Assessment detail","Weekly schedule"];
const evidenceFor=(code,category)=>(data.evidence&&data.evidence[code]&&data.evidence[code][category])||[];
const evaluated=()=>levelUnits().filter(u=>u.status==="selected");
/* Rebuild the matcher's normalised text while keeping a map back to original offsets. */
function normMap(text){
 let out="",map=[],prevSpace=false;
 for(let i=0;i<text.length;i++){
  let ch=text[i];
  if(ch==="–"||ch==="—") ch="-";
  if(/\s/.test(ch)){ if(prevSpace||!out) continue; prevSpace=true; out+=" "; map.push(i); continue; }
  prevSpace=false; out+=ch.toLowerCase(); map.push(i);
 }
 while(out.endsWith(" ")){ out=out.slice(0,-1); map.pop(); }
 return {out,map};
}
function highlight(text,positive,review){
 const {out,map}=normMap(text),ranges=[];
 const add=(list,cls)=>{for(const raw of list||[]){const needle=normMap(raw).out;if(!needle)continue;let i=out.indexOf(needle);while(i!==-1){ranges.push({s:map[i],e:map[i+needle.length-1]+1,cls});i=out.indexOf(needle,i+1);}}};
 add(positive,"hit"); add(review,"hit review");
 if(!ranges.length) return esc(text);
 ranges.sort((a,b)=>a.s-b.s||b.e-a.e);
 const merged=[];
 for(const r of ranges){const last=merged[merged.length-1];
  if(last&&r.s<last.e){last.e=Math.max(last.e,r.e);if(r.cls==="hit")last.cls="hit";}
  else merged.push(Object.assign({},r));}
 let html="",pos=0;
 for(const r of merged){html+=esc(text.slice(pos,r.s))+'<mark class="'+r.cls+'">'+esc(text.slice(r.s,r.e))+'</mark>';pos=r.e;}
 return html+esc(text.slice(pos));
}
function renderSections(){
 const units=evaluated();
 const rows=order.map(code=>{
  const counts=SECTIONS.map(()=>0);
  for(const u of units) for(const e of evidenceFor(u.code,code)) if(e.k==="p"){const i=SECTIONS.indexOf(e.s);if(i>=0)counts[i]++;}
  return {code,counts,total:counts.reduce((a,b)=>a+b,0)};
 }).sort((x,y)=>y.total-x.total||order.indexOf(x.code)-order.indexOf(y.code));
 const max=Math.max(...rows.map(r=>r.total),1);
 $("section-legend").innerHTML=SECTIONS.map((s,i)=>'<span><i class="dot s'+i+'"></i> '+s+'</span>').join("");
 $("insights-context").textContent=units.length+" analysed units · "+rows.reduce((n,r)=>n+r.total,0)+" positive evidence items";
 $("sections").innerHTML=rows.map(r=>{
  const scale=state.sections==="rate"?(r.total||1):max;
  const segs=r.counts.map((n,i)=>n?'<span class="seg s'+i+'" style="width:'+(100*n/scale)+'%" title="'+esc(SECTIONS[i]+": "+n+" items")+'"></span>':"").join("");
  return '<div class="stack-row'+(r.total?"":" zero")+'"><span class="bar-name">'+names[r.code]+'</span><span class="stack-track" aria-label="'+esc(names[r.code]+": "+r.counts.map((n,i)=>n+" "+SECTIONS[i]).join(", "))+'">'+segs+'</span><span class="bar-number">'+r.total+'</span></div>';
 }).join("");
}
const RANK_FOOT={
 share:"This category's positive items as a share of all positive items in the same unit. This removes the advantage a longer outline would otherwise have.",
 score:"Total score for this category. Weights are provisional, so treat the order as indicative.",
 items:"Number of distinct evidence items. A unit that repeats the same wording scores higher, so this favours longer outlines."
};
function renderRanking(){
 const code=state.rankCategory,mode=state.rankMeasure;
 const rows=evaluated().map(u=>{
  const c=cat(u,code)||{},all=totalItems(u);
  const v=mode==="score"?(c.score||0):mode==="items"?(c.items||0):all?100*(c.items||0)/all:0;
  return {u,v,items:c.items||0,score:c.score||0,all};
 }).sort((a,b)=>b.v-a.v||a.u.code.localeCompare(b.u.code));
 const withEvidence=rows.filter(r=>r.items>0),zero=rows.length-withEvidence.length;
 const shown=state.rankZero?rows:withEvidence;
 const max=Math.max(...shown.map(r=>r.v),1);
 $("rank-context").textContent=withEvidence.length+" of "+rows.length+" units have positive "+names[code].toLowerCase()+" evidence";
 $("rank-foot").textContent=RANK_FOOT[mode]+" Counts identifiable wording in the public outline, not teaching quality.";
 $("ranking").innerHTML=shown.length?shown.map(r=>{
  const label=mode==="score"?formatScore(r.v):mode==="share"?r.v.toFixed(0)+'%<small>'+r.items+"/"+r.all+'</small>':r.v;
  const detail=r.items+" item"+(r.items===1?"":"s")+" · "+formatScore(r.score)+" score"+(r.all?" · "+r.items+" of "+r.all+" in unit":"");
  return '<button class="bar-row'+(r.items?"":" zero")+(r.u.code===state.selected?" selected":"")+'" data-unit="'+r.u.code+'" title="'+esc(detail)+'" aria-label="'+esc(r.u.code+" "+r.u.title+": "+detail)+'"><span class="bar-name">'+r.u.code+'<small>'+esc(r.u.title)+'</small></span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:'+(100*r.v/max)+'%"></span></span><span class="bar-number">'+label+'</span></button>';
 }).join(""):'<p class="empty">No unit has positive evidence in this category.</p>';
 const toggle=$("rank-toggle-zero");
 toggle.hidden=!zero;
 toggle.textContent=(state.rankZero?"Hide ":"Show ")+zero+" units with none in this category";
 toggle.setAttribute("aria-expanded",String(!!state.rankZero));
}
function renderSpread(){
 const units=evaluated(),spread=[0,0,0,0,0,0,0,0,0];
 for(const u of units) spread[positiveCount(u)]++;
 const labels=order.reduce((sum,c)=>sum+units.filter(u=>cat(u,c)?.positive===true).length,0);
 $("overlap-spread").innerHTML='<span class="spread-label">Categories per unit</span>'
  +spread.map((n,i)=>n?'<span class="spread-chip"><strong>'+n+'</strong> · '+i+' categor'+(i===1?"y":"ies")+'</span>':"").join("")
  +'<span class="spread-note">'+labels+' category labels across '+units.length+' units</span>';
}
/* Where this unit's own evidence sits — the per-unit version of the section chart. */
function unitSectionChart(u){
 const rows=order.map(code=>{
  const counts=SECTIONS.map(()=>0);
  for(const e of evidenceFor(u.code,code)) if(e.k==="p"){const i=SECTIONS.indexOf(e.s);if(i>=0)counts[i]++;}
  return {code,counts,total:counts.reduce((a,b)=>a+b,0)};
 }).filter(r=>r.total);
 if(!rows.length) return "";
 const max=Math.max(...rows.map(r=>r.total));
 return '<div class="unit-sections"><div class="unit-sections-head"><strong>Where the evidence sits</strong><span>'+SECTIONS.map((s,i)=>'<i class="dot s'+i+'" title="'+esc(s)+'"></i>').join("")+'</span></div>'
  +rows.map(r=>'<div class="mini-row"><span>'+names[r.code]+'</span><span class="stack-track" title="'+esc(r.counts.map((n,i)=>n+" "+SECTIONS[i]).filter(t=>!t.startsWith("0 ")).join(", "))+'">'+r.counts.map((n,i)=>n?'<span class="seg s'+i+'" style="width:'+(100*n/max)+'%"></span>':"").join("")+'</span><b>'+r.total+'</b></div>').join("")
  +'<p class="mini-foot">Evidence drawn mainly from learning outcomes may reflect shared outcome wording.</p></div>';
}
function exportCsv(){
 const rows=[["unit_code","unit_title","level","category","result","section","item_label","score","matched_phrases","review_only_phrases","text","source_url"]];
 for(const u of filtered()){
  for(const code of order) for(const e of evidenceFor(u.code,code))
   rows.push([u.code,u.title,u.level,names[code],e.k==="p"?"positive":"review-only",e.s,e.l,e.sc,(e.p||[]).join("; "),(e.r||[]).join("; "),e.t,u.url||""]);
 }
 const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const a=document.createElement("a");
 a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}));
 a.download="cs44-evidence-"+(state.category==="ALL"?"all":state.category)+".csv";
 document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function render(){renderMetrics();renderDistribution();renderSections();renderSpread();renderRanking();renderUnits();}
function reset(){state.level="ALL";state.category="ALL";state.search="";state.selected="INFS6600";state.rankZero=false;state.expanded.clear();state.strength="ALL";state.section="ALL";state.only="ALL";state.sortKey="code";state.sortDir=1;$("strength").value="ALL";$("section").value="ALL";$("only").value="ALL";$("search").value="";$("category").value="ALL";document.querySelectorAll("[data-level]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.level==="ALL"));render();}
const syncLevel=()=>document.querySelectorAll("[data-level]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.level===state.level)));
document.querySelectorAll("[data-level]").forEach(b=>b.addEventListener("click",()=>{state.level=b.dataset.level;syncLevel();render();}));
document.querySelectorAll("[data-compare]").forEach(b=>b.addEventListener("click",()=>{state.compare=b.dataset.compare;document.querySelectorAll("[data-compare]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderComparison();}));
document.querySelectorAll("[data-measure]").forEach(b=>b.addEventListener("click",()=>{state.measure=b.dataset.measure;document.querySelectorAll("[data-measure]").forEach(x=>x.setAttribute("aria-pressed",x===b));renderDistribution();}));
$("distribution").addEventListener("click",e=>{
 const b=e.target.closest("[data-category]");if(!b)return;
 const opening=state.category!==b.dataset.category;
 state.category=opening?b.dataset.category:"ALL";
 $("category").value=state.category;
 renderUnits();renderDistribution();
 if(opening) $("explorer").scrollIntoView({behavior:"smooth",block:"start"});
});
$("category").addEventListener("change",e=>{state.category=e.target.value;renderDistribution();renderUnits();});
$("search").addEventListener("input",e=>{state.search=e.target.value;renderUnits();});
$("units").addEventListener("click",e=>{const b=e.target.closest("[data-unit]");if(!b)return;state.selected=b.dataset.unit;renderUnits();});
$("reset").addEventListener("click",reset);$("empty-reset").addEventListener("click",reset);
document.querySelectorAll("[data-sections]").forEach(b=>b.addEventListener("click",()=>{state.sections=b.dataset.sections;document.querySelectorAll("[data-sections]").forEach(x=>x.setAttribute("aria-pressed",x===b));renderSections();}));
document.querySelectorAll("[data-rank]").forEach(b=>b.addEventListener("click",()=>{state.rankMeasure=b.dataset.rank;document.querySelectorAll("[data-rank]").forEach(x=>x.setAttribute("aria-pressed",x===b));renderRanking();}));
$("rank-category").addEventListener("change",e=>{state.rankCategory=e.target.value;renderRanking();});
$("rank-toggle-zero").addEventListener("click",()=>{state.rankZero=!state.rankZero;renderRanking();});
$("ranking").addEventListener("click",e=>{const b=e.target.closest("[data-unit]");if(!b)return;state.selected=b.dataset.unit;renderRanking();renderUnits();document.getElementById("explorer").scrollIntoView({behavior:"smooth",block:"start"});});
$("unit-detail").addEventListener("click",e=>{const b=e.target.closest("[data-expand]");if(!b)return;const code=b.dataset.expand;state.expanded.has(code)?state.expanded.delete(code):state.expanded.add(code);renderDetail();});
for(const s of SECTIONS){for(const id of ["section","only"]){const o=document.createElement("option");o.value=s;o.textContent=id==="only"?"Only "+s.toLowerCase():s;$(id).appendChild(o);}}
$("strength").addEventListener("change",e=>{state.strength=e.target.value;renderUnits();});
$("section").addEventListener("change",e=>{state.section=e.target.value;renderUnits();});
$("only").addEventListener("change",e=>{state.only=e.target.value;renderUnits();});
$("export").addEventListener("click",exportCsv);
document.querySelectorAll(".sort-th").forEach(b=>b.addEventListener("click",()=>{
 if(state.sortKey===b.dataset.sort) state.sortDir=-state.sortDir;
 else {state.sortKey=b.dataset.sort;state.sortDir=["code","level"].includes(b.dataset.sort)?1:-1;}
 renderUnits();}));
document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x===a));if(a.hash==="#method")document.querySelector("#method details").open=true;}));
render();renderComparison();
})();
