"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import RouteMapSVG from "../components/RouteMapSVG";
import TelemetryChartSVG from "../components/TelemetryChartSVG";
import DigitalTwinPanel from "../components/DigitalTwinPanel";
import FleetTable from "../components/FleetTable";
import BenchmarkPanel from "../components/BenchmarkPanel";
import { useFleetStore } from "@/lib/useFleetStore";

export default function DashboardPage() {
  const {
    route,
    fleet,
    selectedVehicleId,
    setSelectedVehicleId,
    activeVehicle,
    isConnected,
    aiActive,
    toggleAiActive,
    correctionMode,
    setCorrectionMode,
    simulationActive,
    setSimulationActive,
    history,
    benchmark,
    resetFleet,
    injectDelay,
  } = useFleetStore();

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInjectDelay = (seconds: number) => {
    injectDelay(selectedVehicleId, seconds);
    showToast(
      seconds > 0
        ? `Injected +${seconds}s schedule delay on ${selectedVehicleId}`
        : `Applied pacing boost ${seconds}s on ${selectedVehicleId}`
    );
  };

  const handleReset = () => {
    resetFleet();
    showToast("Fleet digital twins and route progress reset.");
  };

  const vehicleIds = fleet.map((v) => v.vehicle_id);

  // Compute fleet wide KPI averages
  const avgSpeed = (fleet.reduce((acc, v) => acc + v.actual_speed, 0) / Math.max(1, fleet.length)).toFixed(2);
  const avgDrift = (fleet.reduce((acc, v) => acc + v.delta_T, 0) / Math.max(1, fleet.length)).toFixed(2);
  const avgProgress = (fleet.reduce((acc, v) => acc + v.percent_complete, 0) / Math.max(1, fleet.length)).toFixed(1);

  return (
    <main className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        isConnected={isConnected}
        activeVehicleId={selectedVehicleId}
        vehicleIds={vehicleIds}
        onSelectVehicle={setSelectedVehicleId}
        simulationActive={simulationActive}
        onToggleSimulation={() => setSimulationActive(!simulationActive)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] border border-cyan-500/40 text-cyan-300 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-medium flex items-center gap-2 animate-bounce">
          <span>⚡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-12 flex flex-col gap-6">
        {/* Top Control Bar / Hero Banner */}
        <div className="bg-gradient-to-r from-[#0b111d] via-[#0d1627] to-[#0b111d] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Fleet Mission Control & Closed-Loop Correction
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Autonomous agricultural rover guidance • Ospina & Noguchi (2025) kinematic formulation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* AI Status Pill */}
            <div
              onClick={toggleAiActive}
              className={`cursor-pointer px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                aiActive
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${aiActive ? "bg-emerald-400" : "bg-red-400"}`} />
              <span>{aiActive ? "AI Speed Control ON" : "AI Control OFF"}</span>
            </div>

            {/* Quick Action Reset */}
            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition flex items-center gap-1.5"
            >
              <span>↺</span> Reset Field
            </button>
          </div>
        </div>

        {/* 4 Primary KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Unit Speed */}
          <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Target Unit Speed</span>
              <span className="text-base">⚡</span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-cyan-400">
                {activeVehicle.actual_speed.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                / {activeVehicle.target_speed.toFixed(2)} m/s
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Ideal: {activeVehicle.ideal_speed.toFixed(2)} m/s</span>
              <span className="text-cyan-400 font-mono">{activeVehicle.vehicle_id}</span>
            </div>
          </div>

          {/* Card 2: Schedule Drift delta_T */}
          <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-violet-500/30 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Schedule Drift (ΔT)</span>
              <span className="text-base">⏱</span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold font-mono ${
                  activeVehicle.delta_T > 2
                    ? "text-amber-400"
                    : activeVehicle.delta_T < -1
                    ? "text-cyan-400"
                    : "text-emerald-400"
                }`}
              >
                {activeVehicle.delta_T > 0 ? `+${activeVehicle.delta_T.toFixed(2)}` : activeVehicle.delta_T.toFixed(2)}s
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300">
                {activeVehicle.schedule_status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Fleet Avg Drift:</span>
              <span className="text-white font-mono">{avgDrift}s</span>
            </div>
          </div>

          {/* Card 3: Route Progress */}
          <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-500/30 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Field Coverage</span>
              <span className="text-base">⌖</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-3xl font-bold font-mono text-emerald-400">
                  {activeVehicle.percent_complete.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {activeVehicle.distance_covered.toFixed(0)} / {route.total_distance.toFixed(0)}m
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, activeVehicle.percent_complete))}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Segment: #{activeVehicle.current_segment_id}</span>
              <span className="text-emerald-400">{activeVehicle.in_turn ? "Turn Arc" : "Straight"}</span>
            </div>
          </div>

          {/* Card 4: Estimated Time Remaining (ETA) */}
          <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-purple-500/30 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">ETA Completion</span>
              <span className="text-base">◈</span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-purple-400">
                {Math.floor(activeVehicle.time_remaining / 60)}:
                {(activeVehicle.time_remaining % 60).toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-slate-400 font-mono">remaining</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Total Plan: {route.total_plan_time.toFixed(0)}s</span>
              <span className="text-purple-300 font-mono">Elapsed: {activeVehicle.time_elapsed}s</span>
            </div>
          </div>
        </div>

        {/* Tab View: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-6">
            {/* Visualizer Row: Route Map + Real-Time Telemetry Curve */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Field SVG Route Map (5 cols) */}
              <div className="lg:col-span-5 h-[520px]">
                <RouteMapSVG
                  route={route}
                  vehicles={fleet}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={setSelectedVehicleId}
                />
              </div>

              {/* Right Column: Dynamic SVG Speed/Drift Chart & Digital Twin Panel (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <TelemetryChartSVG history={history} vehicleId={selectedVehicleId} />
                <DigitalTwinPanel
                  vehicle={activeVehicle}
                  aiActive={aiActive}
                  correctionMode={correctionMode}
                  onToggleAi={toggleAiActive}
                  onSetCorrectionMode={setCorrectionMode}
                  onInjectDelay={handleInjectDelay}
                  onReset={handleReset}
                />
              </div>
            </div>

            {/* Fleet Table Row */}
            <FleetTable
              vehicles={fleet}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />

            {/* Benchmark Footer */}
            <BenchmarkPanel
              metrics={benchmark}
              isConnected={isConnected}
              simulationActive={simulationActive}
              onToggleSimulation={() => setSimulationActive(!simulationActive)}
            />
          </div>
        )}

        {/* Tab View: ROUTE MAP FULLSCREEN */}
        {activeTab === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[680px]">
              <RouteMapSVG
                route={route}
                vehicles={fleet}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-[#0b111d] rounded-2xl border border-white/10 p-5">
                <h3 className="font-semibold text-white text-base mb-2">Serpentine Geometry Spec</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Headland turning arcs conform strictly to Ospina & Noguchi (2025) Eqs. 1-7.
                </p>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Total Route Length:</span>
                    <span className="font-mono text-cyan-400 font-bold">{route.total_distance.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Lane Count:</span>
                    <span className="font-mono text-white font-bold">{route.num_lanes} straight lanes</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Lane Spacing (Row Width):</span>
                    <span className="font-mono text-white font-bold">{route.lane_spacing} m</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Nominal Lane Velocity:</span>
                    <span className="font-mono text-emerald-400 font-bold">1.50 m/s</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Nominal Turn Velocity:</span>
                    <span className="font-mono text-amber-400 font-bold">0.80 m/s</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Headland Arc Radius:</span>
                    <span className="font-mono text-purple-400 font-bold">2.50 m</span>
                  </div>
                </div>
              </div>

              <DigitalTwinPanel
                vehicle={activeVehicle}
                aiActive={aiActive}
                correctionMode={correctionMode}
                onToggleAi={toggleAiActive}
                onSetCorrectionMode={setCorrectionMode}
                onInjectDelay={handleInjectDelay}
                onReset={handleReset}
              />
            </div>
          </div>
        )}

        {/* Tab View: FLEET UNITS */}
        {activeTab === "fleet" && (
          <div className="flex flex-col gap-6">
            <FleetTable
              vehicles={fleet}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DigitalTwinPanel
                vehicle={activeVehicle}
                aiActive={aiActive}
                correctionMode={correctionMode}
                onToggleAi={toggleAiActive}
                onSetCorrectionMode={setCorrectionMode}
                onInjectDelay={handleInjectDelay}
                onReset={handleReset}
              />
              <TelemetryChartSVG history={history} vehicleId={selectedVehicleId} />
            </div>
          </div>
        )}

        {/* Tab View: DIGITAL TWIN */}
        {activeTab === "twin" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <DigitalTwinPanel
                vehicle={activeVehicle}
                aiActive={aiActive}
                correctionMode={correctionMode}
                onToggleAi={toggleAiActive}
                onSetCorrectionMode={setCorrectionMode}
                onInjectDelay={handleInjectDelay}
                onReset={handleReset}
              />
              <TelemetryChartSVG history={history} vehicleId={selectedVehicleId} />
            </div>
            <div className="lg:col-span-5 h-[560px]">
              <RouteMapSVG
                route={route}
                vehicles={fleet}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            </div>
          </div>
        )}

        {/* Tab View: BENCHMARK */}
        {activeTab === "analytics" && (
          <div className="flex flex-col gap-6">
            <BenchmarkPanel
              metrics={benchmark}
              isConnected={isConnected}
              simulationActive={simulationActive}
              onToggleSimulation={() => setSimulationActive(!simulationActive)}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TelemetryChartSVG history={history} vehicleId={selectedVehicleId} />
              <div className="bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Architecture & Model Details</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Edge closed loop execution pipeline: telemetry in &gt; twin forward lookahead &gt; RF speed regression &gt; trajectory differential steering &gt; immediate feedback.
                  </p>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-3 bg-[#060a14] rounded-xl border border-white/5 flex justify-between">
                      <span className="text-slate-400">Primary ML Model:</span>
                      <span className="text-cyan-400 font-bold">RandomForestRegressor (scikit-learn)</span>
                    </div>
                    <div className="p-3 bg-[#060a14] rounded-xl border border-white/5 flex justify-between">
                      <span className="text-slate-400">Lookahead Horizon:</span>
                      <span className="text-emerald-400 font-bold">3.0 seconds forward simulation</span>
                    </div>
                    <div className="p-3 bg-[#060a14] rounded-xl border border-white/5 flex justify-between">
                      <span className="text-slate-400">WebSocket Transport:</span>
                      <span className="text-purple-400 font-bold">FastAPI asyncio connection manager</span>
                    </div>
                    <div className="p-3 bg-[#060a14] rounded-xl border border-white/5 flex justify-between">
                      <span className="text-slate-400">Database Mode:</span>
                      <span className="text-amber-400 font-bold">In-Memory Twins (Scoped to connection)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-slate-400">
                  <span>Target Tick Frequency: 10 Hz (100ms)</span>
                  <span className="text-emerald-400 font-semibold">Latency SLA &lt; 5.0ms</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}