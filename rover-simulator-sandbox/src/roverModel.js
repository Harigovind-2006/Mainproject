import * as THREE from 'three';

/**
 * Procedural 3D Autonomous Agricultural Rover Robot
 * Complete with articulated steering wheels, spinning LiDAR scanner,
 * dynamic spotlights, chassis suspension pitch, and dynamic paint recoloring.
 */
export class RoverModel {
  constructor(colorHex = 0xffd21e) {
    this.group = new THREE.Group();
    this.primaryColor = colorHex;
    this.wheelRadius = 0.22;
    this.wheelWidth = 0.16;

    // References for dynamic animation
    this.wheels = [];
    this.frontSteerPivots = [];
    this.lidarPuck = null;
    this.chassisBody = null;
    this.headlights = [];
    this.taillightMaterial = null;
    this.paintMaterials = [];

    this.currentPitch = 0;
    this.buildRover();
  }

  buildRover() {
    // ----------------------------------------------------
    // Shared Materials
    // ----------------------------------------------------
    const primaryPaint = new THREE.MeshStandardMaterial({
      color: this.primaryColor,
      metalness: 0.35,
      roughness: 0.35
    });
    this.paintMaterials.push(primaryPaint);

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      metalness: 0.8,
      roughness: 0.3
    });

    const tireRubber = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.9,
      metalness: 0.1
    });

    const chrome = new THREE.MeshStandardMaterial({
      color: 0xd8e0e8,
      metalness: 0.9,
      roughness: 0.15
    });

    const glowCyan = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    this.taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0x550000,
      emissive: 0x880000,
      emissiveIntensity: 0.6
    });

    // ----------------------------------------------------
    // 1. Chassis Body (Suspension tilted frame)
    // ----------------------------------------------------
    this.chassisBody = new THREE.Group();
    this.chassisBody.position.y = 0.28;
    this.group.add(this.chassisBody);

    // Main hull box
    const hullGeo = new THREE.BoxGeometry(0.72, 0.28, 1.25);
    const hull = new THREE.Mesh(hullGeo, primaryPaint);
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.chassisBody.add(hull);

    // Bottom skid plate
    const skidGeo = new THREE.BoxGeometry(0.66, 0.04, 1.15);
    const skid = new THREE.Mesh(skidGeo, darkMetal);
    skid.position.y = -0.15;
    this.chassisBody.add(skid);

    // Top tech deck / electronics box
    const deckGeo = new THREE.BoxGeometry(0.56, 0.14, 0.82);
    const deck = new THREE.Mesh(deckGeo, darkMetal);
    deck.position.set(0, 0.20, -0.05);
    deck.castShadow = true;
    this.chassisBody.add(deck);

    // Solar / heatsink panel on deck
    const solarGeo = new THREE.BoxGeometry(0.48, 0.02, 0.68);
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x0a1a30,
      metalness: 0.9,
      roughness: 0.2
    });
    const solar = new THREE.Mesh(solarGeo, solarMat);
    solar.position.set(0, 0.28, -0.05);
    this.chassisBody.add(solar);

    // ----------------------------------------------------
    // 2. Tubular Roll Cage & Front Bull Bar
    // ----------------------------------------------------
    const barMat = darkMetal;

    // Front Bumper Bull Bar
    const bumperBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 12), barMat);
    bumperBar.rotation.z = Math.PI / 2;
    bumperBar.position.set(0, -0.04, 0.66);
    this.chassisBody.add(bumperBar);

    // Bumper uprights
    [-0.28, 0.28].forEach((x) => {
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.20, 8), barMat);
      up.position.set(x, 0.03, 0.66);
      this.chassisBody.add(up);
    });

    // Roll cage top rails
    [-0.30, 0.30].forEach((x) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 8), barMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.22, -0.05);
      this.chassisBody.add(rail);
    });

    // ----------------------------------------------------
    // 3. Rotating 3D LiDAR Scanner & GPS Masts
    // ----------------------------------------------------
    const lidarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 12), darkMetal);
    lidarMast.position.set(0, 0.35, 0.22);
    this.chassisBody.add(lidarMast);

    this.lidarPuck = new THREE.Group();
    this.lidarPuck.position.set(0, 0.44, 0.22);
    this.chassisBody.add(this.lidarPuck);

    // Puck housing
    const puckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 16), chrome);
    this.lidarPuck.add(puckMesh);

    // Laser emitter slot band
    const laserBand = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.02, 16), glowCyan);
    laserBand.position.y = 0.005;
    this.lidarPuck.add(laserBand);

    // Dual GNSS Antennas (masts at rear)
    [-0.22, 0.22].forEach((x) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 8), darkMetal);
      mast.position.set(x, 0.38, -0.48);
      this.chassisBody.add(mast);

      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), chrome);
      dome.position.set(x, 0.54, -0.48);
      this.chassisBody.add(dome);
    });

    // ----------------------------------------------------
    // 4. Headlights & Taillights
    // ----------------------------------------------------
    // Dual front high-power spotlights
    [-0.25, 0.25].forEach((x) => {
      // Light housing
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), chrome);
      housing.rotation.x = Math.PI / 2;
      housing.position.set(x, 0.06, 0.63);
      this.chassisBody.add(housing);

      // Lens glow
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }));
      lens.position.set(x, 0.06, 0.656);
      this.chassisBody.add(lens);

      // SpotLight projecting forward
      const spot = new THREE.SpotLight(0xfff5d0, 2.5, 18, Math.PI / 4.5, 0.4, 1.2);
      spot.position.set(x, 0.06, 0.66);
      spot.target.position.set(x, -0.5, 6.0);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 512;
      spot.shadow.mapSize.height = 512;
      this.chassisBody.add(spot);
      this.chassisBody.add(spot.target);
      this.headlights.push(spot);
    });

    // Dual rear brake lights
    [-0.25, 0.25].forEach((x) => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.02), this.taillightMaterial);
      tail.position.set(x, 0.06, -0.63);
      this.chassisBody.add(tail);
    });

    // ----------------------------------------------------
    // 5. 4 Wheels (Front steerable, rear fixed)
    // ----------------------------------------------------
    const wheelPositions = [
      { x: -0.46, y: 0.22, z: 0.42, isFront: true, isLeft: true },   // Front Left
      { x: 0.46, y: 0.22, z: 0.42, isFront: true, isLeft: false },   // Front Right
      { x: -0.46, y: 0.22, z: -0.42, isFront: false, isLeft: true }, // Rear Left
      { x: 0.46, y: 0.22, z: -0.42, isFront: false, isLeft: false }, // Rear Right
    ];

    wheelPositions.forEach((wp) => {
      // Steering pivot group (rotates around Y axis)
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wp.x, wp.y, wp.z);
      this.group.add(steerPivot);

      if (wp.isFront) {
        this.frontSteerPivots.push(steerPivot);
      }

      // Wheel spin group (rotates around X axis)
      const wheelSpin = new THREE.Group();
      steerPivot.add(wheelSpin);
      this.wheels.push(wheelSpin);

      // Main tire cylinder (aligned along X axis)
      const tireGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, this.wheelWidth, 20);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireRubber);
      tire.castShadow = true;
      tire.receiveShadow = true;
      wheelSpin.add(tire);

      // Rim hubcap
      const rimGeo = new THREE.CylinderGeometry(this.wheelRadius * 0.62, this.wheelRadius * 0.62, this.wheelWidth + 0.005, 12);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, primaryPaint);
      wheelSpin.add(rim);
      this.paintMaterials.push(rim.material);

      // Center lug nut cap
      const lugGeo = new THREE.CylinderGeometry(this.wheelRadius * 0.22, this.wheelRadius * 0.22, this.wheelWidth + 0.02, 6);
      lugGeo.rotateZ(Math.PI / 2);
      const lug = new THREE.Mesh(lugGeo, darkMetal);
      wheelSpin.add(lug);
    });
  }

  // Live Repaint Function (invoked by color picker swatches)
  setPaintColor(hex) {
    this.primaryColor = hex;
    this.paintMaterials.forEach((mat) => {
      mat.color.setHex(hex);
    });
  }

  // Update animation loop
  update(dt, speed, steerAngle = 0, isBraking = false) {
    // 1. Spin LiDAR dome at ~10 Hz
    if (this.lidarPuck) {
      this.lidarPuck.rotation.y += Math.PI * 2 * 10 * dt;
    }

    // 2. Rotate wheels according to forward velocity
    const wheelRotDelta = (speed * dt) / this.wheelRadius;
    this.wheels.forEach((w) => {
      w.rotation.x += wheelRotDelta;
    });

    // 3. Turn front wheels with steering angle
    this.frontSteerPivots.forEach((sp) => {
      sp.rotation.y = THREE.MathUtils.lerp(sp.rotation.y, steerAngle, 0.2);
    });

    // 4. Suspension pitch dynamics (tilt forward on brake, backward on accel)
    const targetPitch = isBraking ? 0.05 : -Math.min(0.04, speed * 0.015);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, 0.1);
    if (this.chassisBody) {
      this.chassisBody.rotation.x = this.currentPitch;
    }

    // 5. Brake taillights glow
    if (this.taillightMaterial) {
      this.taillightMaterial.emissiveIntensity = isBraking ? 2.5 : 0.6;
      this.taillightMaterial.color.setHex(isBraking ? 0xff2222 : 0x550000);
    }
  }
}
