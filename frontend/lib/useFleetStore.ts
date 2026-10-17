"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RouteData, VehicleTelemetry, BenchmarkMetrics, WebSocketMessage } from "./types";
import { initialRoute, initialVehicles } from "./mockData";

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
  const [route, setRoute] = useState<RouteData>(initialRoute);
  const [fleet, setFleet] = useState<VehicleTelemetry[]>(initialVehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("rover-alpha");
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

  // Active vehicle helper
  const activeVehicle = fleet.find((v) => v.vehicle_id === selectedVehicleId) || fleet[0] || initialVehicles[0];

  // Helper to append real live telemetry history
  const appendHistory = useCallback((veh: VehicleTelemetry) => {
    const now = new Date();
    const timeLabel = `${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const point: TelemetryPoint = {
      time: timeLabel,
      timestamp: Date.now(),
      actual_speed: veh.actual_speed,
      target_speed: veh.target_speed,
      ideal_speed: veh.ideal_speed,
      delta_T: veh.delta_T,
      cross_track_error: veh.cross_track_error,
    };

    lastPacketTimeRef.current = Date.now();
    setIsRoverStreaming(true);

    setHistory((prev) => {
      const list = prev[veh.vehicle_id] || [];
      const updated = [...list, point];
      // Keep up to 60 live points for the chart
      if (updated.length > 60) updated.shift();
      return { ...prev, [veh.vehicle_id]: updated };
    });
  }, []);

  // Fetch initial route and fleet status from REST backend on mount
  useEffect(() => {
    fetch("http://localhost:8000/api/fleet/route")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.segments) setRoute(data);
      })
      .catch(() => {});

    fetch("http://localhost:8000/api/fleet/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.fleet && data.fleet.length > 0) {
          setFleet(data.fleet);
        }
      })
      .catch(() => {});
  }, []);

  // Poll real benchmark metrics from backend
  useEffect(() => {
    let unmounted = false;
    const fetchBenchmark = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/benchmark/metrics");
        if (res.ok) {
          const data = await res.json();
          if (!unmounted) setBenchmark(data);
        }
      } catch (err) {
        // Backend not reachable
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
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/dashboard";
      try {
        const ws = new WebSocket(wsUrl);
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
              if (data.fleet && data.fleet.length > 0) {
                setFleet(data.fleet);
                data.fleet.forEach(appendHistory);
              }
            } else if (data.type === "FLEET_STATUS" && data.fleet) {
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
                return [updated];
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
      } catch (err) {
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
      await fetch("http://localhost:8000/api/fleet/reset", { method: "POST" });
    } catch (e) {}

    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "RESET_FLEET" }));
    }
    setFleet(initialVehicles);
    setHistory({});
  };

  const injectDelay = (vehicleId: string, seconds: number) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "INJECT_DELAY", vehicle_id: vehicleId, seconds }));
    }
    setFleet((prev) =>
      prev.map((v) => {
        if (v.vehicle_id === vehicleId) {
          const newDeltaT = Number((v.delta_T + seconds).toFixed(2));
          return {
            ...v,
            delta_T: newDeltaT,
            time_elapsed: v.time_elapsed + seconds,
            schedule_status: newDeltaT > 2.0 ? "BEHIND" : "ON_SCHEDULE",
          };
        }
        return v;
      })
    );
  };

  const handleSetCorrectionMode = (mode: "model" | "baseline" | "manual") => {
    setCorrectionMode(mode);
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "SET_MODE", mode }));
    }
  };

  const handleSetSimulationActive = (active: boolean | ((prev: boolean) => boolean)) => {
    setSimulationActive((prev) => {
      const nextVal = typeof active === "function" ? active(prev) : active;
      if (wsRef.current && isConnected) {
        wsRef.current.send(JSON.stringify({ action: "TOGGLE_SIMULATION", active: nextVal }));
      }
      return nextVal;
    });
  };

  const toggleAiActive = () => {
    setAiActive((prev) => {
      const nextVal = !prev;
      if (wsRef.current && isConnected) {
        wsRef.current.send(JSON.stringify({ action: "SET_MODE", mode: nextVal ? "model" : "off" }));
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
    history: history[selectedVehicleId] || [],
    benchmark,
    resetFleet,
    injectDelay,
  };
}
