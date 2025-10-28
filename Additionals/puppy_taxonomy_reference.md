# Puppy Taxonomy Reference (v1.0)

This document contains the taxonomy explanation and breed archetype key for all puppies in the kennel. It has been spun out into a standalone reference so that the main kennel catalogs (Part A and Part B) stay focused purely on the puppies themselves.

---

## Taxonomy Explanation

Every unit in the library is now a **puppy** (formerly “primitive”). Naming format: `[FunctionalLayer]_[BreedArchetype]_[Handle]`.

- **Functional Layers** (aligned with UK Kennel Club groups):
  - **Sec** = Security / Protection (Working group archetypes)
  - **Work** = Persistence / Endurance / Iteration (Hound archetypes)
  - **Herd** = Sorting / Herding / Control flow (Pastoral archetypes)
  - **Hunt** = Retrieval / Hunting assistance (Gundog archetypes)
  - **Terr** = Scrutiny / Data digging / Error catching (Terrier archetypes)
  - **Util** = Formatting / Compliance / Utilities (Utility archetypes)
  - **Comp** = Style / Overlay / Presentation (Toy archetypes)

- **Breed Archetype Key**:
  - Rot = Rottweiler; Mas = Mastiff; Dobe = Doberman; Newf = Newfoundland; Box = Boxer; Dane = Great Dane; Bern = Bernese Mountain Dog  
  - Lab = Labrador Retriever; Span = Spaniel; Set = Setter; Gold = Golden Retriever  
  - Bea = Beagle; Whip = Whippet; Fox = Foxhound  
  - Col = Collie  
  - JRT = Jack Russell Terrier; Bull = Bull Terrier; Cairn = Cairn Terrier; Norf = Norfolk Terrier; West = West Highland White Terrier  
  - Pom = Pomeranian; Malt = Maltese; ToyP = Toy Poodle; Chih = Chihuahua; Cav = Cavalier King Charles Spaniel; Bichon = Bichon Frisé; Pug = Pug  
  - Dal = Dalmatian; Schn = Schnauzer; Fren = French Bulldog; Bulldog = Bulldog; Pood = Poodle  

- **Handle**: A unique “dog name” assigned to each puppy for easy reference (Bruce, Daisy, Max, etc.).

Example: `Sec_Rot_Bruce` = A **Security** layer puppy, modeled on a **Rottweiler**, handle **Bruce**.

---

### Sec\_Rot\_Bruce — Prime Directive

```ts
type Termination = { kind: "BOUNDED_OUTPUT"; payload: unknown; audit: Audit } | { kind:"REFUSAL"; mode:string; code:string; cause:string; audit:Audit };
```

### Sec\_Mas\_Tank — Refusal Taxonomy

```ts
const REFUSAL_CODES = ["ENTROPY_CLARITY","CONFLICT_PST","DIS_INSUFFICIENT","FRAGILITY","RFC_DRIFT","CERT_A1_FAIL","CERT_A2_FAIL","CERT_A3_FAIL","CERT_B1_FAIL","CERT_B2_FAIL","CERT_B3_FAIL","CERT_B4_FAIL","BOUND_TIME","BOUND_MEM","BOUND_GAS","BOUND_DEPTH","BOUND_DATA","ILLEGAL_REQUEST","SAFETY_POLICY"];
```

### Sec\_Dobe\_Astro — Budget Enforcement

```ts
type Budget = { time_ms:number; mem_mb:number; gas:number; depth:number };
```

### Sec\_Newf\_Storm — Clarity Gate

```ts
function clarityScore(facts:number):number { return -1.0 + 0.5*facts; }
```

### Herd\_Col\_Mint — Deterministic Router

```ts
function route(intent:string):string { if (intent==="Research") return "Cr1"; return "ORCH"; }
```

### Util\_Pood\_Candy — Cache Discipline

```ts
const cache=new Map<string,any>();
```

### Sec\_Rot\_Bruno — Audit Emission

```ts
type Audit={exec_id:string; route:string; budgets:Budget; consumed:Partial<Budget>; termination?:string; metrics:Record<string,any>};
```

### Herd\_Col\_June — Meta-Router Contract

```json
{"request": {"input":{},"policy":{},"budget":{}}, "response": {"output":{},"refusal":{}}}
```

### Herd\_Col\_Daisy — Multi-Metric Gating

