const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  if (req.url !== "/") {
    return res.end();
  }
  //   const reableStream = fs.createReadStream("plain.txt");
  //   reableStream.pipe(res);

  const readableStream = fs.createReadStream("plain.txt");
  const writeableStream = fs.createWriteStream("output.txt");
  //   readableStream.pipe(writeableStream);
  readableStream.on("data", (chunk) => {
    console.log(chunk);
    writeableStream.write(chunk);
  });
  res.end();
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`server is listening at ${port}`));
