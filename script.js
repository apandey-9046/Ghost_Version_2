// DOM Elements
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");
const typingIndicator = document.getElementById("typingIndicator");
const userTypingIndicator = document.getElementById("userTypingIndicator");
const installButton = document.getElementById("installButton");

// State
let isListening = false;
let isVoiceResponseEnabled = false;
let recognition = null;
let currentUtterance = null;
let isChatUnlocked = false;
let deferredPrompt = null; // For PWA install
let silenceTimer = null; // For auto-send after silence

// Passwords
const START_CHAT_PASSWORD = "Admin123";
const CLEAR_CHAT_PASSWORD = "Arpit@232422";

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
} else {
    micButton.disabled = true;
    micButton.title = "Not supported";
    micButton.style.opacity = 0.5;
}

// On Load
window.addEventListener("DOMContentLoaded", () => {
    loadChatHistory();
    userInput.focus();

    // ✅ Force voice on first message — so it speaks from start
    if (chatArea.children.length === 0) {
        addMessage("🔒 Please enter your password to proceed, Sir", "ghost", true);
    }

    // Register Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(reg => console.log("SW registered:", reg.scope))
            .catch(err => console.error("SW registration failed:", err));
    }
});

// User Typing Indicator
userInput.addEventListener("input", () => {
    if (userInput.value.trim().length > 0) {
        userTypingIndicator.style.display = "block";
    } else {
        userTypingIndicator.style.display = "none";
    }
});

userInput.addEventListener("blur", () => {
    userTypingIndicator.style.display = "none";
});

// Send Message
function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Password check for unlock
    if (!isChatUnlocked) {
        if (message === START_CHAT_PASSWORD) {
            isChatUnlocked = true;
            addMessage("✅ Access granted! Welcome back, Sir.", "ghost", isVoiceResponseEnabled);
            userInput.value = "";
            saveChatHistory();
            return;
        } else {
            addMessage("❌ Access denied. Please Use Your Access Key Sir", "ghost", isVoiceResponseEnabled);
            userInput.value = "";
            return;
        }
    }

    // Clear chat password
    if (message === CLEAR_CHAT_PASSWORD) {
        clearChatHistory();
        addMessage("🧹 Chat cleared successfully.", "ghost", isVoiceResponseEnabled);
        userInput.value = "";
        return;
    }

    if (message.toLowerCase().includes("clear chat")) {
        addMessage("⚠️ Enter Your Password To Clear Chat:", "ghost", isVoiceResponseEnabled);
        userInput.value = "";
        return;
    }

    // ✅ Prevent self-voice from being sent as input
    if (isListening) return;

    // Normal message
    addMessage(message, "user");
    userInput.value = "";
    userTypingIndicator.style.display = "none";
    saveChatHistory();

    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        const reply = getReply(message);
        if (reply && reply.trim()) {
            addMessage(reply, "ghost", isVoiceResponseEnabled);
        }
        saveChatHistory();
    }, 1000 + Math.random() * 500);
}

// Add Message with Typing + Voice Sync
function addMessage(text, sender, shouldSpeak = false) {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = sender === "user" ? "message user-message" : "message ghost-message";

    const senderDiv = document.createElement("div");
    senderDiv.className = "message-sender";
    senderDiv.textContent = sender === "user" ? "You" : "Ghost";

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";
    bubbleDiv.textContent = "";

    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timeDiv);
    chatArea.appendChild(messageDiv);

    if (sender === "ghost") {
        typeTextWithVoice(bubbleDiv, trimmedText, shouldSpeak);
    } else {
        bubbleDiv.textContent = trimmedText;
    }

    chatArea.scrollTop = chatArea.scrollHeight;
}

// ✅ Type and Speak Together — with guaranteed voice
function typeTextWithVoice(element, text, shouldSpeak) {
    let i = 0;
    element.textContent = "";

    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(interval);
        }
    }, 20);

    if (shouldSpeak) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;

        const speak = () => {
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.lang.startsWith("en-US")) ||
                voices.find(v => v.lang.startsWith("en")) ||
                voices[0];
            if (voice) utterance.voice = voice;
            window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
            speak();
        } else {
            window.speechSynthesis.onvoiceschanged = speak;
        }
    }
}

