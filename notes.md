# Node.js Streams 

## Why Streams?
**Problem:** to send large files to client or to copy large files to another files for any such operations Large files first (16GB) load entirely into RAM → Server crashes 💥

**Solution:** Streams divide large files into small chunks → Process piece by piece → RAM stays safe ✅

---

## How Streams Work

### Without Streams (Bad)
```
16GB File → RAM (16GB used) → Server Crash 💥
```

### With Streams (Good)
```
16GB File → Small Chunks (64KB each) → Buffer (64KB only) → Process → Repeat
```

**RAM Usage:** Only 64KB instead of 16GB!

---

## Buffer - The Key Component

**Buffer = Reserved space in RAM (default 64KB)**

### Step-by-Step Process (How it Actually Works):

1. **Read stream starts** → reads chunk by chunk (64KB chunks)
2. **Chunks go to buffer** → buffer stores them temporarily  
3. **Buffer gets full** → read stream **automatically pauses**
4. **Write stream starts working** → takes all chunks from buffer and writes them
5. **Buffer becomes empty** → read stream **automatically resumes**
6. **Process repeats** until entire file is processed

### Visual Representation:
```
File (16GB) → [Read Stream] → [Buffer 64KB] → [Write Stream] → New File

Step 1: Read 64KB → Buffer [■■■■■■■■] (Full) → Read PAUSED
Step 2: Buffer [■■■■■■■■] → Write Stream processes → Buffer [□□□□□□□□] (Empty)
Step 3: Read RESUMES → Read 64KB → Buffer [■■■■■■■■] (Full again)
Step 4: Buffer [■■■■■■■■] → Write Stream processes → Buffer [□□□□□□□□] (Empty)
...continues until 16GB file complete
```

### What is Backpressure?
**Backpressure = Automatic pause/resume mechanism for read streams only**

- **When buffer is full** → upstream (read stream) **pauses**
- **When buffer is empty** → upstream (read stream) **resumes**
- **This prevents memory overflow** and keeps RAM usage minimal!

### Write Stream Behavior (Not Backpressure):
- **When buffer is empty** → write stream goes **idle** (waits for more data)
- **When buffer gets data** → write stream becomes **active** (starts writing)
- **Write streams don't pause** → they're always ready to write when data arrives

### Key Distinction:
| State | Read Stream | Write Stream | Is Backpressure? |
|-------|-------------|--------------|------------------|
| **Buffer Full** | **PAUSED** (forced stop) | Active (writing) | ✅ **YES** |
| **Buffer Empty** | **RESUMES** (can read again) | **IDLE** (waiting for data) | ❌ **NO** |

### Why it's important:

**Without Backpressure:**
- Read stream reads data super fast (maybe 100MB/sec)
- Write stream writes data slowly (maybe 10MB/sec)
- Data keeps piling up in memory faster than it can be written
- Memory usage keeps growing: 1GB → 2GB → 4GB → 8GB → 16GB
- Eventually RAM runs out → Server crashes

**With Backpressure:**
- Read stream reads fast until buffer is full (64KB)
- Read stream automatically stops/pauses
- Write stream catches up and empties the buffer
- Read stream resumes again
- Memory stays constant at 64KB only

**The Problem:** Fast producer + Slow consumer = Memory explosion
**The Solution:** Automatic pause mechanism keeps memory under control

---

## Sending Files to Client

### ❌ Bad Way (Loads entire file in RAM)
```javascript
const server = http.createServer((req, res) => {
  const file = fs.readFileSync("plain.txt"); // Loads entire file!
  return res.end(file);
});
```

### ✅ Good Way (Streams chunk by chunk)
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

### Method 2: Manual handling
```javascript
const readableStream = fs.createReadStream("input.txt");
const writableStream = fs.createWriteStream("output.txt");
readableStream.on("data", (chunk) => {
  writableStream.write(chunk);
});
```

---

## pipe() vs Manual write() - Key Differences

| Feature | pipe() | Manual write() |
|---------|--------|----------------|
| **Backpressure** | ✅ Auto handled | ❌ Manual coding needed |
| **Error handling** | ✅ Auto handled | ❌ Manual coding needed |
| **Stream closing** | ✅ Auto handled | ❌ Manual coding needed |
| **Code complexity** | ✅ Simple | ❌ Complex |
| **Use when** | 99% of cases | Need data transformation |

