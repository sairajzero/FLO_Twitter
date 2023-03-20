
const sqlite3 = require('sqlite3').verbose();

function query(db, sql, values = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, values, (err, rows) => {
            if (err) reject(err);
            else resolve(rows)
        })
    })
}

function check_DB(db_name) {
    return new Promise((resolve, reject) => {
        const DATABASE_NAME = `./${db_name}.db`;
        const _db = new sqlite3.Database(DATABASE_NAME, (err) => {
            if (err) return reject(err);
            query(_db, "SELECT name FROM sqlite_schema WHERE type='table'").then(rows => {
                let tables = rows.map(r => r.name);
                console.log(tables);
                Promise.all(tables.map(t => query(_db, `SELECT * FROM ${t}`))).then(result => {
                    result.forEach((r, i) => {
                        console.log(tables[i])
                        console.table(r)
                    });
                    resolve('--end--');
                }).catch(error => reject(error))
            }).catch(error => reject(error))
        });
    })
}

var userID;
for (let arg of process.argv) {
    if (/^-u=/i.test(arg) || /^-user=/i.test(arg))
        userID = arg.split(/=(.*)/s)[1];
}

if (!userID)
    return console.warn("Public key needed");

check_DB(userID).then(result => {
    console.log(result);
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});