# job-assistant

A local, free (no paid APIs, open-source only) job-application-assistant
tool, built for a Windows 11 machine with 8GB RAM and a 4GB-VRAM GPU.

**Phase 1 (current): environment setup and local LLM validation only.**
No scraping, resume parsing, or form-filling logic exists yet — this phase
only proves that Ollama can run locally on this machine and measures how
fast it responds.

## Structure

```
job-assistant/
├── env/       setup.md (Windows install steps) + requirements.txt
├── data/      profile JSON / job postings DB — empty for now
├── scripts/   phase-by-phase scripts (test_llm.py for Phase 1)
└── logs/      llm_benchmark.md results log
```

## Quick start

See [`env/setup.md`](env/setup.md) for full Windows install steps
(Ollama, Python venv, Playwright). Once set up:

```powershell
venv\Scripts\activate
python scripts\test_llm.py --model qwen2.5:3b
```

Record the printed latency/tokens-per-sec numbers in
[`logs/llm_benchmark.md`](logs/llm_benchmark.md).
