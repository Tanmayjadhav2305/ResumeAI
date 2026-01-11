import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Loader2 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Analyze = ({ user }) => {
  const navigate = useNavigate();
  const [resumeText, setResumeText] = useState("");
  const [roleTarget, setRoleTarget] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [inputMode, setInputMode] = useState("text"); // "text" or "upload"

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setInputMode("upload");
    } else {
      toast.error("Please upload a PDF file");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setInputMode("upload");
    } else {
      toast.error("Please upload a PDF file");
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim() && !file) {
      toast.error("Please provide your resume");
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.id);
        if (roleTarget) formData.append('role_target', roleTarget);
        
        response = await axios.post(`${API}/analyze/pdf?user_id=${user.id}&role_target=${roleTarget}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await axios.post(`${API}/analyze/text?user_id=${user.id}`, {
          resume_text: resumeText,
          role_target: roleTarget || null
        });
      }
      
      localStorage.setItem('usageCount', user.usage_count + 1);
      toast.success("Analysis complete!");
      navigate(`/results/${response.data.analysis_id}`);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("Usage limit reached. Please upgrade.");
        setTimeout(() => navigate('/pricing'), 1500);
      } else {
        toast.error(error.response?.data?.detail || "Analysis failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navbar */}
      <nav className="navbar px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 
            className="text-2xl font-bold cursor-pointer" 
            style={{ fontFamily: 'Outfit, sans-serif' }}
            onClick={() => navigate('/dashboard')}
            data-testid="nav-logo"
          >
            Resume<span className="text-[#00DC82]">AI</span>
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
              data-testid="nav-dashboard-btn"
            >
              Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <section className="px-4 md:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 
            className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-center"
            style={{ fontFamily: 'Outfit, sans-serif' }}
            data-testid="analyze-title"
          >
            Analyze Your Resume
          </h1>
          <p className="text-center text-gray-400 mb-12">
            Upload a PDF or paste your resume text below
          </p>

          {/* Input Mode Toggle */}
          <div className="flex gap-4 mb-8 justify-center">
            <button
              onClick={() => setInputMode("text")}
              className={inputMode === "text" ? "btn-primary" : "btn-secondary"}
              data-testid="toggle-text-mode"
            >
              <FileText size={20} className="inline mr-2" />
              Paste Text
            </button>
            <button
              onClick={() => setInputMode("upload")}
              className={inputMode === "upload" ? "btn-primary" : "btn-secondary"}
              data-testid="toggle-upload-mode"
            >
              <Upload size={20} className="inline mr-2" />
              Upload PDF
            </button>
          </div>

          <div className="glass-card p-8 mb-6">
            {inputMode === "text" ? (
              <div>
                <label className="block text-sm font-medium mb-2">Resume Text</label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume content here..."
                  rows="12"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-[#00DC82] focus:border-transparent transition-all placeholder:text-white/20 resize-none"
                  data-testid="resume-text-input"
                />
              </div>
            ) : (
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
                data-testid="upload-zone"
              >
                <Upload className="w-16 h-16 text-[#00DC82] mx-auto mb-4" />
                {file ? (
                  <p className="text-lg">
                    <span className="text-[#00DC82]">✓</span> {file.name}
                  </p>
                ) : (
                  <>
                    <p className="text-lg mb-2">Drop your PDF here or click to browse</p>
                    <p className="text-sm text-gray-500">PDF files only</p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Target Role (Optional)</label>
              <input
                type="text"
                value={roleTarget}
                onChange={(e) => setRoleTarget(e.target.value)}
                placeholder="e.g., Frontend Developer, Product Manager"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-[#00DC82] focus:border-transparent transition-all placeholder:text-white/20"
                data-testid="role-target-input"
              />
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || (!resumeText.trim() && !file)}
            className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2"
            data-testid="analyze-btn"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Analyzing...
              </>
            ) : (
              "Analyze Resume"
            )}
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Remaining analyses: {3 - user.usage_count} / 3
          </p>
        </div>
      </section>
    </div>
  );
};

export default Analyze;