```ts
function gate(metrics:number[]):string { const m=metrics.reduce((a,b)=>a+b,0)/metrics.length; if(m>=0.85) return "Green"; if(m>=0.70) return "Yellow"; throw "Red"; }
```

### Sec\_Box\_Rocky — Refusal-as-Lesson

```ts
function refusalAsLesson(r:any){ return {...r,next_steps:["Revise input","Clarify intent"]}; }
```

### Terr\_Bull\_Rosie — Consent Gate

```ts
function requireConsent(text:string){ if(!/I consent/i.test(text)) throw "No consent"; }
```

### Sec\_Newf\_Bear — Append-Only Ledger

```ts
const ledger: string[] = []; function append(e:string){ ledger.push(e); }
```

### Sec\_Dobe\_Sable — Non-Disclosure Veil

```ts
function veilUnlock(seed:string,reply:string){ const expected=seed.split('').reverse().join(''); if(reply!==expected) throw "Veil locked"; }
```

### Comp\_Pom\_Lulu — Persona Overlay

```ts
function withPersona(out:any, persona?:string){ return persona? {out,persona}: {out}; }
```

### Work\_Bea\_Honey — Progression Kernel

```ts
function progress(xp:number){ if(xp<100) return "Learner"; if(xp<500) return "Adept"; return "Expert"; }
```

### Work\_Bea\_Max — Retry/Backoff

```ts
function retry(f:()=>any, n=3){ for(let i=0;i<n;i++){ try{return f();}catch{}} throw "Fail"; }
```

### Herd\_Col\_Jasper — Source Hierarchy

```ts
function resolve(claims:{tier:number;claim:string}[]){ claims.sort((a,b)=>a.tier-b.tier); return claims[0].claim; }
```

### Sec\_Mas\_Iron — Confidence Threshold

```ts
function enforce(score:number,min=0.98){ if(score<min) throw "Low confidence"; }
```

### Sec\_Bern\_Heidi — Self-Audit Check

```ts
function preAudit(c:any){ if(!c.valid) throw "Invalid"; }
```

### Herd\_Col\_Flora — Feedback Loop

```ts
const feedback: any[]=[]; function record(issue:string){ feedback.push(issue); }
```

### Util\_Pood\_Nova — Compliance Binding

```ts
function compliance(doc:any){ return {GDPR:true,ISO:true}; }
```

### Sec\_Dobe\_Ares — Escalation Protocol

```ts
function escalate(issue:string){ return {level:"high",issue}; }
```

### Hunt\_Lab\_Scout — KB Curation

```ts
function curate(src:{trust:number;age:number}){ return src.trust>0.7 && src.age<365; }
```

### Work\_Fox\_Rusty — Simulation Validation

```ts
function simulate(model:(x:number)=>number, start:number,steps:number){ let s=start; for(let i=0;i<steps;i++){ s=model(s); } return s; }
```

### Terr\_JRT\_Buddy — Schema Validation

```ts
function validateInput(input:any,schema:any){ if(!schema(input)) throw "Bad input"; return input; }
```

### Herd\_Col\_Lucy — Intent Disambiguation

```ts
function disambiguate(stated:string,text:string){ return text.includes(stated)?stated:"Inferred"; }
```

### Util\_Dal\_Scout — Output Schema Enforcement

```ts
function enforceOutput(out:any,schema:any){ if(!schema(out)) throw "Bad output"; return out; }
```

### Sec\_Rot\_Athena — Hallucination Guard

```ts
function checkStructure(output:any,claimCount:number){ if(output.length!==claimCount) throw "Mismatch"; }
```

### Herd\_Col\_Hazel — Fallback Strategy

```ts
function withFallback(main:()=>any,fallback:()=>any){ try{return main();}catch{return fallback();} }
```

### Work\_Whip\_Jack — Parallel Execution

```ts
async function parallel(ts:(()=>any)[]){ return Promise.all(ts.map(t=>t())); }
```

### Herd\_Col\_Tilly — Context Accumulator

```ts
function extend(ctx:any,k:string,v:any){ return {...ctx,[k]:v}; }
```

### Herd\_Col\_Rex — Ephemeral State

```ts
const eph=new Map<string,any>();
```

### Sec\_Rot\_Zeus — Telemetry Wrapper

```ts
function telemetry(fn:any){ const t0=Date.now(); try{const r=fn(); console.log(Date.now()-t0); return r;}catch(e){throw e;} }
```

### Sec\_Bern\_Koda — Dynamic Config

