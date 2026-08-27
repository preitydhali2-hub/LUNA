from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import httpx
import edge_tts
import base64
import json
import time
import logging

from app.guardrails.clinical_rules import DCB0129SafetyGuardrail
from app.models.triage import SessionLocal, TriageRecord
from app.rag.rag_engine import rag_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("luna-core")

app = FastAPI(title="LUNA Clinical Intelligence Platform", version="2.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL_NAME = "llama3.2:3b"

BASE_SYSTEM_PROMPT = """You are LUNA, an AI clinical reception assistant for an NHS GP Surgery in England.
Clinical Operational Rules:
1. Speak in concise, empathetic British English (strictly 1 to 2 sentences per turn for natural telephony voice).
2. Triage systematically: ask for symptom duration in days, severity (1-10), and related history.
3. If an official NHS guideline is provided in context, provide the verified self-care advice directly.
4. Never attempt formal diagnosis.
"""


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ConnectionManager:
    def __init__(self):
        self.active_callers: Dict[str, WebSocket] = {}
        self.receptionist_dashboards: List[WebSocket] = []

    async def connect_caller(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_callers[session_id] = websocket

    def disconnect_caller(self, session_id: str):
        if session_id in self.active_callers:
            del self.active_callers[session_id]

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.receptionist_dashboards.append(websocket)

    def disconnect_dashboard(self, websocket: WebSocket):
        if websocket in self.receptionist_dashboards:
            self.receptionist_dashboards.remove(websocket)

    async def broadcast_to_dashboard(self, message: dict):
        for connection in list(self.receptionist_dashboards):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass


manager = ConnectionManager()


async def synthesize_british_voice(text: str) -> Optional[str]:
    try:
        voice = "en-GB-SoniaNeural"
        communicate = edge_tts.Communicate(text, voice, rate="+4%")
        audio_bytes = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes.extend(chunk["data"])
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as err:
        logger.error(f"TTS non-fatal error: {err}")
        return None

# --- REST Endpoints ---


@app.get("/api/triage/records")
def get_records(db=Depends(get_db)):
    return db.query(TriageRecord).order_by(TriageRecord.created_at.desc()).limit(30).all()

# --- WebSocket Telephony Gateway ---


@app.websocket("/ws/caller/{session_id}")
async def patient_voice_call(websocket: WebSocket, session_id: str):
    await manager.connect_caller(session_id, websocket)
    history = []
    start_time = time.time()
    db = SessionLocal()

    record = TriageRecord(
        session_id=session_id,
        dialogue_history="[]",
        duration_seconds=0,
        urgency_category="IN_PROGRESS",
        is_emergency=False,
        symptom_summary="Incoming consultation..."
    )
    db.add(record)
    db.commit()

    try:
        while True:
            raw_data = await websocket.receive_text()
            payload = json.loads(raw_data)
            user_utterance = payload.get("utterance", "").strip()

            if not user_utterance:
                continue

            # 1. Deterministic NHS Emergency Guardrail (Instant)
            is_emergency, flag_type, emergency_script = DCB0129SafetyGuardrail.evaluate(
                user_utterance)

            if is_emergency:
                reply_text = emergency_script
                category = f"EMERGENCY_999_{flag_type}"
            else:
                # 2. Query Local RAG Clinical Protocols
                rag_result = await rag_engine.query(user_utterance)
                system_prompt = BASE_SYSTEM_PROMPT
                rag_guidance = None

                if rag_result:
                    protocol, score = rag_result
                    category = f"NHS_SELF_CARE ({protocol['topic']})"
                    rag_guidance = protocol['guidance']
                    system_prompt += f"\n\nOFFICIAL NHS CLINICAL GUIDELINE:\n{rag_guidance}\nProvide this advice directly to the patient in 1-2 concise sentences."
                else:
                    category = "ROUTINE"

                # 3. Call Ollama with 45s timeout and VRAM keep-alive
                messages = [{"role": "system", "content": system_prompt}] + \
                    history + [{"role": "user", "content": user_utterance}]
                try:
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        res = await client.post(OLLAMA_URL, json={
                            "model": MODEL_NAME,
                            "messages": messages,
                            "stream": False,
                            "keep_alive": "1h",
                            "options": {"temperature": 0.2, "num_predict": 80}
                        })
                        if res.status_code == 200:
                            reply_text = res.json()[
                                "message"]["content"].strip()
                        else:
                            raise RuntimeError(
                                f"Ollama status {res.status_code}: {res.text}")
                except Exception as err:
                    logger.error(
                        f"[Ollama Inference Fallback] Reason: {type(err).__name__} - {err}")
                    # If Ollama timed out or failed, fall back to RAG guidance or triage intake directly
                    if rag_guidance:
                        reply_text = f"For this, NHS guidance recommends: {rag_guidance}"
                    else:
                        reply_text = "I have noted that down. Could you tell me if you have any other symptoms or a fever?"

            audio_b64 = await synthesize_british_voice(reply_text)

            history.append({"role": "user", "content": user_utterance})
            history.append({"role": "assistant", "content": reply_text})

            # 4. Sync Database Record
            record.dialogue_history = json.dumps(history)
            record.duration_seconds = int(time.time() - start_time)
            record.urgency_category = "EMERGENCY_999" if is_emergency else (
                "SELF_CARE" if "SELF_CARE" in category else "ROUTINE")
            record.is_emergency = is_emergency
            record.red_flag_triggered = flag_type if is_emergency else None
            record.symptom_summary = history[0]["content"] if len(
                history) > 0 else user_utterance
            db.commit()

            # 5. Send Caller Response
            await websocket.send_text(json.dumps({
                "response_text": reply_text,
                "audio_base64": audio_b64,
                "is_emergency": is_emergency,
                "category": category
            }))

            # 6. Broadcast Event to GP Dashboard
            await manager.broadcast_to_dashboard({
                "session_id": session_id,
                "patient_spoke": user_utterance,
                "luna_replied": reply_text,
                "is_emergency": is_emergency,
                "category": category,
                "timestamp": time.strftime("%H:%M:%S")
            })

    except WebSocketDisconnect:
        manager.disconnect_caller(session_id)
        if record:
            record.duration_seconds = int(time.time() - start_time)
            db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Error in session {session_id}: {e}")
        manager.disconnect_caller(session_id)
        db.close()


@app.websocket("/ws/dashboard")
async def receptionist_dashboard(websocket: WebSocket):
    await manager.connect_dashboard(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)
