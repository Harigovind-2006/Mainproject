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
    isRoverStreaming,
    aiActive,
    toggleAiActive,
    correctionMode,
    setCorrectionMode,
    simulationActive,
    setSimulationActive,
    history,
    benchmark,
    etaConfigured,
    plannedHours,
    resetFleet,
    injectDelay,
    setPlannedTime,
    stopRover,
    resumeRover,
    refreshBackendState,
  } = useFleetStore();

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Track stopped state per vehicle on the frontend for immediate UI feedback
  const [stoppedVehicles, setStoppedVehicles] = useState<Set<string>>(new Set());
  // Mission setup modal ETA input
  const [etaInput, setEtaInput] = useState<string>("");
  const [etaError, setEtaError] = useState<string | null>(null);
  const [etaSubmitting, setEtaSubmitting] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ---- Mission Setup: ETA submit ----
  const handleEtaSubmit = async () => {
    const val = parseFloat(etaInput);
    if (isNaN(val) || val <= 0) {
      setEtaError("Please enter a valid number of hours (e.g. 1.5 for 1 hour 30 minutes).");
      return;
    }
    setEtaSubmitting(true);
    await setPlannedTime(val);
    setEtaSubmitting(false);
    setEtaInput("");
    setEtaError(null);
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    showToast(`✅ Mission started! ETA: ${h}h ${m}m — Rover is now moving.`);
  };

  const handleInjectDelay = (seconds: number) => {
    if (!activeVehicle) {
      showToast("No active vehicle selected.");
      return;
    }
    injectDelay(activeVehicle.vehicle_id, seconds);
    showToast(
      seconds > 0
        ? `Injected +${seconds}s schedule delay on ${activeVehicle.vehicle_id}`
        : `Applied pacing boost ${seconds}s on ${activeVehicle.vehicle_id}`
    );
  };

  const handleSetPlannedTime = (hours: number) => {
    setPlannedTime(hours);
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    showToast(`ETA updated to ${h}h ${m}m. Rover speed adjusted.`);
  };

  const handleStopRover = (vehicleId: string) => {
    stopRover(vehicleId);
    setStoppedVehicles((prev) => new Set([...prev, vehicleId]));
    showToast(`Rover ${vehicleId} commanded to STOP.`);
  };

  const handleResumeRover = (vehicleId: string) => {
    resumeRover(vehicleId);
    setStoppedVehicles((prev) => {
      const next = new Set(prev);
      next.delete(vehicleId);
      return next;
    });
    showToast(`Rover ${vehicleId} commanded to RESUME.`);
  };

  const handleReset = async () => {
    await resetFleet();
    setStoppedVehicles(new Set());
    showToast("Fleet digital twins and route progress reset.");
  };

  const vehicleIds = fleet.map((v) => v.vehicle_id);

  // Compute fleet wide KPI averages safely
  const avgSpeed = fleet.length > 0
    ? (fleet.reduce((acc, v) => acc + (v.actual_speed || 0), 0) / fleet.length).toFixed(2)
    : "--";
  const avgDrift = fleet.length > 0
    ? (fleet.reduce((acc, v) => acc + (v.delta_T || 0), 0) / fleet.length).toFixed(2)
    : "--";
  const avgProgress = fleet.length > 0
    ? (fleet.reduce((acc, v) => acc + (v.percent_complete || 0), 0) / fleet.length).toFixed(1)
    : "--";

  return (
    <main className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* ===================== MISSION SETUP MODAL ===================== */}
      {!etaConfigured && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030609]/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-[#0a0f1d] border border-cyan-500/30 rounded-3xl shadow-2xl p-8 flex flex-col gap-6 relative">
            {/* Glow effect */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-cyan-500/10 blur-2xl rounded-full pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-3xl shadow-inner">
                🚜
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Mission Setup & ETA</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                Configure the target mission completion time in <strong className="text-cyan-300">hours</strong>.
                The rover is currently stopped and will automatically scale its speed to complete the entire route within your desired ETA.
              </p>
            </div>

            {/* Route Summary */}
            {route && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#060a14] rounded-2xl p-3.5 border border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Route Distance</div>
                  <div className="text-lg font-bold font-mono text-cyan-400 mt-1">{route.total_distance.toFixed(1)} m</div>
                </div>
                <div className="bg-[#060a14] rounded-2xl p-3.5 border border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Default Plan Time</div>
                  <div className="text-lg font-bold font-mono text-purple-400 mt-1">{(route.total_plan_time / 3600).toFixed(2)} hr</div>
                </div>
              </div>
            )}

            {/* Quick Preset Buttons */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Quick Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "30 min", val: "0.5" },
                  { label: "1 hour", val: "1.0" },
                  { label: "1.5 hr", val: "1.5" },
                  { label: "2 hours", val: "2.0" },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      setEtaInput(preset.val);
                      setEtaError(null);
                    }}
                    className={`py-2 px-2 text-xs font-mono font-medium rounded-xl border transition ${
                      etaInput === preset.val
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ETA Input Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="mission-eta-input" className="text-xs text-slate-300 font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Target Completion Time (Hours)</span>
                <span className="text-[10px] text-cyan-400 font-mono">e.g. 1.5 = 1 hr 30 min</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    id="mission-eta-input"
                    type="number"
                    min="0.01"
                    step="0.25"
                    placeholder="Enter hours (e.g. 1.0)"
                    value={etaInput}
                    onChange={(e) => {
                      setEtaInput(e.target.value);
                      setEtaError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleEtaSubmit()}
                    autoFocus
                    className="w-full bg-[#060a14] border border-white/10 focus:border-cyan-500/60 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none placeholder-slate-600 transition-all pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono pointer-events-none">
                    hr
                  </span>
                </div>
                <button
                  id="mission-start-btn"
                  onClick={handleEtaSubmit}
                  disabled={etaSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                >
                  {etaSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <span>▶</span>
                      <span>Start Mission</span>
                    </>
                  )}
                </button>
              </div>
              {etaError && <p className="text-xs text-red-400">{etaError}</p>}
              <p className="text-[11px] text-slate-500 mt-1">
                The rover will start moving immediately after setting the target ETA. You can adjust the ETA or pause the rover at any point during operation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        isConnected={isConnected}
        isRoverStreaming={isRoverStreaming}
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
        {/* Backend Connectivity Status Alert if disconnected */}
        {!isConnected && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>
                <strong>Backend WebSocket Offline:</strong> Attempting reconnection to{" "}
                <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-amber-200">
                  ws://localhost:8000/ws/dashboard
                </code>
                . Ensure the FastAPI backend server is running.
              </span>
            </div>
            <button
              onClick={() => refreshBackendState()}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold self-start sm:self-auto transition"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Top Control Bar / Hero Banner */}
        <div className="bg-gradient-to-r from-[#0b111d] via-[#0d1627] to-[#0b111d] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isRoverStreaming ? "bg-emerald-400 animate-pulse" : isConnected ? "bg-cyan-400" : "bg-slate-500"}`} />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Fleet Mission Control & Closed-Loop Correction
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Autonomous agricultural rover guidance • Ospina & Noguchi (2025) kinematic formulation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* ETA Mission Status Pill */}
            {!etaConfigured ? (
              <div className="px-3 py-1.5 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Rover STOPPED • Awaiting ETA</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-xl border bg-purple-500/10 border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Target ETA: {plannedHours ? (plannedHours >= 1 ? `${plannedHours.toFixed(2)} hr` : `${(plannedHours * 60).toFixed(0)} min`) : "--"}</span>
              </div>
            )}

            {/* Simulation Status Pill */}
            <button
              onClick={() => setSimulationActive(!simulationActive)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                simulationActive
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                  : "bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-slate-500/20"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${simulationActive ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
              <span>{simulationActive ? "Simulation ACTIVE" : "Simulation PAUSED"}</span>
            </button>

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
                {activeVehicle ? activeVehicle.actual_speed.toFixed(2) : "--"}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {activeVehicle ? `/ ${activeVehicle.target_speed.toFixed(2)} m/s` : "m/s"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Ideal: {activeVehicle ? `${activeVehicle.ideal_speed.toFixed(2)} m/s` : "--"}</span>
              <span className="text-cyan-400 font-mono">{activeVehicle ? activeVehicle.vehicle_id : "No Unit"}</span>
            </div>
          </div>

          {/* Card 2: Schedule Drift delta_T */}
          <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-violet-500/30 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Schedule Drift (ΔT)</span>
              <span className="text-base">⏱</span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              {activeVehicle ? (
                <>
                  <span
                    className={`text-3xl font-bold font-mono ${
                      activeVehicle.schedule_status === "BEHIND"
                        ? "text-amber-400"
                        : activeVehicle.schedule_status === "AHEAD"
                        ? "text-cyan-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {activeVehicle.delta_T > 0 ? `+${activeVehicle.delta_T.toFixed(2)}` : activeVehicle.delta_T.toFixed(2)}s
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300">
                    {activeVehicle.schedule_status.replace("_", " ")}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold font-mono text-slate-500">--</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Fleet Avg Drift:</span>
              <span className="text-white font-mono">{avgDrift !== "--" ? `${avgDrift}s` : "--"}</span>
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
                  {activeVehicle ? `${activeVehicle.percent_complete.toFixed(1)}%` : "--"}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {activeVehicle && route
                    ? `${activeVehicle.distance_covered.toFixed(0)} / ${route.total_distance.toFixed(0)}m`
                    : "--"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${activeVehicle ? Math.min(100, Math.max(0, activeVehicle.percent_complete)) : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>Segment: {activeVehicle ? `#${activeVehicle.current_segment_id}` : "--"}</span>
              <span className="text-emerald-400">
                {activeVehicle ? (activeVehicle.in_turn ? "Turn Arc" : "Straight") : "Standby"}
              </span>
            </div>
          </div>

          {/* Card 4: Estimated Time Remaining (ETA) */}
          <div className="bg-[#0b111d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-purple-500/30 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">ETA Completion</span>
              <span className="text-base">◈</span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              {!etaConfigured ? (
                <div className="flex flex-col">
                  <span className="text-xl font-bold font-mono text-amber-400">Awaiting ETA</span>
                  <span className="text-[11px] text-slate-500 font-sans">Set mission time to start</span>
                </div>
              ) : activeVehicle ? (
                <>
                  <span className="text-3xl font-bold font-mono text-purple-400">
                    {Math.floor(activeVehicle.time_remaining / 3600) > 0 ? (
                      <>
                        {Math.floor(activeVehicle.time_remaining / 3600)}h{" "}
                        {Math.floor((activeVehicle.time_remaining % 3600) / 60)}m
                      </>
                    ) : (
                      <>
                        {Math.floor(activeVehicle.time_remaining / 60)}:
                        {Math.floor(activeVehicle.time_remaining % 60).toString().padStart(2, "0")}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">remaining</span>
                </>
              ) : (
                <span className="text-3xl font-bold font-mono text-slate-500">--</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
              <span>
                {plannedHours
                  ? `Target: ${plannedHours >= 1 ? `${plannedHours.toFixed(2)} hr` : `${(plannedHours * 60).toFixed(0)} min`}`
                  : route
                  ? `Default: ${(route.total_plan_time / 3600).toFixed(2)} hr`
                  : "--"}
              </span>
              <span className="text-purple-300 font-mono">
                {activeVehicle ? `Elapsed: ${(activeVehicle.time_elapsed / 60).toFixed(1)}m` : "--"}
              </span>
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
                <TelemetryChartSVG history={history} vehicleId={selectedVehicleId || "rover-alpha"} />
                <DigitalTwinPanel
                  vehicle={activeVehicle}
                  aiActive={aiActive}
                  correctionMode={correctionMode}
                  onToggleAi={toggleAiActive}
                  onSetCorrectionMode={setCorrectionMode}
                  onInjectDelay={handleInjectDelay}
                  onReset={handleReset}
                  onSetPlannedTime={handleSetPlannedTime}
                  onStopRover={handleStopRover}
                  onResumeRover={handleResumeRover}
                  roverStopped={activeVehicle ? stoppedVehicles.has(activeVehicle.vehicle_id) : false}
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
              isRoverStreaming={isRoverStreaming}
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
                    <span className="font-mono text-cyan-400 font-bold">
                      {route ? `${route.total_distance.toFixed(2)} m` : "Loading..."}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Lane Count:</span>
                    <span className="font-mono text-white font-bold">
                      {route ? `${route.num_lanes} straight lanes` : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Lane Spacing (Row Width):</span>
                    <span className="font-mono text-white font-bold">
                      {route ? `${route.lane_spacing} m` : "--"}
                    </span>
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
                onSetPlannedTime={handleSetPlannedTime}
                onStopRover={handleStopRover}
                onResumeRover={handleResumeRover}
                roverStopped={activeVehicle ? stoppedVehicles.has(activeVehicle.vehicle_id) : false}
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
                onSetPlannedTime={handleSetPlannedTime}
                onStopRover={handleStopRover}
                onResumeRover={handleResumeRover}
                roverStopped={activeVehicle ? stoppedVehicles.has(activeVehicle.vehicle_id) : false}
              />
              <TelemetryChartSVG history={history} vehicleId={selectedVehicleId || "rover-alpha"} />
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
                onSetPlannedTime={handleSetPlannedTime}
                onStopRover={handleStopRover}
                onResumeRover={handleResumeRover}
                roverStopped={activeVehicle ? stoppedVehicles.has(activeVehicle.vehicle_id) : false}
              />
              <TelemetryChartSVG history={history} vehicleId={selectedVehicleId || "rover-alpha"} />
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
              isRoverStreaming={isRoverStreaming}
              simulationActive={simulationActive}
              onToggleSimulation={() => setSimulationActive(!simulationActive)}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TelemetryChartSVG history={history} vehicleId={selectedVehicleId || "rover-alpha"} />
              <div className="bg-[#0a0f1d] rounded-2xl border border-white/10 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Architecture & Model Details</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Edge closed-loop execution pipeline: telemetry in &gt; twin forward lookahead &gt; RF speed regression &gt; trajectory differential steering &gt; immediate feedback.
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