const database = include('databaseConnection');

async function createUser(email, username, password) {
    let query = `INSERT INTO user (email, username, password) VALUES (?, ?, ?);`;
    try {
        const results = await database.query(query, [email, username, password]);
        return results[0].insertId;
} catch (e) {
    console.error(e);
    console.log("Error creating user");
    return false;
}
}
module.exports = createUser;