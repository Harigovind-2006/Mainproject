import * as THREE from 'three';

/**
 * Serpentine Field Route Manager
 * Exactly matches backend/route_model.py (Ospina & Noguchi 2025):
 * - 4 lanes, 50.0m lane length, 5.0m lane spacing, 2.5m turn radius
 * - Origin (0, 0), Total Distance = 223.562 m
 * - Maps 2D (x, y) coordinates to centered 3D world (X, Z)
 */
export class RouteManager {
  constructor() {
    this.numLanes = 4;
    this.laneLength = 50.0;
    this.laneSpacing = 5.0;
    this.turnRadius = this.laneSpacing / 2.0; // 2.5m
    this.origin = [0.0, 0.0];

    this.plannedLaneSpeed = 1.5; // m/s
    this.plannedTurnSpeed = 0.8; // m/s

    // Field visual centering offset (so the field is centered at 0, 0, 0 in 3D)
    this.centerX = ((this.numLanes - 1) * this.laneSpacing) / 2.0; // 7.5m
    this.centerZ = this.laneLength / 2.0; // 25.0m

    this.targetHours = null;
    this.nominalSpeed = this.plannedLaneSpeed;

    this.segments = [];
    this.totalDistance = 0;
    this.totalPlanTime = 0;

    this.buildRoute();
  }

  buildRoute() {
    this.segments = [];
    let cumS = 0;
    let segId = 0;
    const [x0, y0] = this.origin;

    for (let laneIdx = 0; laneIdx < this.numLanes; laneIdx++) {
      const xLane = x0 + laneIdx * this.laneSpacing;
      const isUpward = (laneIdx % 2 === 0);

      const startPt = isUpward ? [xLane, y0] : [xLane, y0 + this.laneLength];
      const endPt = isUpward ? [xLane, y0 + this.laneLength] : [xLane, y0];

      const laneSeg = {
        id: segId++,
        type: 'lane',
        length: this.laneLength,
        plannedSpeed: this.plannedLaneSpeed,
        startS: cumS,
        endS: cumS + this.laneLength,
        nominalTime: this.laneLength / this.plannedLaneSpeed,
        startPoint: startPt,
        endPoint: endPt,
        isUpward
      };
      this.segments.push(laneSeg);
      cumS += this.laneLength;

      // Semicircular headland turn if not the last lane
      if (laneIdx < this.numLanes - 1) {
        const radius = this.turnRadius;
        const turnLength = Math.PI * radius;
        const nextXLane = x0 + (laneIdx + 1) * this.laneSpacing;

        let center, turnStart, turnEnd, startAngle, endAngle, clockwise;

        if (isUpward) {
          // Top turn: connects (xLane, y0 + L) to (nextXLane, y0 + L)
          center = [(xLane + nextXLane) / 2.0, y0 + this.laneLength];
          turnStart = [xLane, y0 + this.laneLength];
          turnEnd = [nextXLane, y0 + this.laneLength];
          startAngle = Math.PI;
          endAngle = 0.0;
          clockwise = true;
        } else {
          // Bottom turn: connects (xLane, y0) to (nextXLane, y0)
          center = [(xLane + nextXLane) / 2.0, y0];
          turnStart = [xLane, y0];
          turnEnd = [nextXLane, y0];
          startAngle = Math.PI;
          endAngle = 2.0 * Math.PI;
          clockwise = false;
        }

        const turnSeg = {
          id: segId++,
          type: 'turn',
          length: turnLength,
          plannedSpeed: this.plannedTurnSpeed,
          startS: cumS,
          endS: cumS + turnLength,
          nominalTime: turnLength / this.plannedTurnSpeed,
          startPoint: turnStart,
          endPoint: turnEnd,
          center,
          radius,
          startAngle,
          endAngle,
          clockwise,
          isUpward
        };
        this.segments.push(turnSeg);
        cumS += turnLength;
      }
    }

    this.totalDistance = cumS; // 223.562 m
    this.totalPlanTime = this.segments.reduce((acc, s) => acc + s.nominalTime, 0);
  }

  // Convert 2D field coordinates (x, y) to 3D world space (X, Y, Z)
  to3D(x, y, elevation = 0.04) {
    return new THREE.Vector3(x - this.centerX, elevation, y - this.centerZ);
  }

  // Convert 3D world position to 2D field coordinates (x, y)
  to2D(pos3D) {
    return [pos3D.x + this.centerX, pos3D.z + this.centerZ];
  }

  // Set planned completion time in hours and calculate required nominal speed
  setPlannedHours(hours) {
    if (hours <= 0) return;
    this.targetHours = hours;
    const targetSeconds = hours * 3600.0;
    this.nominalSpeed = this.totalDistance / targetSeconds;
    return this.nominalSpeed;
  }

  getSegmentAtDistance(s) {
    const clampedS = Math.max(0.0, Math.min(s, this.totalDistance));
    for (const seg of this.segments) {
      if (seg.startS <= clampedS && clampedS <= seg.endS) {
        return seg;
      }
    }
    return this.segments[this.segments.length - 1];
  }

  /**
   * Returns exact 2D [x, y, heading_rad] at route distance s
   * Matching backend/route_model.py get_coordinates_at_distance()
   */
  getCoordinatesAtDistance(s) {
    const clampedS = Math.max(0.0, Math.min(s, this.totalDistance));
    const seg = this.getSegmentAtDistance(clampedS);
    const ratio = (clampedS - seg.startS) / Math.max(0.0001, seg.length);

    if (seg.type === 'lane') {
      const x = seg.startPoint[0] + ratio * (seg.endPoint[0] - seg.startPoint[0]);
      const y = seg.startPoint[1] + ratio * (seg.endPoint[1] - seg.startPoint[1]);
      const heading = Math.atan2(
        seg.endPoint[1] - seg.startPoint[1],
        seg.endPoint[0] - seg.startPoint[0]
      );
      return { x, y, heading, inTurn: false, segmentId: seg.id };
    } else {
      const [cx, cy] = seg.center;
      const r = seg.radius;
      let angle, heading;

      if (seg.clockwise) {
        angle = seg.startAngle - ratio * Math.PI;
        heading = angle - Math.PI / 2.0;
      } else {
        angle = seg.startAngle + ratio * Math.PI;
        heading = angle + Math.PI / 2.0;
      }

      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return { x, y, heading, inTurn: true, segmentId: seg.id };
    }
  }

  /**
   * Generates 3D points for Three.js Route Ribbon
   */
  generatePathPoints(samplesPerMeter = 2) {
    const points = [];
    const step = 1.0 / samplesPerMeter;
    for (let s = 0; s <= this.totalDistance; s += step) {
      const { x, y } = this.getCoordinatesAtDistance(s);
      points.push(this.to3D(x, y, 0.05));
    }
    const last = this.getCoordinatesAtDistance(this.totalDistance);
    points.push(this.to3D(last.x, last.y, 0.05));
    return points;
  }
}
