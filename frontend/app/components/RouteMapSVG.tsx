"use client";

import React, { useState } from "react";
import { RouteData, VehicleTelemetry } from "@/lib/types";

interface RouteMapSVGProps {
  route: RouteData;
  vehicles: VehicleTelemetry[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
}

export default function RouteMapSVG({
  route,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}: RouteMapSVGProps) {
  const [showLabels, setShowLabels] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Coordinate transformation:
  // Route x spans roughly 0 to 15m (lanes at x=0, 5, 10, 15).
  // Route y spans roughly 0 to 50m.
  // We'll map field coords (x: -5 to 20, y: -5 to 55) to SVG viewport (e.g. width: 450, height: 600)
  const svgWidth = 460;
  const svgHeight = 600;
  const paddingX = 50;
  const paddingY = 45;

  const minX = -4;
  const maxX = 19;
  const minY = -5;
  const maxY = 55;

  const scaleX = (x: number) => paddingX + ((x - minX) / (maxX - minX)) * (svgWidth - 2 * paddingX);
  // SVG y is inverted (y=0 at top, while in field y=0 is bottom)
  const scaleY = (y: number) => svgHeight - paddingY - ((y - minY) / (maxY - minY)) * (svgHeight - 2 * paddingY);

  const selectedVehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId) || vehicles[0];

