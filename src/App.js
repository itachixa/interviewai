import { useState, useRef, useEffect } from "react";
import axios from "axios";

function App() {
  const API = "https://ai-interviewer-backend-7gxf.onrender.com/";

  const [cvText, setCvText] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);

  const [typing, setTyping] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);

  const [listening, setListening] = useState(false);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // 🔽 AUTO SCROLL
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🎧 VOICE + AVATAR
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    setAvatarSpeaking(true);
    utterance.onend = () => setAvatarSpeaking(false);
    speechSynthesis.speak(utterance);
  };

  // ✨ TYPE EFFECT
  const typeMessage = async (text) => {
    setTyping(true);
    let displayed = "";

    for (let i = 0; i < text.length; i++) {
      displayed += text[i];

      // ⚡ Fix no-loop-func by using callback
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "ai_typing") {
          return [...prev.slice(0, -1), { role: "ai_typing", text: displayed }];
        }
        return [...prev, { role: "ai_typing", text: displayed }];
      });

      await new Promise((res) => setTimeout(res, 15));
    }

    setMessages((prev) => [...prev.slice(0, -1), { role: "ai", text }]);
    setTyping(false);
    speak(text);
  };

  // 📄 UPLOAD CV
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post(`${API}/upload-cv`, formData);
    setCvText(res.data.cv_text);
    alert("✅ CV uploaded!");
  };

  // 🚀 START INTERVIEW
  const startInterview = async () => {
    if (!cvText) {
      alert("Upload CV first!");
      return;
    }
    const res = await axios.post(`${API}/questions`, { cv_text: cvText });
    setQuestions(res.data.questions);
    setCurrentIndex(0);

    if (res.data.questions.length > 0) {
      await typeMessage(res.data.questions[0]);
    }
  };

  // 💬 SEND ANSWER
  const sendMessage = async () => {
    if (!input) return;

    const updatedAnswers = [...answers, input];
    setAnswers(updatedAnswers);
    setMessages((prev) => [...prev, { role: "user", text: input }]);

    const res = await axios.post(`${API}/evaluate`, { answer: input });
    await typeMessage(res.data.feedback);

    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      await typeMessage(questions[nextIndex]);
    } else {
      const final = await axios.post(`${API}/final`, { answers: updatedAnswers });
      await typeMessage("📊 FINAL REPORT");
      await typeMessage(final.data.result);
    }

    setInput("");
  };

  // 🎤 START MICRO
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  // ⏹ STOP MICRO
  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // 🗑 CLEAR INPUT
  const clearInput = () => setInput("");

  return (
    <div style={styles.container}>
      <h1>🤖 AI Interviewer</h1>

      {/* 🎥 AVATAR */}
      <div style={styles.avatarBox}>
        <div
          style={{
            ...styles.avatar,
            transform: avatarSpeaking ? "scale(1.2)" : "scale(1)",
          }}
        >
          🤖
        </div>
      </div>

      {/* 📄 CV */}
      <input type="file" onChange={handleUpload} style={{ margin: 10 }} />
      <button onClick={startInterview} style={styles.startBtn}>
        Start Interview
      </button>

      {/* 💬 CHAT */}
      <div style={styles.chat}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.msg,
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#2563eb" : "#1f2937",
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT FIXED */}
      <div style={styles.inputBox}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={styles.input}
          placeholder="Type or speak..."
        />
        {!listening ? (
          <button onClick={startListening} style={styles.micBtn}>
            🎤
          </button>
        ) : (
          <button onClick={stopListening} style={styles.stopBtn}>
            ⏹
          </button>
        )}
        <button onClick={clearInput} style={styles.clearBtn}>
          ❌
        </button>
        <button onClick={sendMessage} style={styles.sendBtn}>
          ➤
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { background: "#0b1120", color: "white", height: "100vh", display: "flex", flexDirection: "column", padding: 10 },
  avatarBox: { display: "flex", justifyContent: "center", margin: 10 },
  avatar: { fontSize: 50, transition: "0.3s" },
  startBtn: { margin: "10px auto", padding: 10, background: "#2563eb", border: "none", color: "white", borderRadius: 8 },
  chat: { flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10 },
  msg: { padding: 12, borderRadius: 10, maxWidth: "70%" },
  inputBox: { display: "flex", padding: 10, background: "#020617", position: "sticky", bottom: 0 },
  input: { flex: 1, padding: 10, borderRadius: 8, border: "none" },
  sendBtn: { marginLeft: 10, padding: "0 15px", background: "#2563eb", border: "none", color: "white", borderRadius: 8 },
  micBtn: { marginLeft: 5, padding: "0 10px", background: "#111827", border: "none", color: "white", borderRadius: 8 },
  stopBtn: { marginLeft: 5, padding: "0 10px", background: "#dc2626", border: "none", color: "white", borderRadius: 8 },
  clearBtn: { marginLeft: 5, padding: "0 10px", background: "#374151", border: "none", color: "white", borderRadius: 8 },
};

export default App;