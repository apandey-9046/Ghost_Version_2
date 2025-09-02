// DOM Elements
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");
const typingIndicator = document.getElementById("typingIndicator");
const userTypingIndicator = document.getElementById("userTypingIndicator");
const installButton = document.getElementById("installButton");
// ✅ Global wake words
const WAKE_WORDS = [
    "wake up", "hey", "are you there", "hello", "ghost",
    "bhai sun", "suno", "ji", "haan", "kya hal hai",
    "status", "online ho", "jaroorat hai", "jarurat hai"
];
// State
let isListening = false; // This now means actively listening for dictation, not just wake words
let isVoiceResponseEnabled = false;
let recognition = null;
let currentUtterance = null;
let isChatUnlocked = false;
let deferredPrompt = null;
let aiModel = null;
// Set app height for mobile devices
function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
window.addEventListener('resize', setAppHeight);
setAppHeight();
// Passwords
const START_CHAT_PASSWORD = "Admin123";
const CLEAR_CHAT_PASSWORD = "Arpit@232422";
// User & AI Info
const USER_NAME = "Arpit";
const AI_NAME = "Ghost";
const AI_BIRTH_DATE = new Date("2025-09-01");
// Version Info
const APP_VERSION = "Ghost v3.0.0";
// Auto Update Date
const LAST_UPDATED = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
});
// Arpit's Profile Context (Updated from live portfolio)
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
    try {
        localStorage.setItem("ghostExpenses", JSON.stringify(expenses));
    } catch (e) {
        console.warn("Failed to save expenses:", e);
    }
}
function saveTasks() {
    try {
        localStorage.setItem("ghostTasks", JSON.stringify(tasks));
    } catch (e) {
        console.warn("Failed to save tasks:", e);
    }
}

