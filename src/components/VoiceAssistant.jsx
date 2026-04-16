import React, { useState, useRef, useCallback, useEffect } from 'react';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

function Waveform({ stream }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!stream) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, w, h);
      const bars = 32;
      const barWidth = w / bars - 2;
      const centerY = h / 2;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(i * bufferLength / bars);
        const val = dataArray[idx] / 255;
        const barHeight = Math.max(2, val * centerY * 0.9);
        ctx.fillStyle = `hsla(${220 + i * 2}, 80%, 60%, ${0.6 + val * 0.4})`;
        const x = i * (barWidth + 2) + 1;
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight, barWidth, barHeight * 2, 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); source.disconnect(); audioCtx.close(); };
  }, [stream]);

  return <canvas ref={canvasRef} className="voice-waveform" width={300} height={80} />;
}

function StreamingText({ text, isPlaying }) {
  const [visibleWords, setVisibleWords] = useState(0);
  const words = text ? text.split(' ') : [];

  useEffect(() => {
    if (!text) return;
    if (!isPlaying) { setVisibleWords(words.length); return; }
    setVisibleWords(0);
    const msPerWord = 380;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisibleWords(i);
      if (i >= words.length) clearInterval(timer);
    }, msPerWord);
    return () => clearInterval(timer);
  }, [text, isPlaying, words.length]);

  if (!text) return null;
  return (
    <span>
      {words.map((word, i) => (
        <span key={i} style={{ opacity: i < visibleWords ? 1 : 0, transition: 'opacity 0.15s' }}>
          {word}{' '}
        </span>
      ))}
    </span>
  );
}

