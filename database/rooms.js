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

async function findRooms(userId) {
    const query = `SELECT r.room_id, name FROM room_user ru JOIN room r USING (room_id) WHERE user_id = ?`;
    const results= await database.query(query, [userId]);
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


module.exports = {createRoom, addUsersToRoom, findRooms,
     authorizeUser, getMessages, getRoomName, sendMessage,
      updateLastReadMessage, getRoomUserId, getLastReadMessage};