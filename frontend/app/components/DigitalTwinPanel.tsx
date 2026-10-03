"use client";

import React from "react";
import { VehicleTelemetry } from "@/lib/types";

interface DigitalTwinPanelProps {
  vehicle: VehicleTelemetry;
  aiActive: boolean;
  correctionMode: "model" | "baseline" | "manual";
  onToggleAi: () => void;
  onSetCorrectionMode: (mode: "model" | "baseline" | "manual") => void;
  onInjectDelay: (seconds: number) => void;
  onReset: () => void;
}

export default function DigitalTwinPanel({
  vehicle,
  aiActive,
  correctionMode,
  onToggleAi,
  onSetCorrectionMode,
  onInjectDelay,
  onReset,
}: DigitalTwinPanelProps) {
  // Cross-track bar scale (-0.5m to +0.5m)
  const crossTrack = vehicle.cross_track_error || 0;
  const crossTrackPercent = Math.max(0, Math.min(100, 50 + (crossTrack / 0.5) * 50));

  const leftWheel = vehicle.wheel_speeds?.left ?? Number((vehicle.actual_speed - 0.02).toFixed(2));
  const rightWheel = vehicle.wheel_speeds?.right ?? Number((vehicle.actual_speed + 0.02).toFixed(2));

  return (
    <div className="bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-semibold text-white text-base">Digital Twin Telemetry</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Model: <span className="text-cyan-400 font-mono font-semibold">{vehicle.vehicle_id}</span> • Closed-loop control
          </p>
        </div>

        {/* AI Mode Selector */}
        <div className="flex items-center gap-2">
          <select
            value={correctionMode}
            onChange={(e) => onSetCorrectionMode(e.target.value as any)}
            className="bg-[#060a14] border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-500"
          >
            <option value="model">Random Forest AI Model</option>
            <option value="baseline">Baseline (Fixed-Step)</option>
            <option value="manual">Manual Override</option>
          </select>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Speed & Correction Target */}
        <div className="bg-[#060a14] rounded-xl p-4 border border-white/5">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Adaptive Speed Correction
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div>
              <span className="text-3xl font-bold font-mono text-cyan-400">{vehicle.actual_speed.toFixed(2)}</span>
              <span className="text-xs text-slate-400 ml-1">m/s actual</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-purple-400">{vehicle.target_speed.toFixed(2)}</span>
              <span className="text-xs text-slate-400 ml-1">m/s target</span>
            </div>
          </div>

          {/* Differential Wheel Speeds */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Differential Drive</span>
              <span className="font-mono text-white">Δv: {(rightWheel - leftWheel).toFixed(3)} m/s</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-400 uppercase">Left Track</div>
                <div className="font-mono text-sm font-bold text-slate-200">{leftWheel.toFixed(2)} m/s</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-400 uppercase">Right Track</div>
                <div className="font-mono text-sm font-bold text-slate-200">{rightWheel.toFixed(2)} m/s</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trajectory & Cross Track Error */}
        <div className="bg-[#060a14] rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Cross-Track Alignment (e_ct)
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                Math.abs(crossTrack) > 0.15 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {crossTrack > 0 ? `+${crossTrack.toFixed(3)}` : crossTrack.toFixed(3)} m
            </span>
          </div>

          {/* Cross Track Visual Gauge */}
          <div className="relative w-full h-5 bg-white/5 rounded-full my-3 overflow-hidden border border-white/10 flex items-center">
            {/* Center target line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-400/80 z-10" />
            {/* Deviation marker */}
            <div
              className="absolute top-1 bottom-1 w-3 rounded-full bg-cyan-400 transition-all duration-300 shadow-md shadow-cyan-500/50"
              style={{ left: `calc(${crossTrackPercent}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-0.50m (Left)</span>
            <span className="text-emerald-400">0.00 (Center)</span>
            <span>+0.50m (Right)</span>
          </div>

          {/* Steering adjust */}
          <div className="mt-3 flex justify-between items-center text-xs">
            <span className="text-slate-400">Steering Feedback (δ):</span>
            <span className="font-mono font-semibold text-cyan-300">
              {vehicle.steering_adjust > 0 ? `+${vehicle.steering_adjust.toFixed(4)}` : vehicle.steering_adjust.toFixed(4)} rad
            </span>
          </div>
        </div>
      </div>

      {/* Lag Features & Lookahead Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Lookahead 3.0s Badge */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Forward Lookahead</div>
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Verified (3.0s Horizon)
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono text-right">
            <div>s + {vehicle.target_speed * 3}m</div>
            <div className="text-cyan-400">Stable</div>
          </div>
        </div>

        {/* Schedule Drift Status */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Schedule Drift (ΔT)</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-lg font-mono font-bold ${
                vehicle.delta_T > 2 ? "text-red-400" : vehicle.delta_T < -2 ? "text-emerald-400" : "text-cyan-400"
              }`}
            >
              {vehicle.delta_T > 0 ? `+${vehicle.delta_T.toFixed(2)}` : vehicle.delta_T.toFixed(2)}s
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              [{vehicle.schedule_status.replace("_", " ")}]
            </span>
          </div>
        </div>

        {/* Feature Vector Lags */}
        <div className="bg-[#060a14] rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Model Lag Features</div>
          <div className="font-mono text-xs text-slate-300 mt-1 flex items-center gap-2">
            <span>[</span>
            <span className="text-cyan-400">{vehicle.delta_T_lags[0]?.toFixed(1) ?? "0.0"}</span>
            <span>,</span>
            <span className="text-purple-400">{vehicle.delta_T_lags[1]?.toFixed(1) ?? "0.0"}</span>
            <span>,</span>
            <span className="text-amber-400">{vehicle.delta_T_lags[2]?.toFixed(1) ?? "0.0"}</span>
            <span>]</span>
          </div>
        </div>
      </div>

      {/* Control Buttons & Perturbation injection */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
        <button
          onClick={onToggleAi}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            aiActive
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${aiActive ? "bg-emerald-400" : "bg-red-400"}`} />
          {aiActive ? "AI CLOSED-LOOP ACTIVE" : "AI CORRECTION DISABLED"}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onInjectDelay(5)}
            className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium rounded-xl hover:bg-amber-500/20 transition"
          >
            ⚠️ Inject +5s Delay
          </button>
          <button
            onClick={() => onInjectDelay(-3)}
            className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium rounded-xl hover:bg-blue-500/20 transition"
          >
            ⚡ Boost Pacing (-3s)
          </button>
          <button
            onClick={onReset}
            className="px-3 py-2 bg-white/5 border border-white/10 text-slate-300 text-xs font-medium rounded-xl hover:bg-white/10 transition"
          >
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}
