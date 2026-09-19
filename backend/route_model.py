import math
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any

@dataclass
class Segment:
    id: int
    type: str  # "lane" or "turn"
    length: float
    planned_speed: float
    start_s: float
    end_s: float
    nominal_time: float
    # 2D Geometry parameters
    start_point: Tuple[float, float]
    end_point: Tuple[float, float]
    # For turns (semicircular arcs)
    center: Optional[Tuple[float, float]] = None
    radius: Optional[float] = None
    start_angle: Optional[float] = None
    end_angle: Optional[float] = None
    clockwise: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "length": round(self.length, 3),
            "planned_speed": round(self.planned_speed, 3),
            "start_s": round(self.start_s, 3),
            "end_s": round(self.end_s, 3),
            "nominal_time": round(self.nominal_time, 3),
            "start_point": [round(c, 3) for c in self.start_point],
            "end_point": [round(c, 3) for c in self.end_point],
            "center": [round(c, 3) for c in self.center] if self.center else None,
            "radius": round(self.radius, 3) if self.radius else None,
        }


class SerpentineRoute:
    """
    Generates and evaluates a standard serpentine field route consisting of
    alternating straight lanes and semicircular headland turns, directly adhering
    to Eqs. 1-7 in Ospina & Noguchi (2025).
    """
    def __init__(
        self,
        num_lanes: int = 4,
        lane_length: float = 50.0,
        lane_spacing: float = 5.0,
        planned_lane_speed: float = 1.5,
        planned_turn_speed: float = 0.8,
        origin: Tuple[float, float] = (0.0, 0.0)
    ):
        self.num_lanes = num_lanes
        self.lane_length = lane_length
        self.lane_spacing = lane_spacing
        self.planned_lane_speed = planned_lane_speed
        self.planned_turn_speed = planned_turn_speed
        self.origin = origin

        self.segments: List[Segment] = []
        self._build_route()

        self.total_distance = self.segments[-1].end_s if self.segments else 0.0
        self.total_plan_time = sum(seg.nominal_time for seg in self.segments)

    def _build_route(self):
        self.segments = []
        cum_s = 0.0
        seg_id = 0
        x0, y0 = self.origin

        for lane_idx in range(self.num_lanes):
            x_lane = x0 + lane_idx * self.lane_spacing
            is_upward = (lane_idx % 2 == 0)

            if is_upward:
                start_pt = (x_lane, y0)
                end_pt = (x_lane, y0 + self.lane_length)
            else:
                start_pt = (x_lane, y0 + self.lane_length)
                end_pt = (x_lane, y0)

            lane_seg = Segment(
                id=seg_id,
                type="lane",
                length=self.lane_length,
                planned_speed=self.planned_lane_speed,
                start_s=cum_s,
                end_s=cum_s + self.lane_length,
                nominal_time=self.lane_length / self.planned_lane_speed,
                start_point=start_pt,
                end_point=end_pt
            )
            self.segments.append(lane_seg)
            cum_s += self.lane_length
            seg_id += 1

            # Semicircular headland turn if not the last lane
            if lane_idx < self.num_lanes - 1:
                radius = self.lane_spacing / 2.0
                turn_length = math.pi * radius
                next_x_lane = x0 + (lane_idx + 1) * self.lane_spacing

                if is_upward:
                    # Top turn connecting (x_lane, y0 + L) to (next_x_lane, y0 + L)
                    center = ((x_lane + next_x_lane) / 2.0, y0 + self.lane_length)
                    turn_start = (x_lane, y0 + self.lane_length)
                    turn_end = (next_x_lane, y0 + self.lane_length)
                    start_angle = math.pi
                    end_angle = 0.0
                    clockwise = True
                else:
                    # Bottom turn connecting (x_lane, y0) to (next_x_lane, y0)
                    center = ((x_lane + next_x_lane) / 2.0, y0)
                    turn_start = (x_lane, y0)
                    turn_end = (next_x_lane, y0)
                    start_angle = math.pi
                    end_angle = 2.0 * math.pi
                    clockwise = False

                turn_seg = Segment(
                    id=seg_id,
                    type="turn",
                    length=turn_length,
                    planned_speed=self.planned_turn_speed,
                    start_s=cum_s,
                    end_s=cum_s + turn_length,
                    nominal_time=turn_length / self.planned_turn_speed,
                    start_point=turn_start,
                    end_point=turn_end,
                    center=center,
                    radius=radius,
                    start_angle=start_angle,
                    end_angle=end_angle,
                    clockwise=clockwise
                )
                self.segments.append(turn_seg)
                cum_s += turn_length
                seg_id += 1

    def get_segment_at_distance(self, s: float) -> Segment:
        """Finds the active segment corresponding to distance s along the route."""
        clamped_s = max(0.0, min(s, self.total_distance))
        for seg in self.segments:
            if seg.start_s <= clamped_s <= seg.end_s:
                return seg
        return self.segments[-1]

    def remaining_time_estimate(self, current_s: float, actual_speed: float) -> float:
        """
        Computes remaining time:
        live measured speed is used for remaining distance in the CURRENT segment,
        while nominal planned speeds are used for all FUTURE segments.
        """
        clamped_s = max(0.0, min(current_s, self.total_distance))
        if clamped_s >= self.total_distance:
            return 0.0

        current_seg = self.get_segment_at_distance(clamped_s)
        remaining_in_current = max(0.0, current_seg.end_s - clamped_s)
        effective_current_speed = max(0.05, actual_speed)

        t_current = remaining_in_current / effective_current_speed

        t_future = 0.0
        for seg in self.segments:
            if seg.id > current_seg.id:
                t_future += seg.nominal_time

        return t_current + t_future

    def get_coordinates_at_distance(self, s: float) -> Tuple[float, float, float]:
        """
        Returns (x, y, heading_rad) at route distance s.
        """
        clamped_s = max(0.0, min(s, self.total_distance))
        seg = self.get_segment_at_distance(clamped_s)
        ratio = (clamped_s - seg.start_s) / max(0.0001, seg.length)

        if seg.type == "lane":
            x = seg.start_point[0] + ratio * (seg.end_point[0] - seg.start_point[0])
            y = seg.start_point[1] + ratio * (seg.end_point[1] - seg.start_point[1])
            heading = math.atan2(seg.end_point[1] - seg.start_point[1], seg.end_point[0] - seg.start_point[0])
            return x, y, heading
        else:
            # Turn segment: circular interpolation
            cx, cy = seg.center
            r = seg.radius
            if seg.clockwise:
                angle = seg.start_angle - ratio * math.pi
                heading = angle - math.pi / 2.0
            else:
                angle = seg.start_angle + ratio * math.pi
                heading = angle + math.pi / 2.0
            x = cx + r * math.cos(angle)
            y = cy + r * math.sin(angle)
            return x, y, heading

    def project_point_to_route(
        self,
        x: float,
        y: float,
        current_segment_idx: Optional[int] = None
    ) -> Tuple[int, float, float]:
        """
        Finds the nearest segment and computes:
        - active_segment_id
        - distance along route (s)
        - signed cross-track error (positive = left of travel direction, negative = right)
        """
        best_dist_sq = float("inf")
        best_seg = self.segments[0]
        best_s = 0.0
        best_cross_track = 0.0

        # Narrow search around current_segment_idx if provided
        if current_segment_idx is not None:
            min_idx = max(0, current_segment_idx - 1)
            max_idx = min(len(self.segments), current_segment_idx + 2)
            search_segments = self.segments[min_idx:max_idx]
        else:
            search_segments = self.segments

        for seg in search_segments:
            if seg.type == "lane":
                # Line segment projection
                x1, y1 = seg.start_point
                x2, y2 = seg.end_point
                dx = x2 - x1
                dy = y2 - y1
                seg_len_sq = dx * dx + dy * dy

                if seg_len_sq < 1e-6:
                    t = 0.0
                else:
                    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / seg_len_sq))

                proj_x = x1 + t * dx
                proj_y = y1 + t * dy
                dist_sq = (x - proj_x) ** 2 + (y - proj_y) ** 2

                if dist_sq < best_dist_sq:
                    best_dist_sq = dist_sq
                    best_seg = seg
                    best_s = seg.start_s + t * seg.length
                    # 2D cross product for signed error: (dx, dy) x (x - x1, y - y1)
                    cross = dx * (y - y1) - dy * (x - x1)
                    norm = math.sqrt(seg_len_sq)
                    best_cross_track = cross / norm if norm > 0 else 0.0
            else:
                # Semicircular arc projection
                cx, cy = seg.center
                r = seg.radius
                angle = math.atan2(y - cy, x - cx)
                proj_x = cx + r * math.cos(angle)
                proj_y = cy + r * math.sin(angle)
                dist_sq = (x - proj_x) ** 2 + (y - proj_y) ** 2

                if dist_sq < best_dist_sq:
                    best_dist_sq = dist_sq
                    best_seg = seg
                    # Unwind angle based on clockwise flag
                    if seg.clockwise:
                        diff = (seg.start_angle - angle) % (2 * math.pi)
                        ratio = max(0.0, min(1.0, diff / math.pi))
                    else:
                        diff = (angle - seg.start_angle) % (2 * math.pi)
                        ratio = max(0.0, min(1.0, diff / math.pi))

                    best_s = seg.start_s + ratio * seg.length
                    # For a circle, radial distance from arc radius
                    dist_to_center = math.hypot(x - cx, y - cy)
                    best_cross_track = dist_to_center - r

        return best_seg.id, best_s, best_cross_track

    def to_dict(self) -> Dict[str, Any]:
        return {
            "num_lanes": self.num_lanes,
            "lane_length": self.lane_length,
            "lane_spacing": self.lane_spacing,
            "total_distance": round(self.total_distance, 3),
            "total_plan_time": round(self.total_plan_time, 3),
            "segments": [seg.to_dict() for seg in self.segments]
        }

# Default route singleton
default_route = SerpentineRoute()
