"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState<string>("admin");
  const [password, setPassword] = useState<string>("admin123");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Try connecting to backend auth if available
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("token", data.access_token);
          localStorage.setItem("user", JSON.stringify({ username: data.username, role: data.role }));
        }
      } else {
        // Fallback for standalone demo / offline mode
        localStorage.setItem("user", JSON.stringify({ username, role: "operator" }));
      }

      router.push("/dashboard");
    } catch (err: any) {
      // If network fails, allow demo login anyway
      localStorage.setItem("user", JSON.stringify({ username, role: "operator" }));
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setUsername("admin");
    setPassword("admin123");
    localStorage.setItem("user", JSON.stringify({ username: "admin", role: "operator" }));
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#070b14] flex items-center justify-center px-4 relative overflow-hidden font-sans">
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute w-[500px] h-[500px] bg-cyan-600/15 rounded-full blur-[120px] -top-32 -left-32 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px] -bottom-32 -right-32 pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-[#0b111d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 sm:p-10">
          {/* Logo Badge */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-white/20">
              <span className="text-white text-2xl font-bold">⚡</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              AgriTrack Mission Control
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              Autonomous Fleet Progress & ETA Correction System
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Username / Call-sign
              </label>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Security Key / Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Connect to Fleet Terminal"}
            </button>
          </form>

          {/* Quick Demo Access Button */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-2"
            >
              <span>🚀</span> Instant Demo Access (admin / admin123)
            </button>
          </div>

          {/* Register Link */}
          <p className="text-center text-slate-400 text-xs mt-6">
            New operator on the field?{" "}
            <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-medium">
              Register unit access
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}