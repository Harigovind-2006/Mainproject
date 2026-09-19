import os
import logging
from pathlib import Path
from typing import Optional, Tuple
import numpy as np

from config import settings

logger = logging.getLogger("backend.speed_correction")

class SpeedCorrectionEngine:
    def __init__(self, model_path: Optional[str] = None):
        self.v_min = settings.V_MIN
        self.v_max = settings.V_MAX
        self.step_size = settings.FIXED_STEP_SIZE
        self.turn_speed = settings.DEFAULT_TURN_SPEED

        # Default model path
        default_path = Path(__file__).resolve().parent / "models" / "rf_model.joblib"
        self.model_path = model_path or str(default_path)
        self.model = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                import joblib
                self.model = joblib.load(self.model_path)
                logger.info(f"Loaded Random Forest speed correction model from {self.model_path}")
            except Exception as e:
                logger.warning(f"Could not load ML model ({e}). Will use baseline fixed-step.")
                self.model = None
        else:
            logger.info(f"No trained model at {self.model_path}. Baseline fixed-step will be used.")

    def compute_speed_correction(
        self,
        current_speed: float,
        delta_T: float,
        lag_features: Tuple[float, float, float],
        distance_remaining: float,
        in_turn: bool,
        mode: str = "model"
    ) -> float:
        """
        Computes target speed for the vehicle.
        Modes:
        - "off": keep current planned speed / no correction
        - "fixed": baseline fixed-step rule (Eqs. from project prompt)
        - "model": Random Forest ML model inference, fallback to "fixed" if model absent
        """
        # Safety constraint: mid-turn speeds must obey turn safety limit
        if in_turn:
            return min(current_speed, self.turn_speed)

        if mode == "off":
            return current_speed

        if mode == "model" and self.model is not None:
            try:
                lag1, lag2, lag3 = lag_features
                import pandas as pd
                features = pd.DataFrame([{
                    "delta_T": float(delta_T),
                    "delta_T_lag1": float(lag1),
                    "delta_T_lag2": float(lag2),
                    "delta_T_lag3": float(lag3),
                    "actual_speed": float(current_speed),
                    "distance_remaining": float(distance_remaining),
                    "in_turn": 1 if in_turn else 0
                }])
                predicted_speed = float(self.model.predict(features)[0])
                # Clamp within operational limits
                return max(self.v_min, min(self.v_max, predicted_speed))
            except Exception as e:
                logger.debug(f"Model prediction failed ({e}); falling back to baseline fixed-step.")

        # Baseline fixed-step rule
        target = current_speed
        if delta_T < -0.1:
            target += self.step_size  # behind schedule -> speed up
        elif delta_T > 0.1:
            target -= self.step_size  # ahead of schedule -> slow down

        return max(self.v_min, min(self.v_max, target))

# Global engine instance
speed_engine = SpeedCorrectionEngine()
