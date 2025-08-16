const fs = require("fs");

const writableStream = fs.createWriteStream("log.txt");
const reableStream = fs.createReadStream("log.txt")


// process.stdin.pipe(writableStream);
//process.stdin- readableSteam
//process.stdout- writableStream
reableStream.pipe(process.stdout)