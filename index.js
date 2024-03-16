require("./utils.js")
const session = require('express-session');
const express = require('express');
const saltRounds = 12;
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
require('dotenv').config();
const path = require('path');

const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3002;

const expireTime = 1 * 60 * 60 * 1000; // 1 hour

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

var mongoStore;
try {
    mongoStore = MongoStore.create({
        mongoUrl:  `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`,
        crypto: {
            secret: mongodb_session_secret
        },
    });
    console.log("Connected to MongoDB");
} catch (e) {
    console.error(e);
    console.log("MongoDB connection failed");
}

if (mongoStore) {
    app.use(session({
        store: mongoStore,
        secret: node_session_secret,
        saveUninitialized: false,
        cookie: {
            maxAge: expireTime
        }
    }));
}

const roomQueries = require('./database/rooms.js');

async function roomAuthorization(req, res, next) {
    const authorized = require('./database/rooms.js');
    const belong = await authorized.authorizeUser(req.session.user_id, req.params.roomId);
    if (!belong) {
        console.log("User not authorized");
        res.status(403);
        res.redirect('/chatrooms');
    } else {
        next();
    }
}

function authorized(req, res, next) { 
    if (req.session.authenticated) {
        next();
    }
    else {
        res.redirect('/login');
    }
}

function ensureUserAvailable(req, res, next) {
    if (req.session.authenticated) {
        res.locals.username = req.session.username;
        res.locals.email = req.session.email;
        res.locals.user_id = req.session.user_id;
    } else {
        res.locals.username = null;
        res.locals.email = null;
        res.locals.user_id = null;
    }
    next();
}

function validatePassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
    return regex.test(password);
}

app.use(ensureUserAvailable);

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    if (req.session.authenticated) {
        res.redirect('/chatrooms');
        return;
    }
    const error = req.query.error;
    res.render('login', { error});
});

app.post('/logingin', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    const findUser = require('./database/findUser.js');
    const results = await findUser.findUsers(email, null);
    if (results.length == 0) {
        res.redirect('/login?error=true');
        return;
    } else if (results.length > 1) {
        console.error("Duplicate users found");
        res.redirect('/login?error=true');
        return;
    } else {
        const user = results[0];
        if (bcrypt.compareSync(password, user.password)) {
            req.session.authenticated = true;
            req.session.username = user.username;
            req.session.email = user.email;
            req.session.user_id = user.user_id;
            req.session.cookie.maxAge = expireTime;
            res.redirect('/');
        } else {
            res.redirect('/login?error=true');
        }
    }
    
});

app.get('/signup', (req, res) => {
    if (req.session.authenticated) {
        res.redirect('/chatrooms');
        return;
    }
    const missing = req.query.missing;
    const error = req.query.error;
    const exists = req.query.exists;
    const password = req.query.pass;
    res.render('signup', { missing, error, exists, password });
});

app.post('/signingup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.redirect('/signup?missing=true');
    }
    if (validatePassword(password)) {
    const createUser = require('./database/createUser');
    const findUsers = require('./database/findUser.js');
    try {
        const userExists = await findUsers.findUsers(email, username);
        if (userExists && userExists.length > 0) {
            res.redirect('/signup?exists=true');
            return;
        }
        const hashedPassword = bcrypt.hashSync(password, saltRounds);
        const user = await createUser(email, username, hashedPassword);
        req.session.authenticated = true;
        req.session.username = username;
        req.session.email = email;
        req.session.cookie.maxAge = expireTime;
        res.redirect('/signupsuccess');
    } catch (e) {
        console.error(e);
        res.redirect('/signup?error=true');
    }
} else {
    res.redirect('/signup?pass=true');
}
});

app.get('/signupsuccess', (req, res) => {
    res.render('signupsuccess');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/deleteUsers', (req, res) => {
    const deleteUsers = require('./database/deleteUsers');
    deleteUsers();
    res.send("Users deleted");
});

app.get('/chatrooms', authorized, async (req, res) => {
    const rooms = await roomQueries.getRooms(req.session.user_id);
    for (const room of rooms) {
        const unreadMessages = await roomQueries.getUnreadMessages(room.room_user_id);
        const recentMessageTime = await roomQueries.getRecentMessageTime(room.room_user_id);
        room.unreadMessages = unreadMessages[0].count;
        room.recentMessageTime = recentMessageTime[0].sent_datetime;
    }
    console.log(rooms);

    res.render('chatrooms', { rooms: rooms });
});

