# CLAUDE.md — Backend (Fleet Progress Tracker)

Context for Claude Code when working inside `/backend`. This is the server-side half of a larger project; see the frontend's own CLAUDE.md for the dashboard side. Both must agree on the WebSocket contract defined below — if you change it here, update the frontend too.

## What this service does
Receives live telemetry from vehicle clients (simulated agents or an ESP32 rover), maintains a per-vehicle "digital twin" of live state, computes real-time work progress / ETA / schedule drift (`delta_T`), and issues speed + trajectory corrections back to each vehicle. Also broadcasts live state to connected dashboard clients.

## Tech stack (decided)
- Python, FastAPI, WebSockets.
- scikit-learn for the trained correction model (RandomForestRegressor primary, LinearRegression baseline) — loaded once at startup via `joblib.load()`, not retrained per request.
- **No database.** Vehicle state is in-memory only (per-vehicle twin objects), scoped to the lifetime of the connection. Simulation/training data lives in CSV files, not a DB. Do not add MongoDB/Postgres/SQLite unless explicitly asked again.
- **No auth.** No login, no JWT, no session handling on this service.
- **No ROS2.** Vehicles are treated as simple telemetry-in/command-out clients, not full robot middleware nodes.

## File layout (build/extend here)