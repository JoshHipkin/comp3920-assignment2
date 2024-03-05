const database = include('databaseConnection');

async function createTables() {
    let createUser = `CREATE TABLE IF NOT EXISTS user (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL,
        UNIQUE INDEX unique_username (username ASC) VISIBLE);`;

    let createRoom = `CREATE TABLE IF NOT EXISTS room (
        room_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        start_datetime DATETIME NOT NULL);`;
    
    let room_user = `CREATE TABLE IF NOT EXISTS room_user (
        room_user_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        room_id INT NOT NULL,
        last_read_message_id INT);`;
    
    let message = `CREATE TABLE IF NOT EXISTS message (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        room_user_id INT NOT NULL,
        sent_datetime DATETIME NOT NULL,
        text TEXT NOT NULL);`;

    let emoji_message = `CREATE TABLE IF NOT EXISTS emoji_message (
        emoji_message_id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        emoji_id INT NOT NULL,
        user_id INT NOT NULL);`;

    let emoji = `CREATE TABLE IF NOT EXISTS emoji (
        emoji_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image VARCHAR(100));`;

    let constraints = `ALTER TABLE user ADD UNIQUE (email);
        ALTER TABLE user ADD UNIQUE (username);
        ALTER TABLE emoji ADD UNIQUE (name);`;

    let foreignKeys = `ALTER TABLE room_user ADD FOREIGN KEY (user_id) REFERENCES user(user_id);
        ALTER TABLE room_user ADD FOREIGN KEY (room_id) REFERENCES room(room_id);
        ALTER TABLE room_user ADD FOREIGN KEY (last_read_message_id) REFERENCES message(message_id);
        ALTER TABLE message ADD FOREIGN KEY (room_user_id) REFERENCES room_user(room_user_id);
        ALTER TABLE emoji_message ADD FOREIGN KEY (message_id) REFERENCES message(message_id);
        ALTER TABLE emoji_message ADD FOREIGN KEY (emoji_id) REFERENCES emoji(emoji_id);
        ALTER TABLE emoji_message ADD FOREIGN KEY (user_id) REFERENCES user(user_id);`;

    try {
        const results = await database.query(createUser + createRoom + room_user + message + emoji_message + emoji + constraints + foreignKeys);
        console.log("Tables created");
        console.log(results);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    } 
}
module.exports = {createTables};

