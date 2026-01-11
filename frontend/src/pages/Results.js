import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, TrendingUp } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ScoreRing = ({ score }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="score-ring">
      <svg width="140" height="140">
        <circle
          className="bg-circle"
          cx="70"
          cy="70"
          r={radius}
        />
        <circle
          className="fg-circle"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-3xl font-bold text-[#00DC82]">{score}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
};

const Results = ({ user }) => {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await axios.get(`${API}/analyses/${user.id}`);
        const found = response.data.analyses.find(a => a.id === analysisId);
        if (found) {
          setAnalysis(found);
        } else {
          toast.error("Analysis not found");
          navigate('/dashboard');
        }
      } catch (error) {
        toast.error("Failed to load analysis");
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [analysisId, user.id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-[#00DC82] text-xl">Loading analysis...</div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const result = analysis.analysis_result;

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
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary flex items-center gap-2"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft size={18} />
            Dashboard
          </button>
        </div>
      </nav>

      {/* Results */}
      <section className="px-4 md:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <h1 
            className="text-3xl md:text-5xl font-bold tracking-tight mb-12 text-center"
            style={{ fontFamily: 'Outfit, sans-serif' }}
            data-testid="results-title"
          >
            Your Resume Analysis
          </h1>

          {/* Score Card */}
          <div className="glass-card p-8 mb-8 text-center" data-testid="overall-score-card">
            <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Overall Score
            </h2>
            <div className="flex justify-center mb-4">
              <ScoreRing score={result.overall_score} />
            </div>
            <p className="text-gray-400">Your resume is performing {result.overall_score >= 70 ? 'well' : 'below average'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Strengths */}
            <div className="analysis-card" data-testid="strengths-card">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="text-[#00DC82]" size={24} />
                <h3 className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Strengths</h3>
              </div>
              <ul className="space-y-2">
                {result.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2" data-testid={`strength-${idx}`}>
                    <span className="text-[#00DC82] mt-1">•</span>
                    <span className="text-gray-300">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="analysis-card" data-testid="weaknesses-card">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="text-red-500" size={24} />
                <h3 className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Weaknesses</h3>
              </div>
              <ul className="space-y-2">
                {result.weaknesses.map((weakness, idx) => (
                  <li key={idx} className="flex items-start gap-2" data-testid={`weakness-${idx}`}>
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-gray-300">{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ATS Issues */}
          <div className="analysis-card mb-8" data-testid="ats-issues-card">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="text-yellow-500" size={24} />
              <h3 className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>ATS Issues</h3>
            </div>
            <ul className="space-y-2">
              {result.ats_issues.map((issue, idx) => (
                <li key={idx} className="flex items-start gap-2" data-testid={`ats-issue-${idx}`}>
                  <span className="text-yellow-500 mt-1">•</span>
                  <span className="text-gray-300">{issue}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improved Bullets */}
          <div className="analysis-card mb-8" data-testid="improved-bullets-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-[#00DC82]" size={24} />
              <h3 className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Improved Bullet Points</h3>
            </div>
            <div className="space-y-4">
              {result.improved_bullets.map((bullet, idx) => (
                <div key={idx} className="bullet-comparison" data-testid={`bullet-comparison-${idx}`}>
                  <div className="original mb-3">
                    <span className="text-xs font-semibold uppercase text-red-400">Before</span>
                    <p className="mt-1">{bullet.original}</p>
                  </div>
                  <div className="improved">
                    <span className="text-xs font-semibold uppercase text-[#00DC82]">After</span>
                    <p className="mt-1">{bullet.improved}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="analysis-card" data-testid="recommendations-card">
            <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Recommendations</h3>
            <ul className="space-y-2">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2" data-testid={`recommendation-${idx}`}>
                  <span className="text-[#00DC82] mt-1">→</span>
                  <span className="text-gray-300">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/analyze')}
              className="btn-primary text-lg"
              data-testid="analyze-another-btn"
            >
              Analyze Another Resume
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Results;