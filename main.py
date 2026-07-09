from fastapi import FastAPI, Depends, HTTPException, status, Response, BackgroundTasks
import pdf_service
import email_service
import payment_service
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import timedelta
import os
import uuid

import models
import schemas
import auth
from database import get_db, engine

app = FastAPI(title="Hindalco Hospital API")

from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}", "traceback": traceback.format_exc()}
    )

# Ensure database tables exist (crucial for Render deployment)
models.Base.metadata.create_all(bind=engine)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files to serve the frontend
# We will do this at the end so it doesn't override API routes.

# --- Auth Routes ---
@app.get("/api/seed_doctors")
def seed_doctors_from_apex(db: Session = Depends(get_db)):
    # Doctors extracted from Oracle APEX screenshot
    apex_doctors = [
        models.Doctor(name="SHOBHIT SRIVASTAVA", specialization="ENT", degree="MS", availability_schedule="Mon-Sat", is_available=True),
        models.Doctor(name="SWATI .", specialization="General Medicine", degree="MD", availability_schedule="Mon-Sat", is_available=True),
        models.Doctor(name="NEELAM TRIPATHI", specialization="General Medicine", degree="MD", availability_schedule="Mon-Sat", is_available=False),
        models.Doctor(name="AMIYA NATH PANDEY", specialization="General Medicine", degree="MD", availability_schedule="Mon-Sat", is_available=True)
    ]
    
    # Check if already seeded to avoid duplicates
    existing = db.query(models.Doctor).count()
    if existing < len(apex_doctors):
        # Insert them
        db.add_all(apex_doctors)
        db.commit()
        return {"status": "success", "message": f"Successfully added {len(apex_doctors)} doctors from APEX portal to the database!"}
    
    return {"status": "info", "message": "Doctors were already added previously."}

@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role == 'doctor':
        raise HTTPException(status_code=400, detail="Doctor accounts must be created by administration")
        
    if user.email:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
    if user.phone:
        db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Phone already registered")
    if user.staff_id:
        db_user = db.query(models.User).filter(models.User.staff_id == user.staff_id).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Staff ID already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        role=user.role,
        name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hashed_password,
        staff_id=user.staff_id,
        title=user.title
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Username can be email, phone, or staff_id
    user = db.query(models.User).filter(
        (models.User.email == form_data.username) | 
        (models.User.staff_id == form_data.username) |
        (models.User.phone == form_data.username)
    ).first()
    
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(form_data.username)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# --- Data Routes ---
@app.get("/api/doctors", response_model=list[schemas.Doctor])
def get_doctors(db: Session = Depends(get_db)):
    return db.query(models.Doctor).all()

@app.get("/api/circulars", response_model=list[schemas.Circular])
def get_circulars(db: Session = Depends(get_db)):
    return db.query(models.Circular).order_by(models.Circular.date_posted.desc()).all()

# --- Appointment Routes ---
@app.get("/api/appointments", response_model=list[schemas.Appointment])
def get_appointments(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Appointment).filter(models.Appointment.user_id == current_user.id).all()

