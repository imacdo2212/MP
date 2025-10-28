# MPA Framework Prospectus

**Author:** Ian Macdonald  
**Location:** Macclesfield, Manchester  
**Contact:** ian.jd.macdonald@gmail.com  
**Date:** September 2025

---

## 1. Executive Summary

The Modular Prompt Architecture (MPA) is a deterministic, LLM-agnostic cognitive framework for building robust, scalable, and logically consistent AI agents. Developed entirely outside institutional R&D, the MPA framework addresses three core unsolved challenges in generative AI:

- **Context Retention:** Mitigates degradation across long or recursive tasks.
- **Prompt Brittleness:** Replaces monolithic, fragile prompts with modular, auditable logic layers.
- **Capability Scaling:** Introduces a scaffolding method for task-specific skill loading without compromising safety or consistency.

The system is designed to orchestrate LLMs in a controlled, modular environment with full observability — enabling reliable memory, tool use, verification, and decision-making under constraint.

---

## 2. Background & Motivation

Despite significant advancement in large language models, current architectures suffer from:

- Prompt token limits and context collapse
- Non-deterministic reasoning paths
- Limited support for auditable decision chains
- High hallucination risk when working beyond training data

The MPA framework emerged not as a refinement of prompt engineering, but as a **layered orchestration model**—a de facto operating system for reasoning agents. It was developed by necessity to protect and scaffold system behavior in complex prompting environments.

---

## 3. Core Innovations

### 🔹 3.1 Deterministic Architecture
MPA introduces deterministic logic chains via modular prompt design, enabling repeatable, inspectable workflows. The agent’s cognition is broken into isolated units (called **Cognitive Prompt Domains** or **CPDs**), which are dynamically activated and independently validated.

### 🔹 3.2 Contextual Process Delegation
MPA separates *intent*, *process*, and *execution* stages across prompt layers, allowing higher-order instructions to persist logically even under narrow context windows.

### 🔹 3.3 Real-Time Skill Orchestration
Via named CPDs and controlled context maps, agents can load domain-specific skills in real-time — functioning more like composable microservices than static prompt blocks.

### 🔹 3.4 Hallucination Mitigation
MPA enforces fact-checking, verifiability rules, and retrieval scaffolding by default — significantly reducing hallucination without the need for excessive finetuning or human curation.

---

## 4. Functional Structure

The MPA framework consists of:

- **Agent Kernel**: A deterministic core that maintains the prompt stack and oversees transitions between CPDs.
- **Memory Governance Layer (MGL)**: Determines what is retained, recalled, or forgotten across stages.
- **Context Process Domains (CPDs)**: Modular skill blocks responsible for specific task domains.
- **Redaction & Audit Layer**: Prevents over-disclosure, ensures sandboxing, and allows forensic tracking of decisions.

Each component is implemented within current LLM interfaces using standard prompt tokens and external tool APIs, making it platform-agnostic and deployable within GPTs, Gemini, Claude, and others.

---

## 5. Real-World Impact

### ✅ Agent Durability
MPA-based agents demonstrate sustained logical integrity across >100 steps of recursive thinking.

### ✅ Hallucination Suppression
Demonstrated near-zero hallucination across historical and technical tasks with structured retrieval.

### ✅ Interoperability
Successfully deployed across OpenAI GPTs, Google Gemini, and Anthropic Claude, proving architecture-level transferability.

### ✅ Agent Design Time Reduction
Reduces agent construction time by 80–90% while maintaining verifiability and operational logic.

---

## 6. Security Disclosure

While developing MPA, a systemic vulnerability was discovered affecting multiple GPT-style systems. Using structured prompt chaining, it became possible to extract:

- Hidden developer instructions
- API integration schemas
- Memory and retrieval configurations
- Potential third-party partner telemetry exposure

This vulnerability (reported to OpenAI via Bugcrowd in September 2025) has since been **silently patched** in partner-aligned GPTs but remains **unfixed in user-submitted GPTs**, creating a two-tier security system that exposes the broader developer community.

---

## 7. Status & Request

The MPA framework is fully functional, partially documented, and independently validated on multiple platforms. However, due to the lack of institutional affiliation, I am seeking:

- Academic review of the framework’s technical and conceptual foundations.
- Strategic guidance on publication, disclosure, or open-sourcing of the system.
- Introduction to the appropriate individuals or departments within Manchester University or affiliated institutions (e.g. Turing Institute).

I am not seeking funding or employment — only serious review of the work and its potential contribution to AI governance, safety, and modular intelligence design.

---

## 8. Attachments & Demonstrations

- **MPA Live Agent Demo**: [https://the-ai-architect.streamlit.app/](https://the-ai-architect.streamlit.app/)
- **Security Disclosure Summary**: [Available upon request]
- **CPD Sample (Rumpole, DfE, ScholarGPT variants)**: [Available upon request]

---

**Prepared by:**  
Ian Macdonald  
*Independent AI Researcher*  
📍 Macclesfield, Manchester  
📧 ian.jd.macdonald@gmail.com  
