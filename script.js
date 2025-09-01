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
let aiModel = null; // For Qwen

// Passwords
const START_CHAT_PASSWORD = "Admin123";
const CLEAR_CHAT_PASSWORD = "Arpit@232422";

// User & AI Info
const USER_NAME = "Arpit";
const AI_NAME = "Ghost";
const AI_BIRTH_DATE = new Date("2025-09-01"); // Ghost's "birth" date

// Arpit's Profile Context (Updated from portfolio)
const PROFILE_CONTEXT = `
Arpit Pandey is a 20-year-old Full Stack Developer passionate about building sleek, modern web apps with smooth UX.
He has completed his BCA and specializes in:
- HTML: Creating structured, semantic web pages with responsive layouts.
- CSS: Styling modern websites, animations, and responsive designs.
- JavaScript: Learning DOM manipulation, ES6+, and interactive features.
- Python: Proficient in scripting, automation, and problem-solving.

His projects include:
1. Task Manager App — Efficiently manage daily tasks.
2. Stone Paper Scissors Game — Interactive game showcasing creativity.
3. E-Commerce Website — Full-featured online shopping platform.
4. Quiz App — Interactive quiz with timer and scoring.
5. Professional Dashboard — Visualize business metrics.
6. Expense Manager — Track income, expenses, and spending trends.

He is always learning new technologies and exploring trends.
Portfolio: https://apandey-9046.github.io/arpit.portfolio_project/
`;

// Expense & Task State
let expenses = JSON.parse(localStorage.getItem("ghostExpenses")) || [];
let tasks = JSON.parse(localStorage.getItem("ghostTasks")) || [];

// Save functions
function saveExpenses() {
    localStorage.setItem("ghostExpenses", JSON.stringify(expenses));
}

function saveTasks() {
    localStorage.setItem("ghostTasks", JSON.stringify(tasks));
}

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
} else {
    micButton.disabled = true;
    micButton.title = "Not supported";
    micButton.style.opacity = 0.5;
}

