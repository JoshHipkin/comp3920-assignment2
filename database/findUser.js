const database = include('databaseConnection');

async function findUsers(email, username) {
    let query = `SELECT * FROM user WHERE email = ? OR username = ?;`;
    try {
        const results = await database.query(query, [email, username]);
        return results[0];
    } catch (e) {
        console.error(e);
        console.log("Error finding user");
        return false;
    }
}

async function findAllUsers(currentUserId) {
    let query = `SELECT user_id, username FROM user WHERE user_id != ?;`;
    try {
        const results = await database.query(query, [currentUserId]);
        return results[0];
    } catch (e) {
        console.error(e);
        console.log("Error finding user");
        return false;
    }
}

async function findUsersInRoom(roomId) {
    let query = `SELECT user_id, username FROM user JOIN room_user 
    USING (user_id) WHERE room_id = ?;`;
    try {
        const results = await database.query(query, [roomId]);
        return results[0];
} catch (e) {
    console.error(e);
    return false;
    }
}

async function findUsersNotInRoom(roomId) {
    let query = `SELECT user_id, username FROM user 
    WHERE user_id NOT IN (SELECT user_id FROM room_user WHERE room_id = ?);`;
    try {
        const results = await database.query(query, [roomId]);
        return results[0];
} catch (e) {
    console.error(e);
    return false;
    }
}


module.exports = {findUsers, findAllUsers, findUsersInRoom, findUsersNotInRoom};