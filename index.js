require("./utils.js")
const session = require('express-session');
const express = require('express');
const saltRounds = 10;
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

const expireTime = 1 * 60 * 60 * 1000; // 1 hour

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

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
} catch (e) {
    console.error(e);
}

if (mongoStore) {
    app.use(session({
        store: mongoStore,
        secret: nodeSessionSecret,
        saveUninitialized: false,
        cookie: {
            maxAge: expireTime
        }
    }));
}