import pytest
from fastapi.testclient import TestClient

def test_circulars(client: TestClient):
    response = client.get("/api/circulars")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_auth_login_invalid(client: TestClient):
    response = client.post("/api/auth/login", data={
        "username": "invalid_user",
        "password": "wrong_password"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"

def test_patient_registration_and_login(client: TestClient):
    # Register
    res = client.post("/api/auth/register", json={
        "role": "non-employee",
        "name": "Test Patient",
        "email": "test@patient.com",
        "password": "password123"
    })
    assert res.status_code == 200
    assert res.json()["email"] == "test@patient.com"
    
    # Login
    login_res = client.post("/api/auth/login", data={
        "username": "test@patient.com",
        "password": "password123"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

def test_admin_appointments(client: TestClient):
    # Login as admin to get token
    login_res = client.post("/api/auth/login", data={
        "username": "admin@test.com",
        "password": "password"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    
    # Test getting appointments
    res = client.get("/api/admin/appointments", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_admin_create_doctor(client: TestClient):
    # Login as admin
    login_res = client.post("/api/auth/login", data={
        "username": "admin@test.com",
        "password": "password"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    token = login_res.json()["access_token"]
    
    res = client.post("/api/admin/doctors", json={
        "name": "Dr. Strange",
        "specialization": "Neurology",
        "degree": "MD",
        "availability_schedule": "Mon-Fri",
        "is_available": True
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["name"] == "Dr. Strange"

def test_admin_fund_wallet(client: TestClient):
    # Create employee to fund
    res_emp = client.post("/api/auth/register", json={
        "role": "employee",
        "name": "Test Employee",
        "staff_id": "EMP-9999",
        "password": "password123"
    })
    assert res_emp.status_code == 200
    user_id = res_emp.json()["id"]

    # Login as admin
    login_res = client.post("/api/auth/login", data={
        "username": "admin@test.com",
        "password": "password"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    token = login_res.json()["access_token"]
    
    # Fund wallet
    res = client.post("/api/admin/wallet/fund", json={
        "user_id": user_id,
        "amount": 500.0
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["new_balance"] == 500.0
