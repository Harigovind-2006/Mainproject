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
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [correctionMode, setCorrectionMode] = useState<"model" | "baseline" | "manual">("model");
  const [simulationActive, setSimulationActive] = useState<boolean>(true);
  const [history, setHistory] = useState<Record<string, TelemetryPoint[]>>({});
  const [benchmark, setBenchmark] = useState<BenchmarkMetrics>({
    total_messages: 1420,
    uptime_seconds: 310,
    messages_per_sec: 14.5,
    avg_latency_ms: 2.14,
    connected_vehicles: 3,
    connected_dashboards: 1,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active vehicle helper
  const activeVehicle = fleet.find((v) => v.vehicle_id === selectedVehicleId) || fleet[0] || initialVehicles[0];

  // Helper to append telemetry history
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

    setHistory((prev) => {
      const list = prev[veh.vehicle_id] || [];
      const updated = [...list, point];
      if (updated.length > 40) updated.shift();
      return { ...prev, [veh.vehicle_id]: updated };
    });
  }, []);

  // Initialize history with mock data
  useEffect(() => {
    const initialHist: Record<string, TelemetryPoint[]> = {};
    fleet.forEach((v) => {
      const points: TelemetryPoint[] = [];
      const baseTime = Date.now() - 30 * 1000;
      for (let i = 0; i < 20; i++) {
        const d = new Date(baseTime + i * 1500);
        const tStr = `${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
        const jitter = (Math.sin(i * 0.5) * 0.15);
        points.push({
          time: tStr,
          timestamp: baseTime + i * 1500,
          actual_speed: Number((v.actual_speed + jitter).toFixed(2)),
          target_speed: v.target_speed,
          ideal_speed: v.ideal_speed,
          delta_T: Number((v.delta_T + jitter * 1.5).toFixed(2)),
          cross_track_error: Number((v.cross_track_error + jitter * 0.2).toFixed(3)),
        });
      }
      initialHist[v.vehicle_id] = points;
    });
    setHistory(initialHist);
  }, []);

  // WebSocket Connection
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
          console.log("[Fleet Tracker] Connected to backend WebSocket");
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
          // Try reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          if (unmounted) return;
          setIsConnected(false);
          ws.close();
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [appendHistory]);

  // Client Simulation Engine (runs when simulationActive is true AND WebSocket is not feeding real live updates, or user overrides)
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      setFleet((currentFleet) => {
        return currentFleet.map((vehicle) => {
          // Advance vehicle along serpentine route
          const stepSeconds = 1.0;
          const nominalLaneSpeed = 1.5;
          const nominalTurnSpeed = 0.8;

          // Determine current segment
          const curSegment = route.segments.find((s) => s.id === vehicle.current_segment_id) || route.segments[0];
          const isTurn = curSegment.type === "turn";
          const plannedSpeed = isTurn ? nominalTurnSpeed : nominalLaneSpeed;

          // Target speed adjusted by AI control if enabled
          let target = vehicle.target_speed;
          if (aiActive) {
            if (correctionMode === "model") {
              // Drift compensation: if behind (delta_T > 0), increase speed; if ahead, decrease
              const compensation = vehicle.delta_T * 0.12;
              target = Math.max(0.6, Math.min(2.4, plannedSpeed + compensation));
            } else if (correctionMode === "baseline") {
              target = vehicle.delta_T > 0.5 ? plannedSpeed + 0.2 : vehicle.delta_T < -0.5 ? plannedSpeed - 0.2 : plannedSpeed;
            }
          } else {
            target = plannedSpeed;
          }

          // Inertia towards target speed
          const actualSpeed = Number((vehicle.actual_speed + (target - vehicle.actual_speed) * 0.25).toFixed(2));
          const newDist = vehicle.distance_covered + actualSpeed * stepSeconds;

          // Check if distance has wrapped or finished
          const boundedDist = newDist > route.total_distance ? 0.0 : newDist;
          const nextSegment = route.segments.find((s) => boundedDist >= s.start_s && boundedDist <= s.end_s) || route.segments[0];

          // Compute coordinates (x, y) along segment
          let nextX = vehicle.x;
          let nextY = vehicle.y;
          let heading = vehicle.heading;
          const segRatio = (boundedDist - nextSegment.start_s) / Math.max(0.001, nextSegment.length);

          if (nextSegment.type === "lane") {
            nextX = nextSegment.start_point[0] + (nextSegment.end_point[0] - nextSegment.start_point[0]) * segRatio;
            nextY = nextSegment.start_point[1] + (nextSegment.end_point[1] - nextSegment.start_point[1]) * segRatio;
            heading = nextSegment.end_point[1] >= nextSegment.start_point[1] ? Math.PI / 2 : -Math.PI / 2;
          } else if (nextSegment.center && nextSegment.radius) {
            const startAngle = nextSegment.start_angle ?? Math.PI;
            const angle = nextSegment.clockwise ? startAngle - segRatio * Math.PI : startAngle + segRatio * Math.PI;
            nextX = nextSegment.center[0] + nextSegment.radius * Math.cos(angle);
            nextY = nextSegment.center[1] + nextSegment.radius * Math.sin(angle);
            heading = nextSegment.clockwise ? angle - Math.PI / 2 : angle + Math.PI / 2;
          }

          // Schedule drift delta_T update
          const nominalTimeForDist = boundedDist / (plannedSpeed || 1.5);
          const timeElapsed = vehicle.time_elapsed + stepSeconds;
          let delta_T = Number((timeElapsed - nominalTimeForDist).toFixed(2));
          if (boundedDist === 0.0) delta_T = 0.0;

          // Schedule status
          const schedule_status = delta_T > 2.0 ? "BEHIND" : delta_T < -2.0 ? "AHEAD" : "ON_SCHEDULE";

          // Cross track error noise
          const crossTrack = Number(((Math.sin(timeElapsed * 0.4) * 0.08)).toFixed(3));
          const steeringAdjust = Number((-crossTrack * 0.45).toFixed(3));

          // Differential wheel speeds
          const wheelBase = 0.6;
          const vLeft = Number((actualSpeed - (steeringAdjust * wheelBase) / 2).toFixed(2));
          const vRight = Number((actualSpeed + (steeringAdjust * wheelBase) / 2).toFixed(2));

          const percentComplete = Number(((boundedDist / route.total_distance) * 100).toFixed(1));
          const timeRemaining = Math.max(0, Math.round((route.total_distance - boundedDist) / Math.max(0.5, actualSpeed)));

          const updated: VehicleTelemetry = {
            ...vehicle,
            x: Number(nextX.toFixed(2)),
            y: Number(nextY.toFixed(2)),
            heading: Number(heading.toFixed(3)),
            actual_speed: actualSpeed,
            target_speed: Number(target.toFixed(2)),
            steering_adjust: steeringAdjust,
            cross_track_error: crossTrack,
            distance_covered: Number(boundedDist.toFixed(1)),
            distance_remaining: Number((route.total_distance - boundedDist).toFixed(1)),
            percent_complete: percentComplete,
            time_elapsed: Math.round(timeElapsed),
            time_remaining: timeRemaining,
            eta_total_time: Math.round(timeElapsed + timeRemaining),
            delta_T: delta_T,
            delta_T_lags: [delta_T, vehicle.delta_T_lags[0], vehicle.delta_T_lags[1]],
            schedule_status,
            current_segment_id: nextSegment.id,
            in_turn: nextSegment.type === "turn",
            last_update_time: Date.now() / 1000,
            wheel_speeds: { left: vLeft, right: vRight },
          };

          return updated;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simulationActive, route, aiActive, correctionMode]);

  // Keep history updated during simulation
  useEffect(() => {
    if (activeVehicle) {
      appendHistory(activeVehicle);
    }
  }, [activeVehicle, appendHistory]);

  // Benchmark stats updater
  useEffect(() => {
    const timer = setInterval(() => {
      setBenchmark((prev) => ({
        ...prev,
        total_messages: prev.total_messages + (isConnected ? 10 : 3),
        uptime_seconds: prev.uptime_seconds + 2,
        messages_per_sec: Number((12 + Math.random() * 4).toFixed(1)),
        avg_latency_ms: Number((1.8 + Math.random() * 0.6).toFixed(2)),
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, [isConnected]);

  // Action methods
  const resetFleet = () => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ action: "RESET_FLEET" }));
    }
    setFleet(initialVehicles);
  };

  const injectDelay = (vehicleId: string, seconds: number) => {
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

  const toggleAiActive = () => {
    setAiActive((prev) => !prev);
  };

  return {
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
    history: history[selectedVehicleId] || [],
    benchmark,
    resetFleet,
    injectDelay,
  };
}
