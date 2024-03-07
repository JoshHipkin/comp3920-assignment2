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


module.exports = {findUsers, findAllUsers};