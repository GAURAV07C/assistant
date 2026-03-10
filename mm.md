# JARVIS Memory System - Detailed Documentation

## Table of Contents
1. [Overview](#overview)
2. [Memory Architecture](#memory-architecture)
3. [Types of Memory](#types-of-memory)
4. [How Memory Works](#how-memory-works)
5. [Data Flow](#data-flow)
6. [Configuration](#configuration)
7. [Storage Locations](#storage-locations)
8. [Retrieval Process](#retrieval-process)
9. [Persistence](#persistence)
10. [Limitations](#limitations)

---

## Overview

JARVIS uses a **multi-layer hybrid memory system** that combines:
- **In-memory storage** (fast access for active sessions)
- **Vector storage** (semantic search for past conversations)
- **Disk persistence** (permanent storage for sessions)

This system allows JARVIS to remember conversations from the past, even years later, and retrieve relevant information when asked.

---

## Memory Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER QUESTION                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VECTOR STORE (FAISS)                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Semantic Search - Find relevant chunks based on meaning        │   │
│  │  (not just keyword matching)                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RETRIEVED CONTEXT                                   │
│  - Top 10 most similar chunks                                          │
│  - From learning data + past conversations                              │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BUILD PROMPT                                        │
│  - JARVIS personality                                                   │
│  - Current date/time                                                   │
│  - Retrieved context chunks                                             │
│  - Chat history (last 20 turns)                                        │
│  - Mode addendum                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GROQ LLM                                            │
│  - Generate response using context                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE + SAVE                                     │
│  - Save to in-memory session                                           │
│  - Persist to disk (JSON file)                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Types of Memory

### 1. Short-Term Memory (Active Session)

**Location:** `app/services/chat_service.py`

```python
self.sessions: Dict[str, List[ChatMessage]] = {}
```

- Stores currently active conversations in RAM
- Fast access (dictionary lookup)
- Ephemeral - lost if server crashes (but saved periodically)
- Each session contains list of ChatMessage objects

```python
# Example structure
{
    "uuid-123": [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi! How can I help?"},
        {"role": "user", "content": "My name is Rahul"},
        {"role": "assistant", "content": "Nice to meet you, Rahul!"}
    ]
}
```

### 2. Long-Term Memory (Vector Store)

**Location:** `app/services/vector_store.py`

Uses:
- **FAISS** (Facebook AI Similarity Search) for vector storage
- **HuggingFace Embeddings** (sentence-transformers/all-MiniLM-L6-v2) for text-to-vector conversion

**What gets stored:**
- Learning data from `database/learning_data/*.txt`
- Past conversations from `database/chats_data/*.json`

**How it works:**
1. Text is split into chunks (1000 characters with 200 overlap)
2. Each chunk is converted to a 384-dimensional vector
3. Vectors are stored in FAISS index
4. Similarity search finds relevant chunks for any query

### 3. Persistent Storage (Disk)

**Locations:**
- `database/chats_data/` - Conversation history
- `database/learning_data/` - User's knowledge base
- `database/vector_store/` - FAISS index

---

## How Memory Works

### Step 1: Startup (Server Start)

```python
# app/main.py - lifespan function
vector_store_service = VectorStoreService()
vector_store_service.create_vector_store()
```

This:
1. Loads all `.txt` files from `database/learning_data/`
2. Loads all `.json` files from `database/chats_data/`
3. Splits documents into chunks
4. Creates embeddings for each chunk
5. Builds FAISS index
6. Saves index to disk

### Step 2: User Sends Message

```python
# app/services/chat_service.py
session_id = chat_service.get_or_create_session(session_id)
chat_service.add_message(session_id, "user", user_message)
```

### Step 3: Context Retrieval (RAG)

```python
# app/services/groq_service.py
retriever = self.vector_store_service.get_retriever(k=10)
context_docs = retriever.invoke(question)
```

The retriever:
1. Converts user question to embedding
2. Searches FAISS for top-10 similar chunks
3. Returns Document objects with page_content and metadata

### Step 4: Build Prompt with Context

```python
# app/services/groq_service.py - _build_prompt_and_messages()
system_message = JARVIS_SYSTEM_PROMPT
system_message += f"\n\nCurrent time and date: {time_info}"
system_message += f"\n\nRelevant context from your learning data and past conversations:\n{context}"
system_message += f"\n\n{mode_addendum}"
```

### Step 5: Generate Response

The LLM receives:
- JARVIS's personality
- Current time/date
- Retrieved context chunks
- Chat history (last 20 turns)
- Mode-specific instructions

### Step 6: Save Conversation

```python
# app/services/chat_service.py
chat_service.add_message(session_id, "assistant", response)
chat_service.save_chat_session(session_id)
```

During streaming, saves every 5 chunks.

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         STARTUP                                          │
│                                                                          │
│  learning_data/*.txt ──► Chunk ──► Embed ──► FAISS Index              │
│  chats_data/*.json   ──► Chunk ──► Embed ──► FAISS Index              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     QUESTION TIME                                         │
│                                                                          │
│  User Question                                                           │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────┐      ┌─────────────┐                                  │
│  │  Embed      │ ───► │  FAISS      │                                  │
│  │  Question   │      │  Search     │                                  │
│  └─────────────┘      └─────────────┘                                  │
│       │                       │                                         │
│       │                       ▼                                         │
│       │              ┌─────────────────────┐                           │
│       │              │  Top 10 Chunks     │                           │
│       │              │  - Learning data   │                           │
│       │              │  - Past chats      │                           │
│       │              └─────────────────────┘                           │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────┐                       │
│  │           BUILD PROMPT                        │                       │
│  │  - System personality                        │                       │
│  │  - Time/date                                 │                       │
│  │  - Retrieved context                         │                       │
│  │  - Chat history (20 turns)                  │                       │
│  │  - Mode addendum                             │                       │
│  └─────────────────────────────────────────────┘                       │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────┐                       │
│  │           GROQ LLM                           │                       │
│  │           Generate Response                  │                       │
│  └─────────────────────────────────────────────┘                       │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────┐                       │
│  │           SAVE TO DISK                       │                       │
│  │  - In-memory session                         │                       │
│  │  - JSON file (database/chats_data/)         │                       │
│  └─────────────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration

**File:** `config.py`

```python
# Vector Store Settings
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE = 1000          # Characters per chunk
CHUNK_OVERLAP = 200       # Overlap between chunks

# Chat History Settings
MAX_CHAT_HISTORY_TURNS = 20  # Max user-assistant pairs sent to LLM
MAX_MESSAGE_LENGTH = 32_000  # Max characters per message

# Directory Settings
LEARNING_DATA_DIR = BASE_DIR / "database" / "learning_data"
CHATS_DATA_DIR = BASE_DIR / "database" / "chats_data"
VECTOR_STORE_DIR = BASE_DIR / "database" / "vector_store"
```

---

## Storage Locations

### Learning Data
```
database/learning_data/
├── system_context.txt    # System instructions
├── userdata.txt         # User personal info
├── usersinterest.txt    # User interests
└── *.txt               # Any other text files
```

### Chat History
```
database/chats_data/
├── chat_a1b2c3d4e5f6.json    # Session 1
├── chat_xyz789abc123.json    # Session 2
└── chat_*.json              # More sessions
```

**JSON Format:**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "messages": [
    {
      "role": "user",
      "content": "Hello, my name is Rahul"
    },
    {
      "role": "assistant",
      "content": "Hello Rahul! Nice to meet you. How can I help you today?"
    }
  ]
}
```

### Vector Store Index
```
database/vector_store/
├── index.faiss    # FAISS index file (binary)
└── index.pkl     # Metadata (Document objects)
```

---

## Retrieval Process

### When User Asks a Question

1. **Embed the question**
   ```python
   question_embedding = embeddings.embed_query(user_question)
   ```

2. **Search FAISS**
   ```python
   results = faiss_index.search(question_embedding, k=10)
   ```

3. **Get top 10 chunks**
   ```python
   relevant_docs = [
       Document(page_content=chunk1, metadata={...}),
       Document(page_content=chunk2, metadata={...}),
       # ... up to 10
   ]
   ```

4. **Inject into prompt**
   ```python
   context = "\n".join([doc.page_content for doc in relevant_docs])
   system_message += f"\n\nRelevant context:\n{context}"
   ```

### Example Retrieval

**User asks after 1 year:**
> "What was my name?"

**Vector search finds:**
```
Chunk from chat_xyz.json:
"User: Hello, my name is Rahul"
"Assistant: Hello Rahul! Nice to meet you!"

Similarity score: 0.89
```

**Result:** JARVIS knows the user's name is Rahul!

---

## Persistence

### When is data saved?

1. **After each message** (non-streaming)
   ```python
   chat_service.save_chat_session(session_id)
   ```

2. **Every 5 chunks** (streaming mode)
   ```python
   if chunk_count % SAVE_EVERY_N_CHUNKS == 0:
       self.save_chat_session(session_id)
   ```

3. **On server shutdown**
   ```python
   # In lifespan shutdown
   for session_id in list(chat_service.sessions.keys()):
       chat_service.save_chat_session(session_id)
   ```

### Loading previous sessions

```python
# app/services/chat_service.py
def load_session_from_disk(self, session_id: str) -> bool:
    # 1. Sanitize session_id for filename
    safe_session_id = session_id.replace("-", "").replace(" ", "_")
    filename = f"chat_{safe_session_id}.json"

    # 2. Read JSON file
    with open(filepath, "r") as f:
        chat_dict = json.load(f)

    # 3. Convert to ChatMessage objects
    messages = [
        ChatMessage(role=msg.get("role"), content=msg.get("content"))
        for msg in chat_dict.get("messages", [])
    ]

    # 4. Store in memory
    self.sessions[session_id] = messages
    return True
```

---

## Limitations

### Token Limit
- `MAX_CHAT_HISTORY_TURNS = 20` - Only last 20 pairs sent to LLM
- Older history not in direct context but still searchable

### Retrieval Limit
- Only top 10 chunks retrieved per question
- Very long conversations may lose some context

### Embedding Model
- Uses `all-MiniLM-L6-v2` (384 dimensions)
- Good quality but not perfect semantic understanding
- May miss subtle connections

### Startup Rebuild
- FAISS index rebuilt on every server restart
- Takes time for large datasets

---

## How Long Will JARVIS Remember?

### Short Answer: **Forever!**

As long as:
1. The JSON files exist in `database/chats_data/`
2. The server is restarted (to re-index old chats)

### Example Timeline

| Time | What Happens |
|------|--------------|
| Day 1 | User: "My favorite color is blue" |
| Day 2 | JARVIS responds using context |
| Day 30 | Chat saved in JSON, indexed in FAISS |
| Day 365 | User asks: "What's my favorite color?" |
| Result | FAISS finds the chunk, JARVIS answers "Blue" |

### Important Notes

1. **Must restart server** to re-index old chats
2. **Chat must be saved** to disk (happens automatically)
3. **Vector store** must be rebuilt on startup

---

## Adding New Learning Data

To teach JARVIS new things:

1. Create a `.txt` file in `database/learning_data/`
2. Add information
3. Restart the server

**Example file:** `database/learning_data/mydata.txt`
```
My name is Rahul Sharma.
I live in Mumbai.
I work as a software developer.
My birthday is on January 15th.
I like coding, gaming, and watching movies.
```

Restart server, and JARVIS will remember this information!

---

## Conclusion

JARVIS's memory system is designed to:

1. **Remember conversations indefinitely** through disk storage
2. **Retrieve relevant context quickly** through vector search
3. **Provide contextual responses** by combining multiple memory types
4. **Scale efficiently** by limiting direct context while enabling retrieval

This is a classic **Retrieval-Augmented Generation (RAG)** architecture, commonly used in production AI systems.

---

*Document created for JARVIS AI Assistant*
*Author: Shreshth Kaushik*