  return (
    <div className="relative w-full h-full bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col overflow-hidden">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-3 z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="font-semibold text-white text-base">Serpentine Field Layout</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            4-Lane Path • {route.total_distance.toFixed(1)}m Total • 5m Spacing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition ${
              showLabels
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            Labels
          </button>
          <button
            onClick={() => setZoomLevel((z) => (z >= 1.4 ? 1.0 : Number((z + 0.2).toFixed(1))))}
            className="px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          >
            Zoom {zoomLevel}x
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 w-full flex items-center justify-center min-h-[360px] overflow-hidden rounded-xl bg-[#060a14] border border-white/5">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full max-h-[540px] transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Grid pattern */}
            <pattern id="fieldGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
            {/* Glow Filter */}
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background grid */}
          <rect width={svgWidth} height={svgHeight} fill="url(#fieldGrid)" />

          {/* Field Boundary Outline */}
          <rect
            x={scaleX(-1)}
            y={scaleY(52)}
            width={scaleX(16) - scaleX(-1)}
            height={scaleY(-2) - scaleY(52)}
            fill="rgba(16, 185, 129, 0.02)"
            stroke="rgba(16, 185, 129, 0.15)"
            strokeDasharray="4 4"
            rx="12"
          />

          {/* Render Route Segments */}
          {route.segments.map((seg) => {
            const isSegActive = selectedVehicle && selectedVehicle.current_segment_id === seg.id;
            const strokeColor = isSegActive ? "#06b6d4" : "rgba(148, 163, 184, 0.25)";
            const strokeWidth = isSegActive ? 3.5 : 2;

            if (seg.type === "lane") {
              const x1 = scaleX(seg.start_point[0]);
              const y1 = scaleY(seg.start_point[1]);
              const x2 = scaleX(seg.end_point[0]);
              const y2 = scaleY(seg.end_point[1]);

              return (
                <g key={`seg-${seg.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSegActive ? undefined : "6 4"}
                    filter={isSegActive ? "url(#cyanGlow)" : undefined}
                  />
                  {showLabels && (
                    <text
                      x={x1 + 10}
                      y={(y1 + y2) / 2}
                      fill="rgba(148, 163, 184, 0.4)"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      L{seg.id / 2 + 1}
                    </text>
                  )}
                </g>
              );
            } else if (seg.center && seg.radius) {
              // Semicircular Turn
              const cx = scaleX(seg.center[0]);
              const cy = scaleY(seg.center[1]);
              const rx = (scaleX(seg.center[0] + seg.radius) - cx);
              const ry = Math.abs(scaleY(seg.center[1] + seg.radius) - cy);

              const x1 = scaleX(seg.start_point[0]);
              const y1 = scaleY(seg.start_point[1]);
              const x2 = scaleX(seg.end_point[0]);
              const y2 = scaleY(seg.end_point[1]);

              // SVG Arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
              // In SVG screen coords, y is flipped, so adjust sweep flag accordingly
              const sweepFlag = seg.clockwise ? 1 : 1;
              const pathD = `M ${x1} ${y1} A ${rx} ${ry} 0 0 ${sweepFlag} ${x2} ${y2}`;

              return (
                <g key={`turn-${seg.id}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSegActive ? undefined : "4 4"}
                    filter={isSegActive ? "url(#cyanGlow)" : undefined}
                  />
                  {showLabels && (
                    <circle cx={cx} cy={cy} r="2" fill="rgba(148, 163, 184, 0.3)" />
                  )}
                </g>
              );
            }
            return null;
          })}

          {/* Start and Finish markers */}
          <g transform={`translate(${scaleX(0)}, ${scaleY(0)})`}>
            <circle r="7" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2" />
            <circle r="3" fill="#10b981" />
            {showLabels && (
              <text x="12" y="4" fill="#10b981" fontSize="10" fontWeight="bold">
                START
              </text>
            )}
          </g>

          <g transform={`translate(${scaleX(15)}, ${scaleY(0)})`}>
            <circle r="7" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
            <circle r="3" fill="#ef4444" />
            {showLabels && (
              <text x="12" y="4" fill="#ef4444" fontSize="10" fontWeight="bold">
                END
              </text>
            )}
          </g>

          {/* Render Vehicles */}
          {vehicles.map((veh) => {
            const isSel = veh.vehicle_id === selectedVehicleId;
            const vx = scaleX(veh.x);
            const vy = scaleY(veh.y);
            const angleDeg = -(veh.heading * 180) / Math.PI + 90;

            const markerColor = isSel
              ? "#06b6d4" // Cyan
              : veh.schedule_status === "BEHIND"
              ? "#f59e0b" // Amber
              : "#10b981"; // Emerald

            return (
              <g
                key={veh.vehicle_id}
                onClick={() => onSelectVehicle(veh.vehicle_id)}
                className="cursor-pointer transition-transform duration-300"
              >
                {/* Outer ping animation for selected */}
                {isSel && (
                  <circle
                    cx={vx}
                    cy={vy}
                    r="18"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-ping"
                  />
                )}

                {/* Vehicle shadow ring */}
                <circle
                  cx={vx}
                  cy={vy}
                  r={isSel ? 14 : 10}
                  fill={isSel ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.08)"}
                  stroke={markerColor}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />

                {/* Direction Pointer Arrow */}
                <g transform={`translate(${vx}, ${vy}) rotate(${angleDeg})`}>
                  <polygon
                    points="0,-10 6,6 0,3 -6,6"
                    fill={markerColor}
                  />
                </g>

                {/* Name & status badge */}
                <g transform={`translate(${vx + 14}, ${vy - 8})`}>
                  <rect
                    x="0"
                    y="0"
                    width={veh.vehicle_id.length * 6.5 + 24}
                    height="16"
                    rx="4"
                    fill="#0b111d"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                  />
                  <text
                    x="6"
                    y="11"
                    fill={isSel ? "#38bdf8" : "#94a3b8"}
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {veh.vehicle_id}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Floating Mini Compass & Scale */}
        <div className="absolute bottom-3 left-3 bg-[#0b111d]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-slate-400 flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-cyan-400">
            <span>▲</span> N
          </div>
          <div className="h-3 w-px bg-white/10" />
          <span>Grid: 5m spacing</span>
        </div>

        {/* Selected Vehicle Legend overlay */}
        <div className="absolute top-3 right-3 bg-[#0b111d]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-300">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Active Target
          </div>
          <div className="flex items-center gap-2 font-mono font-medium text-white">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            {selectedVehicle?.vehicle_id}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            ({selectedVehicle?.x.toFixed(1)}m, {selectedVehicle?.y.toFixed(1)}m) • {selectedVehicle?.in_turn ? "Turning Arc" : "Straight Lane"}
          </div>
        </div>
      </div>
    </div>
  );
}
