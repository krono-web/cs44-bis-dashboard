/* Shared retrieval and arithmetic for the browser and the optional Node server. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CS44Evidence = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const aliases = {
    work_integrated_applied: ["work integrated", "work-integrated", "applied learning", "industry", "实践", "工作整合", "产学", "行业"],
    project_problem_based: ["project", "problem-based", "problem based", "项目", "问题式", "问题导向"],
    case_based: ["case", "案例"],
    entrepreneurial_learning: ["entrepreneur", "创业"],
    community_learning: ["community", "社区"],
    hybrid_learning: ["hybrid", "blended", "混合"],
    simulation: ["simulation", "simulate", "模拟", "仿真"],
    technology_mediated_learning: ["technology-mediated", "technology mediated", "技术支持", "技术介导"]
  };
  function index(data) {
    const categories = new Map(data.categories.map(c => [c.code, c]));
    const records = [];
    for (const unit of data.units) {
      for (const [code, items] of Object.entries(data.evidence?.[unit.code] || {})) {
        items.forEach((e, i) => records.push({
          id: `${unit.code}:${code}:${i}`, unit: unit.code, title: unit.title,
          level: unit.level, category: code, categoryName: categories.get(code)?.name || code,
          kind: e.k === "p" ? "positive" : "review", section: e.s,
          label: e.l, text: e.t, score: e.sc, phrases: e.k === "p" ? e.p || [] : e.r || [],
          rules: e.rules || [], url: unit.url || ""
        }));
      }
    }
    return { data, records };
  }
  function retrieve(db, question, filters = {}) {
    const q = String(question).trim().toLowerCase();
    const zh = /[\u3400-\u9fff]/.test(q);
    const requestedYears = [...new Set(q.match(/\b20\d{2}\b/g) || [])];
    const wrongYear = requestedYears.some(y => Number(y) !== Number(db.data.meta?.year));
    const codes = [...new Set((q.match(/\b[a-z]{4}\d{4}\b/g) || []).map(c => c.toUpperCase()))];
    const categoryCodes = Object.entries(aliases).filter(([, words]) => words.some(w => q.includes(w))).map(([c]) => c);
    const mentionsUG = /\bug\b|undergraduate|本科/.test(q), mentionsPG = /\bpg\b|postgraduate|研究生/.test(q);
    const level = filters.level && filters.level !== "ALL" ? filters.level : mentionsUG !== mentionsPG ? (mentionsUG ? "UG" : "PG") : "ALL";
    const category = filters.category && filters.category !== "ALL" ? [filters.category] : categoryCodes;
    const kind = filters.kind && filters.kind !== "auto" ? filters.kind : /review|待审核|待审|审核记录/.test(q) ? "review" : "positive";
    const section = filters.section || "ALL";
    const scopedUnits = db.data.units.filter(u => (level === "ALL" || u.level === level) && (!codes.length || codes.includes(u.code)));
    const allowed = new Set(scopedUnits.map(u => u.code));
    let records = db.records.filter(r => allowed.has(r.unit) && (!category.length || category.includes(r.category)) &&
      (kind === "ALL" || r.kind === kind) && (section === "ALL" || r.section === section));
    const tokens = q.match(/[a-z][a-z-]{2,}/g) || [];
    const stop = new Set("which what where why how does do the and are for with from have has units unit evidence teaching learning compare between show explain please this that more than about there course courses positive of in is to an all".split(" "));
    const terms = tokens.filter(t => !stop.has(t) && !/^[a-z]{4}\d{4}$/.test(t));
    const recognized = codes.length || category.length || mentionsUG || mentionsPG || filters.category && filters.category !== "ALL" || filters.section && filters.section !== "ALL" || /evidence|dataset|outline|review|证据|数据|大纲|审核/.test(q);
    const ranked = records.map(r => {
      const text = `${r.text} ${r.label} ${r.title} ${r.categoryName} ${r.section}`.toLowerCase();
      return { r, score: terms.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0) };
    }).sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
    if (!recognized) records = ranked.filter(x => x.score > 0).map(x => x.r);
    else records = ranked.map(x => x.r);
    if (wrongYear) records = [];
    const count = rows => ({ records: rows.length, units: new Set(rows.map(r => r.unit)).size,
      positive: rows.filter(r => r.kind === "positive").length, review: rows.filter(r => r.kind === "review").length });
    const stats = { ...count(records), analysed: scopedUnits.filter(u => u.status === "selected").length,
      missing: scopedUnits.filter(u => u.status !== "selected").map(u => u.code),
      cohorts: ["UG", "PG"].map(l => ({ level: l, analysed: scopedUnits.filter(u => u.level === l && u.status === "selected").length, ...count(records.filter(r => r.level === l)) })),
      categories: db.data.categories.filter(c => !category.length || category.includes(c.code)).map(c => ({ name: c.name, ...count(records.filter(r => r.category === c.code)) })),
      unitCodes: [...new Set(records.map(r => r.unit))].sort() };
    const unknown = codes.filter(c => !db.data.units.some(u => u.code === c));
    const scope = { level, categories: category, kind, section, requestedUnits: codes, unknownUnits: unknown };
    let summary;
    if (unknown.length) summary = zh ? `数据集中没有这些课程：${unknown.join("、")}。` : `These units are not in the dataset: ${unknown.join(", ")}.`;
    else if (!records.length) summary = zh ? "当前问题和筛选条件下未找到匹配记录。没有匹配记录不代表该教学方式不存在。可尝试课程代码、教学类别或英文原文关键词。" : "No matching records for this question and scope. No match is not proof that the teaching method is absent. Try a unit code, teaching category or an English source keyword.";
    else summary = zh ? `找到 ${stats.records} 条分类证据记录，涉及 ${stats.units} 门课程。其中正向证据 ${stats.positive} 条，待审核 ${stats.review} 条。以下为原文检索结果，不是模型生成的分析。` : `Found ${stats.records} category-evidence records across ${stats.units} units: ${stats.positive} positive and ${stats.review} review-only. These are source search results, not AI-generated analysis.`;
    if (stats.missing.length) summary += zh ? ` ${stats.missing.join("、")} 缺少可分析的大纲，不能当作零证据。` : ` ${stats.missing.join(", ")} has no eligible outline; this is missing data, not zero evidence.`;
    if (wrongYear) summary = zh ? `当前选择的是 ${db.data.meta.year} 年数据。请用页面顶部的 Dashboard dataset 切换年份；跨年比较请查看 Annual evidence trends。` : `The selected dataset is ${db.data.meta.year}. Change Dashboard dataset at the top for another year; use Annual evidence trends for comparisons across years.`;
    return { question, zh, scope: { ...scope, year: db.data.meta?.year, ruleVersion: db.data.meta?.ruleVersion }, stats, summary, records };
  }
  return { index, retrieve };
});
