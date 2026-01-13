import os
import sys
import asyncio
import json
import subprocess
from pyrogram import Client

def clean_arg(arg):
    return arg.strip().strip("'").strip('"')

def send_ui(type, message, progress=0):
    print(json.dumps({"type": type, "message": message, "progress": progress}), flush=True)

def generate_thumb(video, out):
    try:
        subprocess.run(["ffmpeg", "-i", video, "-ss", "00:00:03", "-vframes", "1", out, "-y"], 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except: return False

async def main():
    if len(sys.argv) < 6:
        send_ui("error", "Config missing.")
        return

    ROOT = clean_arg(sys.argv[1])
    API_ID = int(clean_arg(sys.argv[2]))
    API_HASH = clean_arg(sys.argv[3])
    CHAT = clean_arg(sys.argv[4])
    
    # FIX: User input se \n hatana aur clean rakhna
    RAW_CREDIT = clean_arg(sys.argv[5]).replace("\\n", "\n")
    
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    if not os.path.exists("user_session.session"):
        send_ui("error", "⚠️ Session missing. Please login again.")
        return

    try:
        async with Client("user_session", api_id=API_ID, api_hash=API_HASH) as app:
            course_name = os.path.basename(os.path.normpath(ROOT))
            send_ui("info", f"🚀 Analyzing: {course_name}")

            items = sorted(os.listdir(ROOT))
            folders = [d for d in items if os.path.isdir(os.path.join(ROOT, d))]
            videos = [f for f in items if f.lower().endswith(('.mp4', '.mkv', '.mov'))]

            work_plan = []
            if videos: work_plan.append((course_name, ROOT)) 
            for f in folders: work_plan.append((f, os.path.join(ROOT, f)))

            if not work_plan:
                send_ui("error", "No valid video content found!")
                return

            await app.send_message(CHAT, f"🎓 **COURSE: {course_name}**\n━━━━━━━━━━━━━━")
            
            full_index = f"📚 **INDEX: {course_name}**\n\n"
            total_modules = len(work_plan)

            for idx, (mod_name, mod_path) in enumerate(work_plan):
                send_ui("info", f"Processing: {mod_name}")
                await app.send_message(CHAT, f"📂 **{mod_name}**\n➖➖➖➖➖➖➖")
                full_index += f"📂 **{mod_name}**\n"

                mod_files = sorted([f for f in os.listdir(mod_path) if f.lower().endswith(('.mp4', '.mkv'))])
                
                for i, v_file in enumerate(mod_files):
                    v_path = os.path.join(mod_path, v_file)
                    thumb = v_path + ".jpg"
                    
                    prog = int((idx * (100/total_modules)) + ((i+1) * ((100/total_modules)/len(mod_files))))
                    send_ui("progress", f"Uploading: {v_file}", prog)

                    has_thumb = generate_thumb(v_path, thumb)
                    
                    # FIX: Auto-adding newlines for cleaner credit
                    clean_filename = os.path.splitext(v_file)[0]
                    final_caption = f"🎥 **{clean_filename}**\n\n{RAW_CREDIT}"

                    try:
                        await app.send_video(CHAT, v_path, caption=final_caption, 
                                           thumb=thumb if has_thumb else None, supports_streaming=True, width=1280, height=720)
                        full_index += f"   ├─ {clean_filename}\n"
                    except Exception as e:
                        send_ui("error", f"Fail: {v_file}")

                    if os.path.exists(thumb): os.remove(thumb)
                    await asyncio.sleep(2)

                full_index += "\n"

            if len(full_index) > 4000:
                for x in range(0, len(full_index), 4000): await app.send_message(CHAT, full_index[x:x+4000])
            else:
                await app.send_message(CHAT, full_index)
            
            send_ui("success", "✅ All Tasks Finished!")

    except Exception as e:
        send_ui("error", f"Critical Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())