const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'database');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const POSTS_FILE = path.join(DB_DIR, 'posts.json');

// অটো ডাটাবেজ ফাইল ক্রিয়েটর
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, JSON.stringify([]));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// রেজিস্ট্রেশন রাউট (FullName, Username, Password)
app.post('/api/register', (req, res) => {
    const { fullName, username, password } = req.body;
    if (!fullName || !username || !password) {
        return res.status(400).json({ message: "All fields are required!" });
    }

    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: "Username already exists!" });
    }

    users.push({ fullName, username, password });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.status(200).json({ message: "Registration successful!" });
});

// ইউজার লিস্ট (फाइंड ফ্রেন্ডস ফিচারের জন্য)
app.get('/api/users', (req, res) => {
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const safeUsers = users.map(u => ({ fullName: u.fullName, username: u.username }));
    res.status(200).json(safeUsers);
});

// পোস্ট ক্রিয়েশন রাউট
app.post('/api/posts', (req, res) => {
    const { username, content } = req.body;
    if (!content) return res.status(400).json({ message: "Post content cannot be empty!" });

    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    const newPost = { id: Date.now(), username, content, likes: 0, time: new Date().toLocaleDateString() };
    posts.unshift(newPost);
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.status(200).json(newPost);
});

// ফিড পোস্ট ফেচ করা
app.get('/api/posts', (req, res) => {
    let posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    res.status(200).json(posts);
});

// রিয়েল-টাইম চ্যাট (Socket.io)
io.on('connection', (socket) => {
    socket.on('chatMessage', (data) => {
        io.emit('message', { username: data.username || 'LoveBirds User', text: data.text });
    });
});

server.listen(PORT, () => {
    console.log(`LoveBirds Ultimate Modular Server running on port ${PORT}`);
});
