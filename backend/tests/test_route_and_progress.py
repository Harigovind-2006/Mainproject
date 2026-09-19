import pytest
import math
from route_model import SerpentineRoute, Segment
from progress_engine import compute_progress

def test_serpentine_route_structure():
    route = SerpentineRoute(num_lanes=4, lane_length=50.0, lane_spacing=5.0, planned_lane_speed=1.5, planned_turn_speed=0.8)
    
    # 4 lanes + 3 connecting turns = 7 segments
    assert len(route.segments) == 7
    assert route.segments[0].type == "lane"
    assert route.segments[1].type == "turn"
    assert route.segments[2].type == "lane"
    assert route.segments[3].type == "turn"
    assert route.segments[4].type == "lane"
    assert route.segments[5].type == "turn"
    assert route.segments[6].type == "lane"

    # Total distance calculation
    expected_turn_len = math.pi * 2.5
    expected_total_dist = (4 * 50.0) + (3 * expected_turn_len)
    assert math.isclose(route.total_distance, expected_total_dist, rel_tol=1e-4)

    # Total nominal plan time
    expected_plan_time = (4 * 50.0 / 1.5) + (3 * expected_turn_len / 0.8)
    assert math.isclose(route.total_plan_time, expected_plan_time, rel_tol=1e-4)

def test_segment_lookup_and_coordinates():
    route = SerpentineRoute(num_lanes=4, lane_length=50.0, lane_spacing=5.0)
    
    # At start (s=0)
    seg0 = route.get_segment_at_distance(0.0)
    assert seg0.id == 0
    x, y, heading = route.get_coordinates_at_distance(0.0)
    assert math.isclose(x, 0.0, abs_tol=1e-3)
    assert math.isclose(y, 0.0, abs_tol=1e-3)

    # Mid first lane (s=25)
    x, y, heading = route.get_coordinates_at_distance(25.0)
    assert math.isclose(x, 0.0, abs_tol=1e-3)
    assert math.isclose(y, 25.0, abs_tol=1e-3)

    # End of first lane (s=50)
    x, y, heading = route.get_coordinates_at_distance(50.0)
    assert math.isclose(x, 0.0, abs_tol=1e-3)
    assert math.isclose(y, 50.0, abs_tol=1e-3)

def test_cross_track_projection():
    route = SerpentineRoute(num_lanes=4, lane_length=50.0, lane_spacing=5.0)

    # Vehicle on first lane heading upward from (0,0) to (0,50)
    # If vehicle is at (1.0, 20.0), it is to the RIGHT of the line (in upward travel direction, right is positive x)
    # Line vector is (0, 50), vehicle relative vector is (1, 20).
    # Cross product (dx*vy - dy*vx) = 0*20 - 50*1 = -50 -> signed cte is negative (right)
    seg_id, s_proj, signed_cte = route.project_point_to_route(1.0, 20.0)
    assert seg_id == 0
    assert math.isclose(s_proj, 20.0, abs_tol=0.1)
    assert signed_cte < 0  # right of lane

    # If vehicle is at (-1.0, 20.0), it is to the LEFT of the line
    seg_id, s_proj, signed_cte = route.project_point_to_route(-1.0, 20.0)
    assert seg_id == 0
    assert math.isclose(s_proj, 20.0, abs_tol=0.1)
    assert signed_cte > 0  # left of lane

def test_progress_engine_delta_T_behind():
    route = SerpentineRoute(num_lanes=4, lane_length=50.0, planned_lane_speed=1.5)
    
    # Driving slower than planned (0.8 m/s instead of 1.5 m/s) after 30 seconds
    res = compute_progress(
        distance_covered=20.0,
        actual_speed=0.8,
        time_elapsed=30.0,
        route=route
    )
    # Slower agent will take more total time -> delta_T < 0 (behind schedule)
    assert res.delta_T < 0
    assert res.schedule_status == "BEHIND"
    assert res.ideal_speed > 0.8  # Needs higher speed to catch up

def test_progress_engine_delta_T_ahead():
    route = SerpentineRoute(num_lanes=4, lane_length=50.0, planned_lane_speed=1.5)

    # Driving faster than planned (2.0 m/s instead of 1.5 m/s) after 10 seconds
    res = compute_progress(
        distance_covered=20.0,
        actual_speed=2.0,
        time_elapsed=10.0,
        route=route
    )
    # Faster agent will finish early -> delta_T > 0 (ahead of schedule)
    assert res.delta_T > 0
    assert res.schedule_status == "AHEAD"
