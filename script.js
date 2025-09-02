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
let isListening = false; // Now means actively listening for dictation
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
const USER_NAME = "User"; // Generic placeholder
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

// Profile Context (Generic/Empty as requested)
const PROFILE_CONTEXT = ``; // Removed Arpit-specific data

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

// Generate ID safely (Fix 2: Improved fallback and error handling)
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
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`; // Fix substr
    }
}

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true; // Get live results
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
        addMessage("Welcome back! Please enter your password to proceed.", "ghost", isVoiceResponseEnabled);
    }

    // Register Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(reg => console.log("SW registered:", reg.scope))
            .catch(err => console.error("SW registration failed:", err));
    }

    try {
        // Fix 1: Corrected import URL (removed trailing spaces)
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.5.0/dist/transformers.esm.js');
        // Fix 3: Corrected pipeline usage to 'text-generation'
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
        if (recognition) {
            // Start continuous recognition if permission granted
            recognition.stop(); // Ensure stopped before starting
            setTimeout(() => {
                try {
                    recognition.start();
                    console.log("🎤 Continuous speech recognition started.");
                    updateMicButtonState(); // Update UI to reflect listening state
                } catch (e) {
                    console.error("Error starting continuous recognition:", e);
                    updateMicButtonState(); // Update UI to reflect error state
                }
            }, 500);
        }
    } catch (err) {
        console.warn("⚠️ Mic permission denied");
        micButton.title = "Mic blocked. Allow in browser settings";
        micButton.style.backgroundColor = "#ff6b6b";
        micButton.innerHTML = "🔴";
        isListening = false; // Explicitly set state
    }
}

// Update Mic Button UI based on state
function updateMicButtonState() {
    if (!recognition) {
        micButton.disabled = true;
        micButton.title = "Not supported";
        micButton.style.opacity = 0.5;
        return;
    }

    // Check actual state if available (not standard but useful)
    const actualState = recognition.state || (isListening ? 'listening' : 'inactive');

    if (actualState === 'listening' || isListening) {
        micButton.innerHTML = "🟢";
        micButton.style.backgroundColor = "#00cc44";
        micButton.title = "Active - Listening";
        isListening = true; // Sync state flag
    } else {
        micButton.innerHTML = "⚪";
        micButton.style.backgroundColor = "#666";
        micButton.title = "Start listening";
        isListening = false; // Sync state flag
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
            addMessage("Access granted! Welcome back.", "ghost", isVoiceResponseEnabled);
            userInput.value = "";
            saveChatHistory();
            return;
        } else {
            addMessage("Access denied. Please use your access key.", "ghost", isVoiceResponseEnabled);
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
        addMessage("Enter your password to clear the chat:", "ghost", isVoiceResponseEnabled);
        userInput.value = "";
        return;
    }

    // Prevent self-voice from being sent as input (if actively listening for dictation)
    // Note: This check relies on isListening flag now.
    if (isListening) return;

    // Normal message
    addMessage(message, "user");
    userInput.value = "";
    userInput.blur(); // Close keyboard
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

// Type and Speak Together — Natural, Human-like Voice
function typeTextWithVoice(element, text, shouldSpeak) {
    let i = 0;
    element.textContent = "";

    // Clean text for speech (remove emojis/symbols)
    // Fix 4: Updated emoji removal regex for better browser support
    const cleanText = text.replace(/[\p{Extended_Pictographic}]/gu, '');

    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(interval);
        }
    }, 20);

    if (shouldSpeak) {
        window.speechSynthesis.cancel(); // Stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Natural voice settings
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1;

        // Emotion-based voice modulation
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

        // Stop mic during AI speech to prevent feedback
        if (recognition && isListening) {
            console.log("🔇 Pausing mic during speech output...");
            recognition.stop();
            isListening = false; // Update flag immediately
            updateMicButtonState(); // Update UI

            utterance.onend = () => {
                console.log("🔊 Speech finished, resuming mic...");
                setTimeout(() => {
                    try {
                        // Fix 6: Wrap start in try/catch
                        recognition.start();
                        isListening = true; // Update flag
                        updateMicButtonState(); // Update UI
                        console.log("🎤 Mic resumed.");
                    } catch (e) {
                        console.error("Error restarting recognition after speech:", e);
                        // Stay in stopped state, let user click button to restart
                        isListening = false;
                        updateMicButtonState();
                    }
                }, 300); // Small delay before restarting
            };
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

// Helper: Check if command (not for AI) - Fix 5: Improved regex escaping
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
    if (aiModel && !isCommand(lower)) {
        try {
            const prompt = `
