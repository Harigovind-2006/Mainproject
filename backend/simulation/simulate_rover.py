import asyncio
import json
import math
import random
import time
import argparse
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
import numpy as np
import websockets

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from route_model import SerpentineRoute, default_route


class RoverKinematicsSimulator:
    """
    Simulates physical differential-drive rover kinematics for Phase 1 testing
    without requiring physical ESP32 rover hardware.
    
    Models:
    - Serpentine field path traversal (Ospina & Noguchi 2025)
    - Differential drive wheel speeds (v_left, v_right)
    - Wheel slip and surface friction noise
    - Lateral cross-track drift
    - Closed-loop speed correction adaptation
    """
    def __init__(
        self,
        vehicle_id: str,
        route: Optional[SerpentineRoute] = None,
        wheel_base: float = 0.6,
        slip_noise_std: float = 0.08,
        lateral_noise_std: float = 0.04,
        max_accel: float = 1.2,  # m/s^2
    ):
        self.vehicle_id = vehicle_id
        self.route = route or default_route
        self.wheel_base = wheel_base
        self.slip_noise_std = slip_noise_std
        self.lateral_noise_std = lateral_noise_std
        self.max_accel = max_accel

        # State
        self.s: float = 0.0  # distance along path (m)
        self.actual_speed: float = self.route.planned_lane_speed
        self.target_speed: float = self.route.planned_lane_speed
        self.steering_adjust: float = 0.0
        self.v_left: float = self.actual_speed
        self.v_right: float = self.actual_speed
        self.time_elapsed: float = 0.0

        # Position
        x0, y0, h0 = self.route.get_coordinates_at_distance(0.0)
        self.x: float = x0
        self.y: float = y0
        self.heading: float = h0
        self.cross_track_offset: float = 0.0

    def step(self, dt: float, disturbance: float = 0.0) -> Dict[str, Any]:
        """
        Advances the rover physics by dt seconds.
        """
        self.time_elapsed += dt

        # 1. Acceleration limit toward target speed
        speed_diff = self.target_speed - self.actual_speed
        max_step = self.max_accel * dt
        clamped_diff = max(-max_step, min(max_step, speed_diff))
        self.actual_speed += clamped_diff

        # 2. Wheel slip noise (simulates terrain irregularities like soil/grass)
        slip = 1.0 + random.gauss(0.0, self.slip_noise_std) + disturbance
        effective_speed = max(0.1, self.actual_speed * slip)

        # 3. Advance route distance
        self.s += effective_speed * dt
        wrapped = False
        if self.s >= self.route.total_distance:
            self.s = 0.0
            self.time_elapsed = 0.0
            wrapped = True

        # 4. Compute nominal centerline coordinate
        nom_x, nom_y, nom_heading = self.route.get_coordinates_at_distance(self.s)

        # 5. Lateral drift / steering adjustment response
        # Steering adjust (rad/s) shifts cross-track towards zero
        self.cross_track_offset += (
            -self.steering_adjust * effective_speed * dt * 0.4 
            + random.gauss(0.0, self.lateral_noise_std * dt)
        )
        self.cross_track_offset = max(-0.35, min(0.35, self.cross_track_offset))

        # Rover position = nominal position + normal vector * cross-track offset
        norm_angle = nom_heading + math.pi / 2.0
        self.x = nom_x + self.cross_track_offset * math.cos(norm_angle)
        self.y = nom_y + self.cross_track_offset * math.sin(norm_angle)
        self.heading = nom_heading

        # 6. Differential wheel speeds
        self.v_left = effective_speed - (self.steering_adjust * self.wheel_base) / 2.0
        self.v_right = effective_speed + (self.steering_adjust * self.wheel_base) / 2.0

        return {
            "s": self.s,
            "x": self.x,
            "y": self.y,
            "heading": self.heading,
            "actual_speed": effective_speed,
            "v_left": self.v_left,
            "v_right": self.v_right,
            "wrapped": wrapped
        }


