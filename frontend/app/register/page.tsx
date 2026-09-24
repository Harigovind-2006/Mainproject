
"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleRegister = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    console.log({
      name,
      email,
      password,
    });
  };

  return (
    <main className="min-h-screen bg-[#050816] flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -top-20 -left-20" />

      <div className="absolute w-96 h-96 bg-purple-600/20 rounded-full blur-3xl -bottom-20 -right-20" />

      {/* Register Card */}
      <div className="relative w-full max-w-md">

        <div className="bg-white/10 backdrop-blur-xl border border-white/10
                        rounded-2xl shadow-2xl p-8">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-blue-600
                            flex items-center justify-center
                            shadow-lg shadow-blue-600/30">
              <span className="text-white text-2xl font-bold">
                L
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">
              Create Account
            </h1>

            <p className="text-gray-400 mt-2">
              Create your account to get started
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-5">

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Full Name
              </label>

              <input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           outline-none
                           focus:border-blue-500
                           focus:ring-2 focus:ring-blue-500/20
                           transition"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           outline-none
                           focus:border-blue-500
                           focus:ring-2 focus:ring-blue-500/20
                           transition"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-20 rounded-xl
                             bg-white/5 border border-white/10
                             text-white placeholder-gray-500
                             outline-none
                             focus:border-blue-500
                             focus:ring-2 focus:ring-blue-500/20
                             transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2
                             -translate-y-1/2
                             text-sm text-gray-400
                             hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           outline-none
                           focus:border-blue-500
                           focus:ring-2 focus:ring-blue-500/20
                           transition"
              />
            </div>

            {/* Register Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl
                         bg-blue-600 hover:bg-blue-700
                         text-white font-semibold
                         shadow-lg shadow-blue-600/20
                         transition duration-200"
            >
              Create Account
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-gray-400 text-sm mt-7">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Sign in
            </a>
          </p>

        </div>
      </div>
    </main>
  );
}