export default function VoiceAssistant() {
  const [state, setState] = useState('idle');
  // idle, listening, transcribing, thinking, loading-voice, speaking
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [activeStream, setActiveStream] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const audioElRef = useRef(null);
  const autoListenRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setIsAudioPlaying(false);
  }, []);

  const setupSilenceDetection = useCallback((stream, recorder) => {
    const sCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sSrc = sCtx.createMediaStreamSource(stream);
    const sAn = sCtx.createAnalyser();
    sAn.fftSize = 512;
    sSrc.connect(sAn);
    const sData = new Uint8Array(sAn.frequencyBinCount);
    let silStart = null, hasSp = false;
    const rStart = Date.now();
    const chk = () => {
      if (recorder.state !== 'recording') { sCtx.close(); return; }
      if (Date.now() - rStart < 1500) { requestAnimationFrame(chk); return; }
      sAn.getByteFrequencyData(sData);
      const avg = sData.reduce((a, b) => a + b, 0) / sData.length;
      if (avg > 10) { hasSp = true; silStart = null; }
      else if (hasSp) {
        if (!silStart) silStart = Date.now();
        if (Date.now() - silStart > 2000) { sCtx.close(); recorder.stop(); return; }
      }
      requestAnimationFrame(chk);
    };
    chk();
    setTimeout(() => { if (recorder.state === 'recording') { sCtx.close(); recorder.stop(); } }, 20000);
  }, []);

  const startRecording = useCallback(async (isFollowUp) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        setActiveStream(null);
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size > 0) transcribeAndAsk(blob);
        else setState('idle');
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setActiveStream(stream);
      setState('listening');
      if (!isFollowUp) { setTranscript(''); setReply(''); setShowReply(false); }

      setupSilenceDetection(stream, recorder);
    } catch {
      setReply('Microphone access denied.');
      setShowReply(true);
      setState('idle');
    }
  }, [setupSilenceDetection]);

  const browserSpeak = useCallback((text) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.onend = () => {
        setIsAudioPlaying(false);
        if (autoListenRef.current) {
          setState('listening');
          setTimeout(() => {
            if (autoListenRef.current) startRecording(true);
          }, 800);
        } else {
          setState('idle');
        }
      };
      setShowReply(true);
      setIsAudioPlaying(true);
      window.speechSynthesis.speak(utter);
    } else {
      setState('idle');
    }
  }, [startRecording]);

  const playTTS = useCallback(async (text) => {
    try {
      const audio = audioElRef.current || new Audio();
      audioRef.current = audio;
      const resp = await fetch(`${BASE}/dashboard/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!resp.ok) throw new Error('TTS failed');
      const arrayBuffer = await resp.arrayBuffer();
      if (arrayBuffer.byteLength < 100) throw new Error('Empty');
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsAudioPlaying(false);
        if (autoListenRef.current) {
          // Brief pause so mic doesn't pick up speaker echo
          setState('listening');
          setTimeout(() => {
            if (autoListenRef.current) startRecording(true);
          }, 800);
        } else {
          setState('idle');
        }
      };
      audio.onerror = () => { URL.revokeObjectURL(url); browserSpeak(text); };
      audio.src = url;
      // Show reply text and start playing simultaneously
      setState('speaking');
      setShowReply(true);
      setIsAudioPlaying(true);
      await audio.play();
    } catch {
      browserSpeak(text);
    }
  }, [browserSpeak, startRecording]);

  const askAgent = useCallback(async (question) => {
    setState('thinking');
    setTranscript(question);
    setReply('');
    setShowReply(false);
    try {
      const resp = await fetch(`${BASE}/dashboard/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await resp.json();
      const result = Array.isArray(data) ? data[0] : data;
      const answer = result?.reply || 'Sorry, I could not get an answer.';
      setReply(answer);

      // Check if the user was saying goodbye
      const q = question.toLowerCase();
      const goodbyes = ['thank you', 'thanks', 'goodbye', 'bye', 'good night', 'have a nice', 'that\'s all', 'that is all', 'i\'m done', 'im done', 'nevermind', 'never mind', 'stop', 'end'];
      if (goodbyes.some(g => q.includes(g))) {
        autoListenRef.current = false;
      }

      setState('loading-voice');
      playTTS(answer);
    } catch {
      const err = 'Sorry, I could not connect to the dashboard agent.';
      setReply(err);
      setState('loading-voice');
      playTTS(err);
    }
  }, [playTTS]);

  const transcribeAndAsk = useCallback(async (audioBlob) => {
    setState('transcribing');
    setShowReply(false);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('prompt', 'How are the servers doing? Are there any security issues? What is the disk usage? Which server has the most network traffic?');
      const resp = await fetch(`${BASE}/dashboard/transcribe`, { method: 'POST', body: formData });
      const data = await resp.json();
      const result = Array.isArray(data) ? data[0] : data;
      const text = result?.text?.trim();
      if (!text) { setReply('Could not hear you. Please try again.'); setShowReply(true); setState('idle'); return; }
      await askAgent(text);
    } catch {
      setReply('Sorry, transcription failed.');
      setShowReply(true);
      setState('idle');
    }
  }, [askAgent]);

  // Wire up transcribeAndAsk into startRecording (circular dep workaround)
  const transcribeAndAskRef = useRef(transcribeAndAsk);
  transcribeAndAskRef.current = transcribeAndAsk;

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleMicClick = useCallback(async () => {
    if (state === 'speaking') { stopAudio(); autoListenRef.current = false; setState('idle'); return; }
    if (state === 'listening') { stopRecording(); return; }

    // Pre-warm audio element during user gesture
    const audioEl = new Audio();
    audioEl.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwBHAAAAAAD/+1DEAAAFYAl/tAAAIi4mL/80IAAAANIAAAAASOH/+XBwcHBwcP/EIf/h////+XBwcP/L//8vDg4P/ygAAAA0gAAAAABQ';
    audioEl.play().catch(() => {});
    audioEl.pause();
    audioEl.src = '';
    audioElRef.current = audioEl;

    autoListenRef.current = true;
    startRecording(false);
  }, [state, stopAudio, stopRecording, startRecording]);

  const dismiss = () => {
    autoListenRef.current = false;
    stopAudio();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setState('idle');
    setTranscript('');
    setReply('');
    setShowReply(false);
    setIsAudioPlaying(false);
    setActiveStream(null);
  };

  const stateColors = {
    idle: 'var(--text-secondary)', listening: 'var(--red)',
    transcribing: 'var(--accent)', thinking: 'var(--accent)',
    speaking: 'var(--green)'
  };

  const isActive = state !== 'idle';

  return (
    <div className="voice-assistant">
      <button
        className={`voice-btn voice-${state}`}
        onClick={handleMicClick}
        title="Ask the dashboard"
      >
        {state === 'listening' ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        ) : (state === 'transcribing' || state === 'thinking' || state === 'loading-voice') ? (
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
        ) : state === 'speaking' ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {isActive && (
        <div className="voice-overlay" onClick={dismiss}>
          <div className="voice-panel" onClick={e => e.stopPropagation()}>
            {state === 'listening' && activeStream && <Waveform stream={activeStream} />}

            {(state === 'thinking' || state === 'transcribing' || state === 'loading-voice') && (
              <div className="voice-thinking-dots">
                <span /><span /><span />
              </div>
            )}

            {state === 'listening' && (
              <div className="voice-status" style={{ color: stateColors.listening }}>Listening...</div>
            )}
            {state === 'transcribing' && (
              <div className="voice-status" style={{ color: stateColors.transcribing }}>Transcribing...</div>
            )}
            {state === 'thinking' && (
              <div className="voice-status" style={{ color: stateColors.thinking }}>Thinking...</div>
            )}
            {state === 'loading-voice' && (
              <div className="voice-status" style={{ color: stateColors.thinking }}>Preparing response...</div>
            )}

            {transcript && (
              <div className="voice-transcript">
                <span className="voice-label">You:</span> {transcript}
              </div>
            )}

            {reply && showReply && (
              <div className="voice-reply">
                <span className="voice-label">Dashboard:</span>{' '}
                <StreamingText text={reply} isPlaying={isAudioPlaying} />
              </div>
            )}

            <button className="btn btn-outline" style={{ marginTop: 16, fontSize: '0.75rem' }} onClick={dismiss}>
              End conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