@app.post("/api/appointments", response_model=dict)
def create_appointment(app_req: schemas.AppointmentCreate, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    appointment = models.Appointment(
        user_id=current_user.id,
        doctor_id=app_req.doctor_id,
        date=app_req.date,
        time_slot=app_req.time_slot,
        shift=app_req.shift,
        status="Scheduled" if current_user.role == "employee" else "Pending_Payment"
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    
    if current_user.role == "employee":
        if current_user.pocket_balance < 200.0:
            db.delete(appointment)
            db.commit()
            raise HTTPException(status_code=400, detail="Insufficient wallet balance. Please contact HR to add funds.")
            
        current_user.pocket_balance -= 200.0
        appointment.token_number = f"EMP-{appointment.id}"
        
        # Create payment record for employee wallet deduction
        payment = models.Payment(
            user_id=current_user.id,
            appointment_id=appointment.id,
            amount=200.0,
            currency="INR",
            payment_status="Completed"
        )
        db.add(payment)
        db.commit()
        
        doctor = db.query(models.Doctor).filter(models.Doctor.id == appointment.doctor_id).first()
        if doctor:
            background_tasks.add_task(email_service.send_appointment_email, current_user, appointment, doctor)
            
        return {"status": "success", "appointment": schemas.Appointment.model_validate(appointment).model_dump()}
    else:
        # Non-employee: Create a Cashfree Payment Order
        payment = models.Payment(
            user_id=current_user.id,
            appointment_id=appointment.id,
            amount=500.0, # Fixed OPD fee for non-employees
            currency="INR"
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        
        razorpay_order = payment_service.create_order(amount=payment.amount, currency=payment.currency, receipt=f"ORDER_{payment.id}")
        
        return {
            "status": "payment_required", 
            "appointment": schemas.Appointment.model_validate(appointment).model_dump(),
            "payment_details": {
                "order_id": f"ORDER_{payment.id}",
                "razorpay_order_id": razorpay_order.get("id"),
                "razorpay_key_id": payment_service.RAZORPAY_KEY_ID,
                "amount": payment.amount,
                "currency": payment.currency
            }
        }

@app.post("/api/payments/verify")
def verify_payment(order_id: str, razorpay_payment_id: str, razorpay_order_id: str, razorpay_signature: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    is_valid = payment_service.verify_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    payment_id = int(order_id.split("_")[1])
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if payment:
        payment.payment_status = "Completed"
        payment.gateway_transaction_id = razorpay_payment_id
        db.commit()
        
        if payment.appointment_id:
            appointment = db.query(models.Appointment).filter(models.Appointment.id == payment.appointment_id).first()
            if appointment:
                appointment.status = "Scheduled"
                appointment.token_number = f"PAT-{appointment.id}"
                db.commit()
                
                user = db.query(models.User).filter(models.User.id == appointment.user_id).first()
                doctor = db.query(models.Doctor).filter(models.Doctor.id == appointment.doctor_id).first()
                if user and doctor:
                    background_tasks.add_task(email_service.send_appointment_email, user, appointment, doctor)
                
        return {"status": "success"}
    return {"status": "failed"}



# --- Lab Reports Routes ---
@app.get("/api/lab_reports", response_model=list[schemas.LabReport])
def get_lab_reports(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.LabReport).filter(models.LabReport.user_id == current_user.id).all()

# --- Admin / Doctor Routes ---
@app.post("/api/admin/doctors", response_model=schemas.Doctor)
def create_doctor(doc: schemas.DoctorBase, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    new_doc = models.Doctor(
        name=doc.name,
        specialization=doc.specialization,
        degree=doc.degree,
        availability_schedule=doc.availability_schedule,
        is_available=doc.is_available
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc

@app.post("/api/admin/wallet/fund", response_model=dict)
def fund_wallet(req: schemas.WalletFundRequest, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    target_user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    target_user.pocket_balance += req.amount
    db.commit()
    return {"status": "success", "new_balance": target_user.pocket_balance}

@app.get("/api/admin/appointments", response_model=list[schemas.Appointment])
def get_all_appointments(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ['doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(models.Appointment).all()

@app.put("/api/admin/appointments/{appointment_id}")
def update_appointment_status(appointment_id: int, status: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ['doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    appointment.status = status
    db.commit()
    return {"status": "success"}

@app.post("/api/admin/lab_reports", response_model=schemas.LabReport)
def create_lab_report(report_req: schemas.LabReportBase, user_id: int, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ['doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    report = models.LabReport(
        user_id=user_id,
        test_name=report_req.test_name,
        result_value=report_req.result_value,
        reference_range=report_req.reference_range,
        status=report_req.status
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        background_tasks.add_task(email_service.send_lab_report_email, user, report)
        
    return report


# --- Wallet Routes ---
@app.get("/api/wallet/balance", response_model=dict)
def get_wallet_balance(current_user: models.User = Depends(auth.get_current_user)):
    return {"balance": current_user.pocket_balance}

# --- Prescription Routes ---
@app.get("/api/prescriptions", response_model=list[schemas.Prescription])
def get_my_prescriptions(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Prescription).filter(models.Prescription.user_id == current_user.id).all()

@app.post("/api/admin/prescriptions", response_model=schemas.Prescription)
def create_prescription(presc: schemas.PrescriptionCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ['doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    doctor = db.query(models.Doctor).filter(models.Doctor.name == current_user.name).first()
    doc_id = doctor.id if doctor else 1
    
    prescription = models.Prescription(
        user_id=presc.user_id,
        doctor_id=doc_id,
        medication_details=presc.medication_details,
        notes=presc.notes
    )
    db.add(prescription)
    db.commit()
    db.refresh(prescription)
    return prescription

@app.post("/api/admin/circulars", response_model=schemas.Circular)
def create_circular(circ: schemas.CircularCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ['doctor', 'admin', 'employee']:
        # Let employees post circulars for testing, or restrict to admin
        raise HTTPException(status_code=403, detail="Not authorized")
        
    new_circ = models.Circular(
        title=circ.title,
        description=circ.description,
        priority=circ.priority
    )
    db.add(new_circ)
    db.commit()
    db.refresh(new_circ)
    return new_circ


@app.get("/api/lab_reports/{report_id}/pdf")
def get_lab_report_pdf(report_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    report = db.query(models.LabReport).filter(models.LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user.role not in ['doctor', 'admin'] and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = db.query(models.User).filter(models.User.id == report.user_id).first()
    pdf_bytes = pdf_service.generate_lab_report_pdf(report, user)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=LabReport_{report_id}.pdf"})

@app.get("/api/prescriptions/{presc_id}/pdf")
def get_prescription_pdf(presc_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    presc = db.query(models.Prescription).filter(models.Prescription.id == presc_id).first()
    if not presc:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if current_user.role not in ['doctor', 'admin'] and presc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = db.query(models.User).filter(models.User.id == presc.user_id).first()
    doctor = db.query(models.Doctor).filter(models.Doctor.id == presc.doctor_id).first()
    pdf_bytes = pdf_service.generate_prescription_pdf(presc, user, doctor)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=Prescription_{presc_id}.pdf"})


# Mount static folder
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
