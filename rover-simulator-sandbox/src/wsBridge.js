/**
 * WebSocket Telemetry Bridge
 * Directly matches backend/simulation/simulate_rover.py:
 * Connects to ws://127.0.0.1:8000/ws/vehicle/rover-alpha?mode=model
 * Streams real-time rover telemetry and receives AI closed-loop corrections.
 */
export class WsBridge {
  constructor(vehicleId = 'rover-alpha', mode = 'model') {
    this.vehicleId = vehicleId;
    this.mode = mode;
    this.baseUrl = 'ws://127.0.0.1:8000/ws/vehicle';
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.pendingPingStart = 0;
    this.onStateChangeCallbacks = [];
    this.onCorrectionCallbacks = [];
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  onCorrection(cb) {
    this.onCorrectionCallbacks.push(cb);
  }

  connect() {
    const url = `${this.baseUrl}/${this.vehicleId}?mode=${this.mode}`;
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyState(true);
        console.log(`[WsBridge] Connected to backend vehicle endpoint: ${url}`);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyState(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyState(false);
      };

      this.ws.onmessage = (event) => {
        const tEnd = performance.now();
        const rttMs = this.pendingPingStart > 0 ? (tEnd - this.pendingPingStart) : 0;
        try {
          const resp = JSON.parse(event.data);
          if (rttMs > 0 && !resp.server_latency_ms) {
            resp.server_latency_ms = Math.round(rttMs);
          }
          this.onCorrectionCallbacks.forEach((cb) => cb(resp));
        } catch (e) {
          // ignore parsing error
        }
      };
    } catch (e) {
      this.isConnected = false;
      this.notifyState(false);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  // Sends the exact telemetry payload as simulate_rover.py
  sendTelemetry(x2d, y2d, speed, mode = 'model') {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      this.pendingPingStart = performance.now();
      const payload = {
        vehicle_id: this.vehicleId,
        position: [Math.round(x2d * 1000) / 1000, Math.round(y2d * 1000) / 1000],
        speed: Math.round(speed * 1000) / 1000,
        timestamp: Date.now() / 1000,
        mode: mode
      };
      this.ws.send(JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
  }

  notifyState(status) {
    this.onStateChangeCallbacks.forEach((cb) => cb(status));
  }
}
