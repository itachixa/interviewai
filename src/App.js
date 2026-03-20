import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  // Backend API URL - configure via environment variable
  const API = process.env.REACT_APP_API_URL || "https://ai-interviewer-backend-gbkc.onrender.com";

  // State
  const [cvText, setCvText] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  
  // Configuration
  const [jobLevel, setJobLevel] = useState("intermediate");
  const [role, setRole] = useState("General");
  
  // Loading states
  const [uploading, setUploading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Text to speech
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    setAvatarSpeaking(true);
    utterance.onend = () => setAvatarSpeaking(false);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

  // Type message with animation
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

  // Handle CV upload
  const handleUpload = async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert("❌ Please upload a PDF file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ File too large. Maximum size is 10MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/upload-cv`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      if (res.data.success) {
        setCvText(res.data.cv_text);
        setMessages([{ 
          role: "system", 
          text: "✅ CV uploaded successfully! Select your target job level and role, then start the interview." 
        }]);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || "Error uploading CV";
      alert(`❌ ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleUpload(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  // Start interview
  const startInterview = async () => {
    if (!cvText) {
      alert("Please upload your CV first.");
      return;
    }
    
    setHasStarted(true);
    setShowResults(false);
    setFinalResults(null);
    setMessages([]);
    setAnswers([]);
    setEvaluations([]);
    setCurrentIndex(0);
    
    setLoadingQuestions(true);
    
    try {
      const res = await axios.post(`${API}/questions`, { 
        cv_text: cvText,
        level: jobLevel,
        role: role
      });
      
      setQuestions(res.data.questions);
      
      // Add initial message
      setMessages([{
        role: "ai",
        text: `Hello! I'm your AI interviewer. I'll ask you ${res.data.questions.length} questions based on your CV for a ${jobLevel} level ${role} position. Let's begin!`
      }]);
      
      // Ask first question after a brief delay
      setTimeout(async () => {
        setLoadingQuestions(false);
        await typeMessage(res.data.questions[0]);
      }, 500);
      
    } catch (err) {
      console.error(err);
      alert("❌ Error generating questions");
      setLoadingQuestions(false);
      setHasStarted(false);
    }
  };

  // Submit answer
  const sendMessage = async () => {
    if (!input.trim()) return;
    if (submitting || typing) return;

    const userAnswer = input.trim();
    const currentQuestion = questions[currentIndex];
    
    setSubmitting(true);
    
    // Add user answer to messages
    const updatedAnswers = [...answers, userAnswer];
    setAnswers(updatedAnswers);
    setMessages((prev) => [...prev, { role: "user", text: userAnswer }]);
    setInput("");

    try {
      // Evaluate the answer
      const res = await axios.post(`${API}/evaluate`, { 
        answer: userAnswer,
        question: currentQuestion
      });
      
      const evaluation = res.data;
      setEvaluations(prev => [...prev, evaluation]);
      
      // Show feedback
      await typeMessage(evaluation.feedback);

      // Check if there are more questions
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < questions.length) {
        setCurrentIndex(nextIndex);
        
        // Ask next question after feedback
        setTimeout(async () => {
          await typeMessage(questions[nextIndex]);
        }, 1500);
      } else {
        // All questions answered - get final evaluation
        setTimeout(async () => {
          await getFinalEvaluation(updatedAnswers);
        }, 1500);
      }
      
    } catch (err) {
      console.error(err);
      alert("❌ Error evaluating answer");
    } finally {
      setSubmitting(false);
    }
  };

  // Get final evaluation
  const getFinalEvaluation = async (allAnswers) => {
    try {
      const res = await axios.post(`${API}/final`, { 
        answers: allAnswers,
        questions: questions
      });
      
      setFinalResults(res.data);
      setShowResults(true);
      
      // Show final report
      await typeMessage("📊 FINAL INTERVIEW REPORT");
      await typeMessage(res.data.detailed_report);
      
    } catch (err) {
      console.error(err);
      alert("❌ Error generating final report");
    }
  };

  // Voice recognition
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results.map((result) => result[0].transcript).join("");
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
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

  // Reset interview
  const resetInterview = () => {
    setHasStarted(false);
    setShowResults(false);
    setFinalResults(null);
    setQuestions([]);
    setAnswers([]);
    setEvaluations([]);
    setMessages([]);
    setCurrentIndex(0);
    setCvText("");
  };

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
          
          {/* Level and Role Selection */}
          <div className="config-section">
            <div className="config-row">
              <div className="config-group">
                <label>Target Job Level:</label>
                <select 
                  value={jobLevel} 
                  onChange={(e) => setJobLevel(e.target.value)}
                  className="level-select"
                >
                  <option value="junior">Junior (0-2 years)</option>
                  <option value="intermediate">Intermediate (2-5 years)</option>
                  <option value="senior">Senior (5+ years)</option>
                  <option value="lead">Lead</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              
              <div className="config-group">
                <label>Position/Role:</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Software Engineer, Product Manager"
                  className="role-input"
                />
              </div>
            </div>
          </div>
          
          <div className="upload-content">
            <label 
              className={`upload-box ${cvText ? "has-file" : ""} ${uploading ? "uploading" : ""} ${dragOver ? "drag-over" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden-input"
                id="file-upload"
                disabled={uploading}
              />
              <div className="upload-icon">
                {uploading ? (
                  <div className="upload-spinner"></div>
                ) : cvText ? "✅" : "📄"}
              </div>
              <div className="upload-text">
                {uploading ? (
                  <span className="uploading-text">Processing <strong>CV...</strong></span>
                ) : cvText ? (
                  <><span className="success-text">✓ CV Uploaded Successfully!</span></>
                ) : (
                  <><span className="drag-text">Drag & drop your CV here</span><span className="or-text">or click to browse</span><span className="format-text">(PDF only, max 10MB)</span></>
                )}
              </div>
              {cvText && !uploading && (
                <div className="file-info">
                  <span className="file-name">📎 CV uploaded</span>
                </div>
              )}
            </label>
            
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={hasStarted ? resetInterview : startInterview}
                disabled={!cvText || loadingQuestions || uploading}
              >
                {hasStarted ? "🔄 Restart Interview" : "🚀 Start Interview"}
              </button>
            </div>
          </div>
        </section>

        {/* Interview Section */}
        {!hasStarted ? (
          <div className="welcome-screen">
            <div className="welcome-icon">🎯</div>
            <h2 className="welcome-title">Ready to Practice?</h2>
            <p className="welcome-subtitle">
              Upload your CV, select your target level, and start practicing interview questions. 
              Get real-time feedback and improve your responses.
            </p>
            
            {/* Features */}
            <div className="features-grid">
              <div className="feature-card">
                <span className="feature-icon">📄</span>
                <h3>CV Analysis</h3>
                <p>Questions tailored to your experience</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">💬</span>
                <h3>Real-time Feedback</h3>
                <p>Get instant evaluation after each answer</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">📊</span>
                <h3>Final Report</h3>
                <p>Comprehensive analysis with recommendations</p>
              </div>
            </div>
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
                  Question {showResults ? questions.length : currentIndex + 1} of {questions.length}
                </p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: showResults ? "100%" : `${progress}%` }}
                  />
                </div>
              </div>
              
              {/* Current evaluation display */}
              {evaluations.length > 0 && !showResults && (
                <div className="current-score">
                  <p>Last Answer Score</p>
                  <div className="score-ring">
                    <span className="score-value">{evaluations[evaluations.length - 1]?.score || 0}</span>
                  </div>
                </div>
              )}
              
              {/* Final results button */}
              {showResults && finalResults && (
                <div className="final-score-display">
                  <p>Final Score</p>
                  <div className="score-ring large">
                    <span className="score-value">{finalResults.overall_score}</span>
                  </div>
                </div>
              )}
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
                {messages.length === 0 && !loadingQuestions && (
                  <div className="message message-ai">
                    Hello! I'm your AI interviewer. I'll ask you questions based on your CV, 
                    and you can answer by typing or speaking. Let's begin!
                  </div>
                )}
                
                {loadingQuestions && (
                  <div className="message message-system">
                    ⏳ Generating personalized questions based on your CV...
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

              {/* Input Area - Hidden during results */}
              {!showResults && (
                <div className="input-area">
                  <div className="input-wrapper">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="message-input"
                      placeholder="Type your answer..."
                      disabled={typing || submitting || loadingQuestions}
                    />
                  </div>
                  <button
                    className={`input-btn btn-mic ${listening ? "active" : ""}`}
                    onClick={listening ? stopListening : startListening}
                    title={listening ? "Stop listening" : "Start voice input"}
                    disabled={typing || submitting}
                  >
                    {listening ? "🔴" : "🎤"}
                  </button>
                  <button
                    className="input-btn btn-clear"
                    onClick={clearInput}
                    title="Clear input"
                    disabled={typing || submitting}
                  >
                    ✕
                  </button>
                  <button
                    className="input-btn btn-send"
                    onClick={sendMessage}
                    disabled={!input.trim() || typing || submitting || loadingQuestions}
                    title="Send answer"
                  >
                    {submitting ? "⏳" : "➤"}
                  </button>
                </div>
              )}
              
              {/* Results Summary */}
              {showResults && finalResults && (
                <div className="results-summary">
                  <div className="results-header">
                    <h3>📊 Interview Complete!</h3>
                    <button className="btn btn-secondary" onClick={resetInterview}>
                      Start New Interview
                    </button>
                  </div>
                  
                  <div className="results-grid">
                    <div className="result-card">
                      <h4>Overall Score</h4>
                      <div className="big-score">{finalResults.overall_score}/100</div>
                    </div>
                    <div className="result-card">
                      <h4>Fluency</h4>
                      <div className="sub-score">{finalResults.average_scores.fluency}/100</div>
                    </div>
                    <div className="result-card">
                      <h4>Confidence</h4>
                      <div className="sub-score">{finalResults.average_scores.confidence}/100</div>
                    </div>
                    <div className="result-card">
                      <h4>Accuracy</h4>
                      <div className="sub-score">{finalResults.average_scores.correctness}/100</div>
                    </div>
                  </div>
                  
                  {finalResults.strengths.length > 0 && (
                    <div className="result-section">
                      <h4>✅ Strengths</h4>
                      <ul>
                        {finalResults.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  
                  {finalResults.areas_for_improvement.length > 0 && (
                    <div className="result-section">
                      <h4>⚠️ Areas for Improvement</h4>
                      <ul>
                        {finalResults.areas_for_improvement.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  
                  {finalResults.recommendations.length > 0 && (
                    <div className="result-section">
                      <h4>💡 Recommendations</h4>
                      <ul>
                        {finalResults.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
