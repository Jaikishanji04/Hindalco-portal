from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    role: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    staff_id: Optional[str] = None
    title: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    pocket_balance: float

    model_config = ConfigDict(from_attributes=True)

class WalletFundRequest(BaseModel):
    user_id: int
    amount: float

# --- Doctor Schemas ---
class DoctorBase(BaseModel):
    name: str
    specialization: str
    degree: str
    availability_schedule: str
    is_available: bool

class Doctor(DoctorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- Appointment Schemas ---
class AppointmentCreate(BaseModel):
    doctor_id: int
    date: str
    time_slot: str
    shift: str

class Appointment(AppointmentCreate):
    id: int
    user_id: int
    token_number: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)

# --- Circular Schemas ---
class CircularBase(BaseModel):
    title: str
    description: str
    priority: str


class CircularCreate(CircularBase):
    pass

class Circular(CircularBase):
    id: int
    date_posted: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Payment Schemas ---
class PaymentCreate(BaseModel):
    appointment_id: Optional[int] = None
    amount: float
    currency: str = "INR"

class Payment(PaymentCreate):
    id: int
    user_id: int
    payment_status: str
    gateway_order_id: Optional[str] = None
    gateway_transaction_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Lab Report Schemas ---
class LabReportBase(BaseModel):
    test_name: str
    result_value: str
    reference_range: str
    status: str

class LabReport(LabReportBase):
    id: int
    user_id: int
    date: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Prescription Schemas ---
class PrescriptionBase(BaseModel):
    user_id: int
    medication_details: str
    notes: Optional[str] = None

class PrescriptionCreate(PrescriptionBase):
    pass

class Prescription(PrescriptionBase):
    id: int
    doctor_id: int
    date: datetime

    model_config = ConfigDict(from_attributes=True)
