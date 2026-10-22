import { soundEngine } from './audio.js';

/**
 * HUD Overlay & UI Chrome Manager
 * Controls the retro camcorder HUD, gauges, ETA configuration modal,
 * camera mode pills, color repaint swatches, and sound controls.
 */
export class HudOverlay {
  constructor(physics, route, cameraMgr, rover, onStartMission) {
    this.physics = physics;
    this.route = route;
    this.cameraMgr = cameraMgr;
    this.rover = rover;
    this.onStartMission = onStartMission;

    // Cache DOM Elements
    this.elTimecode = document.getElementById('hud-timecode');
    this.elSpeedVal = document.getElementById('hud-speed-val');
    this.elSpeedBar = document.getElementById('hud-speed-bar');
    this.elEtaTimer = document.getElementById('hud-eta-timer');
    this.elProgressBar = document.getElementById('hud-progress-bar');
    this.elProgressPct = document.getElementById('hud-progress-pct');
    this.elDriftVal = document.getElementById('hud-drift-val');
    this.elModeBadge = document.getElementById('hud-mode-badge');
    this.elCamBadge = document.getElementById('hud-cam-badge');
    this.elWsBadge = document.getElementById('hud-ws-badge');
    this.elStopResumeBtn = document.getElementById('hud-stop-resume-btn');
    this.elMuteBtn = document.getElementById('hud-mute-btn');

    // Modals
    this.landingOverlay = document.getElementById('landing-overlay');
    this.etaModal = document.getElementById('eta-modal');
    this.etaField = document.getElementById('modal-eta-input');
    this.selectedHours = 1.0;

    this.bindEvents();
  }