// Typing Indicator
function showTypingIndicator() {
    typingIndicator.style.display = "flex";
    chatArea.scrollTop = chatArea.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.style.display = "none";
}

// Show Install Prompt
function shouldShowInstallPrompt(message) {
    const triggers = [
        "install", "download", "add to home", "pwa", "save app",
        "can i install", "how to install", "put on home", "make app"
    ];
    const lower = message.toLowerCase();
    return triggers.some(keyword => lower.includes(keyword));
}

// Get Reply
function getReply(message) {
    const lower = message.toLowerCase().replace(/[^\w\s]/g, "");

    // --- Owner Info: Arpit Pandey ---
    if (matches(lower, ["owner", "creator", "developer", "who made you", "who created you", "kaun hai", "tumhara malik", "banaya kisne"])) {
        return "I was created by Mr. Arpit Pandey — a passionate Full Stack Developer.";
    }

    if (matches(lower, ["name", "full name", "owner name", "arpit", "pandey", "kon hai"])) {
        return "My creator's name is Arpit Pandey.";
    }

    if (matches(lower, ["age", "how old", "kitni umar", "umar", "kita saal"])) {
        return "Arpit Pandey is 20 years old.";
    }

    if (matches(lower, ["profession", "job", "work", "career", "kya karta hai", "profile"])) {
        return "He is a Full Stack Developer passionate about building sleek, modern web apps with smooth UX.";
    }

    if (matches(lower, ["education", "padhai", "qualifications", "degree", "bcA", "kaha padha"])) {
        return "He has completed his BCA (Bachelor of Computer Applications).";
    }

    if (matches(lower, ["skills", "technologies", "kya aata hai", "expertise", "tools"])) {
        return "His skills include HTML, CSS, JavaScript, and Python. He's also learning ES6+, DOM manipulation, and modern web frameworks.";
    }

    if (matches(lower, ["projects", "kya banaya hai", "portfolio me kya hai", "work"])) {
        return "His projects include: Task Manager App, Stone Paper Scissors Game, E-Commerce Website, Quiz App, Professional Dashboard, and Expense Manager.";
    }

    if (matches(lower, ["website", "portfolio", "link", "url", "site", "github"])) {
        return "You can view his portfolio here: https://apandey-9046.github.io/arpit.portfolio_project/";
    }

    if (matches(lower, ["open website", "show portfolio", "visit site", "launch", "go to portfolio"])) {
        window.open("https://apandey-9046.github.io/arpit.portfolio_project/", "_blank");
        return "Opening Arpit Pandey's portfolio in a new tab... 🌐";
    }

    // --- Install Prompt ---
    if (shouldShowInstallPrompt(message)) {
        if (deferredPrompt) {
            installButton.hidden = false;

            installButton.onclick = () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(result => {
                    if (result.outcome === 'accepted') {
                        addMessage("🎉 Installation started! Check your device.", "ghost", isVoiceResponseEnabled);
                    } else {
                        addMessage("Installation canceled. You can try again later.", "ghost", isVoiceResponseEnabled);
                    }
                    installButton.hidden = true;
                    installButton.onclick = null;
                });
            };
        }
        return "Yes! Click the 'Install App' button below to install me on your device. 📲";
    }

    // --- Existing Logic ---
    if (matches(lower, ["hi", "hello", "hey", "hlo", "good morning", "good afternoon", "good evening", "sup"])) {
        return "Hello Sir! How can I assist you today?";
    }

    if (matches(lower, ["how are you", "how are you doing", "how is it going", "whats up", "what's up", "how are things"])) {
        return "I'm functioning optimally, thank you! How is your day going?";
    }

    if (matches(lower, ["your name", "who are you", "what are you", "what is your name", "identify yourself"])) {
        return "I'm Ghost — your personal AI assistant.";
    }

    if (matches(lower, ["time", "current time", "what time is it", "clock", "tell me the time"])) {
        return "The current time is " + new Date().toLocaleTimeString();
    }

    if (matches(lower, ["thank", "thanks", "thx", "thank you", "appreciate it", "grateful"])) {
        return "You're welcome, Sir! Let me know if you need anything else.";
    }

    if (matches(lower, ["bye", "goodbye", "see you", "later", "good night", "i'm out", "leaving"])) {
        return "Goodbye Sir! I'll be here whenever you call.";
    }

    if (matches(lower, ["help", "need help", "can you help", "what can you do", "features", "capabilities"])) {
        return "I can chat, tell time, respond to voice input, and more. Just ask me anything!";
    }

    if (matches(lower, ["i love you", "love you", "you're awesome", "best ai", "you are amazing", "impressive"])) {
        return "Aww, that's sweet! I'm here for you, always — professionally, of course. 😉";
    }

    const fallbacks = [
        "I'm not sure about that, but I'm learning every day!",
        "Hmm, I don't have an answer yet, but I'm improving!",
        "Interesting! I'll remember that for next time.",
        "I didn't catch that. Can you rephrase?",
        "Let me think... Nope, not in my training data yet!"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function matches(text, keywords) {
    return keywords.some(keyword => text.includes(keyword.trim()));
}

// ✅ Mic Button: Blinking Green Dot + Auto-Send
micButton.addEventListener("click", () => {
    if (!recognition) return;

    if (isListening) {
        recognition.stop();
        resetMicButton();
    } else {
        try {
            recognition.start();
            isListening = true;
            micButton.innerHTML = "🔴";
            micButton.style.backgroundColor = "#cc0000";
            micButton.title = "Listening...";

            // Blinking green dot effect
            const blink = setInterval(() => {
                if (!isListening) {
                    clearInterval(blink);
                    return;
                }
                micButton.innerHTML = micButton.innerHTML === "🔴" ? "🟢" : "🔴";
            }, 800);
        } catch (e) {
            console.error("Speech error:", e);
            resetMicButton();
        }
    }
});

// Reset mic button to default
function resetMicButton() {
    isListening = false;
    micButton.innerHTML = "🎤";
    micButton.style.backgroundColor = "";
    micButton.title = "Hold to speak";
    clearTimeout(silenceTimer);
}

// Handle recognition events
if (recognition) {
    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.trim();
        if (!isListening) return;

        userInput.value = transcript;

        // Reset silence timer
        clearTimeout(silenceTimer);

        if (e.results[0].isFinal) {
            // Auto-send after 4 seconds of silence
            silenceTimer = setTimeout(() => {
                if (isListening && userInput.value.trim()) {
                    sendMessage();
                }
            }, 4000);
        }
    };

    recognition.onerror = (e) => {
        console.error("Speech error:", e.error);
    };

    recognition.onend = () => {
        if (isListening) {
            resetMicButton();
        }
    };
}

