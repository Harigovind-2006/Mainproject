"use client";

import React from "react";
import { VehicleTelemetry } from "@/lib/types";

interface FleetTableProps {
  vehicles: VehicleTelemetry[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
}

export default function FleetTable({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}: FleetTableProps) {
  return (
    <div className="bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <h3 className="font-semibold text-white text-base">Autonomous Fleet Units</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {vehicles.length} Active Autonomous Units in Field Grid
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
          Telemetry 10Hz Feed
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold">
              <th className="py-3 px-3">Vehicle ID</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Progress</th>
              <th className="py-3 px-3">Speed (Act/Tgt)</th>
              <th className="py-3 px-3">Schedule Drift</th>
              <th className="py-3 px-3">Est. Time Remaining</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {vehicles.map((v) => {
              const isSelected = v.vehicle_id === selectedVehicleId;
              const statusColor =
                v.schedule_status === "ON_SCHEDULE"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : v.schedule_status === "AHEAD"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20";

              return (
                <tr
                  key={v.vehicle_id}
                  onClick={() => onSelectVehicle(v.vehicle_id)}
                  className={`cursor-pointer transition hover:bg-white/[0.03] ${
                    isSelected ? "bg-cyan-500/5" : ""
                  }`}
                >
                  {/* Vehicle Name */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          isSelected
                            ? "bg-cyan-500/20 border border-cyan-500 text-cyan-300"
                            : "bg-white/5 border border-white/10 text-slate-300"
                        }`}
                      >
                        🚜
                      </div>
                      <div>
                        <div className="font-semibold text-white font-mono flex items-center gap-1.5">
                          {v.vehicle_id}
                          {isSelected && <span className="text-[10px] text-cyan-400">●</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Bat: {v.battery_level ?? 90}% • Seg #{v.current_segment_id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold ${statusColor}`}>
                      {v.schedule_status.replace("_", " ")}
                    </span>
                  </td>

                  {/* Route Progress Bar */}
                  <td className="py-3.5 px-3 min-w-[140px]">
                    <div className="flex justify-between text-[11px] mb-1 font-mono">
                      <span className="text-white font-medium">{v.percent_complete.toFixed(1)}%</span>
                      <span className="text-slate-400">{v.distance_covered.toFixed(0)}m</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, v.percent_complete))}%` }}
                      />
                    </div>
                  </td>

                  {/* Speed */}
                  <td className="py-3.5 px-3 font-mono">
                    <span className="text-cyan-400 font-bold">{v.actual_speed.toFixed(2)}</span>
                    <span className="text-slate-400 text-[10px]"> / {v.target_speed.toFixed(2)} m/s</span>
                  </td>

                  {/* Drift */}
                  <td className="py-3.5 px-3 font-mono">
                    <span
                      className={`font-semibold ${
                        v.delta_T > 2 ? "text-amber-400" : v.delta_T < -1 ? "text-cyan-400" : "text-emerald-400"
                      }`}
                    >
                      {v.delta_T > 0 ? `+${v.delta_T.toFixed(2)}` : v.delta_T.toFixed(2)}s
                    </span>
                  </td>

                  {/* Time Remaining */}
                  <td className="py-3.5 px-3 font-mono text-slate-300">
                    {Math.floor(v.time_remaining / 60)}m {Math.floor(v.time_remaining % 60)}s
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVehicle(v.vehicle_id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        isSelected
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {isSelected ? "Active" : "Inspect"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
