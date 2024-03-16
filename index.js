require("./utils.js")
const session = require('express-session');
const express = require('express');
const saltRounds = 12;
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
require('dotenv').config();
const path = require('path');

const bodyParser = require('body-parser');
const { rmSync } = require("fs");
const app = express();
const port = process.env.PORT || 3002;

const expireTime = 1 * 60 * 60 * 1000; // 1 hour

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));


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
    res.render('signup', { missing, error, exists });
});

app.post('/signingup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.redirect('/signup?missing=true');
    }
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
    const findRooms = require('./database/rooms.js');
    const rooms = await findRooms.findRooms(req.session.user_id);
    res.render('chatrooms', { rooms: rooms });
});

app.get('/createRoom', authorized, async (req, res) => {
    const findAllUsers = require('./database/findUser.js');
    const users = await findAllUsers.findAllUsers(req.session.user_id);
    console.log(users)
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

app.get('/room/:roomId', authorized, roomAuthorization, async (req, res) => {
    const roomId = req.params.roomId;
    const messages = await roomQueries.getMessages(roomId);
    const roomName = await roomQueries.getRoomName(roomId);
    const lastReadMessage = await roomQueries.getLastReadMessage(roomId, req.session.user_id);
    await roomQueries.updateLastReadMessage(roomId, req.session.user_id);
    res.render('room', { messages : messages, currentUserId : req.session.user_id , roomName: roomName[0].name, 
        roomId: roomId, lastReadMessageId : lastReadMessage[0].last_read_message_id});
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
    const addUsersToRoom = require('./database/rooms.js');
    try {
        await addUsersToRoom.addUsersToRoom(roomId, selectedUsers);
        res.redirect(`/room/${roomId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error while adding users to group');
    }
});


app.use(express.static(path.join(__dirname, "/public")));
app.get('*', (req, res) => {
    res.status(404);
    res.render('404');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});