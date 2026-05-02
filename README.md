# Node.js Streams Complete Guide

## Table of Contents

1. [Why Streams?](#why-streams)
2. [How Streams Work](#how-streams-work)
   - [Without Streams (Bad)](#without-streams-bad)
   - [With Streams (Good)](#with-streams-good)
3. [Buffer: The Key Component](#buffer-the-key-component)
   - [Step-by-Step Process](#step-by-step-process)
   - [Visual Representation](#visual-representation)
   - [What Is Backpressure?](#what-is-backpressure)
   - [Write Stream Behavior (Not Backpressure)](#write-stream-behavior-not-backpressure)
   - [Key Distinction](#key-distinction)
   - [Why Backpressure Is Important](#why-backpressure-is-important)
4. [Sending Files to Client](#sending-files-to-client)
   - [Bad Way: Loads the Entire File into RAM](#bad-way-loads-the-entire-file-into-ram)
   - [Good Way: Streams Chunk by Chunk](#good-way-streams-chunk-by-chunk)
5. [Copying Large Files](#copying-large-files)
   - [Method 1: Using pipe() (Recommended)](#method-1-using-pipe-recommended)
   - [Method 2: Manual Handling](#method-2-manual-handling)
6. [pipe() vs Manual write(): Key Differences](#pipe-vs-manual-write-key-differences)
7. [Buffer Configuration](#buffer-configuration)
   - [Default Sizes](#default-sizes)
   - [Custom Buffer Sizes](#custom-buffer-sizes)
8. [Key Takeaways](#key-takeaways)
9. [Buffers, Chunks and highWaterMark](#buffers-chunks-and-highwatermark)
10. [What Is a Readable Stream?](#what-is-a-readable-stream)
11. [What Is a Writable Stream?](#what-is-a-writable-stream)
12. [How Readable and Writable Streams Work Together](#how-readable-and-writable-streams-work-together)
    - [Real Examples](#real-examples)
    - [Why This Works](#why-this-works)
13. [How to Create Custom Streams](#how-to-create-custom-streams)
14. [How pipe() Works](#how-pipe-works)
    - [How Does pipe() Know Where to Write?](#how-does-pipe-know-where-to-write)
    - [process.stdin, process.stdout and console.log()](#processstdin-processstdout-and-consolelog)
15. [Transform Streams](#transform-streams)
    - [How It Works](#how-it-works)
    - [Key Points](#key-points)
    - [Problem: Error Handling](#problem-error-handling)
    - [Fix 1: Manual Error Listeners (Tedious)](#fix-1-manual-error-listeners-tedious)
    - [Fix 2: Use pipeline() (Better)](#fix-2-use-pipeline-better)
    - [Why pipeline() Wins](#why-pipeline-wins)
16. [Object Streams](#object-streams)
17. [Async Iteration with for await...of](#async-iteration-with-for-awaitof)
18. [Types of Streaming](#types-of-streaming)
    - [File Streaming (HTTP Progressive)](#file-streaming-http-progressive)
    - [Does Streaming Break the HTTP Rule of 1 Request = 1 Response?](#does-streaming-break-the-http-rule-of-1-request--1-response)
    - [HTTP Live Streaming](#http-live-streaming)

---

## Why Streams?

**Problem:** To send large files to a client, or to copy large files to another file, or for any such operation, large files (say 16GB) first get loaded entirely into RAM → Server crashes 💥

**Solution:** Streams divide large files into small chunks → Process piece by piece → RAM stays safe ✅

---

## How Streams Work

### Without Streams (Bad)

```
16GB File → RAM (16GB used) → Server Crash 💥
```

### With Streams (Good)

```
16GB File → Small Chunks (64KB each) → Buffer (small) → Process → Repeat
```

**RAM Usage:** Only a few KB instead of 16GB!

---

## Buffer: The Key Component

**Buffer = Reserved space in RAM that holds chunks temporarily.**

Both the readable and the writable stream have their **own internal buffer**, and each has a size limit called `highWaterMark`:

- `fs.createReadStream()` → default `64KB`
- `fs.createWriteStream()` → default `16KB`

### Step-by-Step Process

(How it actually works with `pipe()`)

1. **Read stream starts** → reads the file chunk by chunk (up to 64KB at a time) into its buffer
2. **`pipe()` takes each chunk** and calls `writable.write(chunk)`
3. If the writable is fast, its buffer has room → `write()` returns `true` → data keeps flowing
4. If the writable is slow, its buffer reaches its limit → `write()` returns `false` → `pipe()` **pauses the read stream**
5. **Write stream finishes writing** the buffered data to the destination → buffer is drained → it emits a **`drain`** event → `pipe()` **resumes the read stream**
6. **Process repeats** until the entire file is processed, then `pipe()` calls `writable.end()`

### Visual Representation

```
File (16GB) → [Read Stream + buffer] → [Write Stream + buffer] → New File

Step 1: Read chunk → write(chunk) → writable buffer has room → returns true (keep going)
Step 2: Writable buffer reaches its limit → write() returns false → Read PAUSED
Step 3: Write stream writes to disk → buffer drained → 'drain' event → Read RESUMES
Step 4: Read next chunk → ...
...continues until 16GB file complete
```

### What Is Backpressure?

**Backpressure = the slow consumer (writable) tells the fast producer (readable) to pause, and to resume once it has caught up.**

- **When the writable's buffer is full** → upstream (read stream) **pauses**
- **When the writable's buffer is drained** → upstream (read stream) **resumes**
- **This prevents memory overflow** and keeps RAM usage minimal!

### Write Stream Behavior (Not Backpressure)

- **When its buffer is empty** → write stream goes **idle** (waits for more data)
- **When data arrives** → write stream becomes **active** (starts writing)
- **Write streams don't pause themselves** → they're always ready to write when data arrives

### Key Distinction

| State                       | Read Stream                  | Write Stream                | Is Backpressure?                     |
| --------------------------- | ---------------------------- | --------------------------- | ------------------------------------ |
| **Writable buffer full**    | **PAUSED** (forced to stop)  | Active (busy writing)       | ✅ **YES**                           |
| **Writable buffer drained** | **RESUMES** (can read again) | **IDLE** (waiting for data) | ❌ **NO** (backpressure is released) |

### Why Backpressure Is Important

**Without Backpressure:**

- Read stream reads data super fast (maybe 100MB/sec)
- Write stream writes data slowly (maybe 10MB/sec)
- Data keeps piling up in memory faster than it can be written
- Memory usage keeps growing: 1GB → 2GB → 4GB → 8GB → 16GB
- Eventually RAM runs out → Server crashes

**With Backpressure:**

- Read stream reads fast until the writable's buffer is full
- Read stream automatically stops/pauses
- Write stream catches up and empties the buffer
- Read stream resumes again
- Memory stays small and constant

**The Problem:** Fast producer + Slow consumer = Memory explosion
**The Solution:** Automatic pause mechanism keeps memory under control

---

## Sending Files to Client

### Bad Way: Loads the Entire File into RAM

```javascript
const server = http.createServer((req, res) => {
  const file = fs.readFileSync("plain.txt"); // Loads entire file!
  return res.end(file);
});
```

### Good Way: Streams Chunk by Chunk

```javascript
const server = http.createServer((req, res) => {
  const readableStream = fs.createReadStream("plain.txt");
  readableStream.pipe(res); // Streams directly to client
});
```

---

## Copying Large Files

### Method 1: Using pipe() (Recommended)

```javascript
const readableStream = fs.createReadStream("input.txt");
const writableStream = fs.createWriteStream("output.txt");
readableStream.pipe(writableStream);
```

### Method 2: Manual Handling

```javascript
const readableStream = fs.createReadStream("input.txt");
const writableStream = fs.createWriteStream("output.txt");

readableStream.on("data", (chunk) => {
  // write() returns false when the writable's buffer is full
  if (!writableStream.write(chunk)) {
    readableStream.pause(); // stop reading (backpressure)
    writableStream.once("drain", () => readableStream.resume()); // continue when drained
  }
});

readableStream.on("end", () => writableStream.end()); // close the writable
```

If you only write `writableStream.write(chunk)` inside the `data` event (without the `pause`/`drain`/`end` code above), there is **no backpressure** and the writable is never closed, so the buffer can keep growing in memory.

---

## pipe() vs Manual write(): Key Differences

| Feature             | pipe()                                             | Manual write()               |
| ------------------- | -------------------------------------------------- | ---------------------------- |
| **Backpressure**    | ✅ Auto handled                                    | ❌ Manual coding needed      |
| **Stream closing**  | ✅ Calls `end()` on the writable when done         | ❌ Manual coding needed      |
| **Error handling**  | ❌ Errors are **not** forwarded (use `pipeline()`) | ❌ Manual coding needed      |
| **Code complexity** | ✅ Simple                                          | ❌ Complex                   |
| **Use when**        | Most cases                                         | You need very custom control |

---

## Buffer Configuration

### Default Sizes

```javascript
fs.createReadStream(); // 64KB buffer (highWaterMark)
fs.createWriteStream(); // 16KB buffer (highWaterMark)
```

(Most other streams, like custom ones, `http` request/response, etc., default to 16KB. In object mode the default is 16 objects.)

### Custom Buffer Sizes

```javascript
const readableStream = fs.createReadStream("file.txt", {
  highWaterMark: 1024 * 1024, // 1MB buffer
});

const writableStream = fs.createWriteStream("output.txt", {
  highWaterMark: 512 * 1024, // 512KB buffer
});
```

---

## Key Takeaways

1. **Streams prevent server crashes** by using small memory chunks
2. **Backpressure automatically pauses/resumes** the readable stream
3. **pipe() handles flow control automatically** - but use `pipeline()` when you also want proper error handling
4. **Default buffer size** is 64KB for `fs` read streams and 16KB for `fs` write streams - customizable with `highWaterMark`
5. **Perfect for large files, videos, audio** without memory issues

**Result:** Handle files of ANY size with minimal RAM usage! 🚀

---

## Buffers, Chunks and highWaterMark

So basically, buffers in Node.js always store data in binary format. `highWaterMark` controls the buffer's size limit (64KB for `fs` read streams, 16KB for most other streams), which we can change. It is a threshold, not a hard cap: when the buffered data reaches it, the stream signals "stop sending more". A chunk is raw binary data that gets stored in the buffer (a `Buffer` object), but when we _display_ these chunks for debugging, we see them in hexadecimal for human readability – internally though, it's always pure binary. (If you set an `encoding`, like `"utf8"`, the chunks come as strings instead.)

Regarding reading behavior: for a file stream, Node.js reads up to `highWaterMark` bytes per read (the last chunk is usually smaller), while for network streams the chunk size is whatever data arrives. How Node.js physically retrieves these chunks depends on its underlying architecture (libuv + OS-level I/O operations), which we can't directly observe or modify. We only control the buffer's _capacity_ via `highWaterMark`, while the actual read sizes and filling strategy are managed internally by Node.js.

---

## What Is a Readable Stream?

Data comes in small chunks, either from a client through the network or when reading from a big file. Node.js fills the readable stream's buffer until it reaches the `highWaterMark` limit. If the buffer gets full, it stops reading from the source until the data is consumed (that's backpressure kicking in).

---

## What Is a Writable Stream?

A Writable Stream is where you send data out. Node.js takes chunks (from a Readable stream, or when you call `write()`) and flows them one by one to destinations like writing to a file, sending HTTP responses, or saving to a database.

---

## How Readable and Writable Streams Work Together

### Real Examples

**1. Streaming to HTTP Client:**

```js
const server = http.createServer((req, res) => {
  const readableStream = fs.createReadStream("plain.txt");
  readableStream.pipe(res); // Streams directly to client
});
```

Here, Node.js **takes data out chunk-by-chunk** from the readable stream and sends it to the client through `res` (which is already a writable stream). No manual buffer management needed!

**2. Copying Files:**

```js
const readableStream = fs.createReadStream("input.txt");
const writableStream = fs.createWriteStream("output.txt");
readableStream.pipe(writableStream);
```

Node.js **pulls data from the readable stream** and writes it chunk-by-chunk into `output.txt` via the writable stream.

**Key Takeaway:** To **transfer data chunk-by-chunk** (like sending HTTP responses, writing files, or saving to databases), you **always need a writable stream**. It's the "drain pipe" that consumes data safely. Readable streams feed data _into_ these pipes, and Node.js handles the flow automatically—including backpressure!

### Why This Works

- **`pipe()` Method:** Automatically links the readable and writable streams.
- **Backpressure Handling:** If the writable stream is busy (its buffer is full), `pipe()` pauses the readable stream. When the writable is ready again, it resumes.
- **Zero Manual Buffer Management:** Built-in streams (like `fs` or `http`) handle buffering/backpressure internally.

Alright, so here's the deal: when you're reading a **huge file** chunk by chunk and holding those chunks in a buffer (in RAM), that whole process is the **readable stream**. It's like **loading data piece by piece** into a temporary holding area.

Then those chunks are **taken out one by one** and shipped somewhere—like sending them as an HTTP response to a client, writing each chunk to a new file, or saving to a database. _That_ process is the **writable stream**.

So, **readable and writable streams aren't just data structures** (like a stack where you push and pop). They're the **actual processes**:

- **Readable stream** = **Reading** chunks from a source → **holding** them in its buffer.
- **Writable stream** = **Receiving** chunks → **sending** them to a destination (client, file, etc.).

It's all about the **flow**:

1. **Readable** feeds data _in_ (like a faucet filling a sink).
2. **Writable** drains data _out_ (like the sink's drain pipe).

And yeah, if the sink fills up too fast? The faucet (readable) **pauses** until the drain (writable) catches up. That's **backpressure**—and it keeps everything running smooth! 🚀

Writable streams are the "exit door" for your data chunks! 🚪💨

---

## How to Create Custom Streams

```js
const { Readable } = require("stream");

const readableStream = new Readable({
  highWaterMark: 2,
  read() {}, // called when the consumer wants more data (we push manually here)
});

console.log(readableStream.push("hey new data is pushed")); // false → buffer is over highWaterMark
```

So basically, when you create a custom readable stream in Node.js and you manually push data into it, you have to respect backpressure yourself—Node.js can't stop your own code from calling `push()`. The `highWaterMark` just sets a soft limit, but if you ignore it and keep pushing data, the buffer will keep growing, which is bad for memory. To handle this, check the return value of `push()`: if it returns `false`, the buffer is full (`highWaterMark` reached), and you should stop pushing until Node.js calls `read()` again (meaning the data was consumed by a client or piped to a writable stream).

The easiest way is to push data **inside the `read()` method**, because Node.js calls `read()` only when the consumer is ready for more data:

```js
const { Readable } = require("stream");

let i = 0;
const counter = new Readable({
  read() {
    i++;
    if (i > 5) return this.push(null); // null = no more data (end of stream)
    this.push(`line ${i}\n`);
  },
});

counter.pipe(process.stdout);
```

Built-in streams (like `fs.createReadStream`) handle this for you internally; in custom streams, it's your job to manage it by extending `Readable` and implementing the logic properly.

---

## How pipe() Works

When you do `readable.pipe(writable)` or `readable.pipe(res)`, Node handles the flow for you. The readable stream pulls data chunk by chunk (from a file, network, whatever). Those chunks then flow straight into your writable stream or HTTP response. If the output side gets clogged (slow disk, bad connection), `pipe()` pauses the readable stream until things clear up. No manual backpressure checks, no memory explosions. That's why we use `pipe()` - it's the simple way to stream.

Key points:

- Automatic flow control (backpressure)
- Automatically calls `end()` on the writable when the readable finishes
- Works for files, HTTP, whatever
- Does **not** handle errors for you (if a stream in the chain fails, the other streams are not closed), that's why we use `pipeline()` for important work

### How Does pipe() Know Where to Write?

When we do `readable.pipe(writableStream)` or `readable.pipe(res)`, how does `pipe` know whether it has to write to a file or send an HTTP response?

`pipe()` **doesn't need to know** what the writable stream does. It just calls `writable.write(chunk)` for every chunk (and `writable.end()` at the end).

- **If `writable` is a file stream** → Chunks get written to disk
- **If `writable` is `res` (HTTP)** → Chunks become HTTP response body
- **If `writable` is a custom stream that talks to a database** → Chunks get inserted

```js
readable.pipe(anything_writable); // pipe() doesn't care what "anything_writable" is
```

- **`pipe()`** just pushes chunks into the writable stream.
- **The writable stream itself** decides what happens to those chunks.

The behavior **is defined when the writable stream is created** (not by `pipe`):

```js
const httpWritable = res; // Already configured to send HTTP
const fileWritable = fs.createWriteStream("out.txt"); // Already configured to write files
```

No extra logic. Just streams doing their jobs. 🚀

### process.stdin, process.stdout and console.log()

- `process.stdin` - This is a readable stream.
- `process.stdout` - This is a writable stream.
- `console.log()` - under the hood it uses `process.stdout` (and `process.stderr` for `console.error`) to output data to the console. When you call `console.log()`, it's essentially writing to the stdout stream.

---

## Transform Streams

It's for when you need to **read data, modify it, and write it back** - perfect for heavy processing between files/modules. You combine it with `pipe()` (or `pipeline()`) to make it smooth.

### How It Works

1. **Readable Stream** → Feeds data in
2. **Transform Stream** → Modifies chunks (replace text, uppercase, etc.)
3. **Writable Stream** → Takes the processed data

```js
const { Transform } = require("stream");

const replaceWordProcessing = new Transform({
  transform(chunk, encoding, callback) {
    const final = chunk.toString().replaceAll(/ipsum/gi, "geo"); // Process data
    callback(null, final); // Pass to next pipe (null = no error)
  },
});

const readableStream = fs.createReadStream("plain.txt");
const writeableStream = fs.createWriteStream("output.txt");

readableStream
  .pipe(replaceWordProcessing) // Apply transformation
  .pipe(writeableStream); // Write to file
```

⚠️ Note: a chunk is just a piece of bytes, so a word (like "ipsum") can be split between two chunks and won't be replaced, and a multi-byte character can also be cut in the middle. For real text processing, handle the leftover/partial data between chunks (or process by lines).

### Key Points

✅ **Pipe Chains**: You can stack multiple transforms (uppercase, add commas, etc.) before the final write.
✅ **Auto-Managed**: Backpressure, chunking, and flow are handled automatically.

### Problem: Error Handling

If one stream in a `pipe()` chain fails, **the other streams are not closed or cleaned up** (`pipe()` doesn't forward errors) → the remaining streams stay open, file handles leak, and the output file may be left half-written.

### Fix 1: Manual Error Listeners (Tedious)

```js
readableStream
  .pipe(transform1)
  .on("error", (e) => console.log(e))
  .pipe(transform2)
  .on("error", (e) => console.log(e)) // Ugh...
  .pipe(writeableStream);
```

Even then, you still have to manually `destroy()` the other streams.

### Fix 2: Use pipeline() (Better)

```js
const { pipeline } = require("stream");

pipeline(
  readableStream,
  replaceWordProcessing, // Stops here if error
  writeableStream,
  (err) => err && console.log("Failed:", err), // One catch-all
);
```

**Answer to Your Q:**
→ If `replaceWordProcessing` fails, `pipeline()` **automatically destroys all the streams** and triggers the callback. No manual cleanup needed.

There is also a promise version, which works nicely with `async/await`:

```js
const { pipeline } = require("stream/promises");

try {
  await pipeline(readableStream, replaceWordProcessing, writeableStream);
} catch (err) {
  console.log("Failed:", err);
}
```

### Why pipeline() Wins

- **Destroys every stream in the chain on error**
- **No zombie pipes / leaked file handles**
- **Cleaner than manual listeners**

Use it. The end. 🚀

---

## Object Streams

✅ Need `objectMode: true`
✅ `highWaterMark` = number of objects (not bytes), default is 16
✅ Can carry any JS value (objects, arrays, numbers, strings), except `null` (`null` means end of stream)

```js
const { Readable, Writable } = require("stream");

const objStream = new Readable({
  objectMode: true, // Required
  highWaterMark: 100, // Max objects in buffer
  read() {},
});

const printer = new Writable({
  objectMode: true, // The receiving side needs it too
  write(obj, encoding, callback) {
    console.log(obj.data);
    callback();
  },
});

objStream.pipe(printer); // Pipe out
objStream.push({ data: 123 }); // Push objects
objStream.push(null); // End
```

**Rules:**

- The stream that receives the objects also needs `objectMode` (a Transform can use `readableObjectMode` / `writableObjectMode` separately)
- No need to convert objects to strings/JSON between streams

---

## Async Iteration with for await...of

Readable streams are **async iterables**, so you can read them with `for await...of` instead of `on("data")`:

```js
const fs = require("fs");

async function main() {
  const readable = fs.createReadStream("plain.txt", { encoding: "utf8" });

  try {
    for await (const chunk of readable) {
      console.log("chunk length:", chunk.length);
    }
    console.log("done");
  } catch (err) {
    console.log("Failed:", err); // stream errors are thrown here
  }
}

main();
```

- The loop pulls one chunk at a time, so the stream isn't read faster than your loop body finishes (backpressure is handled automatically).
- Errors from the stream are thrown inside the loop, so a normal `try/catch` works.
- If you `break` out of the loop, the stream is destroyed automatically.

---

## Types of Streaming

There are 2 types of streaming:

1. File Streaming (HTTP Progressive)
2. HTTP Live Streaming

### File Streaming (HTTP Progressive)

Stream pre-existing files to the client in chunks. Different encodings (360p, 480p, 720p, 1080p) already exist on the server. The client requests a specific quality, and the server streams that file.

How it works: the readable stream reads a 64KB chunk from the 1GB video and holds it in its buffer, then `pipe()` passes that chunk to the writable stream (`res`). The writable stream sends that 64KB to the client over HTTP, meanwhile the readable stream reads the NEXT 64KB chunk. The process repeats until the entire video is transferred.

If the writable stream is created for writing a file, then instead of sending that 64KB to an HTTP response it writes that 64KB to the new file, and if that writable stream is created for storing data in a DB, that 64KB is stored in that DB. This way server memory usage: only a few chunks at any time (not 1GB!) and the client starts receiving data immediately.

It's not only about the buffer being full or empty - it's about the processing speed mismatch:

- Writable stream slower → Readable stream pauses
- Readable stream faster/slower → the writable simply waits (idle) when there is no data

The buffer acts as small temporary storage between them, but the pausing/waiting happens based on who can't keep up with the pace.

**Then why do we need a buffer?**

1. Streams move raw bytes, and a `Buffer` is how Node.js holds binary data in memory (file bytes are not text).
2. It absorbs small differences in speed between the producer and the consumer, so neither has to wait for the other on every single chunk.

For video, browsers also send **Range requests** (`Range: bytes=...`) and the server answers with `206 Partial Content`, so the player can jump (seek) to any part of the video without downloading everything before it.

### Does Streaming Break the HTTP Rule of 1 Request = 1 Response?

1 request = 1 response, but that 1 response body is sent in multiple pieces. When a client sends an HTTP request, the server first sends the response headers including `Transfer-Encoding: chunked` (used by HTTP/1.1 when the total size isn't known up front, like when you `pipe()` a stream to `res`), then delivers the response body in multiple chunks (each `write` becomes a chunk). When the last chunk (a zero-length one) is sent, the response is complete (the connection itself can then stay open for the next request with keep-alive). This means it's 1 req → 1 response (with a chunked body), not 1 req → multiple responses. The response itself is single, just the body content is delivered piece by piece. The `Transfer-Encoding: chunked` header tells the client "hey, expect the body to come in chunks, the response is complete when I send the final empty chunk."

(In HTTP/2, there is no `Transfer-Encoding: chunked`; the body is sent as data frames, but the idea is the same.)

### HTTP Live Streaming

File Streaming:

```
1GB_movie.mp4 → [64KB] → [64KB] → [64KB] → Reassemble into 1GB_movie.mp4
```

Live Streaming (HLS, DASH):

```
Live_feed → [Segment1 (2-10 sec)] → [Segment2] → [Segment3] → each one is played separately
            (each segment is available in 360p/480p/720p/1080p, the client picks one per segment)
```

Smooth Live Streaming: the client downloads Segment1, Segment2, Segment3 FIRST. Then plays Segment1 while downloading Segment4. This prevents freezing if the next segment downloads slowly.

- File chunks = pieces of the same file
- Live segments = separate mini-videos (each one is a normal file the client can play by itself)

**HTTP Live Streaming Process:**

1. Live camera → video
2. Encoder stores the feed in a buffer
3. Buffer full → encoder creates multi-quality segments (360p/480p/720p/1080p) for the same 2-10 sec chunk
4. Segments saved to storage
5. Manifest file (`.m3u8`) updates with new segment URLs (it lists only the latest few segments)
6. Client requests the manifest
7. Client checks network speed → downloads the matching quality segment
8. Client plays the segment while downloading the next
9. Repeat forever

- Client network slow → switches to a LOWER quality for the next segment
- Client network fast → switches to a HIGHER quality

Each segment and each manifest refresh is a normal HTTP request with its own normal response (1 req = 1 res), so unlike file streaming, live streaming doesn't need a long-lived chunked response.

Client: starts playing quickly while downloading the next segments.

**Handling slow parts:**

- Encoder too slow → the live feed can drop frames
- Client too slow → the player switches to lower quality, and if it still can't keep up it buffers (waits) before playing
