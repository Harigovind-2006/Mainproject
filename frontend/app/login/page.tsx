"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Login successful
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#050816] flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl
                      border border-white/10 rounded-2xl p-8">

        <h1 className="text-3xl font-bold text-white text-center">
          Welcome Back
        </h1>

        <p className="text-gray-400 text-center mt-2">
          Sign in to continue
        </p>

        <form onSubmit={handleLogin} className="space-y-5 mt-8">

          {/* Email */}
          <div>
            <label className="text-gray-300 text-sm">
              Email
            </label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-2 px-4 py-3 rounded-xl
                         bg-white/5 border border-white/10
                         text-white outline-none
                         focus:border-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-gray-300 text-sm">
              Password
            </label>

            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-2 px-4 py-3 rounded-xl
                         bg-white/5 border border-white/10
                         text-white outline-none
                         focus:border-blue-500"
            />
          </div>

          {/* Login */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl
                       bg-blue-600 hover:bg-blue-700
                       text-white font-semibold transition"
          >
            Sign In
          </button>

        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Don't have an account?{" "}
          <a
            href="/register"
            className="text-blue-400 hover:text-blue-300"
          >
            Create account
          </a>
        </p>

      </div>
    </main>
  );
}