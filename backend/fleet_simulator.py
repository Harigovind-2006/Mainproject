import asyncio
import logging
import math
import time
from typing import Dict, Any, Optional

from config import settings
from route_model import default_route
from connection_manager import manager

logger = logging.getLogger("backend.fleet_simulator")


class SimulatedRoverAgent:
    """Represents a simulated autonomous rover running on the field."""

    def __init__(self, vehicle_id: str, initial_s: float = 0.0):
        self.vehicle_id = vehicle_id
        self.s = initial_s
        self.speed = 0.0
        self.target_speed = default_route.planned_lane_speed
        self.battery_level = 98.5
        self.time_offset = 0.0
        # Rover starts STOPPED – waits for operator ETA before moving
        self.stopped: bool = True

    def step(self, dt: float) -> Dict[str, Any]:
        """Advances physical state and generates telemetry payload."""
        if self.stopped:
            # Hold position while awaiting ETA / operator stop
            self.speed = 0.0
            rx, ry, _ = default_route.get_coordinates_at_distance(self.s)
            return {
                "vehicle_id": self.vehicle_id,
                "position": [round(rx, 3), round(ry, 3)],
                "speed": 0.0,
                "timestamp": time.time() + self.time_offset,
                "battery_level": round(self.battery_level, 1),
            }

        # 1. Physics: inertia toward commanded target speed
        self.speed += (self.target_speed - self.speed) * min(1.0, 3.0 * dt)
        self.speed = max(0.1, min(settings.V_MAX + 0.5, self.speed))

        # 2. Advance along route
        self.s += self.speed * dt
        if self.s > default_route.total_distance:
            self.s = self.s % default_route.total_distance

        # 3. Path coordinates + subtle terrain noise
        rx, ry, r_heading = default_route.get_coordinates_at_distance(self.s)
        noise_cte = 0.04 * math.sin(time.time() * 0.8 + hash(self.vehicle_id) % 10)
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

    def reset(self, initial_s: float = 0.0):
        self.s = initial_s
        self.speed = 0.0
        self.target_speed = default_route.planned_lane_speed
        self.time_offset = 0.0
        self.stopped = True  # wait for a new ETA after reset


class FleetSimulator:
    """
    Background simulation manager running a single autonomous rover.
    The rover starts STOPPED and waits until the operator sets an ETA
    via set_planned_time().  Only then does it begin field traversal.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False
        self.mode: str = "model"  # "model" | "fixed" | "off"
        self.update_interval: float = settings.SIMULATOR_UPDATE_INTERVAL
        self.planned_seconds: Optional[float] = None  # set by operator

        # Single rover – starts STOPPED, waiting for ETA
        self.rovers: Dict[str, SimulatedRoverAgent] = {
            "rover-alpha": SimulatedRoverAgent("rover-alpha", initial_s=0.0),
        }

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    @property
    def eta_configured(self) -> bool:
        """True once the operator has provided a planned completion time."""
        return self.planned_seconds is not None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self):
        if self.is_running:
            return
        self._running = True
        self._task = asyncio.create_task(self._simulation_loop())
        logger.info(
            f"Fleet Simulator started – 1 rover (mode='{self.mode}'). "
            f"Rover is {'running' if not self.rovers['rover-alpha'].stopped else 'STOPPED – awaiting ETA'}."
        )

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
        logger.info("Integrated Fleet Simulator stopped.")

    def reset(self):
        """Resets rover to start position and clears ETA; rover waits again."""
        self.planned_seconds = None
        for rover in self.rovers.values():
            rover.reset(0.0)
        asyncio.create_task(manager.reset_fleet_twins())
        logger.info("Rover reset to start. Awaiting new ETA from operator.")

    # ------------------------------------------------------------------
    # Control commands
    # ------------------------------------------------------------------

    def inject_delay(self, vehicle_id: str, seconds: float):
        logger.info(f"Injected {seconds}s delay to '{vehicle_id}'")

    def stop_rover(self, vehicle_id: str) -> bool:
        """Halts a specific rover in place."""
        rover = self.rovers.get(vehicle_id)
        if rover:
            rover.stopped = True
            logger.info(f"Rover '{vehicle_id}' → STOPPED by operator.")
            return True
        return False

    def resume_rover(self, vehicle_id: str) -> bool:
        """Resumes a stopped rover (requires ETA to have been set)."""
        rover = self.rovers.get(vehicle_id)
        if not rover:
            return False
        if not self.eta_configured:
            logger.warning(f"Cannot resume '{vehicle_id}': no ETA set yet.")
            return False
        rover.stopped = False
        if self.planned_seconds:
            speed = max(0.3, min(settings.V_MAX, default_route.total_distance / self.planned_seconds))
            rover.target_speed = speed
        logger.info(f"Rover '{vehicle_id}' → RESUMED by operator.")
        return True

    def set_planned_time(self, seconds: float):
        """
        Primary trigger to start rover operation.
        Accepts total route completion time in **seconds** (caller converts hrs→s).
        Computes required average speed, stores ETA, and releases the rover.
        """
        if seconds <= 0:
            return
        self.planned_seconds = seconds
        total_dist = default_route.total_distance
        required_speed = max(0.3, min(settings.V_MAX, total_dist / seconds))
        for rover in self.rovers.values():
            rover.target_speed = required_speed
            rover.stopped = False  # release rover – begin field traversal
        logger.info(
            f"ETA set → {seconds:.0f}s ({seconds/3600:.3f}h) | "
            f"required avg speed = {required_speed:.4f} m/s"
        )

    def set_mode(self, mode: str):
        if mode in ("model", "fixed", "off", "baseline", "manual"):
            self.mode = (
                "fixed" if mode in ("fixed", "baseline")
                else "off" if mode in ("off", "manual")
                else "model"
            )
            logger.info(f"Correction mode → '{self.mode}'")

    # ------------------------------------------------------------------
    # Simulation loop
    # ------------------------------------------------------------------

    async def _simulation_loop(self):
        last_tick = time.perf_counter()
        while self._running:
            try:
                now = time.perf_counter()
                dt = max(0.01, min(1.0, now - last_tick))
                last_tick = now

                for vehicle_id, rover in self.rovers.items():
                    telemetry_packet = rover.step(dt)
                    correction = await manager.handle_vehicle_telemetry(
                        vehicle_id=vehicle_id,
                        data=telemetry_packet,
                        mode=self.mode,
                    )
                    # Apply AI speed correction only when rover is actively moving
                    if not rover.stopped:
                        rover.target_speed = correction.get("target_speed", rover.speed)

                await asyncio.sleep(self.update_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"FleetSimulator loop error: {e}", exc_info=True)
                await asyncio.sleep(1.0)


fleet_simulator = FleetSimulator()
