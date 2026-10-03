export interface SegmentData {
  id: number;
  type: "lane" | "turn";
  length: number;
  planned_speed: number;
  start_s: number;
  end_s: number;
  nominal_time: number;
  start_point: [number, number];
  end_point: [number, number];
  center?: [number, number] | null;
  radius?: number | null;
  start_angle?: number | null;
  end_angle?: number | null;
  clockwise?: boolean;
}

export interface RouteData {
  num_lanes: number;
  lane_length: number;
  lane_spacing: number;
  total_distance: number;
  total_plan_time: number;
  segments: SegmentData[];
}

export interface VehicleTelemetry {
  vehicle_id: string;
  x: number;
  y: number;
  heading: number;
  actual_speed: number;
  target_speed: number;
  steering_adjust: number;
  cross_track_error: number;
  distance_covered: number;
  distance_remaining: number;
  percent_complete: number;
  time_elapsed: number;
  time_remaining: number;
  eta_total_time: number;
  delta_T: number;
  delta_T_lags: [number, number, number];
  ideal_speed: number;
  schedule_status: "ON_SCHEDULE" | "AHEAD" | "BEHIND" | "IDLE" | string;
  current_segment_id: number;
  in_turn: boolean;
  last_update_time: number;
  battery_level?: number;
  wheel_speeds?: {
    left: number;
    right: number;
  };
}

export interface BenchmarkMetrics {
  total_messages: number;
  uptime_seconds: number;
  messages_per_sec: number;
  avg_latency_ms: number;
  connected_vehicles: number;
  connected_dashboards: number;
}

export interface WebSocketMessage {
  type: "INITIAL_STATE" | "VEHICLE_UPDATE" | "FLEET_STATUS" | "PONG" | string;
  fleet?: VehicleTelemetry[];
  vehicle?: VehicleTelemetry;
  route?: RouteData;
  active_count?: number;
  timestamp?: number;
}
