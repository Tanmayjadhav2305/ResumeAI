import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";

const Pricing = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navbar */}
      <nav className="navbar px-4 sm:px-6 md:px-8 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
          <h1 
            className="text-lg sm:text-2xl font-bold cursor-pointer flex-shrink-0" 
            style={{ fontFamily: 'Outfit, sans-serif' }}
            onClick={() => navigate('/')}
            data-testid="nav-logo"
          >
            Resume<span className="text-[#00DC82]">AI</span>
          </h1>
          <button
            onClick={() => navigate(user ? '/dashboard' : '/')}
            className="btn-secondary flex items-center gap-2"
            data-testid="back-btn"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <h1 
            className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 text-center"
            style={{ fontFamily: 'Outfit, sans-serif' }}
            data-testid="pricing-title"
          >
            Simple, Transparent Pricing
          </h1>
          <p className="text-center text-gray-400 mb-8 sm:mb-16 text-sm sm:text-base px-2">
            Choose the plan that works for you
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="glass-card p-6 sm:p-8" data-testid="free-tier-card">
              <div className="mb-6">
                <h3 className="text-xl sm:text-2xl font-bold mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Free
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold">$0</span>
                  <span className="text-gray-400 text-sm sm:text-base">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">3 resume analyses</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">Basic ATS optimization</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">AI-powered improvements</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">Role-specific suggestions</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/')}
                className="btn-secondary w-full"
                data-testid="free-tier-btn"
              >
                Get Started
              </button>
            </div>

            {/* Pro Tier */}
            <div className="glass-card p-6 sm:p-8 relative border-2 border-[#00DC82] sm:pt-16" data-testid="pro-tier-card">
              <div className="absolute -top-4 sm:top-4 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-[#00DC82] text-black px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-semibold inline-block">
                  Coming Soon
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl sm:text-2xl font-bold mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Pro
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold">$29</span>
                  <span className="text-gray-400 text-sm sm:text-base">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base"><strong>Unlimited</strong> resume analyses</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">Advanced ATS optimization</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">Industry-specific templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">Priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#00DC82] mt-0.5 flex-shrink-0" size={20} />
                  <span className="text-sm sm:text-base">Export to multiple formats</span>
                </li>
              </ul>
              <button
                disabled
                className="btn-primary w-full opacity-50 cursor-not-allowed"
                data-testid="pro-tier-btn"
              >
                Coming Soon
              </button>
            </div>
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-12 sm:mt-16 text-center">
            <p className="text-gray-400 text-sm sm:text-base">
              Questions? Contact us at{" "}
              <a href="mailto:support@resumeai.com" className="text-[#00DC82] hover:underline">
                support@resumeai.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;