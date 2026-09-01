const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}

const USERS_FILE = path.join(DB_DIR, 'users.json');
const POSTS_FILE = path.join(DB_DIR, 'posts.json');
const BACKUP_FILE = path.join(DB_DIR, 'admin_backup.json');

function readData(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { return []; }
}
function writeData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(USERS_FILE)) writeData(USERS_FILE, []);
if (!fs.existsSync(POSTS_FILE)) writeData(POSTS_FILE, []);
if (!fs.existsSync(BACKUP_FILE)) writeData(BACKUP_FILE, { deleted_posts: [], deleted_chats: [], reports: [], logs: [] });

// --- API: User Registration ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password required!' });
    }

    let users = readData(USERS_FILE);
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, message: 'Username already exists!' });
    }

    const newUser = { id: Date.now().toString(), username, password, joinedAt: new Date().toISOString() };
    users.push(newUser);
    writeData(USERS_FILE, users);

    res.json({ success: true, message: 'Registration successful!', user: { username } });
});

// --- API: User Login ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let users = readData(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.json({ success: false, message: 'Invalid credentials!' });
    }

    res.json({ success: true, message: 'Login successful!', user: { username: user.username } });
});

// --- API: Password Reset / Recovery ---
app.post('/api/reset-password', (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.json({ success: false, message: 'Username and new password are required!' });
    }

    let users = readData(USERS_FILE);
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex === -1) {
        return res.json({ success: false, message: 'Username not found in system!' });
    }

    users[userIndex].password = newPassword;
    writeData(USERS_FILE, users);

    res.json({ success: true, message: 'Password reset successful! You can now log in.' });
});

// --- API: Get Posts ---
app.get('/api/posts', (req, res) => {
    let posts = readData(POSTS_FILE);
    res.json(posts);
});

// --- API: Admin & Security Data Fetch ---
app.get('/api/admin/data', (req, res) => {
    let users = readData(USERS_FILE);
    let backup = readData(BACKUP_FILE);
    res.json({ users, backup });
});

// --- Real-time Socket.io Sync & Security Audit ---
io.on('connection', (socket) => {
    console.log('Secure client connected: ' + socket.id);

    socket.on('chat_message', (data) => {
        let backup = readData(BACKUP_FILE);
        backup.logs.push({ type: 'chat', sender: data.sender, content: data.text, timestamp: new Date().toISOString() });
        writeData(BACKUP_FILE, backup);
        io.emit('chat_message', data);
    });

    socket.on('delete_chat_everyone', (msgData) => {
        let backup = readData(BACKUP_FILE);
        backup.deleted_chats.push({
            sender: msgData.sender,
            content: msgData.content,
            deletedAt: new Date().toISOString(),
            reason: "Deleted by sender for everyone"
        });
        writeData(BACKUP_FILE, backup);
        io.emit('refresh_chat');
    });

    socket.on('new_post', (postData) => {
        let posts = readData(POSTS_FILE);
        posts.unshift(postData);
        writeData(POSTS_FILE, posts);
        io.emit('new_post', postData);
    });

    socket.on('manage_post', (actionData) => {
        let posts = readData(POSTS_FILE);
        let backup = readData(BACKUP_FILE);

        if (actionData.action === 'delete') {
            const index = posts.findIndex(p => p.postId === actionData.postId);
            if (index !== -1) {
                const deleted = posts.splice(index, 1)[0];
                backup.deleted_posts.push({ ...deleted, deletedAt: new Date().toISOString() });
                writeData(POSTS_FILE, posts);
                writeData(BACKUP_FILE, backup);
                io.emit('refresh_feed');
            }
        } else if (actionData.action === 'report') {
            backup.reports.push({ postId: actionData.postId, reason: actionData.reason, reportedAt: new Date().toISOString() });
            writeData(BACKUP_FILE, backup);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected.');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`LoveBirds Ultimate Secure Platform running on http://localhost:${PORT}`);
});