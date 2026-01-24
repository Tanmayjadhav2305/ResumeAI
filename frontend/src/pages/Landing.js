import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, CheckCircle, ArrowRight, Lock } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { API_BASE_URL } from "../config";

const API = API_BASE_URL;


const Landing = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/send-otp`, { email });
      setShowOtpInput(true);
      setOtpSent(true);
      toast.success("OTP sent to your email!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/verify-otp`, { 
        email, 
        otp_code: otp 
      });
      
      localStorage.setItem('userId', response.data.user_id);
      localStorage.setItem('userEmail', response.data.email);
      localStorage.setItem('usageCount', response.data.usage_count);
      
      setUser({
        id: response.data.user_id,
        email: response.data.email,
        usage_count: response.data.usage_count
      });
      
      toast.success("Logged in successfully!");
      navigate('/analyze');
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  // Don't render if user exists - will redirect via useEffect
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navbar */}
      <nav className="navbar px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Resume<span className="text-[#00DC82]">AI</span>
          </h1>
          <button
            onClick={() => navigate('/pricing')}
            className="btn-secondary"
            data-testid="nav-pricing-btn"
          >
            Pricing
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h1 
              className="text-4xl md:text-6xl font-bold tracking-tight mb-6 fade-in"
              style={{ fontFamily: 'Outfit, sans-serif' }}
              data-testid="hero-title"
            >
              Transform Your Resume with
              <span className="text-[#00DC82]"> AI Precision</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-12 leading-relaxed">
              Get instant ATS analysis, actionable improvements, and role-specific optimization.
              Built for professionals who mean business.
            </p>

            {/* Auth Card */}
            <div className="glass-card max-w-md mx-auto p-8">
              {!showOtpInput ? (
                <>
                  <h3 className="text-xl font-semibold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Get Started - Free Analysis
                  </h3>
                  <form onSubmit={handleSendOtp}>
                    <div className="mb-4">
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-[#00DC82] focus:border-transparent transition-all placeholder:text-white/20"
                        data-testid="email-input"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                      data-testid="get-otp-btn"
                    >
                      {loading ? "Sending..." : (
                        <>
                          <Mail size={20} />
                          Send OTP
                        </>
                      )}
                    </button>
                  </form>
                  <p className="text-sm text-gray-500 mt-4">
                    We'll send you a secure one-time code.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-16 h-16 text-[#00DC82] mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    OTP Sent!
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Enter the 6-digit code sent to<br /><span className="text-[#00DC82] font-semibold">{email}</span>
                  </p>
                  <form onSubmit={handleVerifyOtp}>
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength="6"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-4xl text-center font-mono focus:ring-2 focus:ring-[#00DC82] focus:border-transparent transition-all tracking-widest"
                        data-testid="otp-input"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="verify-otp-btn"
                    >
                      {loading ? "Verifying..." : (
                        <>
                          <Lock size={20} />
                          Verify & Continue
                        </>
                      )}
                    </button>
                  </form>
                  <button
                    onClick={() => {
                      setShowOtpInput(false);
                      setOtp("");
                    }}
                    className="text-sm text-gray-500 hover:text-gray-400 mt-4 transition-colors"
                  >
                    Back to email
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 md:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6" data-testid="feature-ats-analysis">
              <div className="w-12 h-12 bg-[#00DC82]/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-[#00DC82]" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                ATS Optimization
              </h3>
              <p className="text-gray-400">
                Ensure your resume passes applicant tracking systems with data-driven insights.
              </p>
            </div>

            <div className="glass-card p-6" data-testid="feature-ai-improvements">
              <div className="w-12 h-12 bg-[#00DC82]/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-[#00DC82]" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                AI-Powered Rewrites
              </h3>
              <p className="text-gray-400">
                Get professional bullet point improvements that highlight your impact.
              </p>
            </div>

            <div className="glass-card p-6" data-testid="feature-role-targeting">
              <div className="w-12 h-12 bg-[#00DC82]/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-[#00DC82]" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Role-Specific Tips
              </h3>
              <p className="text-gray-400">
                Tailor your resume for specific roles with targeted recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A0A0A] border-t border-gray-900 mt-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <h3 className="text-xl font-bold mb-2">
                Resume<span className="text-[#00DC82]">AI</span>
              </h3>
              <p className="text-gray-400 text-sm">
                AI-powered resume analysis to help you land your dream job.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => navigate('/analyze')}
                    className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                  >
                    Analyze Resume
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate('/pricing')}
                    className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="#about"
                    className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a 
                    href="#contact"
                    className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="#privacy"
                    className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a 
                    href="#terms"
                    className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                  >
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-900 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">
                © 2026 ResumeAI. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a 
                  href="#twitter"
                  className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                >
                  Twitter
                </a>
                <a 
                  href="#linkedin"
                  className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                >
                  LinkedIn
                </a>
                <a 
                  href="#github"
                  className="text-gray-400 hover:text-[#00DC82] transition text-sm"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;