app.get('/createRoom', authorized, async (req, res) => {
    const findAllUsers = require('./database/findUser.js');
    const users = await findAllUsers.findAllUsers(req.session.user_id);
    res.render('createRoom', { users: users });
});

app.post('/createRoom', async (req, res) => {
    const createRoom = require('./database/rooms.js');
    let{ roomName, selectedUsers } = req.body;
    selectedUsers = Array.isArray(selectedUsers) ? selectedUsers : selectedUsers ? [selectedUsers] : [];
    selectedUsers.push(req.session.user_id);

    try {
        const roomId = await createRoom.createRoom(roomName);

        if (selectedUsers && selectedUsers.length) {
            await createRoom.addUsersToRoom(roomId, selectedUsers);
        }

        res.redirect('/chatRooms');
    } catch (error) {
        console.error(error)
        res.status(500).send('Server error while creating group');
    }
});

const getTimeDifference = (sentTime, now) => {
    const diffTime = Math.abs(now - sentTime);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));

    if (diffDays > 1) {
        return sentTime.toLocaleDateString();
    } else if (diffHours > 1) {
        return `${diffHours} hours ago`;
    } else if (diffMinutes > 1) {
        return `${diffMinutes} minutes ago`;
    } else {
        return `Just now`;
    }
};

app.get('/room/:roomId', authorized, roomAuthorization, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const now = new Date();

        const [messages, roomName, lastReadMessage, emojis] = await Promise.all([
            roomQueries.getMessages(roomId),
            roomQueries.getRoomName(roomId),
            roomQueries.getLastReadMessage(roomId, req.session.user_id),
            roomQueries.getEmojis()
        ]);
        await roomQueries.updateLastReadMessage(roomId, req.session.user_id);

        for (const message of messages) {
            message.relativeTime = getTimeDifference(new Date(message.sent_datetime), now);
            message.emojis = await roomQueries.getMessageEmojis(message.message_id);
        }

        res.render('room', {
            messages: messages,
            currentUserId: req.session.user_id,
            roomName: roomName[0]?.name,
            roomId: roomId,
            lastReadMessageId: lastReadMessage[0]?.last_read_message_id,
            emojis: emojis
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading the chat room');
    }
});


app.post('/room/:roomId', authorized, roomAuthorization, async (req, res) => {
    const roomId = req.params.roomId;
    const message = req.body.message;
    const roomUserId = await roomQueries.getRoomUserId(roomId, req.session.user_id);
    await roomQueries.sendMessage(roomUserId[0].room_user_id, message);
    await roomQueries.updateLastReadMessage(roomId, req.session.user_id);
    res.redirect(`/room/${roomId}`);
});

app.get('/addUsers/:roomId', authorized, roomAuthorization, async (req, res) => {
    const roomId = req.params.roomId;
    const findAllUsers = require('./database/findUser.js');
    const usersInRoom = await findAllUsers.findUsersInRoom(roomId);
    const usersNotInRoom = await findAllUsers.findUsersNotInRoom(roomId);
    res.render('addUsers', { usersNotInRoom : usersNotInRoom, usersInRoom : usersInRoom, roomId: roomId });
});

app.post('/addUsers/:roomId', authorized, roomAuthorization, async (req, res) => {
    const roomId = req.params.roomId;
    let selectedUsers = req.body.selectedUsers;
    selectedUsers = Array.isArray(selectedUsers) ? selectedUsers : selectedUsers ? [selectedUsers] : [];
    if (selectedUsers.length == 0) {
        res.redirect(`/room/${roomId}`);
        return;
    }
    const addUsersToRoom = require('./database/rooms.js');
    try {
        await addUsersToRoom.addUsersToRoom(roomId, selectedUsers);
        res.redirect(`/room/${roomId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error while adding users to group');
    }
});

app.post('/room/:roomId/addEmoji', authorized, roomAuthorization, async (req, res) => {
    const roomId = req.params.roomId;
    const { messageId, emojiId } = req.body;
    const userId = req.session.user_id;
    
    try {
        await roomQueries.addEmojisToMessage(messageId, emojiId, userId);
        res.redirect(`/room/${roomId}`);
    } catch (e) {
        console.error(e);
    }
});



app.get('*', (req, res) => {
    res.status(404);
    res.render('404');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});