"""
Standalone autonomous rover client / simulation agent.
Connects to the FastAPI backend via WebSockets, streams live position/speed telemetry,
and receives real-time closed-loop speed + differential steering corrections.
"""

import asyncio
import json
import time
import math
import argparse
import websockets

from route_model import default_route


async def run_rover_client(
    vehicle_id: str = "rover_field_01",
    server_ws_url: str = "ws://127.0.0.1:8000/ws/vehicle",
    secret: str = None,
    mode: str = "model",
    interval: float = 0.1,  # 10 Hz
    max_ticks: int = None
):
    url = f"{server_ws_url}/{vehicle_id}?mode={mode}"
    if secret:
        url += f"&secret={secret}"

    print(f"Connecting rover '{vehicle_id}' to {url}...")
    try:
        async with websockets.connect(url) as ws:
            print(f"[{vehicle_id}] Connected successfully! Starting 10Hz telemetry streaming.\n")
            s = 0.0
            actual_speed = default_route.planned_lane_speed
            tick = 0

            while max_ticks is None or tick < max_ticks:
                t0 = time.perf_counter()

                # Physical coordinates along serpentine route
                rx, ry, heading = default_route.get_coordinates_at_distance(s)
                # Subtle simulated soil slip disturbance
                slip = 0.03 * math.sin(tick * 0.3)
                px = rx - slip * math.sin(heading)
                py = ry + slip * math.cos(heading)

                payload = {
                    "vehicle_id": vehicle_id,
                    "position": [round(px, 3), round(py, 3)],
                    "speed": round(actual_speed, 2),
                    "timestamp": time.time(),
                    "mode": mode,
                    "battery_level": 97.5
                }

                await ws.send(json.dumps(payload))
                response_raw = await ws.recv()
                t1 = time.perf_counter()
                latency_ms = (t1 - t0) * 1000.0

                resp = json.loads(response_raw)
                target_speed = resp.get("target_speed", actual_speed)
                steer = resp.get("steering_adjust", 0.0)
                wheel_speeds = resp.get("wheel_speeds", {})
                delta_t = resp.get("delta_T", 0.0)
                pct = resp.get("percent_complete", 0.0)

                # Rover motor response (inertia towards target speed)
                actual_speed += (target_speed - actual_speed) * 0.3
                s = (s + actual_speed * interval) % default_route.total_distance

                if tick % 5 == 0:  # Print every 0.5s
                    print(
                        f"[{vehicle_id} #{tick:04d}] "
                        f"Pos: ({px:5.1f}, {py:5.1f}) | "
                        f"Speed: {actual_speed:.2f} -> Cmd: {target_speed:.2f} m/s | "
                        f"Steer: {steer:+.3f} | "
                        f"L/R Wheels: {wheel_speeds.get('left', 0.0):.2f}/{wheel_speeds.get('right', 0.0):.2f} | "
                        f"ΔT: {delta_t:+.2f}s | "
                        f"{pct:4.1f}% complete | "
                        f"RTT: {latency_ms:.1f}ms"
                    )

                tick += 1
                await asyncio.sleep(interval)

    except KeyboardInterrupt:
        print(f"\n[{vehicle_id}] Stopped by operator.")
    except Exception as e:
        print(f"[{vehicle_id}] Connection error: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Autonomous Rover WebSocket Client")
    parser.add_argument("--id", type=str, default="rover_field_01", help="Vehicle ID")
    parser.add_argument("--url", type=str, default="ws://127.0.0.1:8000/ws/vehicle", help="Server WS URL")
    parser.add_argument("--secret", type=str, default=None, help="Device secret")
    parser.add_argument("--mode", type=str, default="model", choices=["model", "fixed", "off"], help="Correction mode")
    parser.add_argument("--interval", type=float, default=0.1, help="Telemetry interval in seconds")
    parser.add_argument("--ticks", type=int, default=None, help="Max ticks (None for infinite)")
    args = parser.parse_args()

    asyncio.run(run_rover_client(
        vehicle_id=args.id,
        server_ws_url=args.url,
        secret=args.secret,
        mode=args.mode,
        interval=args.interval,
        max_ticks=args.ticks
    ))
