import * as THREE from 'three';

/**
 * RoverKinematicsSimulator (Directly from backend/simulation/simulate_rover.py)
 * 
 * Replicates the exact physics, wheel slip noise, differential drive kinematics,
 * lateral cross-track drift, and closed-loop speed correction interface.
 */
export class PhysicsEngine {
  constructor(routeManager) {
    this.route = routeManager;
    this.vehicleId = 'rover-alpha';
    this.mode = 'model'; // 'model' | 'manual' | 'baseline' | 'off'

    // Parameters from backend/simulation/simulate_rover.py
    this.wheelBase = 0.6;        // m
    this.slipNoiseStd = 0.08;    // wheel slip standard deviation
    this.lateralNoiseStd = 0.04; // lateral drift standard deviation
    this.maxAccel = 1.2;         // m/s^2

    // Rover Physical State
    this.s = 0.0;                 // distance along path (m)
    this.actualSpeed = 0.0;       // m/s
    this.effectiveSpeed = 0.0;    // m/s (after slip)
    this.targetSpeed = this.route.plannedLaneSpeed;
    this.steeringAdjust = 0.0;    // rad/s (from closed-loop AI controller)
    this.vLeft = 0.0;             // m/s
    this.vRight = 0.0;            // m/s
    this.timeElapsed = 0.0;       // s
    this.deltaT = 0.0;            // s (schedule drift)
    this.percentComplete = 0.0;   // %
    this.rttMs = 0.0;             // round-trip latency (ms)

    // 2D Field Coordinates (matching backend/route_model.py)
    this.x2d = 0.0;
    this.y2d = 0.0;
    this.heading2d = Math.PI / 2.0;
    this.crossTrackOffset = 0.0;  // m

    // 3D Scene Coordinates
    this.position = new THREE.Vector3(0, 0, 0);
    this.heading = 0.0;           // radians in Three.js (around Y axis)
    this.steerAngle = 0.0;        // visual front wheel angle

    // Mission & Disturbance Control
    this.stopped = true;          // Starts stopped until operator sets ETA!
    this.isBraking = false;
    this.isFinished = false;
    this.disturbance = 0.0;       // mud slip disturbance (e.g. -0.75)
    this.disturbanceTimer = 0.0;

    // Manual Driving Keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      boost: false
    };

