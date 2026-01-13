# Localy v1 

**Localy** is a professional, high-speed course automation tool for VS Code. It allows you to upload entire course directories from your local machine to Telegram channels with organized modules, automatic thumbnails, and a clean index post—all without leaving your editor.

---

## ✨ Features

-   **Native Sidebar Integration:** Access everything from the VS Code Activity Bar.
-   **Terminal-Less Login:** Securely connect your Telegram account directly via the extension UI.
-   **Smart Course Detection:** Automatically identifies modules (folders) and individual videos.
-   **Professional Indexing:** Generates a complete course roadmap at the end of the upload.
-   **Cinematic Video Preview:** Forces landscape mode with auto-generated thumbnails.
-   **Custom Branding:** Add your own credits/tags below every video.

---

## 📸 Preview

![Localy Dashboard](https://raw.githubusercontent.com/thnoxs/localy/main/media/preview.jpg)
*(Note: Replace this URL with your actual hosted image link after pushing to GitHub)*

---

## 🛠 Setup & Usage

### 1. Requirements
-   **Python 3.x** installed on your system.
-   **FFmpeg** installed (for thumbnail generation).
-   `pip install pyrogram tgcrypto`

### 2. Getting API Credentials
1.  Go to [my.telegram.org](https://my.telegram.org) and log in.
2.  Click on **API Development Tools**.
3.  Create a new application and copy your `api_id` and `api_hash`.

### 3. Connection
1.  Open the **Localy** icon in the Sidebar.
2.  Paste your API credentials and click **Connect Telegram**.
3.  Enter your phone number (e.g., `+917004xxxxxx`) and the OTP sent to your Telegram app directly in the UI.

### 4. Uploading
1.  Select the **Root Folder** of your course.
2.  Enter the target **Channel Username** (e.g., `my_channel`).
3.  Hit **Start Automation** and watch the magic happen!

---

## 💡 Pro Tips & Common Mistakes

-   **Phone Format:** Always use the international format with the `+` sign and country code (e.g., `+91`).
-   **No Quotes:** Do not wrap your API Hash or API ID in quotes (`""`).
-   **FFmpeg:** If thumbnails are not appearing, ensure `ffmpeg` is accessible in your system's PATH.

---

## 🤝 Developed By
**Thnoxs** Follow for more tools:
-   [GitHub](https://github.com/thnoxs)
-   [Instagram](https://instagram.com/thnoxs)
-   [LinkedIn](https://linkedin.com/in/thnoxs)

---
*Localy is an independent tool and is not affiliated with Telegram FZ-LLC.*