import * as THREE from 'three';

/**
 * Serpentine Field Route Manager
 * Generates alternating straight lanes and semicircular headland turns
 * following Ospina & Noguchi (2025) kinematic formulation.
 */
export class RouteManager {
  constructor(options = {}) {
    this.numLanes = options.numLanes || 4;
    this.laneLength = options.laneLength || 40.0;
    this.laneSpacing = options.laneSpacing || 6.0;
    this.turnRadius = this.laneSpacing / 2.0; // 3.0m

    // Speed parameters
    this.targetHours = null; // Operator configured completion time (hours)
    this.nominalSpeed = 1.2; // Default cruising speed (m/s)

    this.segments = [];
    this.totalDistance = 0;
    this.buildRoute();
  }

  buildRoute() {
    this.segments = [];
    let cumS = 0;
    let segId = 0;

    // Center the field around (0, 0) in world coordinates
    const startX = -((this.numLanes - 1) * this.laneSpacing) / 2.0;
    const startZ = -this.laneLength / 2.0;

    for (let i = 0; i < this.numLanes; i++) {
      const xLane = startX + i * this.laneSpacing;
      const isUpward = (i % 2 === 0);

      const zStart = isUpward ? startZ : startZ + this.laneLength;
      const zEnd = isUpward ? startZ + this.laneLength : startZ;

      // Straight Lane Segment
      const laneSeg = {
        id: segId++,
        type: 'lane',
        startS: cumS,
        endS: cumS + this.laneLength,
        length: this.laneLength,
        startPoint: new THREE.Vector3(xLane, 0, zStart),
        endPoint: new THREE.Vector3(xLane, 0, zEnd),
        direction: new THREE.Vector3(0, 0, isUpward ? 1 : -1)
      };
      cumS += this.laneLength;
      this.segments.push(laneSeg);

      // Semicircular Turn Segment (if not the last lane)
      if (i < this.numLanes - 1) {
        const nextXLane = startX + (i + 1) * this.laneSpacing;
        const centerX = (xLane + nextXLane) / 2.0;
        const centerZ = zEnd;
        const arcLength = Math.PI * this.turnRadius;

        // Angle in horizontal XZ plane
        let startAngle, endAngle, clockwise;
        if (isUpward) {
          // Top turn: from right (0) to left (PI) or vice versa
          startAngle = Math.PI;
          endAngle = 0;
          clockwise = true;
        } else {
          // Bottom turn
          startAngle = Math.PI;
          endAngle = 2 * Math.PI;
          clockwise = false;
        }

        const turnSeg = {
          id: segId++,
          type: 'turn',
          startS: cumS,
          endS: cumS + arcLength,
          length: arcLength,
          startPoint: new THREE.Vector3(xLane, 0, zEnd),
          endPoint: new THREE.Vector3(nextXLane, 0, zEnd),
          center: new THREE.Vector3(centerX, 0, centerZ),
          radius: this.turnRadius,
          startAngle,
          endAngle,
          clockwise,
          isUpward
        };
        cumS += arcLength;
        this.segments.push(turnSeg);
      }
    }

    this.totalDistance = cumS;
  }

  // Set planned completion time in hours and calculate required nominal speed
  setPlannedHours(hours) {
    if (hours <= 0) return;
    this.targetHours = hours;
    const targetSeconds = hours * 3600.0;
    this.nominalSpeed = this.totalDistance / targetSeconds;
    return this.nominalSpeed;
  }

  // Get 3D world pose (position Vector3, yaw heading in radians, inTurn boolean, segmentId)
  getPoseAtDistance(s) {
    // Clamp or loop distance
    const dist = Math.max(0, Math.min(this.totalDistance, s));
    
    // Find active segment
    for (const seg of this.segments) {
      if (dist >= seg.startS && dist <= seg.endS) {
        const segProgress = dist - seg.startS;

        if (seg.type === 'lane') {
          const ratio = seg.length > 0 ? segProgress / seg.length : 0;
          const pos = new THREE.Vector3().lerpVectors(seg.startPoint, seg.endPoint, ratio);
          const heading = seg.direction.z > 0 ? 0 : Math.PI;
          return {
            position: pos,
            heading: heading,
            inTurn: false,
            segmentId: seg.id,
            isFinished: dist >= this.totalDistance
          };
        } else {
          // Turn arc
          const ratio = segProgress / seg.length;
          const angle = seg.startAngle + (seg.clockwise ? -1 : 1) * (ratio * Math.PI);
          const posX = seg.center.x + seg.radius * Math.cos(angle);
          const posZ = seg.center.z + seg.radius * Math.sin(angle);
          
          // Tangent heading perpendicular to radial vector
          const heading = angle + (seg.clockwise ? -Math.PI / 2 : Math.PI / 2);

          return {
            position: new THREE.Vector3(posX, 0, posZ),
            heading: heading,
            inTurn: true,
            segmentId: seg.id,
            isFinished: dist >= this.totalDistance
          };
        }
      }
    }

    // Default to end point if past total distance
    const lastSeg = this.segments[this.segments.length - 1];
    return {
      position: lastSeg.endPoint.clone(),
      heading: 0,
      inTurn: false,
      segmentId: lastSeg.id,
      isFinished: true
    };
  }

  // Generates array of Vector3 points sampling the route for Three.js Line/Ribbon
  generatePathPoints(samplesPerMeter = 2) {
    const points = [];
    const step = 1.0 / samplesPerMeter;
    for (let s = 0; s <= this.totalDistance; s += step) {
      const pose = this.getPoseAtDistance(s);
      points.push(pose.position.clone().setY(0.04)); // Slightly above ground to prevent z-fighting
    }
    // Add final point
    const lastPose = this.getPoseAtDistance(this.totalDistance);
    points.push(lastPose.position.clone().setY(0.04));
    return points;
  }
}
