"use strict";
(() => {
  if (!window.CS44_DATA || !window.CS44Evidence) return;
  const $ = id => document.getElementById(id);
  const db = CS44Evidence.index(window.CS44_DATA);
  const historyDbs = Object.fromEntries(Object.entries(window.CS44_HISTORY?.years || {}).map(([year, data]) => [year, CS44Evidence.index(data)]));
  let api = window.CS44_ASSISTANT_API || (location.hostname === "127.0.0.1" || location.hostname === "localhost" ? location.origin : "");
  let ready = false;
  let result, shown = 0;
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  for (const c of CS44_DATA.categories) { const o = node("option", c.name); o.value = c.code; $("ask-category").append(o); }
  for (const s of [...new Set(db.records.map(r => r.section))]) { const o = node("option", s); o.value = s; $("ask-section").append(o); }
  $("ask-dataset").textContent = `${CS44_DATA.meta.year} · ${CS44_DATA.units.length} units · ${db.records.length} records · all saved outline sections`;
  function filters() { return Object.fromEntries(["level", "category", "kind", "section"].map(k => [k, $("ask-" + k).value])); }
  function card(r) {
    const article = node("article", undefined, "ask-source"); article.id = "source-" + r.id;
    const heading = node("div", undefined, "ask-source-heading");
    heading.append(node("strong", `${r.year ? r.year + " · " : ""}${r.unit}`), node("span", r.kind === "positive" ? "Positive signal" : "Review-only", "pill " + (r.kind === "positive" ? "ask-positive" : "preliminary")));
    article.append(heading, node("p", `${r.categoryName} · ${r.section}`, "ask-source-meta"), node("p", r.label, "ask-source-label"), node("blockquote", r.text));
    article.append(node("p", `Matched phrases: ${r.phrases.join(", ") || "—"}`, "ask-source-meta"));
    const link = node("a", "Open original outline ↗");
    try { const u = new URL(r.url); if (u.protocol === "https:") { link.href = u.href; link.target = "_blank"; link.rel = "noopener noreferrer"; article.append(link); } } catch {}
    return article;
  }
  function more() {
    result.records.slice(shown, shown + 8).forEach(r => $("ask-sources").append(card(r)));
    shown = Math.min(result.records.length, shown + 8);
    $("ask-more").hidden = shown >= result.records.length;
    $("ask-more").textContent = `Show more evidence (${shown} / ${result.records.length})`;
  }
  function showSearch(r) {
    result = r; shown = 0;
    $("ask-answer").replaceChildren(node("p", r.summary));
    $("ask-sources").replaceChildren();
    $("ask-results").hidden = false;
    const s = r.scope;
    $("ask-scope").textContent = `Scope: ${s.year} · ${s.level} · ${s.kind} · ${s.section} · ${s.categories.length ? s.categories.map(c => CS44_DATA.categories.find(x => x.code === c)?.name || c).join(", ") : "All categories"}${s.requestedUnits.length ? " · " + s.requestedUnits.join(", ") : ""}. ${r.crossYear ? "Uses the same v6.3 rules across requested years." : r.autoYear ? "Year selected automatically from the question." : "Uses the selected dataset; other dashboard filters are independent."}`;
    $("ask-source-count").textContent = `Source evidence (${r.stats.records} records)`;
    const table = $("ask-counts"); table.replaceChildren();
    if (r.stats.records) {
      const t = node("table"); const cap = node("caption", r.crossYear ? "Matched evidence by year" : "Matched records and distinct units in this query");
      const head = node("tr"); (r.crossYear ? ["Year", "Analysed", "Units matched", "Positive", "Review-only"] : ["Level", "Analysed", "Units matched", "Positive", "Review-only"]).forEach(x => head.append(node("th", x))); const thead = node("thead"); thead.append(head);
      const body = node("tbody"); (r.crossYear ? r.stats.yearly : r.stats.cohorts).forEach(c => { const tr = node("tr"); [r.crossYear ? c.year : c.level, c.analysed, c.units, c.positive, c.review].forEach(x => tr.append(node("td", x))); body.append(tr); }); t.append(cap, thead, body); table.append(t);
    }
    more();
  }
  async function ask(event) {
    event?.preventDefault();
    if ($("ask-submit").disabled) return;
    const question = $("ask-question").value.trim(); if (!question) { $("ask-question").focus(); return; }
    const useAI = ready && $("ask-ai").checked;
    if (useAI && !$("ask-access").value) { $("ask-status").textContent = "Enter the access code provided by the dashboard owner to use AI, or turn off AI explanation."; $("ask-access").focus(); return; }
    const requestedYears = CS44Evidence.yearsIn(question, Object.keys(historyDbs).map(Number));
    const cross = requestedYears.length > 1 ? CS44Evidence.retrieveAcrossYears(historyDbs, question, filters()) : null;
    const routedDb = requestedYears.length === 1 ? historyDbs[requestedYears[0]] : db;
    const r = cross || CS44Evidence.retrieve(routedDb, question, filters());
    if (!cross && requestedYears.length === 1 && Number(CS44_DATA.meta.year) !== requestedYears[0]) r.autoYear = true;
    showSearch(r);
    $("ask-status").textContent = useAI ? "Reading matching evidence…" : "Evidence search complete · no AI model used";
    if (!useAI) return;
    $("ask-submit").disabled = true; $("ask-form").setAttribute("aria-busy", "true");
    document.querySelectorAll("[data-ask]").forEach(b => b.disabled = true);
    try {
      const routedDataset = cross ? "multi" : requestedYears.length === 1 ? String(requestedYears[0]) : (window.CS44_DATASET || "original");
      const response = await fetch(`${api}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${$("ask-access").value}` }, body: JSON.stringify({ question, filters: filters(), dataset: routedDataset }), signal: AbortSignal.timeout(70000) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The AI service is unavailable.");
      const answer = node("div");
      payload.claims.forEach(claim => {
        const paragraph = node("p", claim.text + " ");
        claim.sources.forEach(id => {
          const record = r.records.find(x => x.id === id); if (!record) return;
          const link = node("button", `[${record.year ? record.year + " · " : ""}${record.unit} · ${record.section}]`, "ask-citation"); link.type = "button";
          link.addEventListener("click", () => { while (!document.getElementById("source-" + id) && shown < result.records.length) more(); const el = document.getElementById("source-" + id); if (el) { el.tabIndex = -1; el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); } });
          paragraph.append(link);
        }); answer.append(paragraph);
      });
      answer.append(node("p", payload.limitation, "ask-limit")); $("ask-answer").replaceChildren(answer);
      $("ask-status").textContent = "AI explanation · verify the cited source text";
    } catch (error) { $("ask-status").textContent = `${error.name === "TimeoutError" ? "The AI service did not respond within 70 seconds. Please try again; temporary Gemini capacity or rate limits can cause this." : error.message} Source search remains available below.`; }
    finally { $("ask-submit").disabled = false; $("ask-form").removeAttribute("aria-busy"); document.querySelectorAll("[data-ask]").forEach(b => b.disabled = false); }
  }
  $("ask-form").addEventListener("submit", ask); $("ask-more").addEventListener("click", more);
  document.querySelectorAll("[data-ask]").forEach(b => b.addEventListener("click", () => { $("ask-question").value = b.dataset.ask; ask(); }));
  if (api) {
    fetch(`${api}/api/config`, { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).then(c => {
      if (c?.enabled) { ready = true; $("ask-ai-options").hidden = false; $("ask-mode").textContent = "AI available · source search by default"; }
    }).catch(() => {});
  }
})();