async def run_simulated_rover(
    vehicle_id: str = "rover-alpha",
    server_ws_url: str = "ws://127.0.0.1:8000/ws/vehicle",
    tick_rate_hz: float = 10.0,
    noise_std: float = 0.08,
    mode: str = "model",
    loop_forever: bool = False,
    inject_delay_at_sec: Optional[float] = 10.0,
    inject_delay_duration: float = 4.0
):
    """
    Connects to the FastAPI backend over WebSocket and streams telemetry
    in real time, receiving closed-loop AI corrections.
    """
    dt = 1.0 / tick_rate_hz
    rover = RoverKinematicsSimulator(
        vehicle_id=vehicle_id,
        slip_noise_std=noise_std
    )
    ws_endpoint = f"{server_ws_url}/{vehicle_id}?mode={mode}"

    print("\n" + "=" * 65)
    print(f"      PHASE 1 AUTONOMOUS ROVER HARDWARE SIMULATION")
    print("=" * 65)
    print(f"Vehicle ID:          {vehicle_id}")
    print(f"Connecting to:       {ws_endpoint}")
    print(f"Correction Mode:     {mode} (AI Random Forest / Digital Twin)")
    print(f"Telemetry Frequency: {tick_rate_hz} Hz (interval = {dt:.3f}s)")
    print(f"Field Route Length:  {rover.route.total_distance:.1f} m")
    print(f"Planned Route Time:  {rover.route.total_plan_time:.1f} s")
    if inject_delay_at_sec:
        print(f"Scheduled Delay:     {inject_delay_duration}s stop at t={inject_delay_at_sec}s")
    print("=" * 65 + "\n")

    # Metrics accumulators
    speed_errors: List[float] = []
    delta_ts: List[float] = []
    latencies: List[float] = []

    try:
        async with websockets.connect(ws_endpoint) as ws:
            print(f"[{vehicle_id}] Connected to backend successfully. Starting closed-loop run...\n")
            print(f"{'Time(s)':<8} | {'Pos (x, y)':<16} | {'Speed(m/s)':<11} | {'Target':<8} | {'Delta T':<9} | {'Prog %':<8} | {'RTT(ms)':<8}")
            print("-" * 80)

            tick = 0
            while True:
                t_start = time.perf_counter()

                # Simulated terrain disturbance or intentional stall
                disturbance = 0.0
                if inject_delay_at_sec is not None:
                    if inject_delay_at_sec <= rover.time_elapsed < (inject_delay_at_sec + inject_delay_duration):
                        disturbance = -0.75  # severe slip / stall

                phys = rover.step(dt=dt, disturbance=disturbance)

                # Telemetry payload (identical to ESP32 rover packet)
                payload = {
                    "vehicle_id": vehicle_id,
                    "position": [round(phys["x"], 3), round(phys["y"], 3)],
                    "speed": round(phys["actual_speed"], 3),
                    "timestamp": time.time(),
                    "mode": mode
                }

                # 1. Send telemetry to backend
                await ws.send(json.dumps(payload))

                # 2. Receive closed-loop correction from backend
                resp_str = await ws.recv()
                t_end = time.perf_counter()
                rtt_ms = (t_end - t_start) * 1000.0
                latencies.append(rtt_ms)

                resp = json.loads(resp_str)
                rover.target_speed = float(resp.get("target_speed", rover.target_speed))
                rover.steering_adjust = float(resp.get("steering_adjust", 0.0))
                delta_t = float(resp.get("delta_T", 0.0))
                percent = float(resp.get("percent_complete", 0.0))

                speed_errors.append(abs(phys["actual_speed"] - rover.target_speed))
                delta_ts.append(delta_t)

                # Print telemetry line periodically (every 0.5s)
                if tick % int(max(1, tick_rate_hz * 0.5)) == 0:
                    pos_str = f"({phys['x']:.1f}, {phys['y']:.1f})"
                    print(
                        f"{rover.time_elapsed:<8.1f} | "
                        f"{pos_str:<16} | "
                        f"{phys['actual_speed']:<11.2f} | "
                        f"{rover.target_speed:<8.2f} | "
                        f"{delta_t:<+9.2f} | "
                        f"{percent:<8.1f} | "
                        f"{rtt_ms:<8.2f}"
                    )

                tick += 1

                if phys["wrapped"] and not loop_forever:
                    print("\nCompleted full route traversal.")
                    break

                # Sleep remaining cycle time
                elapsed = time.perf_counter() - t_start
                sleep_time = max(0.001, dt - elapsed)
                await asyncio.sleep(sleep_time)

    except ConnectionRefusedError:
        print(f"\n[ERROR] Could not connect to backend at {server_ws_url}.")
        print("Make sure the backend is running first:")
        print("  cd backend && uvicorn main:app --reload\n")
        return
    except Exception as e:
        print(f"\n[ERROR] Simulation exception: {e}")

    # Compute final Phase 1 performance metrics
    if speed_errors:
        mae = float(np.mean(speed_errors))
        mse = float(np.mean(np.square(speed_errors)))
        rmse = float(np.sqrt(mse))
        avg_speed = max(0.1, float(np.mean([rover.actual_speed])))
        mape = float(mae / avg_speed) * 100.0

        mae_delta_t = float(np.mean(np.abs(delta_ts)))
        avg_lat = float(np.mean(latencies))

        print("\n" + "=" * 65)
        print("        PHASE 1 SIMULATION BENCHMARK SUMMARY")
        print("=" * 65)
        print(f"Total Telemetry Ticks:       {len(speed_errors)}")
        print(f"Average Round-Trip Latency:  {avg_lat:.2f} ms")
        print(f"Speed Tracking MAE:          {mae:.4f} m/s")
        print(f"Speed Tracking MSE:          {mse:.4f} (m/s)^2")
        print(f"Speed Tracking RMSE:         {rmse:.4f} m/s")
        print(f"Speed Tracking MAPE:         {mape:.2f} %")
        print(f"Mean Schedule Drift |ΔT|:    {mae_delta_t:.2f} s")
        print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Phase 1 Autonomous Rover Hardware Simulator")
    parser.add_argument("--vehicle-id", type=str, default="rover-alpha", help="Vehicle ID (e.g. rover-alpha)")
    parser.add_argument("--fleet", type=str, default=None, help="Comma-separated list of vehicle IDs to simulate concurrently (e.g. 'rover-alpha,rover-beta,rover-gamma')")
    parser.add_argument("--url", type=str, default="ws://127.0.0.1:8000/ws/vehicle", help="Backend WebSocket URL")
    parser.add_argument("--hz", type=float, default=10.0, help="Telemetry broadcast frequency in Hz (default: 10.0)")
    parser.add_argument("--noise", type=float, default=0.08, help="Wheel slip noise standard deviation (default: 0.08)")
    parser.add_argument("--mode", type=str, default="model", choices=["model", "baseline", "off"], help="Correction mode")
    parser.add_argument("--loop", action="store_true", help="Loop the route continuously")
    parser.add_argument("--inject-delay", type=float, default=10.0, help="Time in seconds to inject artificial delay")
    parser.add_argument("--delay-duration", type=float, default=3.0, help="Duration of delay in seconds")

    args = parser.parse_args()

    if args.fleet:
        vehicle_ids = [v.strip() for v in args.fleet.split(",") if v.strip()]
        print(f"Launching concurrent fleet simulation for: {vehicle_ids}")
        tasks = [
            run_simulated_rover(
                vehicle_id=vid,
                server_ws_url=args.url,
                tick_rate_hz=args.hz,
                noise_std=args.noise,
                mode=args.mode,
                loop_forever=args.loop,
                inject_delay_at_sec=args.inject_delay if idx == 0 else None,
                inject_delay_duration=args.delay_duration
            )
            for idx, vid in enumerate(vehicle_ids)
        ]
        asyncio.run(asyncio.gather(*tasks))
    else:
        asyncio.run(
            run_simulated_rover(
                vehicle_id=args.vehicle_id,
                server_ws_url=args.url,
                tick_rate_hz=args.hz,
                noise_std=args.noise,
                mode=args.mode,
                loop_forever=args.loop,
                inject_delay_at_sec=args.inject_delay,
                inject_delay_duration=args.delay_duration
            )
        )

if __name__ == "__main__":
    main()
