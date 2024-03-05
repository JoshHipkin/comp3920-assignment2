const database = include('databaseConnection');

async function findUsers(email, username) {
    let query = `SELECT * FROM user WHERE email = ? OR username = ?;`;
    console.log(`Searching for user with email: ${email} or username: ${username}`); // Log the input parameters
    try {
        const results = await database.query(query, [email, username]);
        return results[0];
    } catch (e) {
        console.error(e);
        console.log("Error finding user");
        return false;
    }
}


module.exports = findUsers;