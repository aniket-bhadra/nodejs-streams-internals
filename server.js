const http = require("http");
const fs = require("fs");
const { Transform, pipeline } = require("stream");
const { error } = require("console");

// const server = http.createServer((req, res) => {
//   if (req.url !== "/") {
//     return res.end();
//   }
//   //   const reableStream = fs.createReadStream("plain.txt");
//   //   reableStream.pipe(res);

//   const readableStream = fs.createReadStream("plain.txt");
//   const writeableStream = fs.createWriteStream("output.txt");
//   //   readableStream.pipe(writeableStream);
//   readableStream.on("data", (chunk) => {
//     //process
//     const uppercaseString = chunk.toString().toUpperCase();
//     const final = uppercaseString.replaceAll(/ipsum/gi, "mycode");
//     //write
//     writeableStream.write(final);
//   });
//   res.end();
// });

const server = http.createServer((req, res) => {
  const replaceWordProcessing = new Transform({
    transform: (chunk, encoding, callback) => {
      const final = chunk.toString().replaceAll(/ipsum/gi, "geo");
      throw new Error("something is fishy!!!");
      callback(null, final);
      //it takes 1st argument error,2nd is the data
      //and whatever data we passed then converted to readable stream passed to next pipe argument
    },
  });
  const readableStream = fs.createReadStream("plain.txt");
  const writeableStream = fs.createWriteStream("output.txt");

  //   readableStream.pipe(replaceWordProcessing).pipe(writeableStream);
  pipeline(readableStream, replaceWordProcessing, writeableStream, (error) => {
    if (error) {
      console.log(error);
    }
  });
  res.end();
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`server is listening at ${port}`));
