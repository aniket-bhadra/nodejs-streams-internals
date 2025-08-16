# Node.js Streams 

## Why Streams?
**Problem:** to send large files to client or to copy large files to another files for any such operations Large files (16GB) load entirely into RAM → Server crashes 💥

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

### **Corrected Explanation (Keeping Your Original Tone)**  
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