// Load AI Model on Load
window.addEventListener("DOMContentLoaded", async () => {
    loadChatHistory();
    userInput.focus();

    // Show welcome message
    if (chatArea.children.length === 0) {
        addMessage("Please enter your password to proceed, Sir", "ghost", true);
    }

    // Register Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(reg => console.log("SW registered:", reg.scope))
            .catch(err => console.error("SW registration failed:", err));
    }

    // ✅ Load AI Model in Background
    try {
        const { pipeline } = await import('@xenova/transformers');
        aiModel = await pipeline('text-generation', 'Xenova/Qwen-1.8B-Chat');
        console.log("✅ AI Model (Qwen) loaded successfully");
    } catch (err) {
        console.warn("⚠️ AI Model failed to load. Using fallback replies.", err);
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
            addMessage("Access granted! Welcome back, Sir.", "ghost", isVoiceResponseEnabled);
            userInput.value = "";
            saveChatHistory();
            return;
        } else {
            addMessage("Access denied. Please Use Your Access Key Sir", "ghost", isVoiceResponseEnabled);
            userInput.value = "";
            return;
        }
    }

    // Clear chat password
    if (message === CLEAR_CHAT_PASSWORD) {
        clearChatHistory();
        addMessage("Chat cleared successfully.", "ghost", isVoiceResponseEnabled);
        userInput.value = "";
        return;
    }

    if (message.toLowerCase().includes("clear chat")) {
        addMessage("Enter Your Password To Clear Chat:", "ghost", isVoiceResponseEnabled);
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
    setTimeout(async () => {
        hideTypingIndicator();
        const reply = await getReply(message);
        if (reply && reply.trim()) {
            addMessage(reply, "ghost", isVoiceResponseEnabled);
        }
        saveChatHistory();
    }, 500);
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
        // Remove symbols before speaking
        const cleanText = text.replace(/[✅❌🔒⚠️🧹🎉🟢🔴🎤🔊🔇🌐]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
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

// Get Reply from AI or Fallback
async function getReply(message) {
    const lower = message.toLowerCase().replace(/[^\w\s]/g, "");

    // --- Wake Word Detection for Mic ---
    const wakeWords = [
        "wake up", "hey", "are you there", "hello", "ghost",
        "bhai sun", "suno", "ji", "haan", "kya hal hai",
        "status", "online ho", "jaroorat hai", "jarurat hai"
    ];
    if (wakeWords.some(word => lower.includes(word)) && !isListening) {
        isListening = true;
        recognition.stop();
        setTimeout(() => {
            recognition.start();
            addMessage("Yes Sir, I'm here. How can I help you?", "ghost", isVoiceResponseEnabled);
            micButton.innerHTML = "🟢";
            micButton.style.backgroundColor = "#00cc44";
            micButton.title = "Active";
        }, 100);
        return null;
    }

    // --- Install Prompt ---
    if (shouldShowInstallPrompt(message)) {
        if (deferredPrompt) {
            installButton.hidden = false;

            installButton.onclick = () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(result => {
                    if (result.outcome === 'accepted') {
                        addMessage("Installation started! Check your device.", "ghost", isVoiceResponseEnabled);
                    } else {
                        addMessage("Installation canceled. You can try again later.", "ghost", isVoiceResponseEnabled);
                    }
                    installButton.hidden = true;
                    installButton.onclick = null;
                });
            };
        }
        return "Yes! Click the 'Install App' button below to install me on your device.";
    }

    // --- Name Queries ---
    if (matches(lower, ["my name", "mera naam", "kon hu"])) {
        return `Your name is ${USER_NAME}, Sir.`;
    }

    if (matches(lower, ["your name", "tumhara naam", "kaun ho"])) {
        return `I'm ${AI_NAME}, your personal AI assistant.`;
    }

    // --- Age Queries ---
    if (matches(lower, ["my age", "meri umar", "main kitne saal ka hu"])) {
        return "You are 20 years old, Sir.";
    }

    if (matches(lower, ["your age", "tumhari umar", "kitne din se ho"])) {
        const today = new Date();
        const diffTime = Math.abs(today - AI_BIRTH_DATE);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const years = Math.floor(diffDays / 365);
        const remainderDays = diffDays % 365;
        return `I am ${years} years and ${remainderDays} days old today.`;
    }

    // --- Task Manager ---
    if (lower.includes("add task") || lower.includes("task")) {
        const taskText = message.replace(/add task:?/i, "").trim();
        if (taskText) {
            const newTask = {
                id: Date.now(),
                text: taskText,
                date: new Date().toLocaleDateString()
            };
            tasks.push(newTask);
            saveTasks();
            return `✅ Task added: "${taskText}"`;
        }
        return "Please specify a task. Example: 'Add task: Fix bug by tomorrow'";
    }

    if (lower.includes("show tasks") || lower.includes("my tasks")) {
        if (tasks.length === 0) {
            return "You have no tasks. Add one with 'Add task: ...'";
        }

        let taskList = "📝 Your Tasks:\n";
        tasks.forEach((t, i) => {
            taskList += `${i + 1}. ${t.text} (Added: ${t.date})\n`;
        });
        return taskList;
    }

    if (lower.includes("clear tasks")) {
        tasks = [];
        saveTasks();
        return "🧹 All tasks cleared.";
    }

    // --- Expense Manager ---
    if (lower.includes("add expense") || lower.includes("expense")) {
        const match = message.match(/₹?(\d+)/);
        const amount = match ? parseInt(match[1]) : 0;
        if (amount > 0) {
            const words = lower.split(" ");
            const category = words[words.indexOf("expense") + 1] || "General";
            const item = message.split("-")[0].replace(/add expense|expense/i, "").trim() || category;

            const newExpense = {
                id: Date.now(),
                item,
                category,
                amount,
                date: new Date().toLocaleDateString(),
                status: "Paid"
            };

            expenses.push(newExpense);
            saveExpenses();

            return `✅ Expense added: ${item} - ₹${amount}`;
        }
        return "Please specify the amount. Example: 'Add expense: Food - ₹200'";
    }

    if (lower.includes("show expenses") || lower.includes("my expenses")) {
        if (expenses.length === 0) {
            return "You have no expenses recorded yet.";
        }

        let total = expenses.reduce((sum, e) => sum + e.amount, 0);
        let bill = `----------------------------------\n`;
        bill += `        💳 EXPENSE BILL\n`;
        bill += `----------------------------------\n`;
        expenses.forEach(e => {
            bill += `  • ${e.item.padEnd(20)} ₹${e.amount}\n`;
        });
        bill += `----------------------------------\n`;
        bill += `Total:     ₹${total}\n`;
        bill += `Status:    ✅ Paid\n`;
        bill += `----------------------------------`;

        return bill;
    }

    if (lower.includes("clear expenses")) {
        expenses = [];
        saveExpenses();
        return "🧹 All expenses cleared.";
    }

    // --- Game: Stone Paper Scissors ---
    if (lower.includes("play game") || lower.includes("stone paper scissors")) {
        return `Let's play! Choose Stone, Paper, or Scissors. I've chosen mine.`;
    }

    if (["stone", "paper", "scissors"].some(word => lower.includes(word))) {
        const userChoice = lower.includes("stone") ? "Stone" :
            lower.includes("paper") ? "Paper" : "Scissors";

        const options = ["Stone", "Paper", "Scissors"];
        const aiChoice = options[Math.floor(Math.random() * 3)];

        let result = `You: ${userChoice} vs Me: ${aiChoice}\n`;

        if (userChoice === aiChoice) {
            result += "It's a tie! 🤝";
        } else if (
            (userChoice === "Stone" && aiChoice === "Scissors") ||
            (userChoice === "Paper" && aiChoice === "Stone") ||
            (userChoice === "Scissors" && aiChoice === "Paper")
        ) {
            result += "You win! 🎉";
        } else {
            result += "I win! 😎";
        }

        return result;
    }

    // --- Maths Solver ---
    if (lower.includes("solve") || /[+\-*/=]/.test(lower)) {
        try {
            const expression = message.replace(/[^0-9+\-*/().]/g, '');
            const result = eval(expression);
            return `🧮 Result: ${expression} = ${result}`;
        } catch (e) {
            return "I couldn't solve that. Please enter a valid math expression.";
        }
    }

    // --- Quiz ---
    if (lower.includes("quiz") || lower.includes("question")) {
        return `🧠 JavaScript Quiz (5 Questions):\n\n` +
            "1. What does 'JS' stand for?\n" +
            "2. How do you declare a variable in ES6?\n" +
            "3. What is the output of 'typeof null'?\n" +
            "4. Which method adds an element to the end of an array?\n" +
            "5. What does 'DOM' stand for?\n\n" +
            "Reply with your answers, and I'll score you!";
    }

    // --- Existing Logic (Priority Replies) ---
    if (matches(lower, ["hi", "hello", "hey", "hlo", "good morning", "good afternoon", "good evening", "sup"])) {
        return "Hello Sir! How can I assist you today?";
    }

    if (matches(lower, ["how are you", "how are you doing", "how is it going", "whats up", "what's up", "how are things"])) {
        return "I'm functioning optimally, thank you! How is your day going?";
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
        return "Aww, that's sweet! I'm here for you, always — professionally, of course.";
    }

    // --- Default: Use AI to generate reply ---
    if (aiModel) {
        try {
            const prompt = `
${PROFILE_CONTEXT}
You are Ghost, Arpit Pandey's personal AI assistant.
Be helpful, concise, and professional.
Answer this: "${message}"
`;
            const result = await aiModel(prompt, { max_new_tokens: 150 });
            return result[0].generated_text.replace(/[\n\r]+/g, ' ').trim();
        } catch (err) {
            console.error("AI generation failed:", err);
        }
    }

    // Fallback if AI fails
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

// ✅ Mic Button: Sleep Mode + Wake Words
micButton.addEventListener("click", () => {
    if (!recognition) return;

    if (isListening) {
        recognition.stop();
        resetMicButton();
    } else {
        try {
            recognition.stop(); // Clean restart
            recognition.start();
            isListening = true;
            micButton.innerHTML = "🟢";
            micButton.style.backgroundColor = "#00cc44";
            micButton.title = "Active";
        } catch (e) {
            console.error("Speech error:", e);
            resetMicButton();
        }
    }
});

// Reset mic button to sleep mode
function resetMicButton() {
    isListening = false;
    micButton.innerHTML = "⚪";
    micButton.style.backgroundColor = "#666";
    micButton.title = "Listening for wake word...";
    clearTimeout(silenceTimer);

    // Restart recognition in background
    if (recognition && !isListening) {
        recognition.stop();
        setTimeout(() => recognition.start(), 500);
    }
}

// Handle recognition events
if (recognition) {
    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.trim().toLowerCase();
        if (isListening) return; // Already active

        if (e.results[0].isFinal) {
            const matched = wakeWords.some(word => transcript.includes(word));
            if (matched) {
                isListening = true;
                recognition.stop();
                setTimeout(() => {
                    recognition.start();
                    addMessage("Yes Sir, I'm here. How can I help you?", "ghost", isVoiceResponseEnabled);
                    micButton.innerHTML = "🟢";
                    micButton.style.backgroundColor = "#00cc44";
                    micButton.title = "Active";
                }, 100);
            }
        }
    };

    recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.error("Speech error:", e.error);
        }
        // Restart in sleep mode
        if (!isListening) {
            setTimeout(() => recognition.start(), 1000);
        }
    };

    recognition.onend = () => {
        if (!isListening) {
            setTimeout(() => {
                recognition.start();
                micButton.innerHTML = "⚪";
                micButton.style.backgroundColor = "#666";
                micButton.title = "Listening for wake word...";
            }, 500);
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