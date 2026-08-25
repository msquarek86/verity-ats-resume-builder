# Phase 1 Setup — Local LLM Environment (Windows 11)

Goal of this phase: prove that a fully local, free (no paid API) LLM stack
runs on this machine and measure how fast it responds. No scraping, no
parsing, no form-filling yet.

**Target hardware:** 8GB RAM, 512GB SSD, NVIDIA GTX 1650 Ti Max-Q (4GB VRAM), Windows 11.

---

## 1. Install Ollama (Windows)

1. Download the Windows installer from https://ollama.com/download/windows.
2. Run `OllamaSetup.exe` and follow the prompts (no admin/config needed for
   a default install).
3. Ollama installs itself as a background service and exposes a local
   REST API at `http://localhost:11434`.
4. Verify the install in PowerShell:
   ```powershell
   ollama --version
   ```
5. Confirm the API is up:
   ```powershell
   curl http://localhost:11434
   ```
   You should get a plain-text `Ollama is running` response.

Ollama automatically uses your NVIDIA GPU via CUDA if the driver supports
it — no separate CUDA toolkit install is required for basic inference.
Make sure your NVIDIA driver is reasonably current (GeForce Experience or
https://www.nvidia.com/Download/index.aspx).

---

## 2. Pick and pull a model

See **Model recommendation** below. Start with the smallest model to
validate the pipeline end-to-end before trying anything bigger:

```powershell
ollama pull qwen2.5:3b
```

Once the benchmark script confirms this works, you can pull the others to
compare:

```powershell
ollama pull phi3:mini
ollama pull qwen2.5:7b-instruct-q4_0
```

---

## 3. Python 3.11+ virtual environment

1. Install Python 3.11 or later from https://www.python.org/downloads/
   (check "Add python.exe to PATH" during install).
2. From the `job-assistant/` folder, create and activate a venv:
   ```powershell
   py -3.11 -m venv venv
   venv\Scripts\activate
   ```
3. Install dependencies:
   ```powershell
   pip install -r env\requirements.txt
   ```

---

## 4. Playwright

Playwright is installed via `requirements.txt`, but its browser binaries
need a separate download step (this phase only installs it — no scraping
logic is written yet):

```powershell
playwright install
```

This downloads Chromium, Firefox, and WebKit into a local Playwright
cache. No Playwright code is used until a later phase.

---

## 5. Run the benchmark

With the venv active and Ollama running:

```powershell
python scripts\test_llm.py --model qwen2.5:3b
```

Record the results in `logs/llm_benchmark.md`.

---

## Model recommendation (4GB VRAM budget)

| Model | Params | Approx. size (q4) | Fit in 4GB VRAM | Notes |
| --- | --- | --- | --- | --- |
| **qwen2.5:3b** | 3B | ~1.9GB | Comfortable, full GPU offload with headroom | Smallest and fastest of the three; good instruction-following for its size; **pull this first** to validate the pipeline. |
| **phi3:mini** | 3.8B | ~2.3GB | Comfortable, full GPU offload with headroom | Slightly larger than qwen2.5:3b; strong reasoning/quality for its size; good second model to compare quality vs. speed. |
| **qwen2.5:7b-instruct-q4_0** | 7B | ~4.7GB | Right at/over the 4GB ceiling — likely partial CPU offload | Noticeably higher quality output, but on this GPU expect some layers to spill to system RAM/CPU, which will slow tokens/sec meaningfully. Worth benchmarking once the pipeline is confirmed, to decide if the quality gain is worth the latency hit. |

**Tradeoff summary:**
- **Speed:** qwen2.5:3b > phi3:mini > qwen2.5:7b-instruct-q4 (the 7B model
  will be slowest here because it won't fully fit in 4GB VRAM).
- **Quality:** qwen2.5:7b-instruct-q4 > phi3:mini ≈ qwen2.5:3b for more
  nuanced tasks (e.g. resume/job-posting reasoning), but the gap may not
  matter for short, templated tasks like summarization or keyword
  extraction.
- **VRAM fit:** only qwen2.5:3b and phi3:mini fit fully in 4GB with
  comfortable headroom for context; the 7B model is a stretch on this GPU.

Default plan: pull and benchmark `qwen2.5:3b` first since it's the
smallest, confirm the Ollama → Python pipeline works end-to-end, then
benchmark `phi3:mini` and `qwen2.5:7b-instruct-q4_0` for comparison before
deciding which model to standardize on for later phases.

---

## Troubleshooting

- **`curl: connection refused` on port 11434** — Ollama service isn't
  running. Open the Ollama app once, or run `ollama serve` manually in a
  terminal.
- **Model pull is slow/stalls** — Ollama resumes interrupted pulls; just
  re-run `ollama pull <model>`.
- **Out-of-memory / crash on the 7B model** — expected on 4GB VRAM if
  Windows/other apps are also using GPU memory. Close other GPU-heavy
  apps (browser with many tabs, games) and retry, or stick to the smaller
  models.
