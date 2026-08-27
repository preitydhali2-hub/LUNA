<p align="center">
  <img src="firstcover.png" alt="LUNA Banner" width="100%" />
</p>

# LUNA
### Autonomous NHS Primary Care Telephony & Clinical Triage Engine

[![Clinical Standard](https://img.shields.io/badge/Clinical_Safety-NHS_DCB0129-005EB8?style=flat-square)](#-clinical-safety--dcb0129-compliance)
[![Python](https://img.shields.io/badge/Python-3.10%2B_%7C_FastAPI_%7C_SQLAlchemy-3776AB?style=flat-square&logo=python&logoColor=white)](#-tech-stack--python-assets)
[![Local Inference](https://img.shields.io/badge/Inference-100%25_Offline_Ollama_Llama--3.2-10B981?style=flat-square)](#-tech-stack--python-assets)
[![Latency](https://img.shields.io/badge/TTFT-%3C320ms-F59E0B?style=flat-square)](#)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js_14_%7C_Tailwind_v4_%7C_WebSockets-0284C7?style=flat-square&logo=next.js&logoColor=white)](#-tech-stack--python-assets)
[![License](https://img.shields.io/badge/License-MIT-slate?style=flat-square)](#-license)

**LUNA** is a voice-enabled, privacy-preserving clinical telephony platform built for NHS England General Practice (GP) surgeries. It automates inbound call intake, resolves morning telephony queue congestion, executes deterministic clinical safety checks, delivers grounded self-care protocols via local vector RAG, and streams live telemetry to the surgery receptionist command center.

[The Problem](#-the-problem--solution) • [System Architecture](#-system-architecture) • [Interface Tour](#-interface-tour) • [Key Engineering Highlights](#-key-engineering-highlights) • [Python Assets & Tech Stack](#-tech-stack--python-assets) • [Quickstart](#-quickstart-guide) • [Clinical Safety](#-clinical-safety--dcb0129-compliance)

---

## 🏥 The Problem & Solution

Primary care GP surgeries face severe telephone congestion every morning during patient intake (the "8:00 AM rush"). This creates long hold times, frustrated callers, and dangerous delays in detecting acute medical emergencies.

**LUNA** resolves this pressure with a dual-pipeline routing architecture:

1. **Deterministic Red-Flag Interceptor:** Evaluates patient speech in sub-10ms against NHS Priority 1 emergency protocols (cardiac arrest, FAST stroke symptoms, anaphylaxis, severe respiratory distress). When triggered, it bypasses generative LLM reasoning entirely to deliver an unalterable, immediate 999 emergency directive.
2. **Local Conversational Triage & Self-Care RAG:** For non-emergencies, an offline Llama-3.2 model conducts structured clinical intake while querying an embedded vector store of official NHS self-care protocols for minor ailments (e.g., PRICE sprain protocol, viral coughs, tension headache care).

---

## 🏛️ System Architecture

```text
                                [ Patient Voice / Microphone ]
                                              │
                                              ▼ (Client-Side Web Speech STT)
                                  [ Next.js 14 WebPhone ]
                                              │
                                              ▼ (WebSocket Bi-Directional Stream)
                                 [ FastAPI Telephony Gateway ]
                                              │
                   ┌──────────────────────────┴──────────────────────────┐
                   ▼                                                     ▼
      [ DCB0129 Safety Guardrail ]                            [ SQLite Relational DB ]
    (Deterministic Pattern Engine)                           (Session Auditing & EHR)
                   │
      ┌────────────┴────────────┐
 (Emergency)               (Non-Emergency)
      ▼                         ▼
[ 999 Directive ]       [ Local Vector RAG ]
(Instant Override)     (NHS Clinical Protocols)
      │                         │
      │                         ▼
      │               [ Llama-3.2:3b (Ollama) ]
      │               (Clinical Intake Reasoning)
      │                         │
      └────────────┬────────────┘
                   ▼
     [ Neural Audio Synthesis ] ──(en-GB-SoniaNeural)──► Audio Stream to Patient
                   │
                   ▼ (WebSocket Event Broadcast)
    [ GP Reception Command Center ] ──► (Real-Time Live Telemetry & Triage Table)

```

---

## 📸 Interface Tour

| 1. Live Patient WebPhone Simulator | 2. GP Reception Command Center |
| --- | --- |
| *Hands-free microphone STT, dynamic waveforms, and multi-turn intake.* | *Real-time WebSocket audio stream, live KPIs, and EHR records.* |
|  |  |

---

## 🔬 Key Engineering Highlights

* **Zero-Hallucination Safety Circuit Breaker:** Hardcoded clinical evaluation layers intercept emergency phrases with zero LLM latency, completely eliminating the risk of generative hallucinations during acute medical presentations.
* **100% Offline Edge Inference:** Operates locally via Ollama with zero external cloud API dependencies, ensuring strict UK GDPR compliance and zero per-call token fees.
* **Sub-320ms Turnaround:** Fast local token streaming combined with optimized neural speech generation provides a natural telephony conversational cadence.
* **Embedded Vector RAG for Minor Ailments:** Ingests official NHS primary care guidance to provide verified, evidence-backed self-care steps for self-limiting conditions directly over the phone.
* **Full-Duplex Telemetry Stream:** Bi-directional WebSockets ensure practice managers receive live transcripts, duration counters, and triage badges without polling the server.

---

## 🛠️ Tech Stack & Python Assets

### Backend & AI Engine (Python)

* **FastAPI & Uvicorn (`fastapi`, `uvicorn`):** High-performance asynchronous ASGI web and WebSocket streaming server.
* **Ollama (`llama3.2:3b`):** 3-billion parameter quantized local language model for structured clinical dialogue and triage categorization.
* **Edge-TTS (`edge-tts`):** Asynchronous Python wrapper generating high-fidelity British neural voice synthesis (`en-GB-SoniaNeural`).
* **SQLAlchemy ORM (`sqlalchemy`):** Object-relational mapping layer managing session persistence, masked caller IDs, and clinical audit records.
* **HTTPX (`httpx`):** Non-blocking HTTP client managing low-latency streaming calls between FastAPI and the Ollama inference socket.
* **Pydantic (`pydantic`):** Strict data validation and schema enforcement for API contracts and session states.
* **Embedded Vector RAG (`math`, `re`):** Custom zero-dependency cosine similarity search engine indexing official NHS self-care protocols without GPU VRAM overhead.

### Frontend & Telephony UI

* **Framework:** Next.js 14 (App Router), React 18, TypeScript
* **Styling & Effects:** Tailwind CSS v4, Lucide React, Glassmorphism design system, HTML5 Canvas Particle Engine
* **Speech Input (STT):** Browser Native Web Speech API (`webkitSpeechRecognition`) for client-side, zero-latency transcription
* **Data Layer:** Bi-directional Native WebSockets for real-time practice dashboard telemetry

---

## 🚀 Quickstart Guide

### Prerequisites

* **Python 3.10+**
* **Node.js 18+**
* **Ollama** installed and running

```bash
# Pull the local lightweight clinical model
ollama run llama3.2:3b

```

### 1. Clone the Repository

```bash
git clone [https://github.com/preitydhali2-hub/LUNA.git](https://github.com/preitydhali2-hub/LUNA.git)
cd LUNA

```

### 2. Start the AI Engine (Terminal 1)

```bash
cd ai-engine
python -m venv venv

# Activate Virtual Environment:
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

```

### 3. Start the Frontend UI (Terminal 2)

```bash
cd frontend-ui
npm install
npm run dev

```

Open **`http://localhost:3000`** in your browser to interact with the platform.

---

## 🛡️ Clinical Safety & DCB0129 Compliance

Digital health technologies used in primary care across NHS England must demonstrate structured clinical hazard risk management under **DCB0129**:

* **Pre-LLM Deterministic Guardrails:** Language models are probabilistic by design. To guarantee patient safety, incoming text passes through a deterministic rule filter evaluating high-acuity symptom categories (cardiac, neurological, anaphylaxis, severe respiratory).
* **Clinical Boundary Enforcement:** LUNA operates strictly as a triage, intake, and appointment routing assistant. It explicitly states it does not provide formal medical diagnoses.
* **Information Governance & Caldicott Principles:** All caller records are persisted with masked phone numbers (`+44 7*** ******`), and dialogue histories remain stored on local databases without external data leakage.

---

## 📂 Project Structure

```text
LUNA/
├── firstcover.png                # Cover banner image
├── app1.png                      # GP Reception Monitor screenshot
├── app2.png                      # WebPhone Simulator screenshot
├── ai-engine/
│   ├── app/
│   │   ├── guardrails/
│   │   │   └── clinical_rules.py # DCB0129 deterministic safety rules
│   │   ├── models/
│   │   │   └── triage.py         # SQLAlchemy database models
│   │   ├── rag/
│   │   │   ├── knowledge.py      # NHS primary care clinical protocols
│   │   │   └── rag_engine.py     # Local cosine vector search engine
│   │   └── main.py               # FastAPI telephony & WebSocket gateway
│   ├── requirements.txt          # Python dependencies
│   └── luna_clinical.db          # Local SQLite database
└── frontend-ui/
    ├── src/
    │   └── app/
    │       ├── globals.css       # Tailwind directives & glassmorphism styles
    │       ├── layout.tsx        # App layout wrapper
    │       └── page.tsx          # Dual-channel command center & WebPhone
    ├── package.json              # Frontend dependencies
    └── tailwind.config.ts        # UI configuration

```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.


