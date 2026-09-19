import asyncio
import json
import logging
import time
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket

from vehicle_twin import VehicleTwin
from speed_correction import speed_engine
from trajectory_correction import trajectory_controller
from route_model import default_route

logger = logging.getLogger("backend.connection_manager")

class ConnectionManager:
    """
    Manages active WebSocket connections for:
    1. Autonomous vehicles (ESP32 or simulated)
    2. Authenticated monitoring dashboards
    Handles closed-loop telemetry processing, twin forward lookaheads, and broadcasts.
    """
    def __init__(self):
        self.vehicle_connections: Dict[str, WebSocket] = {}
        self.dashboard_connections: Set[WebSocket] = set()
        self.twins: Dict[str, VehicleTwin] = {}

        # Benchmarking / load statistics
        self.message_count: int = 0
        self.start_benchmark_time: float = time.time()
        self.total_processing_latency_ms: float = 0.0

    async def connect_vehicle(self, vehicle_id: str, websocket: WebSocket):
        await websocket.accept()
        self.vehicle_connections[vehicle_id] = websocket
        if vehicle_id not in self.twins:
            self.twins[vehicle_id] = VehicleTwin(vehicle_id=vehicle_id, route=default_route)
        logger.info(f"Vehicle '{vehicle_id}' connected. Total vehicles: {len(self.vehicle_connections)}")
        await self.broadcast_fleet_status()

    def disconnect_vehicle(self, vehicle_id: str):
        if vehicle_id in self.vehicle_connections:
            del self.vehicle_connections[vehicle_id]
            logger.info(f"Vehicle '{vehicle_id}' disconnected. Remaining: {len(self.vehicle_connections)}")

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.dashboard_connections.add(websocket)
        logger.info(f"Dashboard connected. Total dashboards: {len(self.dashboard_connections)}")
        # Send initial full fleet state
        await websocket.send_json({
            "type": "INITIAL_STATE",
            "fleet": [twin.to_dict() for twin in self.twins.values()],
            "route": default_route.to_dict()
        })

    def disconnect_dashboard(self, websocket: WebSocket):
        self.dashboard_connections.discard(websocket)
        logger.info(f"Dashboard disconnected. Remaining: {len(self.dashboard_connections)}")

    async def handle_vehicle_telemetry(
        self,
        vehicle_id: str,
        data: Dict[str, Any],
        mode: str = "model"
    ) -> Dict[str, Any]:
        """
        Executes the closed-loop per-tick message pipeline:
        1. Parse telemetry (x, y, speed, timestamp)
        2. Update VehicleTwin and compute delta_T
        3. Compute speed & trajectory corrections
        4. Validate candidate correction with twin forward lookahead
        5. Return correction packet for vehicle
        6. Broadcast updated state to all dashboards
        """
        t_start = time.perf_counter()

        twin = self.twins.get(vehicle_id)
        if not twin:
            twin = VehicleTwin(vehicle_id=vehicle_id, route=default_route)
            self.twins[vehicle_id] = twin

        pos = data.get("position", [0.0, 0.0])
        x, y = float(pos[0]), float(pos[1])
        speed = float(data.get("speed", 0.0))
        timestamp = float(data.get("timestamp", time.time()))

        # 1. Update twin state & compute progress / delta_T
        twin.update_telemetry(x, y, speed, timestamp)

        # 2. Compute Speed Correction
        lag_features = twin.get_lag_features()
        target_speed = speed_engine.compute_speed_correction(
            current_speed=twin.actual_speed,
            delta_T=twin.delta_T,
            lag_features=lag_features,
            distance_remaining=max(0.0, twin.route.total_distance - twin.distance_covered),
            in_turn=twin.in_turn,
            mode=mode
        )

        # 3. Compute Trajectory Correction (signed cross-track)
        steering_adjust = trajectory_controller.compute_steering(twin.cross_track_error)
        v_left, v_right = trajectory_controller.compute_differential_speeds(target_speed, steering_adjust)

        # 4. Forward lookahead validation via twin
        lookahead = twin.forward_predict(candidate_speed=target_speed, lookahead_seconds=3.0)

        # Update twin's active targets
        twin.target_speed = target_speed
        twin.steering_adjust = steering_adjust

        t_end = time.perf_counter()
        latency_ms = (t_end - t_start) * 1000.0

        # Benchmarking metrics
        self.message_count += 1
        self.total_processing_latency_ms += latency_ms

        response = {
            "vehicle_id": vehicle_id,
            "target_speed": round(target_speed, 3),
            "steering_adjust": round(steering_adjust, 4),
            "wheel_speeds": {
                "left": v_left,
                "right": v_right
            },
            "delta_T": round(twin.delta_T, 2),
            "percent_complete": round(twin.percent_complete, 1),
            "lookahead_validated": lookahead["improves_or_stabilizes"],
            "server_latency_ms": round(latency_ms, 2),
            "timestamp": time.time()
        }

        # Broadcast update to all active dashboards asynchronously
        asyncio.create_task(self.broadcast_vehicle_update(twin.to_dict()))

        return response

    async def broadcast_vehicle_update(self, twin_dict: Dict[str, Any]):
        if not self.dashboard_connections:
            return
        payload = {
            "type": "VEHICLE_UPDATE",
            "vehicle": twin_dict
        }
        stale_connections = set()
        for ws in self.dashboard_connections:
            try:
                await ws.send_json(payload)
            except Exception:
                stale_connections.add(ws)

        for stale in stale_connections:
            self.dashboard_connections.discard(stale)

    async def broadcast_fleet_status(self):
        if not self.dashboard_connections:
            return
        payload = {
            "type": "FLEET_STATUS",
            "fleet": [twin.to_dict() for twin in self.twins.values()],
            "active_count": len(self.vehicle_connections)
        }
        stale = set()
        for ws in self.dashboard_connections:
            try:
                await ws.send_json(payload)
            except Exception:
                stale.add(ws)
        for s in stale:
            self.dashboard_connections.discard(s)

    def get_benchmark_metrics(self) -> Dict[str, Any]:
        uptime = max(0.001, time.time() - self.start_benchmark_time)
        avg_latency = (self.total_processing_latency_ms / self.message_count) if self.message_count > 0 else 0.0
        msg_per_sec = self.message_count / uptime
        return {
            "total_messages": self.message_count,
            "uptime_seconds": round(uptime, 1),
            "messages_per_sec": round(msg_per_sec, 2),
            "avg_latency_ms": round(avg_latency, 3),
            "connected_vehicles": len(self.vehicle_connections),
            "connected_dashboards": len(self.dashboard_connections)
        }

manager = ConnectionManager()
