/**
 * WebSocket Telemetry Bridge
 * Synchronizes 3D simulation telemetry with the FastAPI backend at ws://localhost:8000
 * Falls back seamlessly to offline standalone mode if the backend is not running.
 */
export class WsBridge {
  constructor(url = 'ws://localhost:8000/ws/dashboard') {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.onStateChangeCallbacks = [];
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notify(true);
        console.log('[WsBridge] Connected to FastAPI backend at', this.url);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notify(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notify(false);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle backend broadcasts
          if (data.type === 'PONG') {
            // Heartbeat
          }
        } catch (e) {
          // ignore parse errors
        }
      };
    } catch (e) {
      this.isConnected = false;
      this.notify(false);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  sendTelemetry(vehicleId, x, z, speed, heading, deltaT) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      this.ws.send(JSON.stringify({
        type: 'TELEMETRY_UPDATE',
        vehicle_id: vehicleId,
        x: x,
        y: z,
        speed: speed,
        heading: heading,
        delta_T: deltaT,
        timestamp: Date.now() / 1000
      }));
    } catch (e) {
      // ignore send error
    }
  }

  notify(status) {
    this.onStateChangeCallbacks.forEach((cb) => cb(status));
  }
}
