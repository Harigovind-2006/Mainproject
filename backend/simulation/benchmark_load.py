import asyncio
import json
import time
import random
import statistics
from typing import List, Dict, Any
import websockets

async def simulated_vehicle_worker(
    vehicle_id: str,
    server_ws_url: str,
    num_ticks: int = 50,
    interval: float = 0.1,  # 10 Hz
    latencies: List[float] = None
):
    """
    Connects to the server as an autonomous agent, streams telemetry,
    receives corrections, and measures round-trip response latency.
    """
    try:
        async with websockets.connect(f"{server_ws_url}/{vehicle_id}") as ws:
            x = 0.0
            y = 0.0
            speed = 1.5

            for _ in range(num_ticks):
                t_send = time.perf_counter()
                payload = {
                    "vehicle_id": vehicle_id,
                    "position": [x, y],
                    "speed": speed,
                    "timestamp": time.time(),
                    "mode": "model"
                }
                await ws.send(json.dumps(payload))
                response_str = await ws.recv()
                t_recv = time.perf_counter()

                rtt_ms = (t_recv - t_send) * 1000.0
                if latencies is not None:
                    latencies.append(rtt_ms)

                resp = json.loads(response_str)
                # Apply server's target speed
                target_speed = resp.get("target_speed", speed)
                speed = 0.8 * speed + 0.2 * target_speed
                y += speed * interval

                await asyncio.sleep(interval)
    except Exception as e:
        print(f"[{vehicle_id}] Connection error: {e}")

async def run_benchmark(
    concurrency: int = 25,
    num_ticks: int = 40,
    server_ws_url: str = "ws://127.0.0.1:8000/ws/vehicle"
):
    print(f"\n========================================================")
    print(f"      CONCURRENT FLEET BENCHMARK: {concurrency} AGENTS        ")
    print(f"========================================================")
    print(f"Target Server: {server_ws_url}")
    print(f"Number of simulated vehicles: {concurrency}")
    print(f"Telemetry ticks per vehicle: {num_ticks}")

    latencies: List[float] = []
    t_start = time.perf_counter()

    tasks = [
        simulated_vehicle_worker(
            vehicle_id=f"rover_{i:03d}",
            server_ws_url=server_ws_url,
            num_ticks=num_ticks,
            interval=0.08,
            latencies=latencies
        )
        for i in range(concurrency)
    ]

    await asyncio.gather(*tasks)

    t_total = time.perf_counter() - t_start
    total_messages = len(latencies)

    if total_messages > 0:
        latencies.sort()
        p50 = statistics.median(latencies)
        p95 = latencies[int(0.95 * total_messages)]
        p99 = latencies[int(0.99 * total_messages)]
        avg_lat = statistics.mean(latencies)
        max_lat = max(latencies)
        throughput = total_messages / t_total

        print("\n--- BENCHMARK RESULTS ---")
        print(f"Total Telemetry Messages Exchanged : {total_messages}")
        print(f"Total Benchmark Duration           : {t_total:.2f} s")
        print(f"Effective Telemetry Throughput     : {throughput:.1f} msgs/sec")
        print(f"Average Round-Trip Latency         : {avg_lat:.2f} ms")
        print(f"Median (p50) Latency               : {p50:.2f} ms")
        print(f"95th Percentile (p95) Latency      : {p95:.2f} ms")
        print(f"99th Percentile (p99) Latency      : {p99:.2f} ms")
        print(f"Maximum Latency                    : {max_lat:.2f} ms")
        print("========================================================\n")
    else:
        print("No messages were exchanged. Is the FastAPI server running?")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fleet telemetry load benchmark")
    parser.add_argument("--concurrency", type=int, default=25, help="Number of concurrent vehicles")
    parser.add_argument("--ticks", type=int, default=40, help="Ticks per vehicle")
    parser.add_argument("--url", type=str, default="ws://127.0.0.1:8000/ws/vehicle", help="WebSocket URL")
    args = parser.parse_args()

    asyncio.run(run_benchmark(concurrency=args.concurrency, num_ticks=args.ticks, server_ws_url=args.url))
