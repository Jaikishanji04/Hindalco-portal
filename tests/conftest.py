import pytest
from fastapi.testclient import TestClient
import sqlalchemy
from sqlalchemy.orm import sessionmaker

from main import app
from database import get_db
from models import Base
import models
import auth
import os

TEST_DATABASE_URL = "sqlite:///./test_hindalco.db"
engine = sqlalchemy.create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed required data
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
    
    yield
    
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_hindalco.db"):
        try:
            os.remove("./test_hindalco.db")
        except PermissionError:
            pass # Windows file lock issue

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
