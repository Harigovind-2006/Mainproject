"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RouteData, VehicleTelemetry, BenchmarkMetrics, WebSocketMessage } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/dashboard";

export interface TelemetryPoint {
  time: string;
  timestamp: number;
  actual_speed: number;
  target_speed: number;
  ideal_speed: number;
  delta_T: number;
  cross_track_error: number;
}

export function useFleetStore() {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [fleet, setFleet] = useState<VehicleTelemetry[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRoverStreaming, setIsRoverStreaming] = useState<boolean>(false);
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [correctionMode, setCorrectionMode] = useState<"model" | "baseline" | "manual">("model");
  const [simulationActive, setSimulationActive] = useState<boolean>(true);
  const [history, setHistory] = useState<Record<string, TelemetryPoint[]>>({});
  const [benchmark, setBenchmark] = useState<BenchmarkMetrics>({
    total_messages: 0,
    uptime_seconds: 0,
    messages_per_sec: 0,
    avg_latency_ms: 0,
    connected_vehicles: 0,
    connected_dashboards: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPacketTimeRef = useRef<number>(0);

  // Active vehicle helper (defaults to selected, or first in live fleet, or null if fleet empty)
  const activeVehicle: VehicleTelemetry | null =
    fleet.find((v) => v.vehicle_id === selectedVehicleId) || fleet[0] || null;

  // Auto-select first vehicle ID when fleet populates if none selected
  useEffect(() => {
    if (fleet.length > 0) {
      if (!selectedVehicleId || !fleet.some((v) => v.vehicle_id === selectedVehicleId)) {
        setSelectedVehicleId(fleet[0].vehicle_id);
      }
    }
  }, [fleet, selectedVehicleId]);

  const lastHistoryTimeRef = useRef<Record<string, number>>({});

  // Helper to append real live telemetry history with smooth throttling
  const appendHistory = useCallback((veh: VehicleTelemetry) => {
    const nowMs = Date.now();
    lastPacketTimeRef.current = nowMs;
    setIsRoverStreaming(true);

    const lastTime = lastHistoryTimeRef.current[veh.vehicle_id] || 0;
    if (nowMs - lastTime < 400) return;
    lastHistoryTimeRef.current[veh.vehicle_id] = nowMs;

    const now = new Date();
    const timeLabel = `${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const point: TelemetryPoint = {
      time: timeLabel,
      timestamp: nowMs,
      actual_speed: veh.actual_speed,
      target_speed: veh.target_speed,
      ideal_speed: veh.ideal_speed,
      delta_T: veh.delta_T,
      cross_track_error: veh.cross_track_error,
    };

    setHistory((prev) => {
      const list = prev[veh.vehicle_id] || [];
      const updated = [...list, point];
      if (updated.length > 60) updated.shift();
      return { ...prev, [veh.vehicle_id]: updated };
    });
  }, []);

  // Fetch initial route, fleet status, and simulation status from REST backend on mount
  const refreshBackendState = useCallback(async () => {
    try {
      const routeRes = await fetch(`${API_BASE_URL}/api/fleet/route`);
      if (routeRes.ok) {
        const routeData = await routeRes.json();
        if (routeData && routeData.segments) {
          setRoute(routeData);
        }
      }
    } catch {
      // Backend not yet reachable
    }

    try {
      const statusRes = await fetch(`${API_BASE_URL}/api/fleet/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData && Array.isArray(statusData.fleet)) {
          setFleet(statusData.fleet);
        }
      }
    } catch {
      // Backend not yet reachable
    }

    try {
      const simRes = await fetch(`${API_BASE_URL}/api/simulation/status`);
      if (simRes.ok) {
        const simData = await simRes.json();
        if (typeof simData.running === "boolean") {
          setSimulationActive(simData.running);
        }
      }
    } catch {
      // Backend not yet reachable
    }
  }, []);

  useEffect(() => {
    refreshBackendState();
  }, [refreshBackendState]);

  // Poll real benchmark metrics from backend
  useEffect(() => {
    let unmounted = false;
    const fetchBenchmark = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/benchmark/metrics`);
        if (res.ok) {
          const data = await res.json();
          if (!unmounted) setBenchmark(data);
        }
      } catch {
        // Backend offline
      }
    };

    fetchBenchmark();
    const interval = setInterval(fetchBenchmark, 1000);
    return () => {
      unmounted = true;
      clearInterval(interval);
    };
  }, []);

  // Track whether simulation is actively streaming packets
  useEffect(() => {
    const checkActivity = setInterval(() => {
      if (Date.now() - lastPacketTimeRef.current > 3000) {
        setIsRoverStreaming(false);
      }
    }, 1500);
    return () => clearInterval(checkActivity);
  }, []);

  // Real-time WebSocket connection to backend
  useEffect(() => {
    let unmounted = false;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(WS_BASE_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          setIsConnected(true);
          console.log("[AgriTrack] Connected to backend live WebSocket");
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            if (data.type === "INITIAL_STATE") {
              if (data.route) setRoute(data.route);
              if (data.fleet && Array.isArray(data.fleet)) {
                setFleet(data.fleet);
                data.fleet.forEach(appendHistory);
              }
            } else if (data.type === "FLEET_STATUS" && Array.isArray(data.fleet)) {
              setFleet(data.fleet);
              data.fleet.forEach(appendHistory);
            } else if (data.type === "VEHICLE_UPDATE" && data.vehicle) {
              const updated = data.vehicle;
              setFleet((prev) => {
                const idx = prev.findIndex((v) => v.vehicle_id === updated.vehicle_id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updated;
                  return next;
                }
                return [...prev, updated];
              });
              appendHistory(updated);
            }
          } catch (e) {
            console.error("WS Parse error:", e);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          setIsConnected(false);
          setIsRoverStreaming(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = () => {
          if (unmounted) return;
          setIsConnected(false);
          ws.close();
        };
      } catch {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [appendHistory]);

  // Action methods
  const resetFleet = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/fleet/reset`, { method: "POST" });
    } catch {}

    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "RESET_FLEET" }));
    }
    setHistory({});
    // Fetch refreshed real state from backend instead of dummy data
    await refreshBackendState();
  };

  const injectDelay = async (vehicleId: string, seconds: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/fleet/inject-delay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicleId, seconds }),
      });
    } catch {}

    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "INJECT_DELAY", vehicle_id: vehicleId, seconds }));
    }
  };

  const handleSetCorrectionMode = async (mode: "model" | "baseline" | "manual") => {
    setCorrectionMode(mode);
    try {
      await fetch(`${API_BASE_URL}/api/fleet/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch {}

    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "SET_MODE", mode }));
    }
  };

  const handleSetSimulationActive = async (active: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof active === "function" ? active(simulationActive) : active;
    setSimulationActive(nextVal);

    try {
      const endpoint = nextVal ? "/api/simulation/start" : "/api/simulation/stop";
      await fetch(`${API_BASE_URL}${endpoint}`, { method: "POST" });
    } catch {}

    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "TOGGLE_SIMULATION", active: nextVal }));
    }
  };

  const toggleAiActive = () => {
    setAiActive((prev) => {
      const nextVal = !prev;
      const targetMode = nextVal ? "model" : "off";
      fetch(`${API_BASE_URL}/api/fleet/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode }),
      }).catch(() => {});

      if (wsRef.current && isConnected) {
        wsRef.current.send(JSON.stringify({ action: "SET_MODE", mode: targetMode }));
      }
      return nextVal;
    });
  };

  return {
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
    setCorrectionMode: handleSetCorrectionMode,
    simulationActive,
    setSimulationActive: handleSetSimulationActive,
    history: activeVehicle ? history[activeVehicle.vehicle_id] || [] : [],
    benchmark,
    resetFleet,
    injectDelay,
    refreshBackendState,
  };
}
