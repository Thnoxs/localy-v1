import sys
import os
import asyncio
import json
import traceback
from pyrogram import Client
from pyrogram.errors import SessionPasswordNeeded, PhoneCodeInvalid, PhoneNumberInvalid, ApiIdInvalid

# --- COMMUNICATION HELPER ---
def send_to_js(status, message=None, error=False):
    """Safe JSON sender that flushes immediately"""
    try:
        data = json.dumps({"status": status, "message": message, "error": error})
        print(data, flush=True)
    except Exception:
        pass

# Global Exception Handler
def handle_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    error_msg = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    send_to_js("error", f"Script Crash: {str(exc_value)}", True)

sys.excepthook = handle_exception

async def main():
    # 1. Validate Inputs
    if len(sys.argv) < 3:
        send_to_js("error", "Internal Error: Credentials missing.", True)
        return

    try:
        API_ID = int(sys.argv[1].strip())
        API_HASH = sys.argv[2].strip()
    except ValueError:
        send_to_js("error", "API ID must be a number.", True)
        return

    # 2. Setup Session Path
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    if os.path.exists("user_session.session"):
        os.remove("user_session.session")

    # 3. Initialize Client
    send_to_js("loading", "Connecting to Telegram Servers...")
    app = Client("user_session", api_id=API_ID, api_hash=API_HASH, in_memory=False)

    try:
        await app.connect()
    except ApiIdInvalid:
        send_to_js("error", "API ID/Hash is Invalid!", True)
        return
    except Exception as e:
        send_to_js("error", f"Connection Failed: {str(e)}", True)
        return

    # 4. Ask for Phone
    send_to_js("need_phone", "Enter Phone Number (e.g., +91...)")
    
    # Wait for Input from JS
    try:
        phone_number = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        phone_number = phone_number.strip()
    except Exception as e:
        send_to_js("error", "Input Error", True)
        return

    if not phone_number:
        send_to_js("error", "Phone number empty", True)
        return

    # 5. Send OTP
    send_to_js("loading", "Sending OTP...")
    try:
        sent_code = await app.send_code(phone_number)
        phone_code_hash = sent_code.phone_code_hash
    except PhoneNumberInvalid:
        send_to_js("error", "Invalid Phone Number Format!", True)
        return
    except Exception as e:
        send_to_js("error", f"OTP Error: {str(e)}", True)
        return

    # 6. Ask for OTP
    send_to_js("need_otp", f"OTP sent to {phone_number}")
    
    try:
        code = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        code = code.strip()
    except:
        return

    # 7. Login
    send_to_js("loading", "Verifying OTP...")
    try:
        await app.sign_in(phone_number, phone_code_hash, code)
    except PhoneCodeInvalid:
        send_to_js("error", "Incorrect OTP!", True)
        return
    except SessionPasswordNeeded:
        send_to_js("error", "2FA Password Required (Not supported yet)", True)
        return
    except Exception as e:
        send_to_js("error", f"Login Failed: {str(e)}", True)
        return

    # 8. Success
    user = await app.get_me()
    await app.disconnect()
    send_to_js("success", f"Welcome, {user.first_name}!")

if __name__ == "__main__":
    asyncio.run(main())