${PROFILE_CONTEXT}
You are Ghost, a helpful AI assistant.
Be helpful, concise, and professional.
Answer this: "${message}"
`;
            // Fix 3: Corrected usage for text-generation pipeline
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
    if (matches(lower, ["my name", "who am i"])) {
        return `Your name is ${USER_NAME}.`; // Use generic name
    }
    if (matches(lower, ["your name", "what is your name"])) {
        return `I'm ${AI_NAME}, your AI assistant.`;
    }

    // Age Queries
    if (matches(lower, ["my age"])) {
        return "I don't have your age information.";
    }
    if (matches(lower, ["your age", "how old are you"])) {
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
                // Fix 2: Use safe ID generator
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
        // Improved regex for decimal amounts (Fix from AI 1 review)
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
                // Fix 2: Use safe ID generator
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
            // Safer regex and evaluation (Fix from AI 1 review)
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
    if (lower === "--version" || lower.includes("version") || lower.includes("app version") || lower.includes("current version")) {
        return `📌 Current Version: ${APP_VERSION}\nThis app was last updated on ${LAST_UPDATED}.`;
    }
    if (lower.includes("is my version updated") || lower.includes("check update") || lower.includes("latest version")) {
        return `✅ Yes, you are using the latest version: ${APP_VERSION}.\nLast updated: ${LAST_UPDATED}`;
    }

    // Default Replies
    if (matches(lower, ["hi", "hello", "hey", "hlo", "good morning", "good afternoon", "good evening", "sup"])) {
        return "Hello! How can I assist you today?";
    }
    if (matches(lower, ["how are you", "how are you doing", "how is it going", "whats up", "what's up", "how are things"])) {
        return "I'm functioning optimally, thank you! How is your day going?";
    }
    if (matches(lower, ["time", "current time", "what time is it", "clock", "tell me the time"])) {
        return "The current time is " + new Date().toLocaleTimeString();
    }
    if (matches(lower, ["thank", "thanks", "thx", "thank you", "appreciate it", "grateful"])) {
        return "You're welcome! Let me know if you need anything else.";
    }
    if (matches(lower, ["bye", "goodbye", "see you", "later", "good night", "i'm out", "leaving"])) {
        return "Goodbye! I'll be here whenever you call.";
    }
    if (matches(lower, ["help", "need help", "can you help", "what can you do", "features", "capabilities"])) {
        return "I can chat, tell time, respond to voice input, manage tasks/expenses, play games, and solve math. Just ask!";
    }
    if (matches(lower, ["i love you", "love you", "you're awesome", "best ai", "you are amazing", "impressive"])) {
        return "Aww, that's sweet! I'm here to help.";
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

// Mic Button: Toggle continuous speech recognition
micButton.addEventListener("click", () => {
    if (!recognition) return;

    console.log(`🎤 Mic button clicked. Current state: ${recognition.state || 'unknown'}, isListening flag: ${isListening}`);

    // Check actual state if available
    const actualState = recognition.state || (isListening ? 'listening' : 'inactive');

    if (actualState === 'listening') {
        console.log("🛑 Stopping continuous recognition...");
        recognition.stop();
        isListening = false;
    } else {
        console.log("▶️ Starting continuous recognition...");
        try {
            // Ensure it's stopped before starting
            recognition.abort();
            recognition.start();
            isListening = true;
        } catch (e) {
            console.error("Speech start error:", e);
            isListening = false;
            // Attempt to reset
            setTimeout(() => {
                if (!isListening && recognition) {
                    try {
                        // Fix 6: Wrap start in try/catch
                        recognition.start();
                        isListening = true;
                    } catch (e2) {
                        console.error("Retry start error:", e2);
                        isListening = false;
                    }
                }
                updateMicButtonState();
            }, 1000);
        }
    }
    updateMicButtonState(); // Update UI after action
});

// Handle recognition events for continuous mode
if (recognition) {
    recognition.onresult = (e) => {
        // Process all results, not just final ones, for better responsiveness
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript.trim();
            if (transcript) {
                console.log(`🎤 Recognized (final: ${e.results[i].isFinal}):`, transcript);
                if (e.results[i].isFinal) {
                    // Final result: send as message
                    userInput.value = transcript;
                    sendMessage();
                } else {
                    // Interim result: could update UI live if desired
                    // e.g., show interim text in input field
                    // userInput.value = transcript;
                }
            }
        }
    };

    recognition.onerror = (e) => {
        console.error("🎤 Speech recognition error:", e.error);
        // Handle specific errors
        if (e.error === 'no-speech') {
            console.log("🎤 No speech detected, continuing to listen...");
            // Recognition will automatically restart due to continuous=true
        } else if (e.error === 'audio-capture') {
            console.error("🎤 No microphone found.");
            micButton.title = "No microphone found";
            micButton.style.backgroundColor = "#ff6b6b";
            micButton.innerHTML = "🔴";
            isListening = false;
        } else if (e.error === 'not-allowed') {
            console.error("🎤 Permission to use microphone was denied.");
            micButton.title = "Mic access denied";
            micButton.style.backgroundColor = "#ff6b6b";
            micButton.innerHTML = "🔴";
            isListening = false;
        } else {
            console.warn("🎤 Other recognition error, attempting restart...");
            isListening = false; // Assume stopped on error
        }
        updateMicButtonState();
    };

    recognition.onend = () => {
        console.log("🎤 Speech recognition ended.");
        // In continuous mode, it should restart automatically, but let's be safe
        if (isListening) {
            console.log("🔁 Attempting to restart continuous recognition...");
            setTimeout(() => {
                if (isListening && recognition) {
                    try {
                        // Fix 6: Wrap start in try/catch
                        recognition.start();
                        console.log("🎤 Recognition restarted.");
                    } catch (e) {
                        console.error("🔁 Error restarting recognition:", e);
                        isListening = false;
                        updateMicButtonState();
                    }
                }
            }, 500);
        } else {
            // If intentionally stopped, just update UI
            updateMicButtonState();
        }
    };

    recognition.onstart = () => {
        console.log("🎤 Speech recognition started.");
        isListening = true;
        updateMicButtonState();
    };
}

// Voice Toggle
voiceButton.addEventListener("click", () => {
    isVoiceResponseEnabled = !isVoiceResponseEnabled;
    localStorage.setItem("voiceEnabled", isVoiceResponseEnabled); // Fix: Store boolean as string correctly
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
    installButton.hidden = false;
});

// Optional: Hide install button permanently after installation
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    installButton.hidden = true;
    // Persist this state if needed across reloads
    localStorage.setItem('appInstalled', 'true');
});

// Check persisted state on load for install button
if (localStorage.getItem('appInstalled') === 'true') {
    installButton.hidden = true;
}

// Helper function to check if message is a command
function isCommand(lower) {
    const commands = [
        "install", "download", "pwa", "add task", "show tasks", "clear tasks",
        "add expense", "show expenses", "clear expenses", "play game",
        "stone", "paper", "scissors", "rock", "solve", "quiz", "version",
        "my name", "your name", "my age", "your age", "hi", "help", "time"
    ];
    return commands.some(cmd => lower.includes(cmd));
}

// Initial UI update
updateMicButtonState();