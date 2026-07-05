import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

def send_email(to_email: str, subject: str, html_body: str, plain_body: str):
    if not SMTP_USER or not SMTP_PASS:
        # Fallback to mock log if not configured
        print("=" * 60)
        print("MOCK EMAIL SERVICE - SMTP NOT CONFIGURED")
        print(f"To: {to_email}\nSubject: {subject}")
        print(plain_body)
        print("=" * 60)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Hindalco Hospital <{SMTP_USER}>"
    msg["To"] = to_email

    part1 = MIMEText(plain_body, "plain")
    part2 = MIMEText(html_body, "html")

    msg.attach(part1)
    msg.attach(part2)

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()
        print(f"Email sent successfully to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

def send_appointment_email(user, appointment, doctor):
    to_email = user.email or user.phone # assuming email for now
    if not to_email or "@" not in to_email:
        to_email = "patient@hindalco.com" # fallback for mock data

    subject = "Appointment Confirmation - HINDALCO HOSPITAL"
    plain_body = f"""
Dear {user.name},

Your appointment has been successfully scheduled.

Details:
Doctor: Dr. {doctor.name}
Department: {doctor.specialization}
Date: {appointment.date}
Time Slot: {appointment.time_slot}
Shift: {appointment.shift}
Token Number: {appointment.token_number}

Please arrive 15 minutes early.

Regards,
Hindalco Hospital Administration
"""
    html_body = f"""
    <html>
      <body>
        <h3>Dear {user.name},</h3>
        <p>Your appointment has been successfully scheduled.</p>
        <h4>Details:</h4>
        <ul>
            <li><b>Doctor:</b> Dr. {doctor.name}</li>
            <li><b>Department:</b> {doctor.specialization}</li>
            <li><b>Date:</b> {appointment.date}</li>
            <li><b>Time Slot:</b> {appointment.time_slot}</li>
            <li><b>Token Number:</b> {appointment.token_number}</li>
        </ul>
        <p>Please arrive 15 minutes early.</p>
        <p>Regards,<br>Hindalco Hospital Administration</p>
      </body>
    </html>
    """
    send_email(to_email, subject, html_body, plain_body)

def send_lab_report_email(user, report):
    to_email = user.email or user.phone
    if not to_email or "@" not in to_email:
        to_email = "patient@hindalco.com"

    subject = "Your Lab Report is Ready"
    plain_body = f"""
Dear {user.name},

Your recent laboratory report is now available on the medical portal.
Test: {report.test_name}
Status: {report.status}

You can download the PDF version of your report from the portal dashboard.

Regards,
Hindalco Pathology Lab
"""
    html_body = f"""
    <html>
      <body>
        <h3>Dear {user.name},</h3>
        <p>Your recent laboratory report is now available on the medical portal.</p>
        <p><b>Test:</b> {report.test_name}<br><b>Status:</b> {report.status}</p>
        <p>You can download the PDF version of your report from the portal dashboard.</p>
        <p>Regards,<br>Hindalco Pathology Lab</p>
      </body>
    </html>
    """
    send_email(to_email, subject, html_body, plain_body)
