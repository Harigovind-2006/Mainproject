import logging
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from config import settings
from db.mongo_client import connect_db, close_db, get_db, is_connected_to_atlas
from auth import (
    UserCreate, UserLogin, Token, UserResponse,
    get_password_hash, authenticate_user, create_access_token,
    get_current_user, verify_ws_token, verify_vehicle_secret
)
from connection_manager import manager
from route_model import default_route
from speed_correction import speed_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Real-Time Fleet Progress Backend...")
    await connect_db()
    
    # Ensure a default admin account exists for the dashboard
    db = get_db()
    existing_admin = await db["users"].find_one({"username": "admin"})
    if not existing_admin:
        await db["users"].insert_one({
            "username": "admin",
            "password_hash": get_password_hash("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info("Default operator account created: username='admin', password='admin123'")

    yield
    # Shutdown
    logger.info("Shutting down backend...")
    await close_db()

app = FastAPI(
    title="Real-Time Fleet Progress & ETA Correction API",
    version="1.0.0",
    description="Backend service for autonomous agent progress estimation, adaptive speed, and trajectory correction.",
    lifespan=lifespan
)

# CORS middleware for React / Vite dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Health & System Endpoints ====================

@app.get("/")
async def root():
    return {
        "service": "Real-Time Fleet Progress & ETA Correction System",
        "status": "operational",
        "atlas_connected": is_connected_to_atlas(),
        "model_loaded": speed_engine.model is not None,
        "active_vehicles": len(manager.vehicle_connections),
        "active_dashboards": len(manager.dashboard_connections)
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "atlas" if is_connected_to_atlas() else "in-memory-fallback",
        "rf_model": "loaded" if speed_engine.model else "fallback-fixed-step"
    }

# ==================== Authentication Endpoints ====================

@app.post("/api/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    db = get_db()
    existing = await db["users"].find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")

    now = datetime.now(timezone.utc)
    new_user = {
        "username": user_data.username,
        "password_hash": get_password_hash(user_data.password),
        "role": user_data.role,
        "created_at": now
    }
    await db["users"].insert_one(new_user)
    return UserResponse(username=user_data.username, role=user_data.role, created_at=now)

@app.post("/api/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await authenticate_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": user["username"], "role": user.get("role", "operator")})
    return Token(
        access_token=token,
        token_type="bearer",
        username=user["username"],
        role=user.get("role", "operator")
    )

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return UserResponse(
        username=current_user["username"],
        role=current_user.get("role", "operator"),
        created_at=current_user.get("created_at", datetime.now(timezone.utc))
    )

# ==================== Fleet & Route Endpoints ====================

@app.get("/api/fleet/route")
async def get_route():
    return default_route.to_dict()

@app.get("/api/fleet/status")
async def get_fleet_status():
    return {
        "fleet": [twin.to_dict() for twin in manager.twins.values()],
        "active_connections": len(manager.vehicle_connections),
        "total_plan_time": default_route.total_plan_time,
        "total_distance": default_route.total_distance
    }

@app.post("/api/fleet/reset")
async def reset_fleet():
    manager.twins.clear()
    return {"message": "Fleet state reset successfully"}

@app.get("/api/benchmark/metrics")
async def get_metrics():
    return manager.get_benchmark_metrics()

# ==================== WebSocket Endpoints ====================

@app.websocket("/ws/vehicle/{vehicle_id}")
async def websocket_vehicle_endpoint(
    websocket: WebSocket,
    vehicle_id: str,
    secret: Optional[str] = Query(None),
    mode: str = Query("model")
):
    # Device-secret authentication: if configured in production, verify secret
    if settings.ENVIRONMENT == "production":
        if not verify_vehicle_secret(secret):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect_vehicle(vehicle_id, websocket)
    try:
        while True:
            raw_data = await websocket.receive_json()
            # Execute closed loop per-tick pipeline
            correction_response = await manager.handle_vehicle_telemetry(
                vehicle_id=vehicle_id,
                data=raw_data,
                mode=raw_data.get("mode", mode)
            )
            # Send immediate feedback back to vehicle
            await websocket.send_json(correction_response)
    except WebSocketDisconnect:
        manager.disconnect_vehicle(vehicle_id)
    except Exception as e:
        logger.error(f"Error handling vehicle {vehicle_id}: {e}")
        manager.disconnect_vehicle(vehicle_id)

@app.websocket("/ws/dashboard")
async def websocket_dashboard_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    # JWT authentication for dashboard
    if settings.ENVIRONMENT == "production":
        username = verify_ws_token(token)
        if not username:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect_dashboard(websocket)
    try:
        while True:
            # Dashboards can send control events (e.g. reset, route change)
            msg = await websocket.receive_json()
            action = msg.get("action")
            if action == "RESET_FLEET":
                manager.twins.clear()
                await manager.broadcast_fleet_status()
            elif action == "PING":
                await websocket.send_json({"type": "PONG", "timestamp": msg.get("timestamp")})
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)
    except Exception as e:
        logger.error(f"Dashboard websocket error: {e}")
        manager.disconnect_dashboard(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
