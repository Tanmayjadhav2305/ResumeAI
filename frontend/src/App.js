import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    const usageCount = localStorage.getItem('usageCount');
    
    if (userId && userEmail) {
      setUser({
        id: userId,
        email: userEmail,
        usage_count: parseInt(usageCount) || 0
      });
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-[#00DC82] text-xl">Loading...</div>
    </div>;
  }

  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing user={user} setUser={setUser} />} />
          <Route path="/analyze" element={user ? <Analyze user={user} /> : <Navigate to="/" />} />
          <Route path="/results/:analysisId" element={user ? <Results user={user} /> : <Navigate to="/" />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} logout={logout} /> : <Navigate to="/" />} />
          <Route path="/pricing" element={<Pricing user={user} />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;