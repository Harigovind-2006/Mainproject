import * as THREE from 'three';
import { RouteManager } from './routeManager.js';
import { RoverModel } from './roverModel.js';
import { FieldEnvironment } from './fieldEnvironment.js';
import { PhysicsEngine } from './physicsEngine.js';
import { CameraManager } from './cameraManager.js';
import { WsBridge } from './wsBridge.js';
import { HudOverlay } from './hudOverlay.js';
import { BiosConsole } from './biosConsole.js';
import { soundEngine } from './audio.js';

class SimulatorApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.initThree();
    this.initComponents();
    this.handleUrlParams();
    this.startLoop();
  }

  initThree() {
    // 1. Scene with atmospheric fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.015);

    // 2. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );
    this.camera.position.set(0, 10, 15);

    // 3. WebGL Renderer with High Quality Shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting Setup
    // Ambient / Hemisphere Sky light
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x18120e, 0.7);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Sun Directional Light (casts shadows)
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    this.sunLight.position.set(30, 45, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 120;
    const shadowD = 35;
    this.sunLight.shadow.camera.left = -shadowD;
    this.sunLight.shadow.camera.right = shadowD;
    this.sunLight.shadow.camera.top = shadowD;
    this.sunLight.shadow.camera.bottom = -shadowD;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Handle Window Resizing
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initComponents() {
    // 1. Serpentine Route
    this.routeManager = new RouteManager({
      numLanes: 4,
      laneLength: 40.0,
      laneSpacing: 6.0
    });

    // 2. Rover 3D Model
    this.rover = new RoverModel(0xffd21e);
    this.scene.add(this.rover.group);

    // 3. Field Environment & Arena Props (Interactive Ball, Crops, Fences)
    this.environment = new FieldEnvironment(this.scene, this.routeManager);

    // 4. Kinematics & Physics Engine
    this.physics = new PhysicsEngine(this.routeManager);

    // 5. Multi-Mode Camera System
    this.cameraManager = new CameraManager(this.camera, this.renderer.domElement);

    // 6. WebSocket Live Telemetry Bridge to FastAPI /ws/vehicle endpoint
    this.wsBridge = new WsBridge('rover-alpha', 'model');
    this.wsBridge.connect();

    // Pipe AI closed-loop corrections from backend → physics engine
    this.wsBridge.onCorrection((packet) => {
      this.physics.applyClosedLoopCorrection(packet);
    });

    // 7. HUD Overlay & Event Handling
    this.hud = new HudOverlay(
      this.physics,
      this.routeManager,
      this.cameraManager,
      this.rover,
      (targetHours) => {
        // Send initial telemetry sync to backend when mission starts
        this.wsBridge.sendTelemetry(
          this.physics.x2d,
          this.physics.y2d,
          this.physics.effectiveSpeed,
          this.physics.mode
        );
      }
    );

    // Hook bridge state to HUD badge
    this.wsBridge.onStateChange((connected) => {
      this.hud.setWsStatus(connected);
    });

    // Set initial rover placement
    this.syncRoverTransform();
  }

  handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    // Microduck ?boot=1 URL parameter support: skip welcome landing and boot directly through BIOS
    if (urlParams.get('boot') === '1') {
      const landing = document.getElementById('landing-overlay');
      const bios = document.getElementById('bios-screen');
      if (landing) landing.classList.add('hidden');
      if (bios) {
        bios.classList.remove('hidden');
        const biosConsole = new BiosConsole(bios, () => {
          soundEngine.startMotor();
          this.hud.showEtaModal();
        });
        biosConsole.start();
      }
    }
  }

  syncRoverTransform() {
    this.rover.group.position.copy(this.physics.position);
    this.rover.group.rotation.y = this.physics.heading;
  }

  startLoop() {
    this.telemetryTick = 0;

    const animate = () => {
      requestAnimationFrame(animate);

      const dt = Math.min(this.clock.getDelta(), 0.1);

      // 1. Update Physics Engine (Kinematics & steering)
      this.physics.update(dt);

      // 2. Sync Rover 3D Object Transforms
      this.syncRoverTransform();

      // 3. Animate Rover Subsystems (wheel rotation, lidar, pitch)
      this.rover.update(dt, this.physics.effectiveSpeed, this.physics.steerAngle, this.physics.isBraking);

      // 4. Update Field Environment (Soccer ball physics, collisions, dust)
      this.environment.update(dt, this.physics.position, 0.65, () => {
        soundEngine.playBump();
      });

      // 5. Emit dust from wheels when driving
      if (Math.abs(this.physics.effectiveSpeed) > 0.4) {
        this.environment.emitDust(this.physics.position, 1);
      }

      // 6. Update Audio Motor Pitch
      soundEngine.updateMotor(this.physics.effectiveSpeed, 3.0);

      // 7. Update Camera (Chase tracking / Orbit)
      this.cameraManager.update(dt, this.physics.position, this.physics.heading);

      // 8. Transmit Telemetry over WebSocket (at ~10 Hz)
      // Sends x2d/y2d (2D field coords matching simulate_rover.py) not 3D world coords
      this.telemetryTick += dt;
      if (this.telemetryTick >= 0.1) {
        this.telemetryTick = 0;
        this.wsBridge.sendTelemetry(
          this.physics.x2d,
          this.physics.y2d,
          this.physics.effectiveSpeed,
          this.physics.mode
        );
      }

      // 9. Update Retro Camcorder HUD
      this.hud.update();

      // 10. Render 3D Scene
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }
}

// Launch on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  new SimulatorApp();
});
