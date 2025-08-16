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






### how to create custom streams?
