const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;

const publicDir = path.join(__dirname, "public");
const htmlPath = path.join(publicDir, "index.html");

// Crea cartella e file se non esistono
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

if (!fs.existsSync(htmlPath)) {
  fs.writeFileSync(htmlPath, `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>ChatRandomX</title>
  <style>
    body { background: #121212; color: #fff; font-family: sans-serif; margin: 0; padding: 0; }
    .container { display: flex; flex-direction: column; height: 100vh; }
    .home, .chat { flex: 1; display: none; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; }
    .visible { display: flex; }
    .messages { height: 300px; width: 90%; max-width: 500px; overflow-y: auto; border: 1px solid #444; background: #222; padding: 1rem; margin-bottom: 1rem; }
    .input-area { display: flex; gap: 0.5rem; width: 90%; max-width: 500px; }
    input[type=text] { flex: 1; padding: 0.5rem; background: #333; color: white; border: none; }
    input.nickname { max-width: 250px; height: 40px; font-size: 1rem; text-align: center; margin-bottom: 1rem; }
    button { padding: 0.5rem 1rem; background: #444; color: white; border: none; cursor: pointer; }
    .connected-count { position: absolute; top: 10px; right: 10px; color: #aaa; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="connected-count" id="userCount">👁️ 0</div>
  <div class="container">
    <div class="home visible">
      <h1>ChatRandomX</h1>
      <p>Chatta con nuove persone dall'Italia.</p>
      <input type="text" id="nickname" class="nickname" placeholder="Inserisci il tuo nome" />
      <button onclick="startChat()">Inizia Chat</button>
    </div>

    <div class="chat">
      <div class="messages" id="messages"></div>
      <div class="input-area">
        <input id="messageInput" type="text" placeholder="Scrivi..." disabled />
        <button onclick="sendMessage()" id="sendBtn" disabled>Invia</button>
      </div>
      <div class="input-area" id="actionButtons" style="margin-top: 1rem;">
        <button onclick="skip()">⏭ Salta</button>
        <button onclick="stop()">🛑 Stop</button>
        <button onclick="goHome()">🏠 Home</button>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const home = document.querySelector('.home');
    const chat = document.querySelector('.chat');
    const messages = document.getElementById('messages');
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const actionButtons = document.getElementById('actionButtons');
    const userCount = document.getElementById('userCount');

    let nickname = '';

    function startChat() {
      nickname = document.getElementById('nickname').value.trim();
      if (!nickname) {
        alert("Devi inserire un nome!");
        return;
      }
      home.classList.remove('visible');
      chat.classList.add('visible');
      socket.emit('start_random', nickname);
    }

    function sendMessage() {
      const text = input.value.trim();
      if (text !== '') {
        socket.emit('chat_message', { text });
        addMessage('Tu', text);
        input.value = '';
      }
    }

    function skip() {
      socket.emit('skip');
    }

    function stop() {
      socket.emit('stop');
    }

    function goHome() {
      window.location.reload();
    }

    function addMessage(from, text) {
      const div = document.createElement('div');
      div.innerHTML = '<strong>' + from + ':</strong> ' + text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function disableInput() {
      input.disabled = true;
      sendBtn.disabled = true;
    }

    function enableInput() {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }

    socket.on('msg', ({ from, text }) => {
      addMessage(from, text);
    });

    socket.on('chat_reset', () => {
      messages.innerHTML = '';
      disableInput();
    });

    socket.on('chat_ready', ({ partnerName }) => {
      addMessage('System', partnerName + ' si è connesso alla chat.');
      enableInput();
    });

    socket.on('user_left', ({ partnerName }) => {
      addMessage('System', '⚠️ ' + partnerName + ' ha lasciato la chat.');
      disableInput();
      actionButtons.innerHTML = \`
        <button onclick="startChat()">🔁 Nuova Chat</button>
        <button onclick="goHome()">🏠 Home</button>
      \`;
    });

    socket.on('system', (text) => {
      addMessage('System', text);
    });

    socket.on('connected_users', (count) => {
      userCount.textContent = '👁️ ' + count;
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !input.disabled) {
        sendMessage();
      }
    });
  </script>
</body>
</html>
  `);
}

// Serve statici
app.use(express.static(publicDir));

// Routing base
app.get("/", (req, res) => {
  res.sendFile(htmlPath);
});

// Server dati
let users = new Map();
let waiting = null;
let connectedUsers = 0;

io.on("connection", (socket) => {
  connectedUsers++;
  io.emit("connected_users", connectedUsers);

  let nickname = "";
  let partner = null;

  socket.on("start_random", (name) => {
    nickname = name;
    users.set(socket, { socket, nickname });

    if (waiting && waiting !== socket) {
      partner = waiting;
      const partnerData = users.get(partner);
      users.get(partner).partner = socket;
      users.get(socket).partner = partner;

      waiting = null;

      socket.emit("chat_ready", { partnerName: partnerData.nickname });
      partner.emit("chat_ready", { partnerName: nickname });
    } else {
      waiting = socket;
      socket.emit("system", "⏳ In attesa di un altro utente...");
    }
  });

  socket.on("chat_message", ({ text }) => {
    const partnerSocket = users.get(socket)?.partner;
    if (partnerSocket && users.has(partnerSocket)) {
      partnerSocket.emit("msg", { from: nickname, text });
    }
  });

  socket.on("skip", () => {
    const currentPartner = users.get(socket)?.partner;
    if (currentPartner && users.has(currentPartner)) {
      currentPartner.emit("user_left", { partnerName: nickname });
      users.get(currentPartner).partner = null;
    }

    socket.emit("chat_reset");
    users.get(socket).partner = null;

    waiting = socket;
    socket.emit("system", "⏳ In attesa di un altro utente...");
  });

  socket.on("stop", () => {
    const currentPartner = users.get(socket)?.partner;
    if (currentPartner && users.has(currentPartner)) {
      currentPartner.emit("user_left", { partnerName: nickname });
      users.get(currentPartner).partner = null;
    }

    users.delete(socket);
    socket.emit("chat_reset");
    socket.emit("system", "🔁 Nuova Chat o 🏠 Home.");
  });

  socket.on("disconnect", () => {
    connectedUsers--;
    io.emit("connected_users", connectedUsers);

    if (waiting === socket) {
      waiting = null;
    }

    const currentPartner = users.get(socket)?.partner;
    if (currentPartner && users.has(currentPartner)) {
      currentPartner.emit("user_left", { partnerName: nickname });
      users.get(currentPartner).partner = null;
    }

    users.delete(socket);
  });
});

server.listen(PORT, () => {
  console.log("✅ Server avviato su http://localhost:" + PORT);
});
