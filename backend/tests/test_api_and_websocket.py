import pytest
from fastapi.testclient import TestClient
from main import app
from auth import create_access_token, verify_password, get_password_hash
from connection_manager import manager

client = TestClient(app)

def test_auth_hashing_and_jwt():
    raw = "supersecret123"
    hashed = get_password_hash(raw)
    assert verify_password(raw, hashed)
    assert not verify_password("wrongpassword", hashed)

    token = create_access_token(data={"sub": "operator_test", "role": "operator"})
    assert isinstance(token, str)
    assert len(token) > 20

def test_health_and_root_endpoints():
    r1 = client.get("/")
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["service"] == "Real-Time Fleet Progress & ETA Correction System"
    assert data1["status"] == "operational"

    r2 = client.get("/api/health")
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["status"] == "healthy"

def test_auth_registration_and_login():
    username = "test_user_42"
    password = "password123"

    # Register
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "password": password,
        "role": "supervisor"
    })
    assert reg_res.status_code in (200, 400)  # 200 if new, 400 if already exists

    # Login
    login_res = client.post("/api/auth/login", json={
        "username": username,
        "password": password
    })
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

    # Protected me endpoint
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == username

def test_fleet_route_and_status():
    r = client.get("/api/fleet/route")
    assert r.status_code == 200
    data = r.json()
    assert "segments" in data
    assert len(data["segments"]) > 0

    s = client.get("/api/fleet/status")
    assert s.status_code == 200
    s_data = s.json()
    assert "fleet" in s_data
    assert "total_plan_time" in s_data

def test_vehicle_websocket_telemetry_flow():
    with client.websocket_connect("/ws/vehicle/rover_test_01?mode=model") as ws:
        # Send telemetry tick
        telemetry = {
            "vehicle_id": "rover_test_01",
            "position": [0.0, 15.0],
            "speed": 1.2,
            "timestamp": 1700000000.0,
            "mode": "model"
        }
        ws.send_json(telemetry)
        response = ws.receive_json()

        assert response["vehicle_id"] == "rover_test_01"
        assert "target_speed" in response
        assert "steering_adjust" in response
        assert "wheel_speeds" in response
        assert "delta_T" in response
        assert "lookahead_validated" in response
        assert response["target_speed"] > 0