  bindEvents() {
    // ----------------------------------------------------
    // 1. Landing Screen "Launch Sandbox"
    // ----------------------------------------------------
    const launchBtn = document.getElementById('btn-launch-sandbox');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        soundEngine.ensureContext();
        soundEngine.playClick();
        soundEngine.startMotor();
        this.landingOverlay.classList.add('hidden');
        // If ETA not configured yet, show Mission Setup modal
        if (!this.route.targetHours) {
          this.showEtaModal();
        }
      });
    }

    // ----------------------------------------------------
    // 2. Mission Setup Modal: Presets & Start
    // ----------------------------------------------------
    const presetButtons = document.querySelectorAll('.chip-btn');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        presetButtons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        const hrs = parseFloat(btn.dataset.hours);
        this.selectedHours = hrs;
        if (this.etaField) this.etaField.value = hrs;
      });
    });

    const startMissionBtn = document.getElementById('btn-start-mission');
    if (startMissionBtn) {
      startMissionBtn.addEventListener('click', () => {
        const val = this.etaField ? parseFloat(this.etaField.value) : this.selectedHours;
        const targetHours = isNaN(val) || val <= 0 ? 1.0 : val;

        soundEngine.playMissionStart();
        this.route.setPlannedHours(targetHours);
        this.physics.resume();
        this.etaModal.classList.add('hidden');

        if (this.onStartMission) {
          this.onStartMission(targetHours);
        }
      });
    }

    // ----------------------------------------------------
    // 3. Stop / Resume Rover Button
    // ----------------------------------------------------
    if (this.elStopResumeBtn) {
      this.elStopResumeBtn.addEventListener('click', () => {
        soundEngine.playClick();
        if (this.physics.stopped) {
          this.physics.resume();
        } else {
          this.physics.stop();
        }
        this.updateControlsState();
      });
    }

    // ----------------------------------------------------
    // 4. Toggle Mode Button (Autonomous vs Manual)
    // ----------------------------------------------------
    if (this.elModeBadge) {
      this.elModeBadge.addEventListener('click', () => {
        soundEngine.playClick();
        const nextMode = this.physics.mode === 'autonomous' ? 'manual' : 'autonomous';
        this.physics.setMode(nextMode);
        this.updateControlsState();
      });
    }

    // ----------------------------------------------------
    // 5. Camera Mode Toggle (Key C / Click)
    // ----------------------------------------------------
    if (this.elCamBadge) {
      this.elCamBadge.addEventListener('click', () => {
        soundEngine.playClick();
        const modes = ['CHASE', 'ORBIT', 'FPV', 'TOP_DOWN'];
        const nextIdx = (modes.indexOf(this.cameraMgr.mode) + 1) % modes.length;
        this.cameraMgr.setMode(modes[nextIdx]);
      });
    }

    // ----------------------------------------------------
    // 6. Quack / Horn Button
    // ----------------------------------------------------
    const hornBtn = document.getElementById('hud-horn-btn');
    if (hornBtn) {
      hornBtn.addEventListener('click', () => {
        soundEngine.playQuack();
      });
    }

    // ----------------------------------------------------
    // 7. Sound Mute / Unmute Button
    // ----------------------------------------------------
    if (this.elMuteBtn) {
      this.elMuteBtn.addEventListener('click', () => {
        const muted = soundEngine.toggleMute();
        this.elMuteBtn.textContent = muted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
      });
    }

    // ----------------------------------------------------
    // 8. Color Repaint Swatches (Microduck style)
    // ----------------------------------------------------
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const hex = parseInt(dot.dataset.color, 16);
        colorDots.forEach((d) => d.classList.remove('active'));
        dot.classList.add('active');
        this.rover.setPaintColor(hex);
        soundEngine.playQuack(); // Fun feedback!
      });
    });

    // ----------------------------------------------------
    // 9. Keyboard Shortcuts
    // ----------------------------------------------------
    window.addEventListener('keydown', (e) => {
      // Avoid keyboard interference if typing in an input
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        if (e.key === 'Enter') {
          if (startMissionBtn) startMissionBtn.click();
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'c') {
        soundEngine.playClick();
        this.cameraMgr.toggleChase();
      } else if (key === 'v') {
        soundEngine.playClick();
        this.cameraMgr.setMode(this.cameraMgr.mode === 'FPV' ? 'CHASE' : 'FPV');
      } else if (key === 't') {
        soundEngine.playClick();
        this.cameraMgr.setMode(this.cameraMgr.mode === 'TOP_DOWN' ? 'CHASE' : 'TOP_DOWN');
      } else if (key === 'm') {
        soundEngine.playClick();
        const nextMode = this.physics.mode === 'autonomous' ? 'manual' : 'autonomous';
        this.physics.setMode(nextMode);
        this.updateControlsState();
      } else if (key === 'h') {
        soundEngine.playQuack();
      } else if (key === 'r') {
        soundEngine.playClick();
        this.physics.reset();
        this.showEtaModal();
      } else if (key === ' ') {
        this.physics.keys.brake = true;
      } else if (key === 'w' || e.key === 'ArrowUp') {
        this.physics.keys.forward = true;
      } else if (key === 's' || e.key === 'ArrowDown') {
        this.physics.keys.backward = true;
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        this.physics.keys.left = true;
      } else if (key === 'd' || e.key === 'ArrowRight') {
        this.physics.keys.right = true;
      } else if (e.key === 'Shift') {
        this.physics.keys.boost = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === ' ') this.physics.keys.brake = false;
      if (key === 'w' || e.key === 'ArrowUp') this.physics.keys.forward = false;
      if (key === 's' || e.key === 'ArrowDown') this.physics.keys.backward = false;
      if (key === 'a' || e.key === 'ArrowLeft') this.physics.keys.left = false;
      if (key === 'd' || e.key === 'ArrowRight') this.physics.keys.right = false;
      if (e.key === 'Shift') this.physics.keys.boost = false;
    });

    // Listen to camera manager mode events
    this.cameraMgr.onModeChange((mode) => {
      if (this.elCamBadge) {
        this.elCamBadge.innerHTML = `CAM: <span class="val">${mode} [C]</span>`;
      }
    });
  }

  showEtaModal() {
    if (this.etaModal) {
      this.etaModal.classList.remove('hidden');
      if (this.etaField) {
        this.etaField.focus();
        this.etaField.select();
      }
    }
  }

  updateControlsState() {
    if (this.elStopResumeBtn) {
      this.elStopResumeBtn.textContent = this.physics.stopped ? '▶ RESUME' : '⏹ STOP';
      this.elStopResumeBtn.classList.toggle('cyan', this.physics.stopped);
    }
    if (this.elModeBadge) {
      this.elModeBadge.innerHTML = `MODE: <span class="val">${this.physics.mode.toUpperCase()} [M]</span>`;
    }
  }

  setWsStatus(connected) {
    if (this.elWsBadge) {
      this.elWsBadge.innerHTML = connected
        ? `LINK: <span class="val" style="color: #10b981;">● BACKEND LIVE</span>`
        : `LINK: <span class="val" style="color: #94a3b8;">○ STANDALONE</span>`;
    }
  }

  // Animation frame update
  update() {
    // 1. Timecode (mm:ss:ff)
    if (this.elTimecode) {
      const totalSec = Math.floor(this.physics.timeElapsed);
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      const cs = Math.floor((this.physics.timeElapsed % 1) * 60).toString().padStart(2, '0');
      this.elTimecode.textContent = `${m}:${s}:${cs}`;
    }

    // 2. Speedometer
    if (this.elSpeedVal) {
      this.elSpeedVal.textContent = Math.abs(this.physics.speed).toFixed(2);
    }
    if (this.elSpeedBar) {
      const pct = Math.min(100, (Math.abs(this.physics.speed) / 3.0) * 100);
      this.elSpeedBar.style.width = `${pct}%`;
    }

    // 3. ETA Timer & Route Progress
    if (this.route.targetHours) {
      const totalPlannedSec = this.route.targetHours * 3600;
      const progressRatio = Math.min(1.0, this.physics.distanceCovered / this.route.totalDistance);
      const remainingSec = Math.max(0, totalPlannedSec - this.physics.timeElapsed);

      const remH = Math.floor(remainingSec / 3600);
      const remM = Math.floor((remainingSec % 3600) / 60);
      const remS = Math.floor(remainingSec % 60);

      if (this.elEtaTimer) {
        if (this.physics.isFinished) {
          this.elEtaTimer.innerHTML = `<span style="color: #10b981;">MISSION COMPLETE!</span>`;
        } else {
          this.elEtaTimer.innerHTML = `${remH > 0 ? `${remH}h ` : ''}${remM}m ${remS}s <span>REMAINING</span>`;
        }
      }

      if (this.elProgressBar) {
        this.elProgressBar.style.width = `${progressRatio * 100}%`;
      }
      if (this.elProgressPct) {
        this.elProgressPct.textContent = `${(progressRatio * 100).toFixed(1)}%`;
      }
    } else {
      if (this.elEtaTimer) {
        this.elEtaTimer.innerHTML = `<span style="color: #ffd21e;">AWAITING ETA</span>`;
      }
    }

    // 4. Schedule Drift Delta-T
    if (this.elDriftVal) {
      const dtVal = this.physics.deltaT;
      const sign = dtVal > 0 ? '+' : '';
      this.elDriftVal.textContent = `${sign}${dtVal.toFixed(2)}s`;
      this.elDriftVal.style.color = dtVal > 1.5 ? '#ff334b' : (dtVal < -1.0 ? '#00f0ff' : '#10b981');
    }
  }
}
