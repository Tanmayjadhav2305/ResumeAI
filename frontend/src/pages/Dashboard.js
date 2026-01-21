import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, LogOut, Plus, Clock } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { API_BASE_URL } from "../config";

const API = API_BASE_URL;


const Dashboard = ({ user, logout }) => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUsage, setCurrentUsage] = useState(user.usage_count);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch fresh user data and analyses
        const [userResponse, analysesResponse] = await Promise.all([
          axios.get(`${API}/user/${user.id}`),
          axios.get(`${API}/analyses/${user.id}`)
        ]);
        
        setCurrentUsage(userResponse.data.usage_count);
        setAnalyses(analysesResponse.data.analyses);
        
        // Update localStorage
        localStorage.setItem('usageCount', userResponse.data.usage_count);
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <button
            onClick={logout}
            className="btn-secondary flex items-center gap-2"
            data-testid="logout-btn"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <section className="px-4 md:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
            <div>
              <h1 
                className="text-3xl md:text-5xl font-bold tracking-tight mb-2"
                style={{ fontFamily: 'Outfit, sans-serif' }}
                data-testid="dashboard-title"
              >
                Dashboard
              </h1>
              <p className="text-gray-400">{user.email}</p>
            </div>
            <button
              onClick={() => navigate('/analyze')}
              className="btn-primary flex items-center gap-2"
              data-testid="new-analysis-btn"
            >
              <Plus size={20} />
              New Analysis
            </button>
          </div>

          {/* Usage Stats */}
          <div className="glass-card p-6 mb-8" data-testid="usage-stats">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400 mb-1">Free Tier Usage</p>
                <p className="text-2xl font-bold">
                  {currentUsage} <span className="text-gray-500">/ 3</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">Remaining</p>
                <p className="text-2xl font-bold text-[#00DC82]">{3 - currentUsage}</p>
              </div>
            </div>
            {currentUsage >= 3 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-sm text-yellow-500 mb-2">You've reached your free tier limit</p>
                <button
                  onClick={() => navigate('/pricing')}
                  className="btn-primary text-sm"
                  data-testid="upgrade-cta-btn"
                >
                  Upgrade Now
                </button>
              </div>
            )}
          </div>

          {/* Analyses History */}
          <div>
            <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Your Analyses
            </h2>
            
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : analyses.length === 0 ? (
              <div className="glass-card p-12 text-center" data-testid="no-analyses">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No analyses yet</p>
                <button
                  onClick={() => navigate('/analyze')}
                  className="btn-primary"
                  data-testid="get-started-btn"
                >
                  Get Started
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    onClick={() => navigate(`/results/${analysis.id}`)}
                    className="glass-card p-6 cursor-pointer hover:border-[#00DC82] transition-colors"
                    data-testid={`analysis-item-${analysis.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="text-[#00DC82]" size={24} />
                          <div>
                            <h3 className="font-semibold">Resume Analysis</h3>
                            <p className="text-sm text-gray-400 flex items-center gap-1">
                              <Clock size={14} />
                              {formatDate(analysis.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                          {analysis.analysis_result.strengths[0] || "Resume analyzed successfully"}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-[#00DC82]">
                          {analysis.analysis_result.overall_score}
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;