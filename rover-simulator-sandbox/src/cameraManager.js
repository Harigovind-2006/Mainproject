import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Multi-Mode Camera System
 * Supports Chase Camera (Microduck default), Free OrbitControls on drag,
 * FPV Cockpit Camera, and Top-Down Aerial View.
 */
export class CameraManager {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Controls
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 80.0;

    // Modes: 'CHASE' | 'ORBIT' | 'FPV' | 'TOP_DOWN'
    this.mode = 'CHASE';

    // Chase offsets
    this.chaseDistance = 5.5;
    this.chaseHeight = 2.6;
    this.chaseTargetOffset = new THREE.Vector3(0, 0.6, 0);

    // Detach chase cam when user drags mouse
    this.controls.addEventListener('start', () => {
      if (this.mode === 'CHASE') {
        this.mode = 'ORBIT';
        this.notifyModeChange();
      }
    });

    this.onModeChangeCallbacks = [];
  }

  onModeChange(callback) {
    this.onModeChangeCallbacks.push(callback);
  }

  notifyModeChange() {
    this.onModeChangeCallbacks.forEach((cb) => cb(this.mode));
  }

  setMode(newMode) {
    this.mode = newMode;
    if (newMode === 'CHASE') {
      this.controls.enabled = false;
    } else if (newMode === 'ORBIT') {
      this.controls.enabled = true;
    } else if (newMode === 'FPV') {
      this.controls.enabled = false;
    } else if (newMode === 'TOP_DOWN') {
      this.controls.enabled = true;
      this.camera.position.set(0, 55, 0);
      this.controls.target.set(0, 0, 0);
    }
    this.notifyModeChange();
  }

  toggleChase() {
    this.setMode(this.mode === 'CHASE' ? 'ORBIT' : 'CHASE');
  }

  update(dt, roverPos, roverHeading) {
    if (this.mode === 'CHASE') {
      // Calculate ideal chase position behind rover based on heading
      const backwardX = -Math.sin(roverHeading) * this.chaseDistance;
      const backwardZ = -Math.cos(roverHeading) * this.chaseDistance;
      const idealPos = new THREE.Vector3(
        roverPos.x + backwardX,
        roverPos.y + this.chaseHeight,
        roverPos.z + backwardZ
      );

      // Smooth lerp camera position
      this.camera.position.lerp(idealPos, dt * 5.0);

      // Look at point slightly in front of rover
      const lookTarget = roverPos.clone().add(this.chaseTargetOffset);
      this.camera.lookAt(lookTarget);
      this.controls.target.copy(lookTarget);
    } else if (this.mode === 'FPV') {
      // Cockpit mast position
      const forwardX = Math.sin(roverHeading) * 0.4;
      const forwardZ = Math.cos(roverHeading) * 0.4;
      this.camera.position.set(
        roverPos.x + forwardX,
        roverPos.y + 0.65,
        roverPos.z + forwardZ
      );

      // Look ahead along heading
      const lookDist = 10.0;
      const lookTarget = new THREE.Vector3(
        roverPos.x + Math.sin(roverHeading) * lookDist,
        roverPos.y + 0.5,
        roverPos.z + Math.cos(roverHeading) * lookDist
      );
      this.camera.lookAt(lookTarget);
    } else if (this.mode === 'ORBIT' || this.mode === 'TOP_DOWN') {
      this.controls.update();
    }
  }
}
