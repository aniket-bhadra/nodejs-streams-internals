const { Readable, Writable } = require("stream");

const readableStream = new Readable({
  highWaterMark: 100,
  read: () => {},
});

const writable = new Writable({
  write: (s) => {
    console.log(`inside wirte method-- ${s.toString()}`);
  },
});

readableStream.on("data", (chunk) => {
   res.send(chunk);
});

console.log(`space left-- ${readableStream.push("hey new data is pushed")}`);
