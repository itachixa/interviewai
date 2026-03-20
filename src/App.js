import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  // Backend API URL
  // Use localhost for development, Render for production
  const API = process.env.REACT_APP_API_URL || "https://ai-interviewer-backend-gbkc.onrender.com/";

  const [cvText, setCvText] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    setAvatarSpeaking(true);
    utterance.onend = () => setAvatarSpeaking(false);
    speechSynthesis.speak(utterance);
  };

  // 🔹 TYPE MESSAGE SAFE LOOP
  const typeMessage = async (text) => {
    setTyping(true);
    let displayed = "";

    const updateMessage = (currentText) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "ai_typing") {
          return [...prev.slice(0, -1), { role: "ai_typing", text: currentText }];
        }
        return [...prev, { role: "ai_typing", text: currentText }];
      });
    };

    for (let i = 0; i < text.length; i++) {
      displayed += text[i];
      updateMessage(displayed);
      await new Promise((res) => setTimeout(res, 15));
    }

    setMessages((prev) => [...prev.slice(0, -1), { role: "ai", text }]);
    setTyping(false);
    speak(text);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}upload-cv`, formData);
      setCvText(res.data.cv_text);
    } catch (err) {
      console.error(err);
      alert("❌ Error uploading CV");
    }
  };

  const startInterview = async () => {
    if (!cvText) {
      alert("Please upload your CV first.");
      return;
    }
    setHasStarted(true);
    try {
      const res = await axios.post(`${API}questions`, { cv_text: cvText });
      setQuestions(res.data.questions);
      setCurrentIndex(0);
      await typeMessage(res.data.questions[0]);
    } catch (err) {
      console.error(err);
      alert("❌ Error starting interview");
    }
  };

  const sendMessage = async () => {
    if (!input) return;

    const updatedAnswers = [...answers, input];
    setAnswers(updatedAnswers);
    setMessages((prev) => [...prev, { role: "user", text: input }]);
    setInput("");

    try {
      const res = await axios.post(`${API}evaluate`, { answer: input });
      await typeMessage(res.data.feedback);

      const nextIndex = currentIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentIndex(nextIndex);
        await typeMessage(questions[nextIndex]);
      } else {
        const final = await axios.post(`${API}final`, { answers: updatedAnswers });
        await typeMessage("📊 FINAL REPORT");
        await typeMessage(final.data.result);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error sending message");
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results.map((result) => result[0].transcript).join("");
      setInput(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const clearInput = () => setInput("");

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🤖</div>
          <div>
            <h1 className="app-title">AI Interviewer</h1>
            <p className="app-subtitle">Practice makes perfect</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Upload Section */}
        <section className="upload-section">
          <h2>📄 Upload Your CV to Begin</h2>
          <div className="upload-content">
            <label className={`upload-box ${cvText ? "has-file" : ""}`}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleUpload}
                className="hidden-input"
                id="file-upload"
              />
              <div className="upload-icon">{cvText ? "✅" : "📎"}</div>
              <div className="upload-text">
                {cvText ? (
                  <>CV <strong>Uploaded Successfully!</strong></>
                ) : (
                  <>Click to upload <strong>CV</strong> (PDF, DOC, TXT)</>
                )}
              </div>
            </label>
            <button
              className="btn btn-primary"
              onClick={startInterview}
              disabled={!cvText}
            >
              🚀 {hasStarted ? "Restart Interview" : "Start Interview"}
            </button>
          </div>
        </section>

        {/* Interview Section */}
        {!hasStarted ? (
          <div className="welcome-screen">
            <div className="welcome-icon">🎯</div>
            <h2 className="welcome-title">Ready to Practice?</h2>
            <p className="welcome-subtitle">
              Upload your CV and start practicing interview questions. 
              Get real-time feedback and improve your responses.
            </p>
          </div>
        ) : (
          <section className="interview-section">
            {/* Avatar Panel */}
            <aside className="avatar-panel">
              <div className={`avatar-container ${avatarSpeaking ? "speaking" : ""}`}>
                <span className="avatar-emoji">🤖</span>
              </div>
              <p className={`avatar-status ${avatarSpeaking ? "active" : ""}`}>
                {avatarSpeaking ? "Speaking..." : "Listening"}
              </p>
              
              <div className="question-progress">
                <p className="progress-text">
                  Question {currentIndex + 1} of {questions.length || "?"}
                </p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </aside>

            {/* Chat Container */}
            <div className="chat-container">
              <div className="chat-header">
                <span className="chat-header-title">💬 Interview Chat</span>
                {typing && (
                  <div className="typing-indicator">
                    <span>AI is typing</span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                )}
              </div>

              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="message message-ai">
                    Hello! I'm your AI interviewer. I'll ask you questions based on your CV, 
                    and you can answer by typing or speaking. Let's begin!
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`message ${
                      msg.role === "user"
                        ? "message-user"
                        : msg.role === "system"
                        ? "message-system"
                        : "message-ai"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="input-area">
                <div className="input-wrapper">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="message-input"
                    placeholder="Type your answer..."
                    disabled={typing}
                  />
                </div>
                <button
                  className={`input-btn btn-mic ${listening ? "active" : ""}`}
                  onClick={listening ? stopListening : startListening}
                  title={listening ? "Stop listening" : "Start voice input"}
                >
                  {listening ? "🔴" : "🎤"}
                </button>
                <button
                  className="input-btn btn-clear"
                  onClick={clearInput}
                  title="Clear input"
                >
                  ✕
                </button>
                <button
                  className="input-btn btn-send"
                  onClick={sendMessage}
                  disabled={!input || typing}
                  title="Send answer"
                >
                  ➤
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
