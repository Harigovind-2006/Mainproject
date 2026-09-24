# 🌾 AgriTrack

### AI-Powered Autonomous Vehicle Tracking and Trajectory Correction System

AgriTrack is an intelligent monitoring and control platform designed for autonomous agricultural vehicles performing repetitive path-following tasks such as field traversal.

The system continuously monitors vehicle telemetry, detects deviations from the planned schedule, and uses an AI model to recommend speed corrections that help the vehicle stay on schedule despite real-world variations.

---

## 🚀 Features

- **Real-Time Fleet Monitoring**
  - Monitor multiple autonomous agricultural vehicles.
  - Track speed, GPS position, battery, heading, and vehicle status.

- **AI-Based Speed Correction**
  - Detect whether a vehicle is ahead or behind schedule.
  - Predict an appropriate target speed.
  - Dynamically correct vehicle speed.

- **Schedule Drift Detection**
  - Compare expected progress with actual progress.
  - Calculate schedule drift in real time.

- **Digital Twin Simulation**
  - Maintain a virtual representation of the physical vehicle.
  - Simulate vehicle movement and trajectory.
  - Test trajectory correction strategies.

- **Live Vehicle Tracking**
  - Real-time GPS tracking.
  - WebSocket-based telemetry updates.

- **JWT Authentication**
  - Secure user registration and login.
  - Protected API endpoints and dashboard.

- **Analytics Dashboard**
  - Vehicle performance.
  - Speed history.
  - ETA prediction.
  - Route progress.
  - AI correction metrics.

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │   AgriTrack Frontend │
                         │ Next.js + TypeScript  │
                         └───────────┬──────────┘
                                     │
                           REST API / WebSocket
                                     │
                                     ▼
                         ┌──────────────────────┐
                         │    FastAPI Backend   │
                         ├──────────────────────┤
                         │ JWT Authentication   │
                         │ Fleet Telemetry      │
                         │ Digital Twin         │
                         │ Trajectory Engine    │
                         │ AI Speed Correction  │
                         └───────────┬──────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
             ┌──────────────┐                  ┌──────────────┐
             │   MongoDB    │                  │   AI Model   │
             │              │                  │              │
             │ Users        │                  │ ETA          │
             │ Vehicles     │                  │ Speed        │
             │ Telemetry    │                  │ Correction   │
             │ Trajectories │                  │ Prediction   │
             └──────────────┘                  └──────────────┘