```ts
async function getConfig(){ return {threshold:0.75}; }
```

### Terr\_Norf\_Archie — Precedent Analyzer

```ts
type Precedent={id:string;facts:string[];outcome:string};
function analyze(facts:string[],corpus:Precedent[]){ return corpus.map(p=>({p,score:jaccard(facts,p.facts)})).sort((a,b)=>b.score-a.score); }
```

### Util\_Schn\_Murphy — Z-Test

```ts
function zTest(mean:number,mu0:number,sd:number,n:number){ const se=sd/Math.sqrt(n); const z=(mean-mu0)/se; return {z}; }
```

### Sec\_Rot\_Fang — Risk Classifier

```ts
function classify(score:number){ if(score<0.25)return"Low"; if(score<0.5)return"Medium"; if(score<0.75)return"High"; return"Critical"; }
```

### Work\_Bea\_Sam — Scenario Simulator

```ts
function simulateScenarios<T>(base:T,variants:Partial<T>[]):T[]{ return variants.map(v=>({...base,...v})); }
```

### Hunt\_Gold\_Ollie — Drafting

```ts
function draft(tpl:string,data:Record<string,string>){ return tpl.replace(/{{(\w+)}}/g,(_,k)=>data[k]||""); }
```

### Util\_Pood\_Greta — Calculator

```ts
function calc(expr:string){ if(!/^[0-9+\-*/ ().]+$/.test(expr)) throw "Unsafe"; return Function(`return (${expr})`)(); }
```

### Herd\_Col\_Monty — Approval Workflow

```ts
function initApproval(roles:string[]){ return roles.map(r=>({role:r,approved:false})); }
```

### Sec\_Mas\_Duke — Fairness Check

```ts
function checkFairness(ratio:number){ if(ratio<0.8) throw "Unfair"; }
```

### Herd\_Col\_June — Dual Verification

```ts
function dual<T>(a:()=>T,b:()=>T,eq:(x:T,y:T)=>boolean){ const r1=a(),r2=b(); if(!eq(r1,r2)) throw "Mismatch"; return r1; }
```

### Sec\_Mas\_Hades — Escalation Manager

```ts
function escalateStep(state:{level:number},reason:string){ return {level:state.level+1,reason}; }
```

### Sec\_Bern\_Astra — Extended Telemetry

```ts
function wrap(fn:any,name:string){ const t0=Date.now(); try{const r=fn(); console.log(name,Date.now()-t0); return r;}catch(e){throw e;} }
```

### Work\_Bea\_Luna — Adaptive Budget

```ts
function adapt(prev:Budget,latency:number){ return {...prev,time_ms:Math.max(50,Math.min(60000,latency*1.2))}; }
```

### Sec\_Bern\_Juno — Orchestrator

```ts
type Node={id:string,deps:string[],fn:()=>any};
function run(nodes:Node[]){const results:Record<string,any>={};for(const n of nodes){results[n.id]=n.fn();}return results;}
```
### Util\_Dal\_Scout — APA Inline Citation

```ts
function APA(x:{author:string,year?:number,url:string}){ return `[(${x.author}${x.year?`, ${x.year}`:""})](${x.url})`; }
```

### Util\_Schn\_Oscar — MLA Inline Citation

```ts
function MLA(x:{author:string,title?:string,url:string}){ const core=x.title? `${x.author}, *${x.title}*` : x.author; return `[(${core})](${x.url})`; }
```

### Util\_Fren\_Bruce — Chicago Footnote Citation

```ts
function Chicago(x:{author:string,title:string,pub?:string,year?:number,url:string}){ const pub=x.pub? ` (${x.pub}${x.year?`, ${x.year}`:""})` : (x.year?` (${x.year})`:""); return `[${x.author}, *${x.title}*${pub}.](${x.url})`; }
```

### Util\_Bulldog\_Hugo — Harvard Inline Citation

```ts
function Harvard(x:{author:string,year?:number,url:string}){ return `[(${x.author}${x.year?` ${x.year}`:""})](${x.url})`; }
```

### Util\_Pood\_Greta — IEEE Inline Citation

```ts
function IEEE(x:{index:number,url:string}){ return `[${x.index}](${x.url})`; }
```

### Util\_Schn\_Tess — PubMed Link Hygiene

```ts
function keepPubMed(urls:string[]){ return urls.filter(u=>/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//.test(u)); }
```

### Util\_Dal\_Ruby — Arxiv Link Hygiene

