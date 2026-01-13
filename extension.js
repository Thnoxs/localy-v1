const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

function activate(context) {
    const provider = new LocalyViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('localy.uploaderView', provider));
}

class LocalyViewProvider {
    constructor(extensionUri) { this._extensionUri = extensionUri; }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        this._updateView();

        webviewView.webview.onDidReceiveMessage(async msg => {
            if (msg.cmd === 'startLogin') this._startLoginProcess(msg.apiId, msg.apiHash);
            if (msg.cmd === 'sendInput') this._sendToLoginProcess(msg.value);
            if (msg.cmd === 'selectFolder') {
                const f = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false });
                if (f && f[0]) webviewView.webview.postMessage({ cmd: 'setPath', path: f[0].fsPath });
            } 
            if (msg.cmd === 'startUpload') this._startUpload(msg.path, msg.config);
            if (msg.cmd === 'logout') this._logout();
            if (msg.cmd === 'link') vscode.env.openExternal(vscode.Uri.parse(msg.url));
        });
    }

    _checkSession() {
        return fs.existsSync(path.join(this._extensionUri.fsPath, 'user_session.session'));
    }

    _updateView() {
        if (this._view) {
            const loggedIn = this._checkSession();
            this._view.webview.html = this._getHtml(this._view.webview, loggedIn);
        }
    }

    _startLoginProcess(apiId, apiHash) {
        if (!apiId || !apiHash) { vscode.window.showErrorMessage("Credentials Missing"); return; }
        
        // Kill existing process if any
        if (this.loginProcess) this.loginProcess.kill();

        const script = path.join(this._extensionUri.fsPath, 'backend_login.py');
        this.loginProcess = cp.spawn('python3', [script, apiId, apiHash]);

        this.loginProcess.stdout.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                if (line.trim()) {
                    try {
                        const json = JSON.parse(line.trim());
                        this._view.webview.postMessage({ cmd: 'loginStep', data: json });
                        if (json.status === 'success') setTimeout(() => this._updateView(), 1500);
                    } catch (e) { console.log("Non-JSON Output:", line); }
                }
            });
        });

        this.loginProcess.stderr.on('data', (d) => {
             // Handle script crash or errors
             console.log("Error:", d.toString());
             this._view.webview.postMessage({ cmd: 'loginStep', data: { status: 'error', message: 'Script Error (Check Output)', error: true }});
        });
    }

    _sendToLoginProcess(value) {
        if (this.loginProcess) this.loginProcess.stdin.write(value + "\n");
    }

    _logout() {
        const s = path.join(this._extensionUri.fsPath, 'user_session.session');
        if (fs.existsSync(s)) fs.unlinkSync(s);
        this._updateView();
    }

    _startUpload(folder, cfg) {
        const script = path.join(this._extensionUri.fsPath, 'backend.py');
        const proc = cp.spawn('python3', [script, folder, cfg.apiId, cfg.apiHash, cfg.chatId, cfg.credit]);
        proc.stdout.on('data', d => {
            d.toString().split('\n').forEach(line => {
                if(line.trim()) {
                    try { this._view.webview.postMessage({ cmd: 'status', data: JSON.parse(line) }); } catch(e){}
                }
            });
        });
    }

    _getHtml(webview, isLoggedIn) {
        const icon = (n) => webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'media', n)));
        
        // LOGIN PAGE
        const loginHtml = `
            <div id="login-container" class="fade-in">
                <div class="instructions">
                    <div class="inst-title">SETUP GUIDE</div>
                    <ul>
                        <li>Get API ID & Hash from <a href="#" onclick="link('https://my.telegram.org')">my.telegram.org</a></li>
                        <li>Enter details below to connect safely.</li>
                    </ul>
                </div>
                
                <div id="step-api">
                    <label>API ID</label><input type="text" id="apiId" placeholder="e.g. 123456">
                    <label>API HASH</label><input type="text" id="apiHash" placeholder="e.g. abcd123...">
                    <button class="btn-primary" onclick="startLogin()">
                        <img src="${icon('connect.svg')}" class="btn-icon"> Connect Telegram
                    </button>
                </div>

                <div id="step-phone" class="hidden">
                    <label>ENTER PHONE NUMBER</label>
                    <input type="text" id="phone" placeholder="e.g. +91XXXXXXXXXX">
                    <button class="btn-primary" onclick="sendInput('phone')">Send OTP</button>
                </div>

                <div id="step-otp" class="hidden">
                    <label>ENTER OTP CODE</label>
                    <input type="text" id="otp" placeholder="1 2 3 4 5">
                    <button class="btn-success" onclick="sendInput('otp')">Login</button>
                </div>

                <div id="login-status" class="status-text"></div>
            </div>`;

        // UPLOAD PAGE
        const uploadHtml = `
            <div id="upload-container" class="fade-in">
                <div class="header-row">
                    <span class="brand-sm">LOCALY DASHBOARD</span>
                    <button class="btn-icon-only" onclick="logout()" title="Logout">
                        <img src="${icon('logout.svg')}" style="width:14px; filter:invert(1);">
                    </button>
                </div>

                <div class="card">
                    <label>CHANNEL USERNAME</label>
                    <input type="text" id="chatId" placeholder="localyORG">
                    
                    <label>CREDIT LINE</label>
                    <input type="text" id="credit" value="Uploaded by @thnoxs">
                    <small style="opacity:0.5; font-size:9px;">(Auto-added below video)</small>

                    <div style="height:20px;"></div>

                    <button class="btn-secondary" onclick="selFolder()">
                        <img src="${icon('folder.svg')}" class="btn-icon"> Select Course Folder
                    </button>
                    <div id="path-display">No Folder Selected</div>
                    
                    <button class="btn-primary" id="startBtn" onclick="startUpload()" disabled>
                        <img src="${icon('upload.svg')}" class="btn-icon"> Start Upload
                    </button>
                </div>

                <div class="status-box" id="statusBox">
                    <div class="meta"><span id="msg">Ready</span><span id="pct">0%</span></div>
                    <div class="progress-bar"><div class="fill" id="fill"></div></div>
                </div>
            </div>`;

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                :root { --accent: #007fd4; --bg: var(--vscode-editor-background); --fg: var(--vscode-editor-foreground); }
                body { font-family: var(--vscode-font-family); padding: 15px; color: var(--fg); background: --bg; display: flex; flex-direction: column; min-height: 95vh; }
                
                .main-content { flex-grow: 1; }
                .hidden { display: none; }
                .fade-in { animation: fadeIn 0.4s ease; }
                @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
                
                /* INSTRUCTIONS (CLEAN) */
                .instructions { margin-bottom: 20px; padding-left: 5px; }
                .inst-title { font-weight: bold; font-size: 11px; color: var(--accent); margin-bottom: 5px; letter-spacing: 0.5px; }
                ul { margin: 0; padding-left: 15px; font-size: 11px; opacity: 0.8; line-height: 1.6; }
                a { color: var(--vscode-textLink-foreground); text-decoration: none; }

                /* HEADER & BUTTONS */
                .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 10px; }
                .brand-sm { font-size: 10px; font-weight: bold; opacity: 0.6; letter-spacing: 1px; }
                .btn-icon-only { background: transparent; border: none; cursor: pointer; opacity: 0.6; padding: 5px; }
                .btn-icon-only:hover { opacity: 1; background: rgba(255,255,255,0.1); border-radius: 4px; }

                /* INPUTS & CARDS */
                .card { background: var(--vscode-editor-inactiveSelectionBackground); padding: 15px; border-radius: 6px; }
                label { font-size: 10px; font-weight: 700; opacity: 0.7; display: block; margin: 10px 0 5px; }
                input { width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--fg); border: 1px solid var(--vscode-input-border); border-radius: 4px; outline: none; box-sizing: border-box; }
                input:focus { border-color: var(--accent); }
                
                /* ACTION BUTTONS */
                button.btn-primary { width: 100%; background: var(--accent); color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; margin-top: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
                button.btn-secondary { width: 100%; background: #333; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
                button.btn-success { width: 100%; background: #2ecc71; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; margin-top: 10px; }
                .btn-icon { width: 14px; filter: invert(1); }

                /* STATUS */
                .status-text { margin-top: 15px; font-size: 11px; text-align: center; color: #e67e22; font-weight: bold; min-height: 20px; }
                .status-box { margin-top: 20px; display: none; }
                .progress-bar { height: 4px; background: #333; border-radius: 2px; overflow: hidden; margin-top: 5px; }
                .fill { height: 100%; width: 0%; background: var(--accent); transition: width 0.3s; }
                .meta { display: flex; justify-content: space-between; font-size: 10px; }
                #path-display { text-align: center; font-size: 10px; opacity: 0.6; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                /* PERMANENT FOOTER */
                .footer { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--vscode-widget-border); text-align: center; }
                .socials { display: flex; justify-content: center; gap: 12px; margin-bottom: 10px; }
                .social-icon { width: 18px; opacity: 0.6; cursor: pointer; transition: 0.2s; filter: invert(1); }
                .social-icon:hover { opacity: 1; transform: scale(1.1); }
                .brand { font-size: 9px; opacity: 0.4; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="main-content">
                ${isLoggedIn ? uploadHtml : loginHtml}
            </div>

            <div class="footer">
                <div class="socials">
                    <img src="${icon('github.svg')}" class="social-icon" onclick="link('https://github.com/thnoxs')" title="GitHub">
                    <img src="${icon('instagram.svg')}" class="social-icon" onclick="link('https://instagram.com/thnoxs')" title="Instagram">
                    <img src="${icon('linkedin.svg')}" class="social-icon" onclick="link('https://linkedin.com/in/thnoxs')" title="LinkedIn">
                </div>
                <div class="brand">DEVELOPED BY THNOXS</div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                // ACTIONS
                function startLogin() {
                    const id = document.getElementById('apiId').value;
                    const hash = document.getElementById('apiHash').value;
                    if(!id || !hash) return;
                    
                    document.getElementById('step-api').style.opacity = '0.5';
                    document.getElementById('login-status').innerText = "Connecting...";
                    vscode.postMessage({ cmd: 'startLogin', apiId: id, apiHash: hash });
                }

                function sendInput(type) {
                    const val = document.getElementById(type).value;
                    vscode.postMessage({ cmd: 'sendInput', value: val });
                }
                
                function selFolder() { vscode.postMessage({ cmd: 'selectFolder' }); }
                function logout() { vscode.postMessage({ cmd: 'logout' }); }
                function link(url) { vscode.postMessage({ cmd: 'link', url: url }); }
                
                function startUpload() {
                   document.getElementById('startBtn').disabled = true;
                   document.getElementById('statusBox').style.display = 'block';
                   vscode.postMessage({ 
                       cmd: 'startUpload', 
                       path: document.getElementById('path-display').innerText, 
                       config: { 
                           apiId: '0', apiHash: '0', 
                           chatId: document.getElementById('chatId').value, 
                           credit: document.getElementById('credit').value 
                       }
                   });
                }

                // MESSAGES FROM BACKEND
                window.addEventListener('message', e => {
                    const d = e.data;
                    
                    // LOGIN STEPS
                    if(d.cmd === 'loginStep') {
                        const status = document.getElementById('login-status');
                        
                        // Status Update (Agar status msg hai to dikhao)
                        if(d.data.message) status.innerText = d.data.message;
                        
                        // Error Handling
                        if(d.data.error) {
                            status.style.color = '#e74c3c'; // Red Color for Error
                            document.getElementById('step-api').style.opacity = '1'; // Unlock input
                        } else {
                            status.style.color = '#e67e22'; // Orange for process
                        }

                        // State Switching
                        if(d.data.status === 'need_phone') {
                            document.getElementById('step-api').classList.add('hidden');
                            document.getElementById('step-phone').classList.remove('hidden');
                            status.innerText = ""; // Clear status for next step
                        }
                        if(d.data.status === 'need_otp') {
                            document.getElementById('step-phone').classList.add('hidden');
                            document.getElementById('step-otp').classList.remove('hidden');
                            status.innerText = "OTP Sent!";
                        }
                    }

                    // UPLOAD STEPS
                    if(d.cmd === 'setPath') {
                        document.getElementById('path-display').innerText = d.path;
                        document.getElementById('startBtn').disabled = false;
                    }
                    if(d.cmd === 'status') {
                        document.getElementById('msg').innerText = d.data.message;
                        if(d.data.type === 'progress') {
                            document.getElementById('fill').style.width = d.data.progress + '%';
                            document.getElementById('pct').innerText = d.data.progress + '%';
                        }
                        if(d.data.type === 'success') {
                            document.getElementById('fill').style.width = '100%';
                            document.getElementById('startBtn').innerText = 'Done';
                        }
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
exports.activate = activate;