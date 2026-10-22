import * as THREE from 'three';

/**
 * 3D Agricultural Field Arena & Interactive Props
 * Features procedural soil furrows, crop rows, boundary fences,
 * glowing serpentine route ribbon, and an interactive physics ball (Microduck style!).
 */
export class FieldEnvironment {
  constructor(scene, routeManager) {
    this.scene = scene;
    this.route = routeManager;
    this.width = 64;
    this.length = 74;

    this.ball = null;
    this.ballVelocity = new THREE.Vector3(0, 0, 0);
    this.ballRadius = 0.5;

    this.dustParticles = null;
    this.dustGeom = null;

    this.initEnvironment();
    this.initInteractiveBall();
    this.initRouteVisualizer();
    this.initDustSystem();
  }

  initEnvironment() {
    // ----------------------------------------------------
    // 1. Procedural Soil Ground Texture
    // ----------------------------------------------------
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base soil brown
    ctx.fillStyle = '#1c1611';
    ctx.fillRect(0, 0, 512, 512);

    // Darker furrow stripes along Z
    ctx.fillStyle = '#140f0c';
    for (let x = 0; x < 512; x += 16) {
      ctx.fillRect(x, 0, 8, 512);
    }

    // Dirt noise speckles
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#271f18' : '#0e0b08';
      ctx.fillRect(rx, ry, 2, 2);
    }

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(16, 18);

