/**
 * BIOS Boot Terminal ("Honest Loader")
 * Shows live diagnostic initialization lines before entering the 3D simulation.
 */
export class BiosConsole {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this.terminal = containerEl.querySelector('.bios-terminal');
    this.progressBar = containerEl.querySelector('.bios-progress-bar');
    this.lines = [
      { tag: '[INIT]', tagClass: 'tag', text: 'AGRI-ROVER PHYSICAL KINEMATICS ENGINE v2.5.0' },
      { tag: '[OK]', tagClass: 'tag ok', text: 'OSPINA & NOGUCHI (2025) SERPENTINE ROUTE COMPILED' },
      { tag: '[OK]', tagClass: 'tag ok', text: 'THREE.JS SHADOW MAPS & VOLUMETRIC SPOTLIGHTS READY' },
      { tag: '[OK]', tagClass: 'tag ok', text: 'SYNTHESIZED HARMONIC ELECTRIC MOTOR ARMED' },
      { tag: '[OK]', tagClass: 'tag ok', text: 'DUAL-RTK GNSS ANTENNA SUBSYSTEM: FIX 3D (34.02°N, 118.49°W)' },
      { tag: '[SYNC]', tagClass: 'tag cyan', text: 'WEBSOCKET TELEMETRY BRIDGE: READY ON WS://LOCALHOST:8000' },
      { tag: '[READY]', tagClass: 'tag ok', text: 'SYSTEM ARMED. LAUNCHING 3D DIGITAL TWIN SANDBOX...' }
    ];
  }

  start() {
    if (!this.container) {
      if (this.onComplete) this.onComplete();
      return;
    }

    let lineIdx = 0;
    const totalLines = this.lines.length;

    const interval = setInterval(() => {
      if (lineIdx < totalLines) {
        const item = this.lines[lineIdx];
        const row = document.createElement('div');
        row.className = 'bios-line';
        row.innerHTML = `<span class="${item.tagClass}">${item.tag}</span><span>${item.text}</span>`;
        this.terminal.appendChild(row);
        this.terminal.scrollTop = this.terminal.scrollHeight;

        const pct = Math.round(((lineIdx + 1) / totalLines) * 100);
        if (this.progressBar) {
          this.progressBar.style.width = `${pct}%`;
        }

        lineIdx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          this.container.classList.add('hidden');
          if (this.onComplete) this.onComplete();
        }, 350);
      }
    }, 180);
  }
}
