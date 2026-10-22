"use client";

import Link from "next/link";
import { useState } from "react";

interface NavbarProps {
  isConnected?: boolean;
  isRoverStreaming?: boolean;
  activeVehicleId?: string;
  vehicleIds?: string[];
  onSelectVehicle?: (id: string) => void;
  simulationActive?: boolean;
  onToggleSimulation?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function Navbar({
  isConnected = false,
  isRoverStreaming = false,
  activeVehicleId = "rover-alpha",
  vehicleIds = ["rover-alpha"],
  onSelectVehicle,
  simulationActive = true,
  onToggleSimulation,
  activeTab = "overview",
  onTabChange,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { id: "overview", label: "Overview", icon: "▦" },
    { id: "map", label: "Route Map", icon: "⌖" },
    { id: "fleet", label: "Fleet Units", icon: "🚜" },
    { id: "twin", label: "Digital Twin", icon: "◈" },
    { id: "analytics", label: "Benchmark", icon: "▥" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#070b14]/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-white font-bold text-lg">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base tracking-wide">AgriTrack</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  AI Twin
                </span>
              </div>
              <p className="text-slate-400 text-[10px]">Real-Time Fleet Progress & Correction</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden lg:flex items-center gap-1 bg-[#0b111d] p-1 rounded-xl border border-white/10">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange?.(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Controls & Vehicle Selector */}
          <div className="hidden md:flex items-center gap-3">
            {/* Vehicle Selector */}
            {vehicleIds.length > 0 && onSelectVehicle && (
              <div className="flex items-center gap-1.5 bg-[#0b111d] px-2.5 py-1 rounded-xl border border-white/10">
                <span className="text-[11px] text-slate-400 font-mono">Unit:</span>
                <select
                  value={activeVehicleId}
                  onChange={(e) => onSelectVehicle(e.target.value)}
                  className="bg-transparent text-xs font-mono font-semibold text-cyan-400 outline-none cursor-pointer"
                >
                  {vehicleIds.map((id) => (
                    <option key={id} value={id} className="bg-[#0b111d] text-white">
                      {id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3D Sandbox Launcher Button */}
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-yellow-300 border border-yellow-500/40 text-xs font-semibold shadow-md transition hover:scale-105"
              title="Open Microduck-Style 3D Simulator Sandbox"
            >
              <span>🎮</span>
              <span>3D Sandbox</span>
            </a>

            {/* Connection Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono ${
                isRoverStreaming
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : isConnected
                  ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-300"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRoverStreaming ? "bg-emerald-400 animate-pulse" : isConnected ? "bg-cyan-400" : "bg-slate-500"
                }`}
              />
              <span>{isRoverStreaming ? "Live Simulation (10Hz)" : isConnected ? "Backend Connected" : "Offline"}</span>
            </div>

            {/* Operator Profile */}
            <Link
              href="/login"
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white border border-white/20 hover:ring-2 hover:ring-cyan-500/40 transition"
              title="Operator Profile"
            >
              OP
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden text-slate-300 p-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          >
            ☰
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {menuOpen && (
          <div className="lg:hidden py-3 border-t border-white/10 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange?.(item.id);
                    setMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left ${
                    activeTab === item.id
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:bg-white/5 text-white"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-xs text-slate-400">Target Vehicle:</span>
              <select
                value={activeVehicleId}
                onChange={(e) => onSelectVehicle?.(e.target.value)}
                className="bg-[#0b111d] border border-white/10 text-xs font-mono text-cyan-400 px-2 py-1 rounded"
              >
                {vehicleIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}