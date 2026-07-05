from database import SessionLocal, engine
import models
from auth import get_password_hash
import datetime

# Recreate the tables
models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # 1. Users (From mock data)
    u1 = models.User(
        role="employee", 
        name="Jaideep Kumar", 
        staff_id="HIND-EMP-4029", 
        password_hash=get_password_hash("password"), 
        title="Grade M-3 Assistant Manager",
        pocket_balance=500.0
    )
    u2 = models.User(
        role="employee", 
        name="Aditya Birla", 
        staff_id="HIND-EMP-1001", 
        password_hash=get_password_hash("password"), 
        title="Managing Director"
    )
    u3 = models.User(
        role="non-employee", 
        name="Suresh Kumar", 
        email="patient@gmail.com", 
        phone="9876543210", 
        password_hash=get_password_hash("password")
    )
    
    db.add_all([u1, u2, u3])
    u4 = models.User(
        role="doctor",
        name="Dr. Ajay Sharma",
        email="doctor@hindalco.com",
        password_hash=get_password_hash("password")
    )
    db.add(u4)

    db.commit()

    # 2. Doctors
    docs = [
        models.Doctor(name="Dr. Ajay Sharma", specialization="General Medicine", degree="MD (Internal Medicine)", availability_schedule="Mon - Sat (09:00 - 13:00)", is_available=True),
        models.Doctor(name="Dr. (Mrs.) R. Singh", specialization="Dermatology", degree="MD, DNB (Dermatology & Skin Laser)", availability_schedule="Mon, Wed, Fri (10:00 - 15:00)", is_available=False),
        models.Doctor(name="Dr. K. N. Pandey", specialization="Surgery", degree="MS (General Surgery)", availability_schedule="Mon - Sat (11:00 - 16:00)", is_available=True),
        models.Doctor(name="Dr. Rajiv Saxena", specialization="Pediatrics", degree="MD (Pediatrics), DCH", availability_schedule="Tue, Thu, Sat (09:00 - 13:00)", is_available=True),
        models.Doctor(name="Dr. Harish Pathak", specialization="Orthopedics", degree="MS (Ortho)", availability_schedule="Daily (02:00 - 05:00)", is_available=False)
    ]
    db.add_all(docs)
    db.commit()

    # 3. Circulars
    circs = [
        models.Circular(title="Mandatory Annual Health Audit", description="Grade M-1 to M-3 employees audit cycle starts from October 1st. Please schedule slots through the OHS portal.", priority="medium"),
        models.Circular(title="Health Scheme Renewal", description="HEHS annual limits have been automatically updated. Carry updated physical smartcards to the pharmacy counter.", priority="low"),
        models.Circular(title="Free Health & Hygiene Camp", description="Hindalco Hospital is conducting a pediatric immunization & hygiene camp this Saturday at the colony club hall.", priority="high")
    ]
    db.add_all(circs)
    db.commit()

    print("Database seeded successfully!")
    db.close()

if __name__ == "__main__":
    seed()
