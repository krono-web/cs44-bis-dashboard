import test from "node:test";
import assert from "node:assert/strict";
import worker, { index, retrieve, retrieveAcrossYears, generate, resolveDatasetKey } from "./worker.js";
import datasets from "./datasets.json" with { type: "json" };

test("retrieval uses selected historical dataset and v6.3 evidence", () => {
  const result = retrieve(index(datasets["2024"]), "INFS6600 project evidence", { level:"ALL", category:"ALL", kind:"positive", section:"ALL" });
  assert.equal(result.scope.year, 2024);
  assert.ok(result.records.length > 0);
  assert.ok(result.records.every(r => r.unit === "INFS6600" && r.kind === "positive"));
});

test("assistant responses stay in English for non-English questions", () => {
  const result = retrieve(index(datasets.original), "哪些课程有项目式教学的证据？", { level:"ALL", category:"ALL", kind:"positive", section:"ALL" });
  assert.match(result.summary, /^Found /);
  assert.doesNotMatch(result.summary, /[\u3400-\u9fff]/);
});

test("cross-year question does not silently answer from one year", () => {
  const result = retrieve(index(datasets["2024"]), "compare 2024 and 2025 project evidence", { level:"ALL", category:"ALL", kind:"positive", section:"ALL" });
  assert.equal(result.records.length, 0);
});

test("cross-year retrieval expands a range and prefixes citation IDs", () => {
  const result = retrieveAcrossYears("trend between 2024 to 2026", { level:"ALL", category:"ALL", kind:"positive", section:"ALL" });
  assert.deepEqual(result.scope.years, [2024, 2025, 2026]);
  assert.equal(result.stats.yearly.length, 3);
  assert.ok(result.records.length > 0);
  assert.ok(result.records.every(r => String(r.id).startsWith(`${r.year}:`)));
});

test("a year named in the question overrides the page dataset", () => {
  assert.equal(resolveDatasetKey("what learning methods contain by INFS6015 in 2024", "original"), "2024");
  assert.equal(resolveDatasetKey("compare 2024 to 2026", "original"), "multi");
  assert.equal(resolveDatasetKey("what methods are in INFS6015", "2025"), "2025");
  const result = retrieve(index(datasets[resolveDatasetKey("INFS6015 in 2024", "original")]), "INFS6015 in 2024", { level:"ALL", category:"ALL", kind:"positive", section:"ALL" });
  assert.equal(result.scope.year, 2024);
  assert.ok(result.records.every(r => r.unit === "INFS6015"));
});

test("Gemini structured answer must cite supplied IDs", async () => {
  const result = retrieve(index(datasets.original), "INFS6600 project evidence", { level:"ALL", category:"ALL", kind:"positive", section:"ALL" });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.generationConfig.responseMimeType, "application/json");
    assert.match(request.systemInstruction.parts[0].text, /Answer in English only/);
    const id = result.records[0].id;
    return new Response(JSON.stringify({ candidates:[{content:{parts:[{text:JSON.stringify({claims:[{text:"Supported",sources:[id]}],limitation:"Automated evidence."})}]}}] }), {status:200,headers:{"Content-Type":"application/json"}});
  };
  try { const answer = await generate(result,{GEMINI_API_KEY:"test",GEMINI_MODEL:"test-model"}); assert.equal(answer.claims[0].sources[0],result.records[0].id); }
  finally { globalThis.fetch = oldFetch; }
});

test("HTTP access control and configuration", async () => {
  const env={GEMINI_API_KEY:"key",ASSISTANT_ACCESS_TOKEN:"a-long-class-code",ALLOWED_ORIGINS:"https://huaicongyu-stack.github.io"};
  let res=await worker.fetch(new Request("https://worker.example/api/config",{headers:{Origin:"https://evil.example"}}),env);
  assert.equal(res.status,403);
  res=await worker.fetch(new Request("https://worker.example/api/config",{headers:{Origin:"https://huaicongyu-stack.github.io"}}),env);
  assert.equal(res.status,200); assert.equal((await res.json()).enabled,true);
  res=await worker.fetch(new Request("https://worker.example/api/ask",{method:"POST",headers:{Origin:"https://huaicongyu-stack.github.io","Content-Type":"application/json",Authorization:"Bearer wrong"},body:JSON.stringify({question:"test"})}),env);
  assert.equal(res.status,401);
});
