import asyncio
import logging
import math
import time
from typing import Dict, Any, List, Optional

from config import settings
from route_model import default_route
from connection_manager import manager

logger = logging.getLogger("backend.fleet_simulator")


class SimulatedRoverAgent:
    """Represents a simulated autonomous rover running on the field."""
    def __init__(self, vehicle_id: str, initial_s: float = 0.0):
        self.vehicle_id = vehicle_id
        self.s = initial_s
        self.speed = default_route.planned_lane_speed
        self.target_speed = default_route.planned_lane_speed
        self.battery_level = 98.5
        self.time_offset = 0.0

    def step(self, dt: float) -> Dict[str, Any]:
        """Advances physical state and generates telemetry payload."""
        # 1. Physics: inertia toward commanded target speed
        self.speed += (self.target_speed - self.speed) * min(1.0, 3.0 * dt)
        self.speed = max(0.1, min(settings.V_MAX + 0.5, self.speed))

        # 2. Advance along route
        self.s += self.speed * dt
        if self.s > default_route.total_distance:
            self.s = self.s % default_route.total_distance

        # 3. Path coordinates + subtle physical slip / cross-track disturbance
        rx, ry, r_heading = default_route.get_coordinates_at_distance(self.s)
        # Subtle noise simulating terrain bump
        noise_cte = 0.04 * math.sin(time.time() * 0.8 + hash(self.vehicle_id) % 10)
        # Offset perpendicular to heading
        px = rx - noise_cte * math.sin(r_heading)
        py = ry + noise_cte * math.cos(r_heading)

        # 4. Battery drain (very slow)
        self.battery_level = max(10.0, self.battery_level - (dt * 0.002))

        return {
            "vehicle_id": self.vehicle_id,
            "position": [round(px, 3), round(py, 3)],
            "speed": round(self.speed, 2),
            "timestamp": time.time() + self.time_offset,
            "battery_level": round(self.battery_level, 1),
        }

    def reset(self, initial_s: float):
        self.s = initial_s
        self.speed = default_route.planned_lane_speed
        self.target_speed = default_route.planned_lane_speed
        self.time_offset = 0.0


class FleetSimulator:
    """
    Background simulation manager running autonomous agents inside the backend.
    Streams telemetry through the live Closed-Loop Twin & ML engine.
    """
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False
        self.mode: str = "model"  # "model", "fixed", "off"
        self.update_interval: float = settings.SIMULATOR_UPDATE_INTERVAL

        # Staggered default fleet
        self.rovers: Dict[str, SimulatedRoverAgent] = {
            "rover-alpha": SimulatedRoverAgent("rover-alpha", initial_s=0.0),
            "rover-beta": SimulatedRoverAgent("rover-beta", initial_s=38.0),
            "rover-gamma": SimulatedRoverAgent("rover-gamma", initial_s=85.0),
        }

    @property
    def is_running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    def start(self):
        if self.is_running:
            return
        self._running = True
        self._task = asyncio.create_task(self._simulation_loop())
        logger.info(f"Integrated Fleet Simulator started with {len(self.rovers)} vehicles (mode='{self.mode}')")

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
        logger.info("Integrated Fleet Simulator stopped.")

    def reset(self):
        """Resets all simulated rovers and digital twins."""
        stagger = [0.0, 38.0, 85.0]
        for i, rover in enumerate(self.rovers.values()):
            init_s = stagger[i % len(stagger)]
            rover.reset(init_s)
        asyncio.create_task(manager.reset_fleet_twins())
        logger.info("Fleet Simulator vehicles reset to starting positions.")

    def inject_delay(self, vehicle_id: str, seconds: float):
        """Logs injected delay for simulated rover."""
        logger.info(f"Injected {seconds}s schedule delay to '{vehicle_id}'")

    def set_mode(self, mode: str):
        if mode in ("model", "fixed", "off", "baseline", "manual"):
            # Map baseline -> fixed
            self.mode = "fixed" if mode in ("fixed", "baseline") else ("off" if mode in ("off", "manual") else "model")
            logger.info(f"Fleet Simulator correction mode updated to '{self.mode}'")

    async def _simulation_loop(self):
        last_tick = time.perf_counter()
        while self._running:
            try:
                now = time.perf_counter()
                dt = max(0.01, min(1.0, now - last_tick))
                last_tick = now

                for vehicle_id, rover in self.rovers.items():
                    telemetry_packet = rover.step(dt)
                    # Feed through the core closed-loop pipeline
                    correction = await manager.handle_vehicle_telemetry(
                        vehicle_id=vehicle_id,
                        data=telemetry_packet,
                        mode=self.mode
                    )
                    # Apply returned target speed to rover physics
                    rover.target_speed = correction.get("target_speed", rover.speed)

                await asyncio.sleep(self.update_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in FleetSimulator loop: {e}", exc_info=True)
                await asyncio.sleep(1.0)


fleet_simulator = FleetSimulator()
