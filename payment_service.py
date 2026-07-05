import os
import razorpay
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def create_order(amount: float, currency: str, receipt: str) -> dict:
    if not client:
        # Fallback to mock behavior if no keys
        return {"id": f"mock_order_{receipt}", "amount": int(amount * 100), "currency": currency}
    
    data = {
        "amount": int(amount * 100), # Razorpay accepts amount in paise
        "currency": currency,
        "receipt": receipt
    }
    return client.order.create(data=data)

def verify_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    if not client:
        # Mock verification
        return True
    
    try:
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        client.utility.verify_payment_signature(params_dict)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
