import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from database import get_db, SessionLocal
from models import Base
import models
import auth
import sys
import os

# Create a test database
import sqlalchemy
TEST_DATABASE_URL = "sqlite:///./test_hindalco.db"
engine = sqlalchemy.create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sqlalchemy.orm.sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# Seed some required test data
def setup_test_db():
    db = TestingSessionLocal()
    if not db.query(models.Doctor).first():
        doc = models.Doctor(name="Dr. Test", specialization="General", degree="MD", availability_schedule="Mon-Sat", is_available=True)
        db.add(doc)
        
        admin = models.User(
            role="admin", 
            name="Admin User", 
            email="admin@test.com", 
            password_hash=auth.get_password_hash("password")
        )
        db.add(admin)
        db.commit()
    db.close()

setup_test_db()

@pytest.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_circulars(client: AsyncClient):
    response = await client.get("/api/circulars")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_auth_login_invalid(client: AsyncClient):
    response = await client.post("/api/auth/login", data={
        "username": "invalid_user",
        "password": "wrong_password"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect username or password"

@pytest.mark.asyncio
async def test_patient_registration_and_login(client: AsyncClient):
    # Register
    res = await client.post("/api/auth/register", json={
        "role": "non-employee",
        "name": "Test Patient",
        "email": "test@patient.com",
        "password": "password123"
    })
    assert res.status_code == 200
    assert res.json()["email"] == "test@patient.com"
    
    # Login
    login_res = await client.post("/api/auth/login", data={
        "username": "test@patient.com",
        "password": "password123"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

@pytest.mark.asyncio
async def test_admin_appointments(client: AsyncClient):
    # Login as admin to get token
    login_res = await client.post("/api/auth/login", data={
        "username": "admin@test.com",
        "password": "password"
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    
    # Test getting appointments
    res = await client.get("/api/admin/appointments", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)
