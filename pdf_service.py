from fpdf import FPDF
import io
import datetime

class HindalcoPDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 15)
        # Move to the right
        self.cell(80)
        # Title
        self.cell(30, 10, "Hindalco Hospital, Renukoot", border=0, align="C")
        # Line break
        self.ln(10)
        self.set_font("helvetica", "I", 10)
        self.cell(0, 10, "Medical Portal - Diagnostic & Clinical Services", border=0, align="C")
        self.ln(15)
        # Draw a horizontal line
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        # Position at 1.5 cm from bottom
        self.set_y(-15)
        # helvetica italic 8
        self.set_font("helvetica", "I", 8)
        # Page number
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")


def generate_lab_report_pdf(report, user):
    pdf = HindalcoPDF()
    pdf.add_page()
    
    # Patient Information
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, "Patient Details:", ln=True)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 6, f"Name: {user.name}", ln=True)
    pdf.cell(0, 6, f"Patient ID: HIND-PAT-{user.id}", ln=True)
    pdf.cell(0, 6, f"Email/Phone: {user.email or user.phone}", ln=True)
    pdf.ln(5)
    
    # Report Meta
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, "Laboratory Report Details:", ln=True)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 6, f"Test Name: {report.test_name}", ln=True)
    pdf.cell(0, 6, f"Date: {report.date.strftime('%d-%b-%Y %H:%M')}", ln=True)
    pdf.cell(0, 6, f"Status: {report.status}", ln=True)
    pdf.ln(5)
    
    # Results Table
    pdf.set_font("helvetica", "B", 10)
    pdf.set_fill_color(220, 220, 220)
    pdf.cell(80, 10, "Parameter", border=1, fill=True)
    pdf.cell(55, 10, "Result Value", border=1, fill=True)
    pdf.cell(55, 10, "Reference Range", border=1, fill=True, ln=True)
    
    pdf.set_font("helvetica", "", 10)
    pdf.cell(80, 10, report.test_name, border=1)
    pdf.cell(55, 10, str(report.result_value), border=1)
    pdf.cell(55, 10, str(report.reference_range), border=1, ln=True)
    
    pdf.ln(20)
    pdf.set_font("helvetica", "I", 9)
    pdf.multi_cell(0, 5, "This is an electronically generated report. Clinical correlation is recommended.")
    
    # Return PDF bytes
    return pdf.output(dest='S')


def generate_prescription_pdf(prescription, user, doctor):
    pdf = HindalcoPDF()
    pdf.add_page()
    
    # Doctor Information
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 8, f"Dr. {doctor.name}", ln=True)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 6, f"{doctor.specialization} | {doctor.degree}", ln=True)
    pdf.ln(10)
    
    # Patient Information
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(0, 6, f"Patient Name: {user.name}     |    Date: {prescription.date.strftime('%d-%b-%Y %H:%M')}", ln=True)
    pdf.line(10, pdf.get_y()+2, 200, pdf.get_y()+2)
    pdf.ln(10)
    
    # Rx Symbol
    pdf.set_font("helvetica", "B", 20)
    pdf.cell(0, 10, "Rx", ln=True)
    pdf.ln(5)
    
    # Medication Details
    pdf.set_font("helvetica", "", 11)
    pdf.multi_cell(0, 6, prescription.medication_details)
    pdf.ln(10)
    
    if prescription.notes:
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(0, 6, "Additional Notes:", ln=True)
        pdf.set_font("helvetica", "", 10)
        pdf.multi_cell(0, 6, prescription.notes)
        
    pdf.ln(30)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 6, "Doctor's Signature", align="R", ln=True)
    
    return pdf.output(dest='S')
