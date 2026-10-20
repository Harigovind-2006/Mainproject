"use client";

import React, { useState } from "react";
import { RouteData, VehicleTelemetry } from "@/lib/types";

interface RouteMapSVGProps {
  route: RouteData | null;
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

  const selectedVehicle =
    vehicles.find((v) => v.vehicle_id === selectedVehicleId) || vehicles[0] || null;

  return (
    <div className="relative w-full h-full bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col overflow-hidden">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-3 z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${route ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
            <h3 className="font-semibold text-white text-base">Serpentine Field Layout</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {route
              ? `${route.num_lanes}-Lane Path • ${route.total_distance.toFixed(1)}m Total • ${route.lane_spacing}m Spacing`
              : "Loading field route geometry from backend..."}
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
          {route && route.segments && route.segments.map((seg) => {
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
            }

            if (seg.type === "turn" && seg.center && seg.radius) {
              const cx = scaleX(seg.center[0]);
              const cy = scaleY(seg.center[1]);
              const rxPx = ((seg.radius / (maxX - minX)) * (svgWidth - 2 * paddingX));
              const ryPx = ((seg.radius / (maxY - minY)) * (svgHeight - 2 * paddingY));

              // Headland Arc
              const startX = scaleX(seg.start_point[0]);
              const startY = scaleY(seg.start_point[1]);
              const endX = scaleX(seg.end_point[0]);
              const endY = scaleY(seg.end_point[1]);

              // Top headland turn (y > 25) curves outside top (sweep=0); Bottom turn curves outside bottom (sweep=1)
              const sweep = seg.center[1] > 25 ? 0 : 1;
              const d = `M ${startX} ${startY} A ${rxPx} ${ryPx} 0 0 ${sweep} ${endX} ${endY}`;

              return (
                <g key={`turn-${seg.id}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={isSegActive ? "#a855f7" : "rgba(168, 85, 247, 0.35)"}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSegActive ? undefined : "4 3"}
                    filter={isSegActive ? "url(#cyanGlow)" : undefined}
                  />
                  {showLabels && (
                    <text
                      x={cx}
                      y={seg.center[1] > 25 ? cy - 12 : cy + 18}
                      textAnchor="middle"
                      fill="rgba(168, 85, 247, 0.6)"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      Turn {seg.id}
                    </text>
                  )}
                </g>
              );
            }

            return null;
          })}

          {/* Render Vehicles */}
          {vehicles.map((veh) => {
            const isSel = veh.vehicle_id === selectedVehicleId;
            const vx = scaleX(veh.x);
            const vy = scaleY(veh.y);
            // heading in field: 0 = East, pi/2 = North.
            // SVG coordinate rotation angle in degrees:
            const angleDeg = -(veh.heading * 180) / Math.PI + 90;

            const markerColor = isSel
              ? "#38bdf8"
              : veh.schedule_status === "ON_SCHEDULE"
              ? "#10b981"
              : veh.schedule_status === "AHEAD"
              ? "#06b6d4"
              : "#f59e0b";

            return (
              <g
                key={veh.vehicle_id}
                onClick={() => onSelectVehicle(veh.vehicle_id)}
                className="cursor-pointer transition-transform duration-200"
              >
                {/* Ping Radar Rings for selected rover */}
                {isSel && (
                  <circle
                    cx={vx}
                    cy={vy}
                    r="18"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-ping"
                  />
                )}

                {/* Rover Body Outer Halo */}
                <circle
                  cx={vx}
                  cy={vy}
                  r={isSel ? "12" : "9"}
                  fill={isSel ? "rgba(56, 189, 248, 0.25)" : "rgba(255,255,255,0.1)"}
                  stroke={markerColor}
                  strokeWidth={isSel ? "2.5" : "1.5"}
                  filter={isSel ? "url(#cyanGlow)" : undefined}
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
        {selectedVehicle ? (
          <div className="absolute top-3 right-3 bg-[#0b111d]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-300">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Active Target
            </div>
            <div className="flex items-center gap-2 font-mono font-medium text-white">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              {selectedVehicle.vehicle_id}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              ({selectedVehicle.x.toFixed(1)}m, {selectedVehicle.y.toFixed(1)}m) •{" "}
              {selectedVehicle.in_turn ? "Turning Arc" : "Straight Lane"}
            </div>
          </div>
        ) : (
          <div className="absolute top-3 right-3 bg-[#0b111d]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-400">
            <span>Waiting for active telemetry feed...</span>
          </div>
        )}
      </div>
    </div>
  );
}
