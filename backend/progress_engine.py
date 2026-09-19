from dataclasses import dataclass
from typing import Dict, Any, Optional
from route_model import SerpentineRoute, default_route

@dataclass
class ProgressResult:
    distance_covered: float
    distance_remaining: float
    percent_complete: float
    time_elapsed: float
    time_remaining: float
    eta_total_time: float
    delta_T: float
    ideal_speed: float
    schedule_status: str
    current_segment_id: int
    in_turn: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "distance_covered": round(self.distance_covered, 2),
            "distance_remaining": round(self.distance_remaining, 2),
            "percent_complete": round(self.percent_complete, 1),
            "time_elapsed": round(self.time_elapsed, 2),
            "time_remaining": round(self.time_remaining, 2),
            "eta_total_time": round(self.eta_total_time, 2),
            "delta_T": round(self.delta_T, 2),
            "ideal_speed": round(self.ideal_speed, 2),
            "schedule_status": self.schedule_status,
            "current_segment_id": self.current_segment_id,
            "in_turn": self.in_turn
        }


def compute_progress(
    distance_covered: float,
    actual_speed: float,
    time_elapsed: float,
    route: Optional[SerpentineRoute] = None
) -> ProgressResult:
    """
    Pure functional progress calculation matching Eqs. 1-7 in Ospina & Noguchi (2025):
    - Live speed is used for the remaining portion of the active segment.
    - Nominal planned speeds are used for all future segments.
    - delta_T = total_plan_time - (time_elapsed + time_remaining)
      delta_T < 0 means behind schedule.
      delta_T > 0 means ahead of schedule.
    """
    active_route = route or default_route
    clamped_s = max(0.0, min(distance_covered, active_route.total_distance))
    distance_remaining = max(0.0, active_route.total_distance - clamped_s)
    percent_complete = (clamped_s / active_route.total_distance * 100.0) if active_route.total_distance > 0 else 100.0

    current_seg = active_route.get_segment_at_distance(clamped_s)
    in_turn = (current_seg.type == "turn")

    time_remaining = active_route.remaining_time_estimate(clamped_s, actual_speed)
    projected_total_time = time_elapsed + time_remaining
    delta_T = active_route.total_plan_time - projected_total_time

    # Ideal speed to complete exactly on nominal time
    time_budget_remaining = active_route.total_plan_time - time_elapsed
    if time_budget_remaining > 0.001 and distance_remaining > 0.001:
        ideal_speed = distance_remaining / time_budget_remaining
    else:
        ideal_speed = current_seg.planned_speed

    if delta_T < -1.0:
        schedule_status = "BEHIND"
    elif delta_T > 1.0:
        schedule_status = "AHEAD"
    else:
        schedule_status = "ON_SCHEDULE"

    return ProgressResult(
        distance_covered=clamped_s,
        distance_remaining=distance_remaining,
        percent_complete=percent_complete,
        time_elapsed=time_elapsed,
        time_remaining=time_remaining,
        eta_total_time=projected_total_time,
        delta_T=delta_T,
        ideal_speed=ideal_speed,
        schedule_status=schedule_status,
        current_segment_id=current_seg.id,
        in_turn=in_turn
    )