    this.reset();
  }

  // Gaussian Normal Random Generator (Box-Muller Transform)
  gaussian(mean = 0.0, std = 1.0) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * std;
  }

  reset() {
    this.s = 0.0;
    this.timeElapsed = 0.0;
    this.deltaT = 0.0;
    this.percentComplete = 0.0;
    this.actualSpeed = 0.0;
    this.effectiveSpeed = 0.0;
    this.targetSpeed = this.route.nominalSpeed;
    this.steeringAdjust = 0.0;
    this.vLeft = 0.0;
    this.vRight = 0.0;
    this.crossTrackOffset = 0.0;
    this.disturbance = 0.0;
    this.disturbanceTimer = 0.0;
    this.isBraking = false;
    this.isFinished = false;
    this.stopped = true;

    // Position at start of route (lane 0, s=0)
    const initial = this.route.getCoordinatesAtDistance(0.0);
    this.x2d = initial.x;
    this.y2d = initial.y;
    this.heading2d = initial.heading;

    const pos3D = this.route.to3D(this.x2d, this.y2d);
    this.position.copy(pos3D);
    this.heading = -(this.heading2d - Math.PI / 2.0);
  }

  stop() {
    this.stopped = true;
  }

  resume() {
    this.stopped = false;
  }

  // Switch driving mode: 'model' (autonomous AI) | 'manual' (WASD control) | 'baseline' | 'off'
  setMode(newMode) {
    this.mode = newMode;
    // When switching to manual, zero out autonomous steering
    if (newMode === 'manual') {
      this.steeringAdjust = 0.0;
    }
  }

  // Inject mud slip disturbance (-75% wheel traction), exactly matching simulate_rover.py
  injectMudSlip(duration = 4.0, severity = -0.75) {
    this.disturbance = severity;
    this.disturbanceTimer = duration;
  }

  // Applies closed-loop feedback packet received from FastAPI backend (/ws/vehicle)
  applyClosedLoopCorrection(packet) {
    if (!packet) return;

    if (packet.target_speed !== undefined) {
      this.targetSpeed = parseFloat(packet.target_speed);
    }
    if (packet.steering_adjust !== undefined) {
      this.steeringAdjust = parseFloat(packet.steering_adjust);
    }
    if (packet.delta_T !== undefined) {
      this.deltaT = parseFloat(packet.delta_T);
    }
    if (packet.percent_complete !== undefined) {
      this.percentComplete = parseFloat(packet.percent_complete);
    }
    if (packet.server_latency_ms !== undefined) {
      this.rttMs = parseFloat(packet.server_latency_ms);
    }
  }

  update(dt) {
    // Handle active disturbance timer
    if (this.disturbanceTimer > 0) {
      this.disturbanceTimer -= dt;
      if (this.disturbanceTimer <= 0) {
        this.disturbance = 0.0;
      }
    }

    if (this.stopped) {
      this.actualSpeed = THREE.MathUtils.lerp(this.actualSpeed, 0, dt * 5.0);
      this.effectiveSpeed = 0.0;
      this.vLeft = 0.0;
      this.vRight = 0.0;
      return;
    }

    if (this.mode === 'manual') {
      this.updateManual(dt);
    } else {
      this.updateKinematics(dt);
    }
  }

  /**
   * Exact RoverKinematicsSimulator.step(dt) implementation from simulate_rover.py
   */
  updateKinematics(dt) {
    this.timeElapsed += dt;

    // 1. Acceleration limit toward target speed
    const speedDiff = this.targetSpeed - this.actualSpeed;
    const maxStep = this.maxAccel * dt;
    const clampedDiff = Math.max(-maxStep, Math.min(maxStep, speedDiff));
    this.actualSpeed += clampedDiff;

    // 2. Wheel slip noise (simulates terrain irregularities like soil/grass)
    const slip = 1.0 + this.gaussian(0.0, this.slipNoiseStd) + this.disturbance;
    this.effectiveSpeed = Math.max(0.0, this.actualSpeed * slip);

    // 3. Advance route distance
    this.s += this.effectiveSpeed * dt;

    if (this.s >= this.route.totalDistance) {
      this.s = this.route.totalDistance;
      this.isFinished = true;
      this.actualSpeed = 0.0;
      this.effectiveSpeed = 0.0;
    }

    // 4. Compute nominal centerline coordinate
    const nom = this.route.getCoordinatesAtDistance(this.s);

    // 5. Lateral drift / steering adjustment response
    // Steering adjust (rad/s) shifts cross-track towards zero
    this.crossTrackOffset += (
      -this.steeringAdjust * this.effectiveSpeed * dt * 0.4
      + this.gaussian(0.0, this.lateralNoiseStd * dt)
    );
    this.crossTrackOffset = Math.max(-0.35, Math.min(0.35, this.crossTrackOffset));

    // Rover position = nominal position + normal vector * cross-track offset
    const normAngle = nom.heading + Math.PI / 2.0;
    this.x2d = nom.x + this.crossTrackOffset * Math.cos(normAngle);
    this.y2d = nom.y + this.crossTrackOffset * Math.sin(normAngle);
    this.heading2d = nom.heading;

    // 6. Differential wheel speeds (Ospina & Noguchi 2025)
    this.vLeft = this.effectiveSpeed - (this.steeringAdjust * this.wheelBase) / 2.0;
    this.vRight = this.effectiveSpeed + (this.steeringAdjust * this.wheelBase) / 2.0;

    // 7. Map to 3D World Space
    const pos3D = this.route.to3D(this.x2d, this.y2d);
    this.position.copy(pos3D);

    // 3D Yaw heading: in 2D, heading=PI/2 is +Y, which corresponds to +Z in 3D
    const target3DHeading = -(this.heading2d - Math.PI / 2.0);
    this.heading = THREE.MathUtils.lerp(this.heading, target3DHeading, dt * 8.0);

    // Front wheel visual steer angle
    this.steerAngle = nom.inTurn ? (this.effectiveSpeed > 0 ? 0.32 : -0.32) : -this.steeringAdjust * 0.5;

    // 8. Standalone schedule drift calculation (fallback if backend not linked)
    if (!this.rttMs) {
      const nominalPlanTime = this.route.targetHours ? this.route.targetHours * 3600.0 : this.route.totalPlanTime;
      const expectedTimeAtS = (this.s / this.route.totalDistance) * nominalPlanTime;
      this.deltaT = this.timeElapsed - expectedTimeAtS;
      this.percentComplete = (this.s / this.route.totalDistance) * 100.0;

      // Standalone closed-loop proportional controller (Stanley steering)
      this.steeringAdjust = Math.max(-0.5, Math.min(0.5, -0.6 * this.crossTrackOffset));

      // Speed recovery
      if (this.deltaT > 0.5) {
        this.targetSpeed = Math.min(2.5, this.route.nominalSpeed + 0.3); // Speed up
      } else if (this.deltaT < -0.5) {
        this.targetSpeed = Math.max(0.5, this.route.nominalSpeed - 0.2); // Slow down
      } else {
        this.targetSpeed = this.route.nominalSpeed;
      }
    }
  }

  /**
   * Manual Remote Driving (WASD / Arrows)
   */
  updateManual(dt) {
    this.timeElapsed += dt;
    const maxSpd = this.keys.boost ? 3.0 : 2.0;

    if (this.keys.brake) {
      this.isBraking = true;
      this.actualSpeed = THREE.MathUtils.lerp(this.actualSpeed, 0, 4.5 * dt);
    } else if (this.keys.forward) {
      this.isBraking = false;
      this.actualSpeed = Math.min(maxSpd, this.actualSpeed + this.maxAccel * dt);
    } else if (this.keys.backward) {
      this.isBraking = false;
      this.actualSpeed = Math.max(-1.0, this.actualSpeed - this.maxAccel * dt);
    } else {
      this.isBraking = false;
      this.actualSpeed -= Math.sign(this.actualSpeed) * Math.min(Math.abs(this.actualSpeed), 1.0 * dt);
    }

    this.effectiveSpeed = this.actualSpeed;

    let targetSteer = 0;
    if (this.keys.left) targetSteer = 0.45;
    if (this.keys.right) targetSteer = -0.45;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, dt * 4.0);

    if (Math.abs(this.effectiveSpeed) > 0.02) {
      this.heading += (this.effectiveSpeed / this.wheelBase) * Math.tan(-this.steerAngle) * dt;
    }

    this.position.x += Math.sin(this.heading) * this.effectiveSpeed * dt;
    this.position.z += Math.cos(this.heading) * this.effectiveSpeed * dt;

    // Arena boundary clamp
    this.position.x = Math.max(-25, Math.min(25, this.position.x));
    this.position.z = Math.max(-35, Math.min(35, this.position.z));

    const [x2, y2] = this.route.to2D(this.position);
    this.x2d = x2;
    this.y2d = y2;
    this.vLeft = this.effectiveSpeed - (this.steerAngle * this.wheelBase) / 2.0;
    this.vRight = this.effectiveSpeed + (this.steerAngle * this.wheelBase) / 2.0;
  }
}