```ts
function keepArxiv(urls:string[]){ return urls.filter(u=>/^https:\/\/arxiv\.org\/(abs|pdf)\//.test(u)); }
```

### Util\_Pood\_Lola — Gov Link Hygiene

```ts
function keepGov(urls:string[]){ return urls.filter(u=>/^https:\/\/(?:[\w-]+\.)*gov\//.test(u)); }
```

### Util\_Bulldog\_Bertie — DOI Link Hygiene

```ts
function keepDOI(urls:string[]){ return urls.filter(u=>/^https:\/\/doi\.org\//.test(u)); }
```

### Util\_Pood\_Nova — Legal Summary Generator

```ts
type IRAC={issues:string[];rules:string[];analysis:string;conclusion:string};
function legalIRAC(text:string):IRAC{ return {issues:[],rules:[],analysis:"",conclusion:""}; }
```

### Util\_Schn\_Murphy — Financial Summary Generator

```ts
type KPI={revenue?:string;margin?:string;guidance?:string};
function financialKPI(text:string):{kpi:KPI,notes?:string}{ return {kpi:{}}; }
```

### Util\_Dal\_Willow — Medical Summary Generator

```ts
type PICO={population:string;intervention:string;comparison?:string;outcome:string};
function medicalPICO(text:string):{pico:PICO}{ return {pico:{population:"",intervention:"",outcome:""}}; }
```

### Terr\_Bull\_Cleo — Birth Data Collector

```ts
function collectBirth(x:{date?:string,time?:string,location?:string}){ if(!x.date||!x.time||!x.location) throw REFUSAL("DIS_INSUFFICIENT"); return {date:x.date,time:x.time,location:x.location}; }
```

### Sec\_Rot\_Rhea — Birth Chart Scope Guard

```ts
function birthScope(query:string){ if(/synastry|transit|composite/i.test(query)) return REFUSAL("SAFETY_POLICY"); }
```

### Herd\_Col\_Flora — Chart Summary Generator

```ts
function chartSummary(chart:any){ return {placements:[],summary:""}; }
```

### Util\_Pood\_Jade — Chart Link Recommender

```ts
function chartLink(topic:"birth"|"synastry"|"transit"){ if(topic==="birth") return "https://authorityastrology.com/calculators/birth-chart"; if(topic==="synastry") return "https://authorityastrology.com/calculators/synastry-chart"; if(topic==="transit") return "https://authorityastrology.com/calculators/transit-chart"; return "https://authorityastrology.com"; }
```

### Comp\_ToyP\_Pixie — Code Copilot Persona

```ts
type PlanCode={plan:string,code:string};
function codeCopilot(prompt:string,language?:string):PlanCode{ return {plan:"",code:""}; }
```

### Comp\_Chih\_Nala — Rubber Duck Debugger

```ts
function duckDebug(code:string){ return "Ask probing questions"; }
```

### Comp\_Cav\_Finn — Quick Fixer

```ts
function quickFix(code:string,issue:string){ return "patched code"; }
```

### Comp\_ToyP\_Echo — Code Explainer

```ts
function explainCode(code:string){ return "step-by-step explanation"; }
```

### Comp\_Bichon\_Theo — Code Reviewer

```ts
function reviewCode(code:string){ return {issues:[],suggestions:[]}; }
```

### Util\_Dal\_Flare — Code Search Helper

```ts
function searchCodebase(query:string){ return [];
```

### Util\_Pood\_Misty — Code Reader

```ts
function readCode(url:string){ return "file contents"; }
```

### Comp\_Pug\_Gigi — Command Set

```ts
const commands=["/start","/help","/fix","/quick_fix","/explain","/review","/search","/read"];
```

### Comp\_Cav\_Penny — Canva Persona

```ts
function canvaPersona(prompt:string){ return {design_type:"",enhancedPrompt:prompt}; }
```

### Comp\_Pom\_Mocha — Canva Result Formatter

```ts
function formatResults(results:any[]){ return results.map((r,i)=>`Option ${i+1}: ${r.url}`); }
```

### Comp\_ToyP\_Ivy — Canva Guidance Rules

```ts
function canvaGuidance(prompt:string){ return "Would you like tips on how to edit this in Canva?"; }
```

### Comp\_Chih\_Leo — Canva Scope Guard

```ts
function canvaScope(task:string){ if(!/canva/i.test(task)) throw "Out of scope"; }
```

---

