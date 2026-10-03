"use client";

import React, { useState } from "react";
import { TelemetryPoint } from "@/lib/useFleetStore";

interface TelemetryChartSVGProps {
  history: TelemetryPoint[];
  vehicleId: string;
}

export default function TelemetryChartSVG({ history, vehicleId }: TelemetryChartSVGProps) {
  const [activeTab, setActiveTab] = useState<"speed" | "drift">("speed");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = history.length > 0 ? history : [];
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  // Compute Scales
  let minVal = 0;
  let maxVal = 2.5;

  if (activeTab === "speed") {
    minVal = 0.4;
    maxVal = 2.4;
  } else {
    // Schedule drift delta_T can be negative (ahead) or positive (behind)
    const drifts = points.map((p) => p.delta_T);
    const minDrift = Math.min(-2, ...drifts);
    const maxDrift = Math.max(5, ...drifts);
    minVal = Math.floor(minDrift - 1);
    maxVal = Math.ceil(maxDrift + 1);
  }

  const getX = (index: number) => {
    if (points.length <= 1) return paddingLeft;
    return paddingLeft + (index / (points.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    return paddingTop + chartH - ((clamped - minVal) / (maxVal - minVal)) * chartH;
  };

  // Generate path strings
  const generatePath = (accessor: (p: TelemetryPoint) => number) => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(accessor(p)).toFixed(1)}`)
      .join(" ");
  };

  const actualSpeedPath = generatePath((p) => p.actual_speed);
  const targetSpeedPath = generatePath((p) => p.target_speed);
  const idealSpeedPath = generatePath((p) => p.ideal_speed);
  const driftPath = generatePath((p) => p.delta_T);

  // Gradient area path for drift
  const zeroY = getY(0);
  const driftAreaPath =
    points.length > 0
      ? `${driftPath} L ${getX(points.length - 1)} ${zeroY} L ${getX(0)} ${zeroY} Z`
      : "";

  const hoveredPoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div className="w-full bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <h3 className="font-semibold text-white text-base">
              {activeTab === "speed" ? "Real-Time Speed Dynamics" : "Schedule Drift Timeline (ΔT)"}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Telemetric feedback loop for <span className="font-mono text-cyan-400 font-semibold">{vehicleId}</span>
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-[#060a14] rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("speed")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === "speed"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⚡ Speed Control
          </button>
          <button
            onClick={() => setActiveTab("drift")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === "drift"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⏱ Drift (ΔT)
          </button>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="relative w-full h-[220px]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="driftGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="speedAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = minVal + ratio * (maxVal - minVal);
            const y = getY(val);
            return (
              <g key={`grid-${ratio}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgba(148, 163, 184, 0.5)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val.toFixed(1)} {activeTab === "speed" ? "m/s" : "s"}
                </text>
              </g>
            );
          })}

          {/* Zero baseline for drift */}
          {activeTab === "drift" && (
            <line
              x1={paddingLeft}
              y1={zeroY}
              x2={svgWidth - paddingRight}
              y2={zeroY}
              stroke="rgba(16, 185, 129, 0.4)"
              strokeWidth="1.5"
            />
          )}

          {/* Plot Content */}
          {activeTab === "speed" ? (
            <>
              {/* Ideal Speed Reference */}
              <path
                d={idealSpeedPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="5 5"
                opacity="0.7"
              />
              {/* Target Speed (AI Candidate) */}
              <path
                d={targetSpeedPath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              {/* Actual Speed (Live Telemetry) */}
              <path
                d={actualSpeedPath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="3"
                className="transition-all duration-300"
              />
            </>
          ) : (
            <>
              {/* Drift Area Fill */}
              <path d={driftAreaPath} fill="url(#driftGradient)" />
              {/* Drift Curve */}
              <path
                d={driftPath}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2.5"
                className="transition-all duration-300"
              />
            </>
          )}

          {/* Interactive Hover Vertical Crosshair */}
          {points.map((p, idx) => {
            const x = getX(idx);
            return (
              <rect
                key={`hit-${idx}`}
                x={x - 10}
                y={paddingTop}
                width={20}
                height={chartH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(idx)}
              />
            );
          })}

          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + chartH}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="2 2"
              />
              {activeTab === "speed" ? (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(points[hoverIndex].actual_speed)}
                  r="5"
                  fill="#06b6d4"
                  stroke="#fff"
                  strokeWidth="2"
                />
              ) : (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(points[hoverIndex].delta_T)}
                  r="5"
                  fill="#8b5cf6"
                  stroke="#fff"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && hoverIndex !== null && (
          <div
            className="absolute top-1 pointer-events-none bg-[#0f172a] border border-cyan-500/40 rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur-md"
            style={{
              left: Math.min(chartW - 40, Math.max(paddingLeft, getX(hoverIndex) - 60)),
            }}
          >
            <div className="text-[10px] text-slate-400 font-mono mb-1">
              Time: {hoveredPoint.time}
            </div>
            {activeTab === "speed" ? (
              <div className="space-y-0.5 font-mono text-[11px]">
                <div className="text-cyan-400">
                  Actual: <span className="font-bold">{hoveredPoint.actual_speed.toFixed(2)} m/s</span>
                </div>
                <div className="text-purple-400">
                  Target: <span>{hoveredPoint.target_speed.toFixed(2)} m/s</span>
                </div>
                <div className="text-amber-400">
                  Ideal: <span>{hoveredPoint.ideal_speed.toFixed(2)} m/s</span>
                </div>
              </div>
            ) : (
              <div className="font-mono text-[11px]">
                <span className="text-slate-300">Drift ΔT: </span>
                <span
                  className={`font-bold ${
                    hoveredPoint.delta_T > 2
                      ? "text-red-400"
                      : hoveredPoint.delta_T < -1
                      ? "text-emerald-400"
                      : "text-cyan-400"
                  }`}
                >
                  {hoveredPoint.delta_T > 0 ? `+${hoveredPoint.delta_T.toFixed(2)}` : hoveredPoint.delta_T.toFixed(2)}s
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {hoveredPoint.delta_T > 2
                    ? "Vehicle is lagging behind schedule"
                    : hoveredPoint.delta_T < -1
                    ? "Vehicle is running ahead of plan"
                    : "Pacing is precisely on target"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend & Stats Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pt-3 border-t border-white/5 text-xs">
        {activeTab === "speed" ? (
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-cyan-400 rounded-full" />
              <span className="text-slate-300">Actual Speed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-purple-400 rounded-full border-dashed" />
              <span className="text-slate-300">Target Speed (AI Correction)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-amber-400 rounded-full" />
              <span className="text-slate-400">Planned Nominal</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-violet-400 rounded-full" />
              <span className="text-slate-300">Schedule Drift (ΔT)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-emerald-400 rounded-full" />
              <span className="text-slate-400">Zero Nominal Baseline</span>
            </div>
          </div>
        )}

        <div className="text-[11px] font-mono text-slate-400">
          Last measured:{" "}
          <span className="text-white font-semibold">
            {points[points.length - 1]?.actual_speed ?? 0} m/s
          </span>{" "}
          • ΔT:{" "}
          <span className="text-cyan-400 font-semibold">
            {points[points.length - 1]?.delta_T ?? 0}s
          </span>
        </div>
      </div>
    </div>
  );
}
