import time
import math
from typing import Dict, Any, List, Optional, Tuple
from route_model import SerpentineRoute, default_route
from progress_engine import compute_progress, ProgressResult

class VehicleTwin:
    """
    Digital twin representing the live internal state and physics projection
    for an individual autonomous vehicle.
    """
    def __init__(self, vehicle_id: str, route: Optional[SerpentineRoute] = None):
        self.vehicle_id = vehicle_id
        self.route = route or default_route

        # State coordinates
        self.x: float = 0.0
        self.y: float = 0.0
        self.heading: float = 0.0
        self.distance_covered: float = 0.0
        self.actual_speed: float = 0.0
        self.target_speed: float = self.route.planned_lane_speed
        self.steering_adjust: float = 0.0
        self.cross_track_error: float = 0.0

        # Timing
        self.created_at: float = time.time()
        self.start_time: Optional[float] = None
        self.last_update_time: float = time.time()
        self.time_elapsed: float = 0.0

        # Progress & Delta T
        self.current_segment_id: int = 0
        self.in_turn: bool = False
        self.delta_T: float = 0.0
        self.percent_complete: float = 0.0
        self.eta_total_time: float = self.route.total_plan_time
        self.time_remaining: float = self.route.total_plan_time
        self.ideal_speed: float = self.route.planned_lane_speed
        self.schedule_status: str = "ON_SCHEDULE"

        # Rolling history of delta_T for feature extraction (lag1, lag2, lag3)
        self.delta_T_history: List[float] = []

        # Validation logs: predicted vs actual
        self.recent_predictions: List[Dict[str, Any]] = []

    def update_telemetry(
        self,
        x: float,
        y: float,
        speed: float,
        timestamp: Optional[float] = None
    ) -> ProgressResult:
        now = timestamp or time.time()
        if self.start_time is None:
            self.start_time = now

        self.time_elapsed = max(0.0, now - self.start_time)
        self.last_update_time = now
        self.actual_speed = max(0.0, speed)
        self.x = x
        self.y = y

        # Project 2D coordinates to route distance s and signed cross-track error
        seg_id, s_proj, signed_cte = self.route.project_point_to_route(x, y, self.current_segment_id)
        self.distance_covered = s_proj
        self.current_segment_id = seg_id
        self.cross_track_error = signed_cte

        # Compute progress and delta_T
        prog = compute_progress(
            distance_covered=self.distance_covered,
            actual_speed=self.actual_speed,
            time_elapsed=self.time_elapsed,
            route=self.route
        )

        self.delta_T = prog.delta_T
        self.percent_complete = prog.percent_complete
        self.eta_total_time = prog.eta_total_time
        self.time_remaining = prog.time_remaining
        self.ideal_speed = prog.ideal_speed
        self.schedule_status = prog.schedule_status
        self.in_turn = prog.in_turn

        # Update history
        self.delta_T_history.append(prog.delta_T)
        if len(self.delta_T_history) > 50:
            self.delta_T_history.pop(0)

        # Check any pending predictions against actual outcome
        self._evaluate_past_predictions(now, prog.delta_T)

        return prog

    def get_lag_features(self) -> Tuple[float, float, float]:
        """
        Returns delta_T_lag1, delta_T_lag2, delta_T_lag3 for model inference.
        """
        n = len(self.delta_T_history)
        lag1 = self.delta_T_history[-2] if n >= 2 else self.delta_T
        lag2 = self.delta_T_history[-3] if n >= 3 else lag1
        lag3 = self.delta_T_history[-4] if n >= 4 else lag2
        return lag1, lag2, lag3

    def forward_predict(
        self,
        candidate_speed: float,
        lookahead_seconds: float = 3.0
    ) -> Dict[str, Any]:
        """
        Forward-simulates candidate correction a few seconds ahead from current real state:
        - Estimates new distance covered: s_future = s_current + candidate_speed * lookahead_seconds
        - Future elapsed time: t_future = t_elapsed + lookahead_seconds
        - Re-evaluates delta_T at t_future.
        Returns prediction outcome and whether it improves or controls error.
        """
        projected_s = min(self.route.total_distance, self.distance_covered + candidate_speed * lookahead_seconds)
        projected_elapsed = self.time_elapsed + lookahead_seconds

        future_prog = compute_progress(
            distance_covered=projected_s,
            actual_speed=candidate_speed,
            time_elapsed=projected_elapsed,
            route=self.route
        )

        current_err = abs(self.delta_T)
        predicted_err = abs(future_prog.delta_T)
        improves_or_stabilizes = (predicted_err <= current_err + 0.1)

        prediction_record = {
            "timestamp": self.last_update_time,
            "target_time": self.last_update_time + lookahead_seconds,
            "candidate_speed": candidate_speed,
            "predicted_delta_T": future_prog.delta_T,
            "predicted_distance": projected_s,
            "improves_or_stabilizes": improves_or_stabilizes,
            "evaluated": False,
            "actual_error_at_target": None
        }

        self.recent_predictions.append(prediction_record)
        if len(self.recent_predictions) > 20:
            self.recent_predictions.pop(0)

        return prediction_record

    def _evaluate_past_predictions(self, current_time: float, current_delta_T: float):
        for pred in self.recent_predictions:
            if not pred["evaluated"] and current_time >= pred["target_time"]:
                pred["evaluated"] = True
                pred["actual_delta_T"] = current_delta_T
                pred["error"] = abs(pred["predicted_delta_T"] - current_delta_T)

    def to_dict(self) -> Dict[str, Any]:
        lag1, lag2, lag3 = self.get_lag_features()
        return {
            "vehicle_id": self.vehicle_id,
            "x": round(self.x, 3),
            "y": round(self.y, 3),
            "heading": round(self.heading, 3),
            "actual_speed": round(self.actual_speed, 2),
            "target_speed": round(self.target_speed, 2),
            "steering_adjust": round(self.steering_adjust, 3),
            "cross_track_error": round(self.cross_track_error, 3),
            "distance_covered": round(self.distance_covered, 2),
            "distance_remaining": round(max(0.0, self.route.total_distance - self.distance_covered), 2),
            "percent_complete": round(self.percent_complete, 1),
            "time_elapsed": round(self.time_elapsed, 1),
            "time_remaining": round(self.time_remaining, 1),
            "eta_total_time": round(self.eta_total_time, 1),
            "delta_T": round(self.delta_T, 2),
            "delta_T_lags": [round(lag1, 2), round(lag2, 2), round(lag3, 2)],
            "ideal_speed": round(self.ideal_speed, 2),
            "schedule_status": self.schedule_status,
            "current_segment_id": self.current_segment_id,
            "in_turn": self.in_turn,
            "last_update_time": self.last_update_time
        }
