# LLM Benchmark Log

Record results from `scripts/test_llm.py` here each time you run it,
so models can be compared before picking one to standardize on.

Machine: 8GB RAM, NVIDIA GTX 1650 Ti Max-Q (4GB VRAM), Windows 11.

## Template

Copy this block per run:

```
### <model tag> — <date>

- Avg latency (wall clock): __ s
- Ollama total duration: __ s
- Prompt tokens: __
- Generated tokens: __
- Tokens/sec: __
- Notes: (quality of summary, GPU vs CPU offload observed in Task Manager,
  anything unusual)
```

---

### qwen2.5:3b —

- Avg latency (wall clock):
- Ollama total duration:
- Prompt tokens:
- Generated tokens:
- Tokens/sec:
- Notes:

---

### phi3:mini —

- Avg latency (wall clock):
- Ollama total duration:
- Prompt tokens:
- Generated tokens:
- Tokens/sec:
- Notes:

---

### qwen2.5:7b-instruct-q4_0 —

- Avg latency (wall clock):
- Ollama total duration:
- Prompt tokens:
- Generated tokens:
- Tokens/sec:
- Notes:
