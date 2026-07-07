# Hindalco Hospital Portal

A full-stack hospital management system built with FastAPI, SQLite, and a custom vanilla JavaScript frontend. 

## Features
- **Role-based Access Control**: Different access levels for Employees, Doctors, Admins, and Patients.
- **Appointments Management**: Schedule appointments and manage shifts.
- **Payments Integration**: Integrated with Razorpay for handling OPD fees and wallet recharges.
- **Wallet System**: Internal wallet tracking for employees.
- **Lab Reports & Prescriptions**: View and generate PDF reports for prescriptions and lab results.
- **Email Notifications**: Automated emails for appointments and lab results.

## Tech Stack
- **Backend**: Python 3, FastAPI, SQLAlchemy
- **Database**: SQLite
- **Authentication**: JWT (JSON Web Tokens)
- **Frontend**: HTML5, Vanilla JavaScript, CSS3
- **Payment Gateway**: Razorpay
- **PDF Generation**: ReportLab

## Getting Started

### Prerequisites
- Python 3.9+
- pip (Python package installer)

### Installation

1. **Clone the repository** (if applicable) or navigate to the project directory.

2. **Create a virtual environment (recommended)**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Copy the example environment file and configure your variables (such as the `SECRET_KEY`, SMTP credentials, and Razorpay keys).
   ```bash
   cp .env.example .env
   ```
   *Make sure to update `.env` with secure keys and actual credentials before deploying to production.*

5. **Run the Application**:
   Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://127.0.0.1:8000`. The frontend will be served at the root URL.

## Documentation
Once the server is running, you can access the automatically generated interactive API documentation (Swagger UI) at:
- `http://127.0.0.1:8000/docs`

## Running Tests
To run the test suite, ensure you have `pytest` installed, and execute:
```bash
python -m pytest tests
```
