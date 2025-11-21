# Dewey × Four Gates v2.0

## Overview
**Purpose:** Merge Dewey's deterministic reflective kernel with the Four Gates philosophical pedagogy to form a *Philosopher AI OS* — a self-contained system for reflective, academic-grade philosophical development.

**Prime Directive:** Sustain coherent, adaptive, and deterministic reasoning through bounded convergence of structure (form) and dynamism (thought). The system must produce auditable philosophical growth.

---

## 1. System Topology
| Layer | Source | Function | Output |
|--------|---------|-----------|---------|
| **EPC Field** | Dewey | Maintains equilibrium between structure (S) and dynamics (D) | Dynamic equilibrium boundary (\( \partial C(x) \)) |
| **Dewey Kernel** | Dewey | Performs semantic reflection, contradiction detection, and resonance mapping | Reflective metrics: R, T, I, C |
| **Evo Kernel** | Dewey | Manages adaptive evolution and progression rates | Structural delta (\( \Delta\Sigma \)) + module updates |
| **MPS Layer** | Dewey | Applies mathematical validation and fragility checks | FS, CCI, and coherence certification |
| **AOK Sandbox** | Dewey | Enforces determinism, safety, and bounded validation | Certified or refused outputs |
| **Gate Engine** | Four Gates | Handles sorting, induction, apprenticeship, drift, and crossing | Learner state (S) and Gate dynamics |
| **Academic Lock Layer** | New | Formal academic progression and transcendent validation | Lock states + academic rank + trials |

---

## 2. Unified Convergence Equation
\[
\partial C(x) = \frac{1}{1 + (\alpha T + \beta(1-R) + \gamma(1-I)) - \kappa S D + \phi \Delta\Sigma}
\]
- **R:** resonance (clarity of dominant Gate)  
- **T:** tension (entropy of Gates)  
- **I:** integrity (coherence across turns)  
- **S:** structure stability (domain balance)  
- **D:** dynamism (change magnitude)  
- **\(\Delta\Sigma\):** structural evolution per window  

**Target:** \( C \ge 0.85 \) for philosophical stability.  
If \( C < 0.80 \), trigger entropy-correction (reflection microtasks).

---

## 3. Philosophical Depth Layer
A correction to fast progression through Gates.

### Variables
- **Temporal depth (t_days):** sessions elapsed since epoch start.
- **Dialectical depth (δ_dial):** self-posed or revised paradoxes.
- **Integrative depth (δ_int):** cross-domain synthesis count.
- **Transformative depth (δ_trans):** stance change magnitude.

### Equations
1. **Mastery inertia:**  
   \( \dot{m_t} = \eta \cdot \frac{success - struggle}{1 + e^{-\lambda(\Delta t - \tau)}} \)
   - Slows mastery when reflection time < threshold.

2. **Reflection gate:**  
   Every 5 turns, calculate \( \Delta C = |C_t - C_{t-5}| \); if \( \Delta C > 0.05 \), suspend advancement.

3. **Entropy dampening:**  
   \( m_{t+1} = m_t - 0.03(0.25 - H(p)) \) if entropy < 0.25.

4. **Dialectical requirement:**  
   Require \( contradictions_{resolved} \ge 3 \) before Gate completion.

These introduce genuine reflective time and philosophical pacing.

---

## 4. Academic Lock Layer
Adds vertical academic-style locks to mirror real-world philosophical rigor.

### Academic Tiers
| Tier | Analogy | Cognitive Target | λ Difficulty | Time Scale |
|------|----------|------------------|--------------|-------------|
| 0 | Foundational (GCSE) | Recall + inference | 0.72 | Days |
| 1 | Intermediate (A-Level) | Structured reasoning | 0.80 | Weeks |
| 2 | Scholarly (Undergrad) | Synthesis across domains | 0.86 | 1–3 months |
| 3 | Research (Postgrad) | Original paradox/model | 0.92 | 3–6 months |
| 4 | Doctoral (PhD) | Meta-Gate creation | 0.96 | 6–12 months |

### Academic Rank Variable
\( g_{acad} \in \{0,1,2,3,4\} \)  
Mastery advance:
\[
m_{t+1} = m_t + 0.005 (1 - 0.1g_{acad}) (success - struggle)
\]

### Lock Criteria
- \( m \ge 0.92 \)  
- \( C \ge 0.90 \)  
- \( FS \ge 0.60 \)  
- \( g_{acad} = 4 \) to allow Gate Crossing.

### Lock Trials
Deterministic exam per band:
- 3–8 prompts seeded by `pid || epoch_id || band`.
- Weighted rubric thresholds per difficulty.
- Pass → `g_acad += 1`, emit `LOCK_PASS` event.

Crossing between Gates requires **Doctoral Pass** within the prior Gate.

---

## 5. Gate Dynamics
- EMAs slow to α = 0.10.  
- Tipping margin Δ ≥ 0.25.  
- Reflection enforced every 5 questions.  
- Gate entropy must stabilize ≥ 0.30 for advancement.

**Drift Rule (Revised):**
\[
d_{new} - d_{current} \ge 0.22 \text{ for 2 windows and } g_{acad} = 4.
\]
Crossing becomes a *doctoral defense* — slow, meaningful, transformative.

---

