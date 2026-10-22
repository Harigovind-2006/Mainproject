import * as THREE from 'three';

/**
 * Rover Kinematics & Physics Engine
 * Supports both Autonomous Serpentine Waypoint Following (speed-scaled to user ETA)
 * and Manual Remote Teleoperation (WASD / Arrows) with differential drive physics.
 */
export class PhysicsEngine {
  constructor(routeManager) {
    this.route = routeManager;
    this.mode = 'autonomous'; // 'autonomous' | 'manual'

    // Rover Pose & Kinematics
    this.position = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // radians
    this.speed = 0;   // m/s
    this.steerAngle = 0;
    this.distanceCovered = 0; // s (meters along route)
    this.timeElapsed = 0;     // seconds
    this.deltaT = 0;          // Schedule drift in seconds (actual - planned)
    this.stopped = true;      // Starts stopped until operator sets ETA!
    this.isBraking = false;
    this.isFinished = false;

    // Manual Driving Parameters
    this.maxForwardSpeed = 3.0; // m/s
    this.maxReverseSpeed = -1.2;
    this.accelRate = 2.4;       // m/s^2
    this.brakeRate = 4.5;
    this.frictionDecel = 1.2;
    this.maxSteerAngle = 0.52;  // ~30 degrees
    this.steerRate = 2.5;

    // Keys state for manual control
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

  reset() {
    this.distanceCovered = 0;
    this.timeElapsed = 0;
    this.deltaT = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.isBraking = false;
    this.isFinished = false;
    this.stopped = true; // Awaiting ETA config

    // Place rover at route start
    const initialPose = this.route.getPoseAtDistance(0);
    this.position.copy(initialPose.position);
    this.heading = initialPose.heading;
  }

  setMode(mode) {
    if (mode === 'autonomous' || mode === 'manual') {
      this.mode = mode;
      this.speed = 0;
      this.steerAngle = 0;
    }
  }

  stop() {
    this.stopped = true;
    this.speed = 0;
  }

  resume() {
    this.stopped = false;
  }

  injectDelay(seconds) {
    this.timeElapsed += seconds;
    this.deltaT += seconds;
  }

  update(dt) {
    if (this.stopped) {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, 0.1);
      return;
    }

    if (this.mode === 'autonomous') {
      this.updateAutonomous(dt);
    } else {
      this.updateManual(dt);
    }
  }

  // ----------------------------------------------------
  // Autonomous Mode: Follow Serpentine Trajectory
  // ----------------------------------------------------
  updateAutonomous(dt) {
    if (this.isFinished) {
      this.speed = 0;
      return;
    }

    this.timeElapsed += dt;

    // Target cruising speed scaled to operator ETA
    let targetSpeed = this.route.nominalSpeed;

    // Peek ahead to see if approaching or in a headland turn
    const currentPose = this.route.getPoseAtDistance(this.distanceCovered);
    if (currentPose.inTurn) {
      // Slow down slightly on turns for stability
      targetSpeed = Math.min(targetSpeed, 1.0);
    }

    // Smooth speed acceleration
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * 2.5);

    // Advance path progress distance s
    this.distanceCovered += this.speed * dt;

    if (this.distanceCovered >= this.route.totalDistance) {
      this.distanceCovered = this.route.totalDistance;
      this.isFinished = true;
      this.speed = 0;
    }

    // Compute updated position and heading from route math
    const pose = this.route.getPoseAtDistance(this.distanceCovered);
    this.position.copy(pose.position);

    // Smooth heading transition
    this.heading = THREE.MathUtils.lerp(this.heading, pose.heading, dt * 8.0);

    // Compute steering wheel visual angle based on heading curvature
    this.steerAngle = pose.inTurn ? (this.speed > 0 ? 0.35 : -0.35) : 0;

    // Schedule Drift Calculation: actual elapsed time vs planned nominal time
    const nominalTimeExpected = (this.distanceCovered / this.route.totalDistance) * (this.route.targetHours ? this.route.targetHours * 3600 : 150);
    this.deltaT = this.timeElapsed - nominalTimeExpected;
    this.isBraking = false;
  }

  // ----------------------------------------------------
  // Manual Mode: WASD Remote Driving
  // ----------------------------------------------------
  updateManual(dt) {
    this.timeElapsed += dt;

    // 1. Throttle / Brake / Reversing
    const maxSpd = this.keys.boost ? this.maxForwardSpeed * 1.4 : this.maxForwardSpeed;

    if (this.keys.brake) {
      this.isBraking = true;
      this.speed = THREE.MathUtils.lerp(this.speed, 0, this.brakeRate * dt);
    } else if (this.keys.forward) {
      this.isBraking = false;
      this.speed = Math.min(maxSpd, this.speed + this.accelRate * dt);
    } else if (this.keys.backward) {
      this.isBraking = false;
      this.speed = Math.max(this.maxReverseSpeed, this.speed - this.accelRate * dt);
    } else {
      this.isBraking = false;
      // Natural ground rolling friction
      if (Math.abs(this.speed) < 0.05) {
        this.speed = 0;
      } else {
        this.speed -= Math.sign(this.speed) * this.frictionDecel * dt;
      }
    }

    // 2. Steering angle
    let targetSteer = 0;
    if (this.keys.left) targetSteer = -this.maxSteerAngle;
    if (this.keys.right) targetSteer = this.maxSteerAngle;

    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, this.steerRate * dt);

    // 3. Differential Yaw Rotation
    if (Math.abs(this.speed) > 0.05) {
      const wheelbase = 1.0;
      const yawRate = (this.speed / wheelbase) * Math.tan(this.steerAngle);
      this.heading += yawRate * dt;
    }

    // 4. Update Position in World Space
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;

    // 5. Arena boundary clamping
    const maxBoundX = 30.0;
    const maxBoundZ = 35.0;
    this.position.x = Math.max(-maxBoundX, Math.min(maxBoundX, this.position.x));
    this.position.z = Math.max(-maxBoundZ, Math.min(maxBoundZ, this.position.z));
  }
}
