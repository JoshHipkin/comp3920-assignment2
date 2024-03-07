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


module.exports = {createRoom, addUsersToRoom, findRooms};