    const groundGeo = new THREE.PlaneGeometry(this.width, this.length);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ----------------------------------------------------
    // 2. Agricultural Crop Rows (Lanes between path)
    // ----------------------------------------------------
    const cropMat = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8
    });
    const stalkGeo = new THREE.ConeGeometry(0.22, 0.5, 5);

    // Place stylized crop mounds along lanes
    const startX = -((this.route.numLanes - 1) * this.route.laneSpacing) / 2.0;
    const zStart = -this.route.laneLength / 2.0;

    for (let lane = 0; lane < this.route.numLanes; lane++) {
      const x = startX + lane * this.route.laneSpacing;
      // Flank each lane on both sides with crops
      [-1.4, 1.4].forEach((offset) => {
        for (let z = zStart + 2; z <= zStart + this.route.laneLength - 2; z += 1.8) {
          const crop = new THREE.Mesh(stalkGeo, cropMat);
          crop.position.set(x + offset, 0.25, z);
          crop.scale.set(1, 0.8 + Math.random() * 0.4, 1);
          crop.castShadow = true;
          this.scene.add(crop);
        }
      });
    }

    // ----------------------------------------------------
    // 3. Perimeter Boundary Fences
    // ----------------------------------------------------
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);

    const halfW = this.width / 2;
    const halfL = this.length / 2;

    // Boundary posts
    for (let x = -halfW; x <= halfW; x += 4) {
      [-halfL, halfL].forEach((z) => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.6, z);
        post.castShadow = true;
        this.scene.add(post);
      });
    }
    for (let z = -halfL; z <= halfL; z += 4) {
      [-halfW, halfW].forEach((x) => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.6, z);
        post.castShadow = true;
        this.scene.add(post);
      });
    }

    // Boundary Rail Cables
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
    const railXGeo = new THREE.CylinderGeometry(0.015, 0.015, this.width, 8);
    railXGeo.rotateZ(Math.PI / 2);

    [-halfL, halfL].forEach((z) => {
      [0.4, 0.8].forEach((y) => {
        const rail = new THREE.Mesh(railXGeo, railMat);
        rail.position.set(0, y, z);
        this.scene.add(rail);
      });
    });

    const railZGeo = new THREE.CylinderGeometry(0.015, 0.015, this.length, 8);
    railZGeo.rotateX(Math.PI / 2);

    [-halfW, halfW].forEach((x) => {
      [0.4, 0.8].forEach((y) => {
        const rail = new THREE.Mesh(railZGeo, railMat);
        rail.position.set(x, y, 0);
        this.scene.add(rail);
      });
    });
  }

  // Glowing 3D Serpentine Path Ribbon
  initRouteVisualizer() {
    const points = this.route.generatePathPoints(3);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Glowing cyan line material
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3
    });
    const line = new THREE.Line(geometry, lineMat);
    this.scene.add(line);

    // Waypoint Markers at Start & Headland Turns
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xffd21e });
    const flagGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);

    this.route.segments.forEach((seg) => {
      const pose = this.route.getPoseAtDistance(seg.startS);
      if (pose && pose.position) {
        const marker = new THREE.Mesh(flagGeo, flagMat);
        marker.position.copy(pose.position).setY(0.03);
        this.scene.add(marker);
      }
    });
  }

  // Interactive Physics Soccer Ball (Microduck Sandbox feature)
  initInteractiveBall() {
    const ballCanvas = document.createElement('canvas');
    ballCanvas.width = 256;
    ballCanvas.height = 128;
    const bctx = ballCanvas.getContext('2d');
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, 256, 128);
    bctx.fillStyle = '#111111';
    for (let y = 0; y < 128; y += 32) {
      for (let x = (y % 64 === 0 ? 0 : 32); x < 256; x += 64) {
        bctx.fillRect(x, y, 32, 32);
      }
    }
    const ballTex = new THREE.CanvasTexture(ballCanvas);

    const ballGeo = new THREE.SphereGeometry(this.ballRadius, 20, 20);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.35,
      metalness: 0.1
    });

    this.ball = new THREE.Mesh(ballGeo, ballMat);
    this.ball.position.set(0, this.ballRadius, -5.0);
    this.ball.castShadow = true;
    this.scene.add(this.ball);
  }

  // Wheel dirt particle effects
  initDustSystem() {
    const count = 120;
    const positions = new Float32Array(count * 3);
    this.dustLifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -100; // initially hidden
      positions[i * 3 + 2] = 0;
      this.dustLifetimes[i] = 0;
    }

    this.dustGeom = new THREE.BufferGeometry();
    this.dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0x8d6e63,
      size: 0.25,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(this.dustGeom, dustMat);
    this.scene.add(this.dustParticles);
    this.dustIndex = 0;
  }

  // Emit dust puff from rover wheels
  emitDust(pos, count = 2) {
    if (!this.dustGeom) return;
    const posAttr = this.dustGeom.attributes.position;
    const arr = posAttr.array;
    const total = arr.length / 3;

    for (let k = 0; k < count; k++) {
      const idx = this.dustIndex;
      arr[idx * 3 + 0] = pos.x + (Math.random() - 0.5) * 0.4;
      arr[idx * 3 + 1] = 0.05 + Math.random() * 0.1;
      arr[idx * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;
      this.dustLifetimes[idx] = 0.6; // lifetime in seconds
      this.dustIndex = (this.dustIndex + 1) % total;
    }
    posAttr.needsUpdate = true;
  }

  update(dt, roverPos, roverRadius = 0.65, onBallBump = null) {
    // ----------------------------------------------------
    // 1. Update Physics Ball (Roll, friction, bounce)
    // ----------------------------------------------------
    if (this.ball) {
      // Apply linear velocity
      this.ball.position.addScaledVector(this.ballVelocity, dt);

      // Rotate ball along rolling direction
      const rollSpeed = this.ballVelocity.length();
      if (rollSpeed > 0.01) {
        const axis = new THREE.Vector3(-this.ballVelocity.z, 0, this.ballVelocity.x).normalize();
        this.ball.rotateOnWorldAxis(axis, (rollSpeed * dt) / this.ballRadius);
      }

      // Ground friction damping
      this.ballVelocity.multiplyScalar(Math.pow(0.85, dt * 60));

      // Arena boundary bounce
      const maxBX = this.width / 2 - this.ballRadius - 0.5;
      const maxBZ = this.length / 2 - this.ballRadius - 0.5;

      if (Math.abs(this.ball.position.x) > maxBX) {
        this.ball.position.x = Math.sign(this.ball.position.x) * maxBX;
        this.ballVelocity.x *= -0.7;
      }
      if (Math.abs(this.ball.position.z) > maxBZ) {
        this.ball.position.z = Math.sign(this.ball.position.z) * maxBZ;
        this.ballVelocity.z *= -0.7;
      }

      // Rover <-> Ball Collision Check
      const toBall = new THREE.Vector3().subVectors(this.ball.position, roverPos);
      toBall.y = 0;
      const dist = toBall.length();
      const minDist = roverRadius + this.ballRadius;

      if (dist < minDist && dist > 0.001) {
        // Separate
        const normal = toBall.clone().normalize();
        this.ball.position.copy(roverPos).addScaledVector(normal, minDist);

        // Push impulse
        const impulse = 3.5;
        this.ballVelocity.addScaledVector(normal, impulse);
        if (onBallBump) onBallBump();
      }
    }

    // ----------------------------------------------------
    // 2. Update Dust Particles
    // ----------------------------------------------------
    if (this.dustGeom) {
      const posAttr = this.dustGeom.attributes.position;
      const arr = posAttr.array;
      const total = arr.length / 3;

      for (let i = 0; i < total; i++) {
        if (this.dustLifetimes[i] > 0) {
          this.dustLifetimes[i] -= dt;
          arr[i * 3 + 1] += dt * 0.4; // rise slightly
          if (this.dustLifetimes[i] <= 0) {
            arr[i * 3 + 1] = -100; // hide
          }
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}
