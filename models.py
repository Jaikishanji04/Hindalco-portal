from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Enum, Text
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String) # 'employee' or 'non-employee'
    name = Column(String)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String)
    
    # Employee specific fields
    staff_id = Column(String, unique=True, index=True, nullable=True)
    title = Column(String, nullable=True)
    pocket_balance = Column(Float, default=0.0)

    appointments = relationship("Appointment", back_populates="user")
    payments = relationship("Payment", back_populates="user")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    specialization = Column(String)
    degree = Column(String)
    availability_schedule = Column(String)
    is_available = Column(Boolean, default=True)

    appointments = relationship("Appointment", back_populates="doctor")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    date = Column(String) # Stored as YYYY-MM-DD
    time_slot = Column(String)
    shift = Column(String) # 'Morning' or 'Evening'
    token_number = Column(String, nullable=True)
    status = Column(String, default='Pending_Payment') # 'Pending_Payment', 'Scheduled', 'Completed', 'Cancelled'
    
    user = relationship("User", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    payments = relationship("Payment", back_populates="appointment")


class Circular(Base):
    __tablename__ = "circulars"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    date_posted = Column(DateTime, default=datetime.datetime.utcnow)
    priority = Column(String) # 'low', 'medium', 'high'


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    amount = Column(Float)
    currency = Column(String, default='INR')
    payment_status = Column(String, default='Pending') # 'Pending', 'Completed', 'Failed', 'Refunded'
    gateway_order_id = Column(String, nullable=True)
    gateway_transaction_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="payments")
    appointment = relationship("Appointment", back_populates="payments")


class LabReport(Base):
    __tablename__ = "lab_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    test_name = Column(String)
    result_value = Column(String)
    reference_range = Column(String)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Pending") # 'Pending', 'Completed'
    
    user = relationship("User")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    date = Column(DateTime, default=datetime.datetime.utcnow)
    medication_details = Column(Text)
    notes = Column(Text, nullable=True)

    user = relationship("User")
    doctor = relationship("Doctor")