// Generate ID safely
// ✅ Fix 2: Updated fallback to use substring instead of deprecated substr
function generateId() {
    try {
        // Ensure crypto is available and randomUUID is callable
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        } else {
            throw new Error('crypto.randomUUID not available');
        }
    } catch (e) {
        console.warn("crypto.randomUUID failed, using fallback:", e);
        // Fallback: timestamp + random number part
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`; // ✅ substr -> substring
    }
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
// Load AI Model (Safe Pipeline)
window.addEventListener("DOMContentLoaded", async () => {
    loadChatHistory();
    userInput.focus();
    // Restore voice toggle
    isVoiceResponseEnabled = localStorage.getItem("voiceEnabled") === "true";
    voiceButton.textContent = isVoiceResponseEnabled ? "🔊" : "🔇";
    // Show welcome message
    if (chatArea.children.length === 0) {
        addMessage("Welcome back, Sir! Please enter your password to proceed.", "ghost", isVoiceResponseEnabled);
    }
    // Register Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(reg => console.log("SW registered:", reg.scope))
            .catch(err => console.error("SW registration failed:", err));
    }
    // ✅ Fix 1: Corrected import URL (removed trailing spaces)
    try {
        // ✅ Fix 3: Corrected pipeline usage to 'text-generation'
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.5.0/dist/transformers.esm.js'); // Removed trailing spaces
        // Using a lightweight generative model. Adjust if needed.
        aiModel = await pipeline('text-generation', 'Xenova/distilgpt2');
        console.log("✅ AI Text Generation Model loaded (lightweight)");
    } catch (err) {
        console.warn("⚠️ AI Model failed to load. Using rule-based replies.", err);
        aiModel = null;
    }
    checkMicPermission();
});
// Check Mic Permission
async function checkMicPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("✅ Mic permission granted");
        stream.getTracks().forEach(track => track.stop());
        if (recognition && !isListening) {
            recognition.stop();
            setTimeout(() => {
                try {
                    recognition.start(); // ✅ Fix 6: Wrap start in try/catch
                } catch (e) {
                    console.error("Error restarting recognition after permission check:", e);
                }
            }, 500);
        }
    } catch (err) {
        console.warn("⚠️ Mic permission denied");
        micButton.title = "Mic blocked. Allow in browser settings";
        micButton.style.backgroundColor = "#ff6b6b";
        micButton.innerHTML = "🔴";
    }
}
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
    // ✅ Fix 1: Removed invalid recognition.state check
    // ✅ Prevent self-voice from being sent as input (if actively listening for dictation)
    if (isListening && recognition /* && recognition.state === 'listening' */) return;
    // Normal message
    addMessage(message, "user");
    userInput.value = "";
    userInput.blur(); // ✅ Close keyboard
    userTypingIndicator.style.display = "none";
    saveChatHistory();
    showTypingIndicator();
    setTimeout(async () => {
        try {
            const reply = await getReply(message);
            if (reply && reply.trim()) {
                addMessage(reply, "ghost", isVoiceResponseEnabled);
            }
        } catch (err) {
            console.error("Reply error:", err);
            addMessage("Sorry, I had trouble processing that.", "ghost", isVoiceResponseEnabled);
        } finally {
            hideTypingIndicator();
            saveChatHistory();
        }
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
// ✅ Type and Speak Together — Natural, Human-like Voice
function typeTextWithVoice(element, text, shouldSpeak) {
    let i = 0;
    element.textContent = "";
    // Clean text for speech (remove emojis/symbols)
    // ✅ Fix 4: Updated emoji removal regex for better browser support
    const cleanText = text.replace(/[\p{Extended_Pictographic}]/gu, ''); // ✅ \p{Emoji} -> [\p{Extended_Pictographic}]
    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(interval);
        }
    }, 20);
    if (shouldSpeak) {
        window.speechSynthesis.cancel(); // ✅ Stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(cleanText);
        // ✅ Natural voice settings
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1;
        // ✅ Emotion-based voice modulation
        if (text.includes("🎉") || text.includes("win")) {
            utterance.pitch = 1.2;
            utterance.rate = 1.05;
        } else if (text.includes("❌") || text.includes("error")) {
            utterance.pitch = 0.8;
            utterance.rate = 0.8;
        } else if (text.includes("love") || text.includes("sweet")) {
            utterance.pitch = 1.1;
        }
        const speak = () => {
            const voices = window.speechSynthesis.getVoices();
            const preferred = voices.find(v => v.name === 'Google US English') ||
                voices.find(v => v.lang === 'en-US') ||
                voices.find(v => v.lang.startsWith('en')) ||
                voices[0];
            if (preferred) utterance.voice = preferred;
            window.speechSynthesis.speak(utterance);
        };
        if (window.speechSynthesis.getVoices().length > 0) {
            speak();
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                speak();
                window.speechSynthesis.onvoiceschanged = null;
            };
        }
        // ✅ Stop mic during AI speech
        if (recognition && isListening) {
            recognition.stop();
            setTimeout(() => {
                try {
                    recognition.start(); // ✅ Fix 6: Wrap start in try/catch
                } catch (e) {
                    console.error("Error restarting recognition after speech:", e);
                }
                // Reset mic button state after speech finishes if it was active
                if (isListening) {
                    resetMicButton(); // Go back to wake word listening
                }
            }, Math.min(cleanText.length * 80, 5000)); // Resume after speech
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
// Helper: Check if command (not for AI)
// ✅ Improved matches function with word boundaries (Fix from AI 2)
function matches(text, keywords) {
    return keywords.some(keyword => {
        const trimmed = keyword.trim();
        // Escape potential regex special characters in the keyword
        const escapedKeyword = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        return regex.test(text);
    });
}
// Get Reply from AI or Fallback
async function getReply(message) {
    const lower = message.toLowerCase().replace(/[^\w\s]/g, "");
    // --- Wake Word Detection for Mic ---
    if (WAKE_WORDS.some(word => lower.includes(word)) && !isListening) {
        isListening = true; // Enter active dictation mode
        recognition.stop();
        setTimeout(() => {
            try {
                recognition.start(); // ✅ Fix 6: Wrap start in try/catch
            } catch (e) {
                console.error("Error restarting recognition after wake word:", e);
                resetMicButton(); // Reset on error
            }
            addMessage("Yes Sir, I'm here. How can I help you?", "ghost", isVoiceResponseEnabled);
            micButton.innerHTML = "🟢";
            micButton.style.backgroundColor = "#00cc44";
            micButton.title = "Active - Listening";
        }, 100);
        return null; // Don't process wake word as a command
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
    // --- If NOT a command, let AI handle it (General Knowledge)
    // Only use AI if it's loaded and the message isn't a recognized command
    if (aiModel && !isCommand(lower)) {
        try {
            const prompt = `
${PROFILE_CONTEXT}
You are Ghost, Arpit Pandey's personal AI assistant.
Be helpful, concise, and professional.
Answer this: "${message}"
`;
            // ✅ Fix 3: Corrected usage for text-generation pipeline
            const result = await aiModel(prompt, { max_new_tokens: 200, return_full_text: false });
            const reply = result?.[0]?.generated_text?.trim() ||
                "I'm not sure about that.";
            if (reply && !reply.toLowerCase().includes("i don't know")) {
                return reply;
            }
        } catch (err) {
            console.error("AI generation failed:", err);
        }
    }
    // --- Commands (AI not needed) ---
    // Name Queries
    if (matches(lower, ["my name", "mera naam", "kon hu"])) {
        return `Your name is ${USER_NAME}, Sir.`;
    }
    if (matches(lower, ["your name", "tumhara naam", "kaun ho"])) {
        return `I'm ${AI_NAME}, your personal AI assistant.`;
    }
    // Age Queries
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
    // Task Manager
    if (lower.includes("add task") || lower.includes("task")) {
        const taskText = message.replace(/add task:?/i, "").trim();
        if (taskText) {
            const newTask = {
                // ✅ Fix 2: Use safe ID generator
                id: generateId(),
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
        if (tasks.length === 0) return "You have no tasks. Add one with 'Add task: ...'";
        let taskList = "📝 Your Tasks:\n";
        tasks.forEach((t, i) => taskList += `${i + 1}. ${t.text} (Added: ${t.date})\n`);
        return taskList;
    }
    if (lower.includes("clear tasks")) {
        tasks = [];
        saveTasks();
        return "🧹 All tasks cleared.";
    }
    // Expense Manager
    if (lower.includes("add expense") || lower.includes("expense")) {
        // ✅ Improved regex for decimal amounts (Fix from AI 1)
        const match = message.match(/(?:₹\$?|\$)?\s*(\d+(?:\.\d{1,2})?)/i);
        const amount = match ? parseFloat(match[1]) : 0;
        if (amount > 0) {
            const words = lower.split(" ");
            const categoryIndex = words.indexOf("expense") + 1;
            const category = categoryIndex < words.length ? words[categoryIndex].charAt(0).toUpperCase() + words[categoryIndex].slice(1) : "General";
            // Extract item description more robustly
            let item = "Expense";
            const dashIndex = message.indexOf(" - ");
            if (dashIndex !== -1) {
                item = message.substring(message.indexOf("expense") !== -1 ? message.indexOf("expense") + 8 : 0, dashIndex).trim() || category;
            } else {
                // If no dash, try to get text after "add expense" or "expense"
                const afterAddExpense = message.toLowerCase().indexOf("add expense");
                const afterExpense = message.toLowerCase().indexOf("expense");
                if (afterAddExpense !== -1) {
                    item = message.substring(afterAddExpense + 11).trim() || category;
                } else if (afterExpense !== -1) {
                    item = message.substring(afterExpense + 8).trim() || category;
                }
            }
            // Fallback if item is still generic
            if (item.toLowerCase() === "expense" || item.toLowerCase() === "add") {
                item = category;
            }

            const newExpense = {
                // ✅ Fix 2: Use safe ID generator
                id: generateId(),
                item, category, amount,
                date: new Date().toLocaleDateString(),
                status: "Paid"
            };
            expenses.push(newExpense);
            saveExpenses();
            return `✅ Expense added: ${item} - ₹${amount.toFixed(2)}`;
        }
        return "Please specify the amount. Example: 'Add expense: Food - ₹200' or 'Add expense Lunch - $15.50'";
    }
    if (lower.includes("show expenses") || lower.includes("my expenses")) {
        if (expenses.length === 0) return "You have no expenses recorded yet.";
        let total = expenses.reduce((sum, e) => sum + e.amount, 0);
        let bill = `----------------------------------\n`;
        bill += `        💳 EXPENSE BILL\n`;
        bill += `----------------------------------\n`;
        expenses.forEach(e => bill += `  • ${e.item.padEnd(20)} ₹${e.amount.toFixed(2)}\n`);
        bill += `----------------------------------\n`;
        bill += `Total:     ₹${total.toFixed(2)}\n`;
        bill += `Status:    ✅ Paid\n`;
        bill += `----------------------------------`;
        return bill;
    }
    if (lower.includes("clear expenses")) {
        expenses = [];
        saveExpenses();
        return "🧹 All expenses cleared.";
    }
    // Game
    if (lower.includes("play game") || lower.includes("stone paper scissors")) {
        return `Let's play! Choose Stone, Paper, or Scissors. I've chosen mine.`;
    }
    if (["stone", "paper", "scissors", "rock"].some(word => lower.includes(word))) {
        const userChoice = lower.includes("rock") || lower.includes("stone") ? "Stone" :
            lower.includes("paper") ? "Paper" : "Scissors";
        const options = ["Stone", "Paper", "Scissors"];
        const aiChoice = options[Math.floor(Math.random() * 3)];
        let result = `You: ${userChoice} vs Me: ${aiChoice}\n`;
        if (userChoice === aiChoice) result += "It's a tie! 🤝";
        else if ((userChoice === "Stone" && aiChoice === "Scissors") ||
            (userChoice === "Paper" && aiChoice === "Stone") ||
            (userChoice === "Scissors" && aiChoice === "Paper"))
            result += "You win! 🎉";
        else result += "I win! 😎";
        return result;
    }
    // Maths
    if (lower.includes("solve") || /[+\-*/=]/.test(lower)) {
        try {
            // ✅ Fix 6: Safer regex and evaluation (Fix from AI 1)
            const expr = message.replace(/[^0-9+\-*/().\s]/g, '').replace(/\s+/g, ''); // Remove non-math chars and extra spaces
            // Stricter validation regex for basic expressions
            if (!/^[\d\s()+\-*/.]+$/.test(expr) || expr.includes('/0')) {
                throw new Error("Invalid or dangerous expression");
            }
            // Avoid Function constructor, use eval cautiously or better, a parser
            // For simplicity here, using eval with strict regex check above.
            // In production, use math.js or similar.
            // Note: eval can still be risky, this is a compromise based on feedback.
            const result = eval(expr); // Assuming regex prevents most issues
            if (!isFinite(result)) throw new Error("Infinite or NaN result");
            return `🧮 Result: ${expr} = ${result}`;
        } catch (e) {
            console.error("Math evaluation error:", e);
            return "I couldn't solve that. Please enter a valid math expression (e.g., 2+2, (5*3)-1).";
        }
    }
    // Quiz
    if (lower.includes("quiz") || lower.includes("question")) {
        return `🧠 JavaScript Quiz (5 Questions):\n` +
            "1. What does 'JS' stand for?\n" +
            "2. How do you declare a variable in ES6?\n" +
            "3. What is the output of 'typeof null'?\n" +
            "4. Which method adds an element to the end of an array?\n" +
            "5. What does 'DOM' stand for?\n" +
            "Reply with your answers, and I'll score you!";
    }
    // Version
    if (lower === "--version" || lower.includes("version kya hai") || lower.includes("what is your version") || lower.includes("app version") || lower.includes("current version")) {
        return `📌 Current Version: ${APP_VERSION}\nThis app was last updated on ${LAST_UPDATED}.\nDeveloped by Arpit Pandey.`;
    }
    if (lower.includes("is my version updated") || lower.includes("check update") || lower.includes("latest version")) {
        return `✅ Yes Sir, you are using the latest version: ${APP_VERSION}.\nLast updated: ${LAST_UPDATED}`;
    }
    // Default Replies
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
    // Fallback
    const fallbacks = [
        "I'm not sure about that, but I'm learning every day!",
        "Hmm, I don't have an answer yet, but I'm improving!",
        "Interesting! I'll remember that for next time.",
        "I didn't catch that. Can you rephrase?",
        "Let me think... Nope, not in my training data yet!"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ✅ Mic Button: Sleep Mode + Wake Words
micButton.addEventListener("click", () => {
    if (!recognition) return;
    if (isListening) {
        // Currently actively listening for dictation, stop it
        recognition.stop();
        resetMicButton(); // Go back to wake word mode
    } else {
        // Currently in wake word mode or stopped, start listening for wake words
        try {
            recognition.abort(); // Ensure stopped
            recognition.start();
            isListening = false; // Start in wake-word detection mode
            micButton.innerHTML = "⚪";
            micButton.style.backgroundColor = "#666";
            micButton.title = "Listening for wake word...";
        } catch (e) {
            console.error("Speech start error:", e);
            resetMicButton();
        }
    }
});
// Reset mic button to sleep mode (wake word listening)
// ✅ Fix 6: Improved resetMicButton to handle state and errors more robustly
function resetMicButton() {
    isListening = false; // Reset to wake-word listening state
    micButton.innerHTML = "⚪";
    micButton.style.backgroundColor = "#666";
    micButton.title = "Listening for wake word...";
    if (recognition) {
        recognition.abort(); // Ensure stopped before restart
        setTimeout(() => {
            if (!isListening) { // Only restart if still in wake-word mode
                try {
                    recognition.start(); // ✅ Fix 6: Wrap start in try/catch
                } catch (e) {
                    console.error("Error restarting recognition in resetMicButton:", e);
                    // Optional: Add UI feedback for persistent mic issues
                }
            }
        }, 500);
    }
}
// Handle recognition events
if (recognition) {
    recognition.onresult = (e) => {
        const resultIndex = e.resultIndex;
        const transcript = e.results[resultIndex][0].transcript.trim();
        // console.log("Recognition result:", transcript, "isFinal:", e.results[resultIndex].isFinal, "isListening:", isListening);
        // Handle final results
        if (e.results[resultIndex].isFinal) {
            // Check for wake words if NOT currently in active dictation mode
            if (!isListening) {
                const matched = WAKE_WORDS.some(word => transcript.toLowerCase().includes(word));
                if (matched) {
                    isListening = true; // Switch to active dictation mode
                    recognition.stop();
                    setTimeout(() => {
                        try {
                            recognition.start(); // ✅ Fix 6: Wrap start in try/catch
                        } catch (e) {
                            console.error("Error restarting recognition after internal wake word:", e);
                            resetMicButton(); // Reset on error
                            return; // Exit if restart failed
                        }
                        addMessage("Yes Sir, I'm here. How can I help you?", "ghost", isVoiceResponseEnabled);
                        micButton.innerHTML = "🟢";
                        micButton.style.backgroundColor = "#00cc44";
                        micButton.title = "Active - Listening";
                    }, 100);
                }
                // If not a wake word, ignore (stay in wake-word mode)
            } else {
                // Currently in active dictation mode, process the transcript as user input
                userInput.value = transcript;
                sendMessage(); // Send the dictated message
                // After sending, go back to wake-word mode
                resetMicButton();
            }
        }
        // Handle interim results (optional, for live feedback)
        // else if (transcript) {
        //     // Could update UI with interim results if needed
        // }
    };
    recognition.onerror = (e) => {
        // console.error("Speech recognition error:", e.error);
        // Handle specific errors if needed
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.error("Speech error:", e.error);
        }
        // Restart recognition in the appropriate mode if it ends unexpectedly
        if (!isListening) { // If was in wake-word mode
            setTimeout(() => {
                resetMicButton(); // Restart wake-word listening
            }, 1000);
        } else { // If was in active dictation mode
            resetMicButton(); // Go back to wake-word mode on error
        }
    };
    recognition.onend = () => {
        // console.log("Recognition ended. isListening:", isListening);
        // Automatically restart recognition in the correct mode
        setTimeout(() => {
            if (!isListening) {
                // Was in wake-word mode, restart listening for wake words
                resetMicButton();
            } else {
                // Was in active dictation mode, but ended, go back to wake-word mode
                resetMicButton();
            }
        }, 500);
    };
}
// Voice Toggle
voiceButton.addEventListener("click", () => {
    isVoiceResponseEnabled = !isVoiceResponseEnabled;
    localStorage.setItem("voiceEnabled", isVoiceResponseEnabled);
    voiceButton.textContent = isVoiceResponseEnabled ? "🔊" : "🔇";
    voiceButton.title = isVoiceResponseEnabled ? "Disable voice output" : "Enable voice output";
});
// LocalStorage
function saveChatHistory() {
    const messages = Array.from(document.querySelectorAll(".message"))
        .slice(-100)
        .map(msg => {
            const sender = msg.classList.contains("user-message") ? "user" : "ghost";
            const text = msg.querySelector(".message-bubble").textContent;
            return { sender, text };
        });
    try {
        localStorage.setItem("ghostChatHistory", JSON.stringify(messages));
    } catch (e) {
        console.warn("Failed to save chat history:", e);
    }
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
    installButton.hidden = false; // ✅ Show when available
});
// Ensure voices load (keep this line, remove the empty assignment later if needed)
// window.speechSynthesis.onvoiceschanged = () => { }; // ✅ Removed redundant empty handler

// ✅ Optional: Hide install button permanently after installation (Fix from AI 2)
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    installButton.hidden = true;
    // Optionally, persist this state if needed across reloads
    // localStorage.setItem('appInstalled', 'true');
});
// Uncomment the following lines if you want to check persisted state on load
// if (localStorage.getItem('appInstalled') === 'true') {
//     installButton.hidden = true;
// }

// Helper function to check if message is a command (kept as is, used in logic)
function isCommand(lower) {
    const commands = [
        "wake up", "hey", "hello", "bhai sun", "suno", "status", "online",
        "install", "download", "pwa", "add task", "show tasks", "clear tasks",
        "add expense", "show expenses", "clear expenses", "play game",
        "stone", "paper", "scissors", "rock", "solve", "quiz", "version",
        "my name", "your name", "my age", "your age", "hi", "help", "time"
    ];
    return commands.some(cmd => lower.includes(cmd));
}
