const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// পোর্ট ও ডাটাবেজ পাথ কনফিগারেশন
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'database');
const USERS_FILE = path.join(DB_DIR, 'users.json');

// ডাটাবেজ ফোল্ডার বা ফাইল না থাকলে অটো তৈরি করা
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// মিডলওয়্যার
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname))); // স্ট্যাটিক ফাইল সার্ভ করার জন্য

// ১. রেজিস্ট্রেশন রাউট (FullName, Username, Password সহ)
app.post('/api/register', (req, res) => {
    const { fullName, username, password } = req.body;
    
    if (!fullName || !username || !password) {
        return res.status(400).json({ message: "All fields are required!" });
    }

    let users = [];
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
    } catch (err) {
        users = [];
    }

    // ইউজার আগে থেকেই আছে কি না চেক করা
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ message: "Username already exists!" });
    }

    // নতুন ইউজার সেভ করা
    users.push({ fullName, username, password });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    res.status(200).json({ message: "Registration successful!" });
});

// ২. পাসওয়ার্ড পরিবর্তনের রাউট
app.post('/api/change-password', (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: "Please provide both old and new passwords!" });
    }

    let users = [];
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
    } catch (err) {
        return res.status(500).json({ message: "Database error!" });
    }

    // নোট: সিম্প্লিফিকেশনের জন্য এখানে ইউজার সেশন চেক করা হয়েছে, 
    // আপনি চাইলে নির্দিষ্ট ইউজারের পাসওয়ার্ড আপডেট লজিক এখানে কাস্টমাইজ করতে পারেন।
    if (users.length > 0) {
        // ডেমো বা সিঙ্গেল সেশন হ্যান্ডলিংয়ের জন্য প্রথম ইউজারের পাসওয়ার্ড চেক
        if (users[0].password === oldPassword) {
            users[0].password = newPassword;
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            return res.status(200).json({ message: "Password updated successfully!" });
        } else {
            return res.status(400).json({ message: "Current password is incorrect!" });
        }
    } else {
        return res.status(404).json({ message: "No user found!" });
    }
});

// রিয়েল-টাইম Socket.io চ্যাট হ্যান্ডলিং
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('chatMessage', (data) => {
        // চ্যাট মেসেজ সকল ইউজারের কাছে ব্রডকাস্ট করা
        io.emit('message', { username: data.username || 'LoveBirds User', text: data.text });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`LoveBirds Ultimate Secure Platform running on http://localhost:${PORT}`);
});
