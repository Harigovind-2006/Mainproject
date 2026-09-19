import sys
import os
import random
import math
from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd

# Add backend root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from route_model import SerpentineRoute, default_route
from progress_engine import compute_progress

def run_simulation(
    num_runs: int = 120,
    dt: float = 0.5,
    output_csv: Optional[str] = None
) -> pd.DataFrame:
    """
    Simulates autonomous agent runs across varying noise levels and correction modes
    to construct the empirical dataset specified in Phase I.
    """
    route = default_route
    total_dist = route.total_distance
    total_plan_time = route.total_plan_time

    records = []
    noise_levels = [0.05, 0.10, 0.15, 0.20]
    modes = ["off", "fixed"]

    print(f"Starting simulation of {num_runs} runs across noise levels {noise_levels}...")

    for run_id in range(num_runs):
        noise_std = random.choice(noise_levels)
        mode = modes[run_id % len(modes)]

        # Agent state
        s = 0.0
        time_elapsed = 0.0
        tick = 0
        current_speed = route.planned_lane_speed

        delta_T_history = []

        while s < total_dist:
            seg = route.get_segment_at_distance(s)
            in_turn = (seg.type == "turn")
            planned_speed = seg.planned_speed

            # Slip noise injected onto planned speed
            noise_factor = np.random.normal(1.0, noise_std)
            actual_speed = max(0.2, min(3.0, current_speed * noise_factor))

            # Progress & delta_T calculation
            prog = compute_progress(
                distance_covered=s,
                actual_speed=actual_speed,
                time_elapsed=time_elapsed,
                route=route
            )

            delta_T = prog.delta_T
            delta_T_history.append(delta_T)

            # Lag features
            n_hist = len(delta_T_history)
            lag1 = delta_T_history[-2] if n_hist >= 2 else delta_T
            lag2 = delta_T_history[-3] if n_hist >= 3 else lag1
            lag3 = delta_T_history[-4] if n_hist >= 4 else lag2

            # Ideal speed label: distance_remaining / time_remaining_budget
            time_budget_remaining = total_plan_time - time_elapsed
            if time_budget_remaining > 0.001 and prog.distance_remaining > 0.001:
                ideal_speed = prog.distance_remaining / time_budget_remaining
            else:
                ideal_speed = planned_speed

            records.append({
                "run_id": run_id,
                "tick": tick,
                "time_elapsed": round(time_elapsed, 3),
                "distance_covered": round(s, 3),
                "distance_remaining": round(prog.distance_remaining, 3),
                "actual_speed": round(actual_speed, 3),
                "planned_speed": round(planned_speed, 3),
                "in_turn": 1 if in_turn else 0,
                "delta_T": round(delta_T, 4),
                "delta_T_lag1": round(lag1, 4),
                "delta_T_lag2": round(lag2, 4),
                "delta_T_lag3": round(lag3, 4),
                "ideal_speed": round(ideal_speed, 4),
                "noise_std": noise_std,
                "correction_mode": mode
            })

            # Fixed-step speed correction for next tick if mode == "fixed"
            if mode == "fixed" and not in_turn:
                if delta_T < -0.1:
                    current_speed = min(2.5, current_speed + 0.1)
                elif delta_T > 0.1:
                    current_speed = max(0.5, current_speed - 0.1)
            elif in_turn:
                current_speed = route.planned_turn_speed
            else:
                current_speed = route.planned_lane_speed

            # Step agent forward
            s += actual_speed * dt
            time_elapsed += dt
            tick += 1

    df = pd.DataFrame(records)
    print(f"Simulation finished: generated {len(df)} total ticks across {num_runs} runs.")

    out_path = output_csv or str(BASE_DIR / "data" / "simulation_dataset.csv")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"Dataset successfully saved to {out_path}")
    return df

if __name__ == "__main__":
    from typing import Optional
    run_simulation()