// Voice Toggle
voiceButton.addEventListener("click", () => {
    isVoiceResponseEnabled = !isVoiceResponseEnabled;
    voiceButton.textContent = isVoiceResponseEnabled ? "🔊" : "🔇";
    voiceButton.title = isVoiceResponseEnabled ? "Disable voice output" : "Enable voice output";
});

// LocalStorage
function saveChatHistory() {
    const messages = [];
    document.querySelectorAll(".message").forEach(msg => {
        const sender = msg.classList.contains("user-message") ? "user" : "ghost";
        const text = msg.querySelector(".message-bubble").textContent;
        messages.push({ sender, text });
    });
    localStorage.setItem("ghostChatHistory", JSON.stringify(messages));
}

function loadChatHistory() {
    const saved = localStorage.getItem("ghostChatHistory");
    if (!saved) return;
    try {
        JSON.parse(saved).forEach(({ sender, text }) => {
            if (text && text.trim()) addMessage(text, sender);
        });
    } catch (e) {
        localStorage.removeItem("ghostChatHistory");
    }
}

function clearChatHistory() {
    localStorage.removeItem("ghostChatHistory");
    chatArea.innerHTML = "";
    const log = document.createElement("div");
    log.textContent = "Chat cleared.";
    log.style.textAlign = "center";
    log.style.color = "#888";
    log.style.fontSize = "0.8rem";
    log.style.margin = "10px";
    chatArea.appendChild(log);
}

// Send on Enter & Click
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});

// PWA Install Prompt
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// Ensure voices load
window.speechSynthesis.onvoiceschanged = () => { };