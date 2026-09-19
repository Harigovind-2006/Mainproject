import pytest
from speed_correction import speed_engine, SpeedCorrectionEngine
from trajectory_correction import trajectory_controller, TrajectoryCorrectionController
from vehicle_twin import VehicleTwin
from route_model import default_route

def test_fixed_step_speed_correction():
    engine = SpeedCorrectionEngine(model_path="non_existent_file.joblib")
    assert engine.model is None  # Force baseline mode

    # Behind schedule (delta_T < -0.1) -> should increase speed
    speed_up = engine.compute_speed_correction(
        current_speed=1.5,
        delta_T=-5.0,
        lag_features=(-5.0, -5.0, -5.0),
        distance_remaining=100.0,
        in_turn=False,
        mode="fixed"
    )
    assert speed_up > 1.5

    # Ahead of schedule (delta_T > 0.1) -> should decrease speed
    slow_down = engine.compute_speed_correction(
        current_speed=1.5,
        delta_T=5.0,
        lag_features=(5.0, 5.0, 5.0),
        distance_remaining=100.0,
        in_turn=False,
        mode="fixed"
    )
    assert slow_down < 1.5

    # In turn -> must respect turn speed limit
    turn_speed = engine.compute_speed_correction(
        current_speed=1.5,
        delta_T=-10.0,
        lag_features=(-10.0, -10.0, -10.0),
        distance_remaining=100.0,
        in_turn=True,
        mode="fixed"
    )
    assert turn_speed <= engine.turn_speed

def test_rf_model_speed_correction():
    # Test with loaded RF model
    assert speed_engine.model is not None

    predicted_speed = speed_engine.compute_speed_correction(
        current_speed=1.2,
        delta_T=-4.0,
        lag_features=(-3.8, -3.5, -3.0),
        distance_remaining=80.0,
        in_turn=False,
        mode="model"
    )
    # Output should be clamped between v_min and v_max
    assert speed_engine.v_min <= predicted_speed <= speed_engine.v_max

def test_trajectory_steering_controller():
    controller = TrajectoryCorrectionController(k_p=0.5)

    # Vehicle is left of path (error > 0) -> steering should be negative (steer right)
    steer_right = controller.compute_steering(signed_cross_track_error=0.4)
    assert steer_right < 0

    # Vehicle is right of path (error < 0) -> steering should be positive (steer left)
    steer_left = controller.compute_steering(signed_cross_track_error=-0.4)
    assert steer_left > 0

def test_differential_drive_speeds():
    controller = TrajectoryCorrectionController(track_width=0.3)
    target_v = 1.5

    # Steering right (negative steer) -> right wheel slows down or left wheel speeds up
    # In controller: v_left = v - steer * w/2; v_right = v + steer * w/2
    v_l, v_r = controller.compute_differential_speeds(target_speed=target_v, steering_adjust=-0.4)
    assert v_l > target_v
    assert v_r < target_v

def test_vehicle_twin_forward_lookahead():
    twin = VehicleTwin(vehicle_id="test_rover", route=default_route)
    twin.update_telemetry(x=0.0, y=10.0, speed=1.5, timestamp=100.0)

    # Forward simulate 3 seconds ahead at 1.5 m/s
    pred = twin.forward_predict(candidate_speed=1.5, lookahead_seconds=3.0)
    assert "predicted_delta_T" in pred
    assert "improves_or_stabilizes" in pred
    assert pred["predicted_distance"] > twin.distance_covered
