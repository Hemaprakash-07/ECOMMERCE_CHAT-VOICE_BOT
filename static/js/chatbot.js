/**
 * static/js/chatbot.js  —  NexPC AI Chat + Voice Bot
 *
 * Features:
 *  • Floating launcher icon (bottom-right)
 *  • Slide-up chat window with message history
 *  • Text input + Send button
 *  • Voice input via Web Speech API (SpeechRecognition)
 *  • Text-to-Speech output via SpeechSynthesis
 *  • Language toggle: English ↔ Tamil
 *  • Session memory (maintained server-side)
 *  • Quick-action chips for common queries
 *  • Markdown-style formatting of bot responses
 *  • Welcome popup on first visit
 *  • Accessible keyboard navigation
 */
"use strict";

(function () {

  // ── Configuration ──────────────────────────────────────────────
  const CONFIG = {
    endpoint:       "/chat",
    welcomeDelay:   4000,    // ms before popup appears
    ttsRate:        0.95,
    ttsPitch:       1.0,
    ttsVolume:      1.0,
    maxMsgHistory:  60,
  };

  const LANG = {
    en: {
      code:        "en-IN",
      greet:       "Hello! I'm your NexPC AI assistant. Ask me about product recommendations, PC compatibility, order tracking, or anything else! 🤖",
      placeholder: "Type in English or Tamil…",
      popup:       "👋 Hi! Ask me anything about PC components!",
      listening:   "Listening… speak now",
      voiceErr:    "Couldn't catch that. Try again or type your query.",
      noSupport:   "Voice input not supported in this browser.",
      send:        "Send",
    },
    ta: {
      code:        "ta-IN",
      greet:       "வணக்கம்! நான் உங்கள் NexPC AI உதவியாளர். தயாரிப்பு பரிந்துரைகள், PC இணக்கத்தன்மை, ஆர்டர் கண்காணிப்பு பற்றி கேளுங்கள்! 🤖",
      placeholder: "தமிழில் அல்லது ஆங்கிலத்தில் தட்டச்சு செய்யுங்கள்…",
      popup:       "👋 வணக்கம்! PC கூறுகள் பற்றி எதையும் கேளுங்கள்!",
      listening:   "கேட்கிறேன்… இப்போது பேசுங்கள்",
      voiceErr:    "கேட்கவில்லை. மீண்டும் முயற்சிக்கவும்.",
      noSupport:   "இந்த உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை.",
      send:        "அனுப்பு",
    }
  };

  const QUICK_CHIPS = {
    en: [
      "Best GPU for gaming under ₹30,000",
      "AMD vs Intel for 2024",
      "Recommend 16GB DDR5 RAM",
      "Track my order",
      "Return policy",
    ],
    ta: [
      "₹30,000க்குள் சிறந்த GPU",
      "AMD vs Intel ஒப்பீடு",
      "16GB DDR5 RAM பரிந்துரை",
      "என் ஆர்டர் நிலை",
      "திரும்பப் பெறும் கொள்கை",
    ],
  };

  // ── Language state ─────────────────────────────────────────────
  let currentLang = "en";
  let isTTSEnabled = true;
  let isListening  = false;
  let recognition  = null;
  let currentUtterance = null;

  // ── DOM references (populated in init) ────────────────────────
  let dom = {};

  // ── Build UI ───────────────────────────────────────────────────
  function buildUI() {
    // Inject CSS
    const style = document.createElement("style");
    style.textContent = getCSS();
    document.head.appendChild(style);

    // Welcome popup
    const popup = document.createElement("div");
    popup.id        = "nexpc-popup";
    popup.className = "nc-popup";
    popup.innerHTML = `
      <button class="nc-popup-close" id="nexpc-popup-close">×</button>
      <span id="nexpc-popup-msg">${LANG[currentLang].popup}</span>`;
    document.body.appendChild(popup);

    // Launcher button
    const launcher = document.createElement("button");
    launcher.id        = "nexpc-launcher";
    launcher.className = "nc-launcher";
    launcher.setAttribute("aria-label", "Open AI chat assistant");
    launcher.setAttribute("title", "Chat with NexPC AI");
    launcher.innerHTML = `
      <span class="nc-launcher-icon">🤖</span>
      <span class="nc-launcher-pulse"></span>`;
    document.body.appendChild(launcher);

    // Chat widget
    const widget = document.createElement("div");
    widget.id        = "nexpc-chat";
    widget.className = "nc-widget";
    widget.setAttribute("aria-hidden", "true");
    widget.setAttribute("role", "dialog");
    widget.setAttribute("aria-label", "NexPC AI Support Chat");
    widget.innerHTML = `
      <!-- Header -->
      <div class="nc-header">
        <div class="nc-header-left">
          <div class="nc-avatar">🤖</div>
          <div>
            <div class="nc-title">NexPC AI</div>
            <div class="nc-status" id="nexpc-status">
              <span class="nc-dot"></span> Online
            </div>
          </div>
        </div>
        <div class="nc-header-actions">
          <!-- Language toggle -->
          <button class="nc-icon-btn" id="nexpc-lang-btn"
                  title="Switch language / மொழி மாற்று">
            🌐 EN
          </button>
          <!-- TTS toggle -->
          <button class="nc-icon-btn" id="nexpc-tts-btn"
                  title="Toggle text-to-speech">🔊</button>
          <!-- Clear chat -->
          <button class="nc-icon-btn" id="nexpc-clear-btn"
                  title="Clear conversation">🗑️</button>
          <!-- Close -->
          <button class="nc-icon-btn" id="nexpc-close"
                  aria-label="Close chat">✕</button>
        </div>
      </div>

      <!-- Messages -->
      <div class="nc-messages" id="nexpc-messages">
        <div class="nc-msg nc-bot" id="nc-initial-msg">
          <div class="nc-bubble" id="nc-greet-bubble"></div>
        </div>
        <!-- Quick chips -->
        <div class="nc-chips" id="nexpc-chips"></div>
        <!-- Typing indicator -->
        <div class="nc-typing" id="nexpc-typing" style="display:none">
          <div class="nc-bubble">
            <span class="nc-dot-anim"></span>
            <span class="nc-dot-anim"></span>
            <span class="nc-dot-anim"></span>
          </div>
        </div>
      </div>

      <!-- Voice status banner -->
      <div class="nc-voice-banner" id="nexpc-voice-banner" style="display:none">
        <span class="nc-mic-pulse">🎤</span>
        <span id="nexpc-voice-label">Listening…</span>
        <button class="nc-voice-cancel" id="nexpc-voice-cancel">✕</button>
      </div>

      <!-- Input area -->
      <div class="nc-input-area">
        <textarea class="nc-textarea" id="nexpc-input"
                  placeholder="${LANG[currentLang].placeholder}"
                  rows="1" aria-label="Chat message"></textarea>
        <button class="nc-icon-btn nc-mic-btn" id="nexpc-mic"
                title="Voice input" aria-label="Start voice input">🎤</button>
        <button class="nc-send-btn" id="nexpc-send"
                aria-label="Send message">
          <span>${LANG[currentLang].send}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(widget);

    // Resolve DOM refs
    dom = {
      popup:       popup,
      popupClose:  document.getElementById("nexpc-popup-close"),
      popupMsg:    document.getElementById("nexpc-popup-msg"),
      launcher:    launcher,
      widget:      widget,
      messages:    document.getElementById("nexpc-messages"),
      chips:       document.getElementById("nexpc-chips"),
      typing:      document.getElementById("nexpc-typing"),
      input:       document.getElementById("nexpc-input"),
      sendBtn:     document.getElementById("nexpc-send"),
      micBtn:      document.getElementById("nexpc-mic"),
      closeBtn:    document.getElementById("nexpc-close"),
      langBtn:     document.getElementById("nexpc-lang-btn"),
      ttsBtn:      document.getElementById("nexpc-tts-btn"),
      clearBtn:    document.getElementById("nexpc-clear-btn"),
      greetBubble: document.getElementById("nc-greet-bubble"),
      voiceBanner: document.getElementById("nexpc-voice-banner"),
      voiceLabel:  document.getElementById("nexpc-voice-label"),
      voiceCancel: document.getElementById("nexpc-voice-cancel"),
      statusEl:    document.getElementById("nexpc-status"),
    };

    // Set initial greeting
    dom.greetBubble.innerHTML = formatBotMsg(LANG[currentLang].greet);
    renderChips();
  }

  // ── Event wiring ───────────────────────────────────────────────
  function wireEvents() {
    // Launcher
    dom.launcher.addEventListener("click", toggleChat);

    // Popup close
    dom.popupClose.addEventListener("click", (e) => {
      e.stopPropagation();
      hidePopup();
    });
    dom.popup.addEventListener("click", toggleChat);

    // Close btn
    dom.closeBtn.addEventListener("click", closeChat);

    // Send
    dom.sendBtn.addEventListener("click", handleSend);
    dom.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    dom.input.addEventListener("input", autoResize);

    // Mic
    dom.micBtn.addEventListener("click", toggleVoice);
    dom.voiceCancel.addEventListener("click", stopListening);

    // Language toggle
    dom.langBtn.addEventListener("click", toggleLanguage);

    // TTS toggle
    dom.ttsBtn.addEventListener("click", toggleTTS);

    // Clear chat
    dom.clearBtn.addEventListener("click", clearChat);

    // Chips (delegated)
    dom.chips.addEventListener("click", (e) => {
      const chip = e.target.closest(".nc-chip");
      if (chip) sendMessage(chip.textContent.trim());
    });

    // Keyboard close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dom.widget.classList.contains("open")) closeChat();
    });

    // Welcome popup timer
    setTimeout(showPopup, CONFIG.welcomeDelay);

    // Hover popup
    dom.launcher.addEventListener("mouseenter", showPopup);
    dom.launcher.addEventListener("mouseleave", () => {
      if (!dom.widget.classList.contains("open")) {
        setTimeout(hidePopup, 1500);
      }
    });
  }

  // ── Chat open/close ────────────────────────────────────────────
  function toggleChat() {
    if (dom.widget.classList.contains("open")) closeChat();
    else openChat();
  }

  function openChat() {
    dom.widget.classList.add("open");
    dom.widget.setAttribute("aria-hidden", "false");
    dom.launcher.classList.add("active");
    hidePopup();
    setTimeout(() => dom.input.focus(), 300);
    scrollToBottom();
  }

  function closeChat() {
    dom.widget.classList.remove("open");
    dom.widget.setAttribute("aria-hidden", "true");
    dom.launcher.classList.remove("active");
    stopListening();
    stopTTS();
  }

  function showPopup() {
    dom.popup.classList.add("show");
    dom.popupMsg.textContent = LANG[currentLang].popup;
  }

  function hidePopup() {
    dom.popup.classList.remove("show");
  }

  // ── Language toggle ────────────────────────────────────────────
  function toggleLanguage() {
    currentLang = currentLang === "en" ? "ta" : "en";
    const L = LANG[currentLang];
    dom.langBtn.textContent  = `🌐 ${currentLang.toUpperCase()}`;
    dom.input.placeholder    = L.placeholder;
    dom.sendBtn.querySelector("span").textContent = L.send;
    dom.popupMsg.textContent = L.popup;
    dom.greetBubble.innerHTML= formatBotMsg(L.greet);
    renderChips();
    stopTTS();
  }

  // ── TTS toggle ─────────────────────────────────────────────────
  function toggleTTS() {
    isTTSEnabled = !isTTSEnabled;
    dom.ttsBtn.textContent = isTTSEnabled ? "🔊" : "🔇";
    dom.ttsBtn.title = isTTSEnabled ? "Mute TTS" : "Unmute TTS";
    if (!isTTSEnabled) stopTTS();
  }

  function speak(text) {
    if (!isTTSEnabled || !window.speechSynthesis) return;
    stopTTS();
    const plain = text.replace(/[*_`#~>\-]/g, "").replace(/\s+/g, " ").trim();
    currentUtterance = new SpeechSynthesisUtterance(plain);
    
    // Auto-detect language
    const isTamil = /[\u0B80-\u0BFF]/.test(plain);
    const targetLang = isTamil ? "ta-IN" : "en-US";
    currentUtterance.lang = targetLang;

    // Try to find a native voice
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const matchedVoice = voices.find(v => v.lang.includes(targetLang) || v.lang.includes(isTamil ? "ta" : "en"));
      if (matchedVoice) currentUtterance.voice = matchedVoice;
    } else {
      // Chrome sometimes takes a moment to load voices
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(v => v.lang.includes(targetLang) || v.lang.includes(isTamil ? "ta" : "en"));
        if (matchedVoice) currentUtterance.voice = matchedVoice;
      };
    }

    currentUtterance.rate   = CONFIG.ttsRate;
    currentUtterance.pitch  = CONFIG.ttsPitch;
    currentUtterance.volume = CONFIG.ttsVolume;
    window.speechSynthesis.speak(currentUtterance);
  }

  function stopTTS() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  // ── Voice input ────────────────────────────────────────────────
  function initRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript) {
        dom.input.value = transcript;
        autoResize();
        sendMessage(transcript);
      }
      stopListening();
    };

    rec.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      stopListening();
      if (e.error !== "no-speech") {
        appendMessage("bot", LANG[currentLang].voiceErr);
      }
    };

    rec.onend = () => {
      if (isListening) stopListening();
    };

    return rec;
  }

  function toggleVoice() {
    if (isListening) { stopListening(); return; }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      appendMessage("bot", LANG[currentLang].noSupport);
      return;
    }
    startListening();
  }

  function startListening() {
    if (!recognition) recognition = initRecognition();
    if (!recognition) { appendMessage("bot", LANG[currentLang].noSupport); return; }

    stopTTS();
    recognition.lang = LANG[currentLang].code;
    recognition.start();
    isListening = true;

    dom.micBtn.classList.add("active");
    dom.micBtn.textContent = "⏹";
    dom.voiceBanner.style.display = "flex";
    dom.voiceLabel.textContent    = LANG[currentLang].listening;

    // Auto-timeout at 10s
    setTimeout(() => {
      if (isListening) stopListening();
    }, 10000);
  }

  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch { /* ok */ } }
    isListening = false;
    dom.micBtn.classList.remove("active");
    dom.micBtn.textContent = "🎤";
    dom.voiceBanner.style.display = "none";
  }

  // ── Send message ───────────────────────────────────────────────
  function handleSend() {
    const text = dom.input.value.trim();
    if (!text) return;
    dom.input.value = "";
    autoResize();
    sendMessage(text);
  }

  async function sendMessage(text) {
    stopTTS();
    appendMessage("user", text);
    showTyping();
    dom.sendBtn.disabled = true;
    dom.chips.style.display = "none";

    try {
      const res  = await fetch(CONFIG.endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ input: text, lang: currentLang }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data   = await res.json();
      const answer = data.response || "I couldn't find an answer to that.";

      hideTyping();
      appendMessage("bot", answer);
      speak(answer);

    } catch (err) {
      console.error("[NexPC Chat]", err);
      hideTyping();
      const fallback = currentLang === "ta"
        ? "மன்னிக்கவும், ஒரு பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்."
        : "Sorry, something went wrong. Please try again shortly.";
      appendMessage("bot", fallback);
    }

    dom.sendBtn.disabled = false;
    dom.input.focus();
  }

  // ── Append message ─────────────────────────────────────────────
  function appendMessage(role, text) {
    // Remove chips from previous position
    const typing = dom.typing;

    const msg = document.createElement("div");
    msg.className = `nc-msg nc-${role}`;

    const bubble = document.createElement("div");
    bubble.className = "nc-bubble";
    bubble.innerHTML = role === "bot" ? formatBotMsg(text) : escapeHtml(text);
    msg.appendChild(bubble);

    // Timestamp
    const ts = document.createElement("div");
    ts.className   = "nc-ts";
    ts.textContent = new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
    msg.appendChild(ts);

    dom.messages.insertBefore(msg, typing);
    pruneMessages();
    scrollToBottom();
  }

  function pruneMessages() {
    const msgs = dom.messages.querySelectorAll(".nc-msg");
    if (msgs.length > CONFIG.maxMsgHistory) {
      msgs[0].remove();
    }
  }

  // ── Format bot message (light markdown) ───────────────────────
  function formatBotMsg(text) {
    return escapeHtml(text)
      // Code blocks
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // Bullet lines starting with ─ or -
      .replace(/^[─\-]{3,}$/gm, "<hr>")
      .replace(/^[\s]*[\-•]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => `<ul>${m}</ul>`)
      // New lines
      .replace(/\n/g, "<br>")
      // Order Invoice tables: preserve spacing
      .replace(/Order Invoice/g, "<strong>📋 Order Invoice</strong>");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Typing indicator ───────────────────────────────────────────
  function showTyping() {
    dom.typing.style.display = "flex";
    scrollToBottom();
  }
  function hideTyping() {
    dom.typing.style.display = "none";
  }

  // ── Quick chips ────────────────────────────────────────────────
  function renderChips() {
    const chips = QUICK_CHIPS[currentLang] || QUICK_CHIPS.en;
    dom.chips.innerHTML = chips.map(c =>
      `<button class="nc-chip" type="button">${c}</button>`
    ).join("");
    dom.chips.style.display = "flex";
  }

  // ── Clear conversation ─────────────────────────────────────────
  function clearChat() {
    const allMsgs = dom.messages.querySelectorAll(".nc-msg:not(#nc-initial-msg)");
    allMsgs.forEach(m => m.remove());
    dom.chips.style.display = "flex";
    stopTTS();
    renderChips();
  }

  // ── Helpers ────────────────────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      dom.messages.scrollTop = dom.messages.scrollHeight;
    });
  }

  function autoResize() {
    const el = dom.input;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ── CSS (injected dynamically) ─────────────────────────────────
  function getCSS() {
    return `
/* ── NexPC Chat Widget ─────────────────────────────────
   Scoped under .nc-* to avoid collisions
────────────────────────────────────────────────────── */
#nexpc-launcher {
  position:fixed; bottom:28px; right:28px; z-index:9000;
  width:60px; height:60px; border-radius:50%; border:none; cursor:pointer;
  background:linear-gradient(135deg,#7c3aed,#a78bfa);
  box-shadow:0 8px 28px rgba(124,58,237,0.5);
  display:flex; align-items:center; justify-content:center;
  transition:transform .25s cubic-bezier(0.4,0,0.2,1),
             box-shadow .25s cubic-bezier(0.4,0,0.2,1);
  font-size:26px; overflow:visible;
}
#nexpc-launcher:hover { transform:scale(1.1); box-shadow:0 12px 36px rgba(124,58,237,0.65); }
#nexpc-launcher.active { transform:rotate(10deg) scale(1.05); }
.nc-launcher-pulse {
  position:absolute; top:-4px; right:-4px;
  width:16px; height:16px; border-radius:50%;
  background:#10b981; border:2.5px solid #09090f;
  animation:nc-pulse 2s ease infinite;
}
@keyframes nc-pulse {
  0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,0.6); }
  60%     { box-shadow:0 0 0 8px rgba(16,185,129,0); }
}

/* Popup */
.nc-popup {
  position:fixed; bottom:102px; right:28px; z-index:8999;
  background:#13141d; border:1px solid rgba(255,255,255,0.08);
  border-radius:14px; padding:14px 38px 14px 16px;
  max-width:240px; font-size:13.5px; color:#f1f5f9;
  box-shadow:0 8px 32px rgba(0,0,0,0.5);
  opacity:0; pointer-events:none; transform:translateY(8px);
  transition:opacity .3s ease, transform .3s ease;
  font-family:'Inter',sans-serif; line-height:1.4;
}
.nc-popup.show { opacity:1; pointer-events:all; transform:translateY(0); cursor:pointer; }
.nc-popup-close {
  position:absolute; top:8px; right:8px; background:none; border:none;
  color:#94a3b8; cursor:pointer; font-size:16px; line-height:1;
  transition:color .2s;
}
.nc-popup-close:hover { color:#f1f5f9; }

/* Widget */
.nc-widget {
  position:fixed; bottom:100px; right:28px; z-index:8998;
  width:400px; max-width:calc(100vw - 32px);
  height:580px; max-height:calc(100vh - 140px);
  background:#13141d; border:1px solid rgba(255,255,255,0.08);
  border-radius:20px; box-shadow:0 24px 64px rgba(0,0,0,0.7),
    0 0 0 1px rgba(255,255,255,0.04) inset;
  display:flex; flex-direction:column; overflow:hidden;
  opacity:0; pointer-events:none;
  transform:translateY(20px) scale(0.97);
  transform-origin:bottom right;
  transition:opacity .3s cubic-bezier(0.4,0,0.2,1),
             transform .3s cubic-bezier(0.4,0,0.2,1);
  font-family:'Inter',system-ui,sans-serif;
}
.nc-widget.open {
  opacity:1; pointer-events:all;
  transform:translateY(0) scale(1);
}

/* Header */
.nc-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px;
  background:linear-gradient(135deg,#1a1d2e,#141624);
  border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0;
}
.nc-header-left { display:flex; align-items:center; gap:12px; }
.nc-avatar {
  width:38px; height:38px; border-radius:50%;
  background:linear-gradient(135deg,#7c3aed,#a78bfa);
  display:flex; align-items:center; justify-content:center;
  font-size:18px; flex-shrink:0;
  box-shadow:0 4px 14px rgba(124,58,237,0.4);
}
.nc-title { font-size:15px; font-weight:700; color:#f1f5f9; }
.nc-status { font-size:11px; color:#94a3b8; display:flex; align-items:center; gap:5px; margin-top:1px; }
.nc-dot {
  width:7px; height:7px; border-radius:50%; background:#10b981;
  animation:nc-pulse 2.5s ease infinite;
}
.nc-header-actions { display:flex; align-items:center; gap:4px; }
.nc-icon-btn {
  width:30px; height:30px; border:none; background:rgba(255,255,255,0.06);
  border-radius:8px; color:#94a3b8; cursor:pointer; font-size:13px;
  display:flex; align-items:center; justify-content:center;
  transition:background .2s, color .2s;
}
.nc-icon-btn:hover { background:rgba(255,255,255,0.12); color:#f1f5f9; }

/* Messages */
.nc-messages {
  flex:1; overflow-y:auto; padding:14px 12px;
  display:flex; flex-direction:column; gap:6px;
  scroll-behavior:smooth;
  background:linear-gradient(180deg,#0e1018 0%,#0c0e16 100%);
}
.nc-messages::-webkit-scrollbar { width:4px; }
.nc-messages::-webkit-scrollbar-thumb { background:#3f3f5a; border-radius:99px; }

/* Messages */
.nc-msg { display:flex; flex-direction:column; max-width:88%; gap:4px; }
.nc-bot { align-self:flex-start; }
.nc-user { align-self:flex-end; align-items:flex-end; }
.nc-bubble {
  padding:10px 14px; border-radius:14px; font-size:13.5px;
  line-height:1.55; word-break:break-word;
}
.nc-bot  .nc-bubble {
  background:#1e2133; border:1px solid rgba(255,255,255,0.07);
  color:#e2e8f0; border-bottom-left-radius:4px;
}
.nc-user .nc-bubble {
  background:linear-gradient(135deg,#7c3aed,#6d28d9);
  color:#fff; border-bottom-right-radius:4px;
}
.nc-bubble pre { background:rgba(0,0,0,0.4); padding:10px; border-radius:8px;
  overflow-x:auto; font-size:12px; margin:6px 0; }
.nc-bubble code { font-family:'JetBrains Mono',monospace; font-size:12px;
  background:rgba(0,0,0,0.3); padding:1px 5px; border-radius:4px; }
.nc-bubble ul { padding-left:16px; margin:6px 0; }
.nc-bubble li { margin:3px 0; }
.nc-bubble hr { border:none; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0; }
.nc-bubble strong { color:#f1f5f9; }
.nc-ts { font-size:10px; color:#475569; padding:0 4px; }

/* Chips */
.nc-chips {
  display:flex; flex-wrap:wrap; gap:7px; padding:4px 0 8px;
}
.nc-chip {
  padding:6px 12px; border:1.5px solid rgba(124,58,237,0.3);
  border-radius:99px; background:rgba(124,58,237,0.08);
  color:#a78bfa; font-size:12px; font-weight:500; cursor:pointer;
  transition:background .2s, border-color .2s, color .2s;
  white-space:nowrap; font-family:'Inter',sans-serif;
}
.nc-chip:hover { background:rgba(124,58,237,0.2); border-color:#7c3aed; color:#f1f5f9; }

/* Typing indicator */
.nc-typing { display:flex; align-self:flex-start; }
.nc-typing .nc-bubble {
  display:flex; align-items:center; gap:5px; padding:12px 14px;
}
.nc-dot-anim {
  width:7px; height:7px; background:#a78bfa; border-radius:50%;
  animation:nc-bounce .9s ease infinite;
}
.nc-dot-anim:nth-child(2) { animation-delay:.15s; }
.nc-dot-anim:nth-child(3) { animation-delay:.3s; }
@keyframes nc-bounce {
  0%,100% { transform:translateY(0); }
  50%      { transform:translateY(-5px); }
}

/* Voice banner */
.nc-voice-banner {
  background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(167,139,250,0.1));
  border-top:1px solid rgba(124,58,237,0.3);
  padding:10px 16px; display:flex; align-items:center; gap:10px;
  font-size:13px; color:#a78bfa; flex-shrink:0;
}
.nc-mic-pulse { font-size:18px; animation:nc-mic 1s ease infinite; }
@keyframes nc-mic {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:0.5; transform:scale(1.2); }
}
.nc-voice-cancel {
  margin-left:auto; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3);
  border-radius:99px; color:#ef4444; width:24px; height:24px; font-size:12px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:background .2s;
}
.nc-voice-cancel:hover { background:rgba(239,68,68,0.3); }

/* Input area */
.nc-input-area {
  display:flex; align-items:flex-end; gap:8px;
  padding:12px 14px; border-top:1px solid rgba(255,255,255,0.07);
  background:#12141e; flex-shrink:0;
}
.nc-textarea {
  flex:1; background:rgba(255,255,255,0.05);
  border:1.5px solid rgba(255,255,255,0.08);
  border-radius:12px; padding:10px 13px;
  font-family:'Inter',sans-serif; font-size:13.5px; color:#f1f5f9;
  outline:none; resize:none; line-height:1.5; max-height:120px;
  transition:border-color .2s, box-shadow .2s;
}
.nc-textarea::placeholder { color:#475569; }
.nc-textarea:focus {
  border-color:#7c3aed;
  box-shadow:0 0 0 3px rgba(124,58,237,0.15);
}
.nc-mic-btn {
  width:38px; height:38px; border-radius:10px; flex-shrink:0;
  font-size:17px; background:rgba(255,255,255,0.05);
  border:1.5px solid rgba(255,255,255,0.08);
  transition:all .2s;
}
.nc-mic-btn.active {
  background:rgba(239,68,68,0.2); border-color:#ef4444; color:#ef4444;
}
.nc-send-btn {
  height:38px; padding:0 14px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,#7c3aed,#a78bfa);
  border:none; color:#fff; font-size:13px; font-weight:600;
  display:flex; align-items:center; gap:6px;
  box-shadow:0 4px 16px rgba(124,58,237,0.35);
  transition:opacity .2s, transform .2s;
}
.nc-send-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
.nc-send-btn:disabled { opacity:.45; cursor:not-allowed; }

/* Mobile */
@media (max-width:480px) {
  .nc-widget { width:calc(100vw - 16px); right:8px; bottom:88px; height:70vh; max-height:580px; }
  #nexpc-launcher { right:16px; bottom:16px; }
  .nc-popup { right:16px; bottom:90px; }
}
    `;
  }

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    // Skip if there are existing chatbot elements from old code
    if (document.getElementById("nexpc-launcher")) return;

    buildUI();
    wireEvents();

    // Pre-init speech recognition
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      recognition = initRecognition();
    }

    // Hide existing old chatbot elements if present (backwards-compat)
    const oldLogo   = document.querySelector(".chatbot-logo");
    const oldWidget = document.querySelector(".chat-widget");
    const oldPopup  = document.querySelector(".welcome-popup");
    if (oldLogo)   oldLogo.style.display   = "none";
    if (oldWidget) oldWidget.style.display = "none";
    if (oldPopup)  oldPopup.style.display  = "none";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(); // IIFE — fully scoped