---

## Buffer Configuration

### Default Sizes
```javascript
// Both default to 64KB
fs.createReadStream()   // 64KB buffer
fs.createWriteStream()  // 64KB buffer
```

### Custom Buffer Sizes
```javascript
const readableStream = fs.createReadStream("file.txt", {
  highWaterMark: 1024 * 1024 // 1MB buffer
});

const writableStream = fs.createWriteStream("output.txt", {
  highWaterMark: 512 * 1024  // 512KB buffer
});
```

---

## Key Takeaways

1. **Streams prevent server crashes** by using small memory chunks
2. **Buffer automatically pauses/resumes** streams (backpressure)
3. **pipe() handles everything automatically** - use it!
4. **Default buffer size is 64KB** - customizable
5. **Perfect for large files, videos, audio** without memory issues

**Result:** Handle files of ANY size with minimal RAM usage! 🚀


So basically, buffers in Node.js always store data in binary format, and the default *highWaterMark* value (which controls the buffer's maximum capacity) is 64KB for streams, which we can change. A chunk is raw binary data that gets stored in the buffer, but when we *display* these chunks for debugging, we represent them in hexadecimal for human readability – internally though, it's always pure binary.

Regarding reading behavior: while the buffer might be configured for 64KB, Node.js doesn't necessarily read exactly 64KB chunks. It could read smaller pieces (like 1KB chunks) multiple times to fill the buffer gradually, or occasionally read larger blocks depending on the source. How Node.js physically retrieves these chunks depends entirely on its underlying architecture (libuv + OS-level I/O operations), which we can't directly observe or modify. We only control the buffer's *capacity* via *highWaterMark*, while the actual chunking mechanism, read sizes, and filling strategy are managed internally by Node.js based on system constraints and optimizations.

### **What is a Readable Stream?**  
Data comes in small chunks, either from a client through the network or when reading from a big file. Node.js fills the buffer until it reaches the `highWaterMark` limit. If the buffer gets full, it automatically pauses until the data is consumed (that’s backpressure kicking in).  

### **What is a Writable Stream?**  
A Writable Stream is where you send data out. Node.js takes data from the buffer (or directly from a Readable stream) and flows it chunk by chunk to destinations like writing to a file, sending HTTP responses, or saving to a database.  

### **Real Examples**  
**1. Streaming to HTTP Client:**  
```js
const server = http.createServer((req, res) => {
  const readableStream = fs.createReadStream("plain.txt");
  readableStream.pipe(res); // Streams directly to client
});
```  
Here, Node.js **takes data out chunk-by-chunk** from the readable stream’s buffer and sends it to the client through `res` (which is already a writable stream). No manual buffer management needed!  

**2. Copying Files:**  
```js
const readableStream = fs.createReadStream("input.txt");
const writableStream = fs.createWriteStream("output.txt");
readableStream.pipe(writableStream);
```  
Node.js **pulls data from the readable stream’s buffer** and writes it chunk-by-chunk into `output.txt` via the writable stream.  

### **Key Takeaway**  
To **transfer data chunk-by-chunk** (like sending HTTP responses, writing files, or saving to databases), you **always need a writable stream**. It’s the "drain pipe" that consumes data from buffers safely. Readable streams feed data *into* these pipes, and Node.js handles the flow automatically—including backpressure!  

---  

### **Why This Works**  
- **`pipe()` Method:** Automatically links the readable and writable streams.  
- **Backpressure Handling:** If the writable stream is busy, it signals the readable stream to pause. When ready, it resumes.  
- **Zero Manual Buffer Management:** Built-in streams (like `fs` or `http`) handle buffering/backpressure internally.  

 writable streams are the "exit door" for your data chunks! 🚪💨

### **Explanation**  
Alright, so here's the deal: when you're reading a **huge file** chunk by chunk and storing those chunks into a buffer (in RAM), that whole process is called a **readable stream**. It's like **loading data piece by piece** into a temporary holding area.  

Now, once that data is sitting in the buffer, you **take it out chunk by chunk** and do something with it—like sending it as an HTTP response to a client, writing each chunk to a new file, or saving it to a database. *That* process—the act of **pulling data out of the buffer and shipping it off**—is called a **writable stream**.  

So, **readable and writable streams aren't just data structures** (like a stack where you push and pop). They're the **actual processes**:  
- **Readable stream** = **Reading** chunks from a source → **storing** in a buffer.  
- **Writable stream** = **Grabbing** chunks from the buffer → **sending** them to a destination (client, file, etc.).  

It’s all about the **flow**:  
1. **Readable** feeds data *into* the buffer (like a faucet filling a sink).  
2. **Writable** drains data *out* of the buffer (like the sink’s drain pipe).  

And yeah, if the sink (buffer) fills up too fast? The faucet (readable) **pauses** until the drain (writable) catches up. That’s **backpressure**—and it keeps everything running smooth! 🚀
### how to create custom streams?
const { Readable } = require("stream");

const readableStream = new Readable({
  highWaterMark: 2,
  read: () => {},
});

console.log(readableStream.push("hey new data is pushed"));


So basically, when you create a custom readable stream in Node.js, and you manually push data into it, you must handle backpressure yourself—Node.js won’t do it for you automatically like it does with built-in streams (like fs.createReadStream). The highWaterMark just sets a soft limit, but if you ignore it and keep pushing data, the buffer will keep growing uncontrollably, which is bad for memory. To fix this, you have to check the return value of push()—if it returns false, it means the buffer is full (highWaterMark exceeded), and you must stop pushing data until the stream drains (i.e., data is consumed by a client or piped to a writable stream). Only then should you resume pushing. This is manual backpressure control, and if you don’t do it, your app could leak memory or crash under heavy loads. Built-in streams handle this automatically, but in custom streams, it’s your job to manage it properly by extending Readable and implementing the logic yourself.

### pipe(writable) or pipe(res)

When you do `readable.pipe(writable)` or `readable.pipe(res)`, Node handles everything silently. The readable stream sucks in data chunk by chunk - could be from a file, network, whatever. Those chunks then flow straight into your writable stream or HTTP response. If the output side gets clogged (slow disk, bad connection), the readable stream automatically stops pushing more data until things clear up. No manual backpressure checks, no memory explosions - it just works. The pipe() method sorts out all the messy details like chunk sizes and flow control behind your back. You set it and forget it. That's why we use pipe() - it's the lazy (smart) way to stream.

Key points:
- Automatic chunk management
- Built-in backpressure
- Zero manual flow control needed
- Works for files, HTTP, whatever
- Just pipe() and move on

Here's your corrected version with your original tone intact:

---

### **Transform Stream**  
It's for when you need to **read data, modify it, and write it back** - perfect for heavy processing between files/modules. You combine it with `pipe()` to make it smooth.

### **How It Works**  
1. **Readable Stream** → Feeds data in  
2. **Transform Stream** → Modifies chunks (replace text, uppercase, etc.)  
3. **Writable Stream** → Takes the processed data  

```js
const server = http.createServer((req, res) => {
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
});
```

### **Key Points**  
✅ **Pipe Chains**: You can stack multiple transforms (uppercase, add commas, etc.) before the final write.  
✅ **Auto-Managed**: Backpressure, chunking, and flow are handled automatically.  

### **Problem: Error Handling**  
If one transform fails, **later pipes keep running** → garbage data/memory leaks.  

#### **Fix 1: Manual Error Listeners (Tedious)**  
```js
readableStream
  .pipe(transform1).on("error", (e) => console.log(e))
  .pipe(transform2).on("error", (e) => console.log(e)) // Ugh...
  .pipe(writeableStream);
```

#### **Fix 2: Use `pipeline()` (Better)**  
```js
pipeline(
  readableStream,
  replaceWordProcessing, // Stops here if error
  writeableStream,
  (err) => err && console.log("Failed:", err) // One catch-all
);
```
**Answer to Your Q:**  
→ If `replaceWordProcessing` fails, `pipeline()` **automatically stops everything** and triggers the callback. No manual cleanup needed.  

### **Why `pipeline()` Wins**  
- **Kills the stream chain on error**  
- **No zombie pipes**  
- **Cleaner than manual listeners**  

Use it. The end. 🚀  

### Object Streams:

✅ Need `objectMode: true`  
✅ `highWaterMark` = object count (not bytes)  
✅ Works for JS objects only (no strings/buffers)  

```js
const objStream = new Readable({
  objectMode: true, // Required
  highWaterMark: 100, // Max objects in buffer
  read() {} 
});

objStream.push({data: 123}); // Push objects
objStream.pipe(writable); // Pipe out
```  

**Rules:**  
- Both streams need `objectMode`  
- Faster than string conversion  

### When we do `readable.pipe(writableStream)` or `readable.pipe(res)`, how does `pipe` know whether it has to write to a file or send an HTTP response? How does `pipe` determine this?

`pipe()` **doesn't need to know** what the writable stream does. It just blindly pumps chunks into it.  

- **If `writable` is a file stream** → Chunks get written to disk  
- **If `writable` is `res` (HTTP)** → Chunks become HTTP response body  
- **If `writable` is a database** → Chunks get inserted  

```js
readable.pipe(anything_writable); // pipe() doesn't care what "anything_writable" is
```  

- **`pipe()`** just pushes chunks into the writable stream.  
- **The writable stream itself** decides what happens to those chunks:  
  - `res` → Sends HTTP response  
  - File stream → Writes to disk  
  - DB stream → Saves to database  

```js
readable.pipe(writable); // pipe() just pushes
```  

**Key Confirmation:**  
- The behavior **is defined when the writable stream is created** (not by `pipe`).  
- Example:  
  ```js
  const httpWritable = res; // Already configured to send HTTP
  const fileWritable = fs.createWriteStream(); // Already configured to write files
  ```  

No extra logic. Just streams doing their jobs. 🚀  

process.stdin - This is indeed a readable stream. 
process.stdout - This is a writable stream.
console.log() - under the hood it uses process.stdout (and process.stderr for error messages) to output data to the console. When you call console.log(), it's essentially writing to the stdout stream. 

### extra
There is 2 types of streaming 
File Streaming (HTTP Progressive)
Http live streaming

- File Streaming 
Readable stream reads 64KB chunk from the 1GB video and stores it to buffer, then once buffer is full immediately pipes that 64KB to writable stream (res). Writable stream immediately sends that 64KB to the client over HTTP, meanwhile since buffer is empty readable stream reads the NEXT 64KB chunk. Process repeats until entire video is transferred.
If the writable stream is created for writing file then instead of sending that 64kb to http response it writes that 64kb to that new file, if that writable stream is created for storing data in db that 64kb is stored to that db. This way Server memory usage: Only ~64KB at any time (not 1GB!) Client starts receiving data immediately.
It's not about buffer being full or empty - it's about processing speed mismatch:
Writable stream slower → Readable stream pauses
Readable stream slower → Writable stream waits
The buffer acts as a small temporary storage between them, but the pausing/waiting happens based on who can't keep up with the pace.
Then why we need buffer?
1. Streams need Buffer objects to handle binary data - you can't stream raw file bytes directly.
2. Buffer provides consistent 64KB chunks and reuses the same memory space instead of creating new memory for each chunk.

### Does stream breaks the http rule of 1 req = 1 res since it sending multiple chunk datas for 1 req?
1 request = 1 response, but that 1 response body is chunked into multiple pieces. When a client sends an HTTP request, the server first sends response headers including Transfer-Encoding: chunked, then delivers the response body in multiple chunks (typically 64KB each) while keeping the connection open. The connection only closes after all chunks are sent. This means it's 1 req → 1 response (with chunked body), not 1 req → multiple responses. The response itself is single, just the body content is delivered piece by piece. The Transfer-Encoding: chunked header tells the client "hey, expect the body to come in chunks, don't close connection until I'm done sending all pieces."

File Streaming (HTTP Progressive):
Stream pre-existing files to client in chunks
Different encodings (360p, 480p, 720p, 1080p) already exist on server
Client requests specific quality, server streams that file
