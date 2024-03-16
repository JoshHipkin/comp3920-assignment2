const database = include('databaseConnection')

async function createRoom(roomName) {
    const query = `INSERT INTO room (name, start_datetime) VALUES (?, ?);`;
    const values = [roomName, new Date()];
    const [results] = await database.query(query, values);
    return results.insertId;    
};

async function addUsersToRoom(roomId, selectedUsers) {
    const values = selectedUsers.map(userId => [roomId, userId]);

    const query = `INSERT INTO room_user (room_id, user_id) VALUES ${values.map(() => '(?, ?)').join(', ')};`;

    await database.query(query, [].concat(...values));
}

async function getRooms(userId) {
    // Fetch the list of rooms the user is part of along with the last read message ID.
    const rooms = await database.query(`
        SELECT 
            r.room_id, 
            r.name,
            ru.last_read_message_id,
            ru.room_user_id
        FROM 
            room r
        LEFT JOIN 
            room_user ru USING(room_id) 
            WHERE ru.user_id = ?`, 
        [userId]
    );
    return rooms[0];
}

async function getUnreadMessages(room_user_id) {
    const query = `
    SELECT COUNT(*) AS count
    FROM message
    WHERE room_user_id = ? AND message_id > (SELECT last_read_message_id FROM room_user WHERE room_user_id = ?)`;
    const results = await database.query(query, [room_user_id, room_user_id]);
    return results[0];
}

async function getRecentMessageTime(room_user_id) {
    const query = `SELECT sent_datetime FROM message WHERE room_user_id = ? ORDER BY sent_datetime DESC LIMIT 1;`;
    const results = await database.query(query, [room_user_id]);
    return results[0];
}
 

async function authorizeUser(userId, roomId) {
    const query = `SELECT user_id FROM room_user WHERE user_id = ? AND room_id = ?`;
    const results = await database.query(query, [userId, roomId]);
    if (results.length > 0) {
        return true;
    } else {
        return false;
    }
}

async function getRoomName(roomId) {
    const query = `SELECT name FROM room WHERE room_id = ?`;
    const results = await database.query(query, [roomId]);
    return results[0];
}

async function getMessages(roomId) {
    const query = `SELECT *
        FROM message
        join room_user ru using (room_user_id)
        join room r using (room_id)
        join user u using (user_id)
        where ru.room_id = ?
        order by sent_datetime ASC;`;
    const results = await database.query(query, [roomId]);
    return results[0];
}

async function sendMessage(roomUserId, message) {
    const query = `INSERT INTO message (room_user_id, sent_datetime, text) VALUES (?, ?, ?);`;
    const values = [roomUserId, new Date(), message.trim()];
    await database.query(query, values);
}

async function getRoomUserId(roomId, userId) {
    const query = `SELECT room_user_id FROM room_user WHERE room_id = ? AND user_id = ?`;
    const results = await database.query(query, [roomId, userId]);
    return results[0];
}

async function updateLastReadMessage(roomId, userId) {
    const updateQuery = `
            UPDATE room_user
            SET last_read_message_id = (SELECT MAX(message_id) FROM message WHERE room_id = ?)
            WHERE user_id = ? AND room_id = ?
        `;
    await database.query(updateQuery, [roomId, userId, roomId]); 
}

async function getLastReadMessage(roomId, userId) {
    const query = `SELECT last_read_message_id FROM room_user WHERE room_id = ? AND user_id = ?`;
    const results = await database.query(query, [roomId, userId]);
    return results[0];
}

async function getEmojis() {
    const query = `SELECT * FROM emoji;`;
    const results = await database.query(query);
    return results[0];
}

async function getMessageEmojis(message_id) {
    const query = `SELECT name, image, COUNT(*) AS count FROM emoji_message join emoji USING(emoji_id) WHERE message_id = ? 
    GROUP BY name, image;`;
    const results = await database.query(query, [message_id]);
    return results[0];

}

async function addEmojisToMessage(message_id, emoji_id, user_id) {
    const query = `INSERT INTO emoji_message (message_id, emoji_id, user_id) VALUES (?, ?, ?);`;
    const values = [message_id, emoji_id, user_id];
    await database.query(query, values);
}



module.exports = {createRoom, addUsersToRoom, 
    getRooms, getUnreadMessages, getRecentMessageTime, authorizeUser, getMessages, getRoomName, sendMessage,
      updateLastReadMessage, getRoomUserId, getLastReadMessage, 
      getEmojis, getMessageEmojis, addEmojisToMessage};