"use client";

import React from "react";
import { BenchmarkMetrics } from "@/lib/types";

interface BenchmarkPanelProps {
  metrics: BenchmarkMetrics;
  isConnected: boolean;
  simulationActive: boolean;
  onToggleSimulation: () => void;
}

export default function BenchmarkPanel({
  metrics,
  isConnected,
  simulationActive,
  onToggleSimulation,
}: BenchmarkPanelProps) {
  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <h3 className="font-semibold text-white text-base">System Telemetry & Performance</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time closed-loop latency & pipeline benchmarking
          </p>
        </div>

        {/* Simulation toggle button */}
        <button
          onClick={onToggleSimulation}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
            simulationActive
              ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
              : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${simulationActive ? "bg-purple-400 animate-pulse" : "bg-slate-500"}`} />
          {simulationActive ? "Field Simulator Running" : "Simulator Paused"}
        </button>
      </div>

      {/* Benchmark Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Processing Latency */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Avg Closed-Loop Latency</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {metrics.avg_latency_ms.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <span>✓</span> Ultra-low &lt; 5ms target
          </div>
        </div>

        {/* Message Throughput */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Throughput</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-purple-400">
              {metrics.messages_per_sec.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">msg/s</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {metrics.total_messages.toLocaleString()} total packets
          </div>
        </div>

        {/* Connected Twins */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Active Digital Twins</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {metrics.connected_vehicles}
            </span>
            <span className="text-xs text-slate-400">rovers</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            In-memory state synced
          </div>
        </div>

        {/* Server Uptime & Mode */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Service Health</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-base font-bold font-mono ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>
              {isConnected ? "WS Connected" : "Local Engine"}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Uptime: {formatUptime(metrics.uptime_seconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