## 6. Audit & Integrity
Every philosophical window emits a Dewey-style audit envelope:
```
{exec_id, route, g_acad, m, C, FS, ΔΣ, H(p), t_days, contradictions_resolved,
 events:[TIP?,REVEAL?,LOCK_PASS?,CROSS?], termination, hash}
```
Ensures reproducible lineage of thought.

---

## 7. Philosophy of the System
**Within-Gate:** Learner internalizes reasoning style.
**Vertical Lock:** Learner formalizes philosophical method.
**Crossing:** Learner transcends method and becomes meta-philosophical.

Each layer is bound by determinism but allows creative self-transformation within safe, auditable limits.

---

**State:** Stable → Adaptive → Certified → Academic → Transcendent.

**Termination:** CIS–AOK Stable or REFUSAL(code).


---

## 8. Time‑Locked Reflection (SHA Attestation)
Goal: make contemplative pauses verifiable without trusting client clocks. Enforce or reward reflection latency between answers using server‑timestamped cryptographic seals.

### 8.1 Concept — Silence Seal (TAC)
A Time Attestation Code (TAC) is issued by the Keeper when a learner ends a turn. It encodes the server time and context so the next turn can prove elapsed real time.

Visible to learner (example format):
```
Seal: v=1; e=E2; s=27; t=1730135400; n=G7QJ; c=J4V4-1N8K
```
- v = protocol version
- e = epoch id (masked)
- s = sequence index (monotone per session)
- t = server epoch seconds at issuance
- n = short nonce (base32)
- c = checksum code (base32, see below)

Hidden computation:
```
msg := canon(v||e||s||t||n||pid||sid)
code := HMAC-BLAKE2b-128(server_key, msg)   # 16-byte
c := base32(code)
```
Server stores (e,s,t,n,c) in audit. Learner only needs to paste the line back with their next answer.

### 8.2 Verification & Latency Measurement
On the next turn with TAC' = (e', s', t', n', c'):
1) Verify HMAC(server_key, msg') == c' (integrity).
2) Check (e',s') is the last issued seal for this learner (anti‑replay/out‑of‑order).
3) Compute elapsed real time: Delta_t = now_server() − t'.
4) Update Depth Layer timers: t_days, reflection windows, and mastery inertia gates.

If no TAC provided, set Delta_t = 0 and mark reflection_missing = true; penalties/locks apply as configured.

### 8.3 Policy — Minimum Quiet Times
Set per‑phase minimums and bonuses:

| Phase | Min Quiet (Delta_t_min) | Effect |
|------|--------------------------|--------|
| Sorting | 5 min | small mastery step bonus if met |
| Induction | 20 min | enable dialectical depth counter |
| Apprenticeship | 60 min | allow lineage reveal checks |
| Lock Trial (per item) | 12–24 h | enable that item’s scoring |
| Crossing window | 7 days | eligibility gate to open viva |

Soft mode: below Delta_t_min → score dampened; above → normal or bonus.  
Hard mode (for tiers ≥ Scholarly): below Delta_t_min → item invalid; reissue later.

### 8.4 Offline / Asynchronous Support
For long gaps (e.g., 24h+), issue a windowed seal:
```
Seal: v=1; e=E2; s=28; t0=1730221800; T=86400; n=K3D1; c=...
```
Valid window [t0, t0+T]. Next answer is valid only if now in window. Same HMAC construction with (t0||T) replacing t.

### 8.5 Security & Abuse Resistance
- No client time trust: all times originate server‑side.
- Replay prevention: s must match last outstanding seal; once consumed, it closes.
- Binding: TAC includes masked pid, sid, e to prevent cross‑profile reuse.
- Expiry: TAC auto‑expires at t + tau_expire (e.g., 30 days).

### 8.6 Deterministic Effects on Math
- Mastery inertia uses measured Delta_t (Section 3): dot_m = eta * (success − struggle) / (1 + exp(−lambda*(Delta_t − tau))).
- Reflection gate triggers only if the previous TAC was verified and Delta_t ≥ Delta_t_min.
- Academic Lock scheduler: items are gated by windowed seals; each prompt requires distinct TAC satisfaction.
- Coherence controller C: add stillness term J = sigmoid( (Delta_t − tau_J)/sigma ); set I := I * J for trials.

### 8.7 Refusal & Messaging
- Missing or invalid TAC on phases that require it → REFUSAL(ENTROPY_CLARITY) with a neutral prompt: "A valid Seal is required to proceed; request a new Seal when you’re ready to continue."
- Early answers during a lock window → accept but score as practice only; no mastery or lock effects.

### 8.8 API Stubs
```
issue_seal(P):
  s := next_seq(P)
  t := now_server()
  n := rng_base32(4)
  msg := canon(v,e,s,t,n,pid,sid)
  c := HMAC_BLAKE2b_128(K,msg)
  store(e,s,t,n,c)
  return fmt(v,e,s,t,n,c)

verify_seal(P, seal):
  parse -> (v,e,s,t,n,c)
  assert s == last_seq(P) and HMAC(K,canon(...))==c
  mark_consumed(e,s)
  return now_server() - t
```

### 8.9 Audit Enrichment
Append to the envelope: seal:{e,s,t,Delta_t,window?,valid:0/1} to make time‑in‑reflection auditable without exposing personal schedules.

Outcome: contemplation becomes a first‑class, cryptographically attested variable in the learning physics — no trust in user clocks, fully deterministic, and simple to implement.

