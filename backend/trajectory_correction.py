import math
from typing import Tuple, Dict, Any

class TrajectoryCorrectionController:
    """
    Computes spatial cross-track trajectory corrections using a Stanley-style
    proportional controller, supporting both steering servo and differential drive rovers.
    """
    def __init__(self, k_p: float = 0.6, max_steer_rad: float = 0.5, track_width: float = 0.25):
        self.k_p = k_p
        self.max_steer_rad = max_steer_rad
        self.track_width = track_width

    def compute_steering(self, signed_cross_track_error: float) -> float:
        """
        Stanley-style proportional correction:
        - signed_cross_track_error > 0: vehicle is to the LEFT of planned line -> steer right (negative)
        - signed_cross_track_error < 0: vehicle is to the RIGHT of planned line -> steer left (positive)
        """
        raw_adjust = -self.k_p * signed_cross_track_error
        # Clamp to physical steering limits
        return max(-self.max_steer_rad, min(self.max_steer_rad, raw_adjust))

    def compute_differential_speeds(
        self,
        target_speed: float,
        steering_adjust: float
    ) -> Tuple[float, float]:
        """
        Converts a linear target speed and steering adjustment into left/right wheel speeds
        for differential-drive rovers.
        """
        half_width = self.track_width / 2.0
        v_left = target_speed - (steering_adjust * half_width)
        v_right = target_speed + (steering_adjust * half_width)
        return round(max(0.0, v_left), 3), round(max(0.0, v_right), 3)

    def evaluate_correction(
        self,
        signed_cross_track_error: float,
        target_speed: float
    ) -> Dict[str, Any]:
        steering = self.compute_steering(signed_cross_track_error)
        v_left, v_right = self.compute_differential_speeds(target_speed, steering)
        return {
            "cross_track_error": round(signed_cross_track_error, 4),
            "steering_adjust": round(steering, 4),
            "wheel_speeds": {
                "left": v_left,
                "right": v_right
            }
        }

trajectory_controller = TrajectoryCorrectionController()
