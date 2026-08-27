"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  ShieldAlert,
  CheckCircle2,
  Stethoscope,
  Radio,
  Sparkles,
  Send,
  Users,
  FileText,
  Zap,
  RefreshCw,
  Headphones,
  Mic,
  MicOff
} from "lucide-react";

interface LiveFeedItem {
  session_id: string;
  patient_spoke: string;
  luna_replied: string;
  is_emergency: boolean;
  category: string;
  timestamp: string;
}

interface TriageRecord {
  id: number;
  session_id: string;
  caller_phone_masked: string;
  urgency_category: string;
  is_emergency: boolean;
  symptom_summary?: string;
  duration_seconds: number;
  created_at: string;
}

function BioluminescentCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
      color: Math.random() > 0.4 ? "127, 192, 255" : "176, 212, 255",
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(${p.color}, 0.8)`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />;
}

export default function LunaClinicalSuite() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "phone">("dashboard");
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [records, setRecords] = useState<TriageRecord[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // WebPhone Caller State
  const [isCallActive, setIsCallActive] = useState(false);
  const [callSessionId, setCallSessionId] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callTranscript, setCallTranscript] = useState<{ sender: "user" | "luna"; text: string; time: string }[]>([]);
  const [emergencyAlert, setEmergencyAlert] = useState<string | null>(null);

  const dashboardWsRef = useRef<WebSocket | null>(null);
  const callerWsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const fetchRecords = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/triage/records");
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (err) {
      console.error("DB Sync error:", err);
    }
  };

  useEffect(() => {
    fetchRecords();
    const pollInterval = setInterval(fetchRecords, 4000);

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/dashboard");
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data: LiveFeedItem = JSON.parse(event.data);
      setLiveFeed((prev) => [data, ...prev.slice(0, 20)]);
      fetchRecords();
    };

    dashboardWsRef.current = ws;
    return () => {
      ws.close();
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [callTranscript, isProcessing]);

  // Speech Recognition Setup (STT)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-GB";

        recognition.onresult = (event: any) => {
          const spokenText = event.results[0][0].transcript;
          if (spokenText.trim()) {
            sendPatientMessage(spokenText);
          }
          setIsListening(false);
        };

        recognition.onerror = (err: any) => {
          console.warn("Speech recognition error:", err);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setUserInput("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Speech start error:", err);
      }
    }
  };

  const startCall = () => {
    const sId = "NHS-" + Math.floor(100000 + Math.random() * 900000);
    setCallSessionId(sId);
    setCallTranscript([]);
    setEmergencyAlert(null);
    setIsCallActive(true);

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/caller/${sId}`);
    ws.onopen = () => {
      setCallTranscript([
        {
          sender: "luna",
          text: "Hello, you've reached St. Mary's Surgery. I'm Luna. How can I help you with your health today?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    };

    ws.onmessage = (event) => {
      setIsProcessing(false);
      const data = JSON.parse(event.data);
      setIsSpeaking(true);

      setCallTranscript((prev) => [
        ...prev,
        {
          sender: "luna",
          text: data.response_text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      if (data.is_emergency) {
        setEmergencyAlert(data.category);
      }

      if (data.audio_base64) {
        const audioSrc = `data:audio/mp3;base64,${data.audio_base64}`;
        if (audioRef.current) {
          audioRef.current.src = audioSrc;
          audioRef.current.play().catch(() => { });
          audioRef.current.onended = () => setIsSpeaking(false);
        }
      } else {
        setTimeout(() => setIsSpeaking(false), 2000);
      }
    };

    callerWsRef.current = ws;
  };

  const endCall = () => {
    if (callerWsRef.current) {
      callerWsRef.current.close();
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    setIsCallActive(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    fetchRecords();
  };

  const sendPatientMessage = (textToSend?: string) => {
    const query = textToSend || userInput;
    if (!query.trim() || !callerWsRef.current) return;

    setCallTranscript((prev) => [
      ...prev,
      {
        sender: "user",
        text: query,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
    ]);
    setIsProcessing(true);
    callerWsRef.current.send(JSON.stringify({ utterance: query }));
    setUserInput("");
  };

  return (
    <div className="min-h-screen bg-[#08070e] text-[#f0eef6] flex flex-col relative overflow-hidden font-sans">
      <audio ref={audioRef} className="hidden" />
      <BioluminescentCanvas />

      {/* Bioluminescent Gradient Orbs */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-[#005EB8]/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-[#7fc0ff]/15 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Top Navbar */}
      <header className="border-b border-white/[0.06] bg-[#08070e]/70 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#005EB8] to-[#7fc0ff] flex items-center justify-center shadow-[0_0_25px_rgba(127,192,255,0.3)] ring-1 ring-white/20">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-[#7fc0ff] bg-clip-text text-transparent">
                  LUNA
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 text-[#7fc0ff] font-medium border border-[#7fc0ff]/20">
                  NHS DCB0129
                </span>
              </div>
              <p className="text-xs text-slate-400 font-light">Autonomous Primary Care Triage & Telephony</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" : "bg-rose-500"}`} />
              <span className="text-slate-300 font-medium">{isConnected ? "System Live" : "Offline"}</span>
            </div>

            <div className="flex bg-white/[0.04] p-1 rounded-2xl border border-white/[0.08]">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === "dashboard"
                  ? "bg-gradient-to-r from-[#005EB8] to-[#1d70b8] text-white shadow-[0_4px_20px_rgba(0,94,184,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                GP Reception Monitor
              </button>
              <button
                onClick={() => setActiveTab("phone")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${activeTab === "phone"
                  ? "bg-gradient-to-r from-[#005EB8] to-[#1d70b8] text-white shadow-[0_4px_20px_rgba(0,94,184,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Live WebPhone Sim
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 z-10 relative">
        {activeTab === "dashboard" ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-3xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Total Triaged Calls</span>
                  <div className="p-2 rounded-xl bg-sky-500/10 text-[#7fc0ff]">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-light tracking-tight">{records.length}</div>
                <p className="text-[11px] text-slate-400 mt-1">Logged in SQLite</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Routine Bookings</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-light tracking-tight text-emerald-400">
                  {records.filter((r) => !r.is_emergency).length}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Managed autonomously</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Priority 1 Red Flags</span>
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-light tracking-tight text-rose-400">
                  {records.filter((r) => r.is_emergency).length}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Deterministic 999 overrides</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Response Latency</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-light tracking-tight text-amber-400">&lt; 320ms</div>
                <p className="text-[11px] text-slate-400 mt-1">Local Ollama Llama-3.2</p>
              </div>
            </div>

            {/* Split Screen Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Telephony Stream */}
              <div className="glass-panel lg:col-span-1 rounded-3xl p-6 flex flex-col h-[520px]">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-[#7fc0ff] animate-pulse" />
                    <h3 className="font-semibold text-sm">Live Audio & Telephony Stream</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-slate-400">WS://LIVE</span>
                </div>

                <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
                  {liveFeed.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
                      <Headphones className="w-10 h-10 mb-3 stroke-1 text-slate-600" />
                      <p className="text-sm font-light">No calls active currently</p>
                      <p className="text-xs mt-1 text-slate-600">Switch to WebPhone Sim to start a test call.</p>
                    </div>
                  ) : (
                    liveFeed.map((feed, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${feed.is_emergency
                          ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                          : "glass-card text-slate-300"
                          }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
                          <span className="text-[#7fc0ff]">{feed.session_id}</span>
                          <span className="text-slate-500">{feed.timestamp}</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <p><span className="text-slate-400 font-medium">Caller:</span> {feed.patient_spoke}</p>
                          <p><span className="text-[#7fc0ff] font-medium">Luna:</span> {feed.luna_replied}</p>
                        </div>
                        {feed.is_emergency && (
                          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            {feed.category}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Persisted Records */}
              <div className="glass-panel lg:col-span-2 rounded-3xl p-6 flex flex-col h-[520px]">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-sm">Persisted Clinical Records (SQLite)</h3>
                  </div>
                  <button
                    onClick={fetchRecords}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-slate-400">
                        <th className="pb-3 font-medium">Session ID</th>
                        <th className="pb-3 font-medium">Caller</th>
                        <th className="pb-3 font-medium">Triage Priority</th>
                        <th className="pb-3 font-medium">Chief Complaint</th>
                        <th className="pb-3 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {records.map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 font-mono text-slate-300">{r.session_id}</td>
                          <td className="py-3.5 text-slate-400">{r.caller_phone_masked}</td>
                          <td className="py-3.5">
                            {r.is_emergency ? (
                              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                                999 EMERGENCY
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                                ROUTINE GP
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-slate-300 max-w-[220px] truncate">
                            {r.symptom_summary || "Routine Consultation"}
                          </td>
                          <td className="py-3.5 text-slate-400 font-mono">{r.duration_seconds}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* WebPhone Caller Simulation View */
          <div className="max-w-2xl mx-auto py-4">
            <div className="glass-panel rounded-3xl p-8 relative overflow-hidden shadow-2xl">
              {/* Emergency Alert Banner */}
              {emergencyAlert && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-200 flex items-start gap-3.5 animate-pulse shadow-lg">
                  <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">NHS PRIORITY 1 RED FLAG ACTIVATED</h4>
                    <p className="text-xs text-rose-300 mt-1">
                      Matched protocol: <span className="font-mono font-bold text-white">{emergencyAlert}</span>. Bypassed generative reasoning; immediate 999 directive issued.
                    </p>
                  </div>
                </div>
              )}

              {/* Call Header */}
              <div className="text-center space-y-2 mb-6">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-[#005EB8]/30 to-[#7fc0ff]/30 border border-[#7fc0ff]/30 text-[#7fc0ff] mb-1 shadow-[0_0_30px_rgba(127,192,255,0.2)]">
                  <Phone className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-light tracking-tight">St. Mary&apos;s NHS Surgery</h2>
                <p className="text-xs font-mono text-slate-400">
                  {isCallActive ? `Active Call: ${callSessionId}` : "Line Available • Dial to test LUNA"}
                </p>
              </div>

              {/* Dynamic Waveform Visualizer */}
              {isCallActive && (
                <div className="flex items-center justify-center gap-1.5 h-12 mb-6 bg-black/40 rounded-2xl p-2 border border-white/[0.04]">
                  {[...Array(15)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-300 ${isSpeaking
                        ? "bg-gradient-to-t from-[#005EB8] to-[#7fc0ff] h-8 animate-wave"
                        : isListening
                          ? "bg-rose-500 h-6 animate-pulse"
                          : "bg-slate-800 h-2"
                        }`}
                      style={{ animationDelay: `${i * 0.07}s` }}
                    />
                  ))}
                </div>
              )}

              {/* Call Dialogue Box */}
              {isCallActive && (
                <div className="bg-black/40 rounded-2xl p-5 h-64 overflow-y-auto mb-5 space-y-3.5 border border-white/[0.06] text-xs">
                  {callTranscript.map((t, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl max-w-[85%] ${t.sender === "user"
                        ? "ml-auto bg-gradient-to-r from-[#005EB8] to-[#1d70b8] text-white shadow-md"
                        : "mr-auto glass-card text-slate-200"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <strong className="text-[10px] uppercase font-bold opacity-75">
                          {t.sender === "user" ? "You (Patient)" : "Luna (Receptionist)"}
                        </strong>
                        <span className="text-[10px] opacity-50 font-mono">{t.time}</span>
                      </div>
                      <p className="leading-relaxed text-[13px]">{t.text}</p>
                    </div>
                  ))}
                  {isListening && (
                    <div className="ml-auto bg-rose-950/40 border border-rose-500/30 p-3 rounded-2xl text-rose-300 text-xs flex items-center gap-2 animate-pulse">
                      <Mic className="w-3.5 h-3.5 text-rose-400" />
                      <span>Listening to your microphone... (speak now)</span>
                    </div>
                  )}
                  {isProcessing && (
                    <div className="mr-auto glass-card p-3 rounded-2xl text-slate-400 text-xs flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#7fc0ff] animate-spin" />
                      <span>Luna is analyzing symptoms...</span>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}

              {/* Quick Test Chips */}
              {isCallActive && (
                <div className="mb-4">
                  <p className="text-[11px] text-slate-400 mb-2 font-medium">Quick Clinical Test Scenarios:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => sendPatientMessage("I have crushing chest pain radiating to my left arm")}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition-all"
                    >
                      🚨 Emergency 999 (Chest Pain)
                    </button>
                    <button
                      onClick={() => sendPatientMessage("I have had a mild sore throat for 3 days")}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition-all"
                    >
                      🩺 Routine Sore Throat
                    </button>
                    <button
                      onClick={() => sendPatientMessage("I twisted my ankle playing football, what should I do?")}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-medium transition-all"
                    >
                      🩹 RAG Sprained Ankle
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons & Microphone Controls */}
              <div className="space-y-3">
                {!isCallActive ? (
                  <button
                    onClick={startCall}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-[0_4px_25px_rgba(5,150,105,0.3)]"
                  >
                    <Phone className="w-4 h-4" />
                    Place Simulated Call
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleListening}
                        title={isListening ? "Stop listening" : "Speak through microphone"}
                        className={`p-3.5 rounded-xl transition-all flex items-center justify-center border ${isListening
                          ? "bg-rose-600 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse"
                          : "bg-white/5 hover:bg-white/10 text-[#7fc0ff] border-white/10"
                          }`}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>

                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendPatientMessage()}
                        placeholder={isListening ? "Listening to your voice..." : "Type symptoms or click mic to speak..."}
                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-[#7fc0ff] transition-all placeholder:text-slate-600"
                      />

                      <button
                        onClick={() => sendPatientMessage()}
                        disabled={isProcessing}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#005EB8] to-[#1d70b8] hover:from-[#1d70b8] hover:to-[#7fc0ff] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-[0_4px_15px_rgba(0,94,184,0.3)] disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </button>
                    </div>

                    <button
                      onClick={endCall}
                      className="w-full py-3 rounded-xl bg-rose-600/80 hover:bg-rose-600 font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-rose-500/30 text-white"
                    >
                      <PhoneOff className="w-4 h-4" />
                      Terminate Call & Save Triage
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}