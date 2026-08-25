"""
Phase 1 validation script: confirm Ollama is reachable locally and measure
response latency / throughput for a given model.

Usage:
    python scripts/test_llm.py --model qwen2.5:3b
    python scripts/test_llm.py --model phi3:mini --prompt "custom prompt text"

This script does not scrape, parse, or fill anything — it only exercises
the local Ollama API to validate the setup from Phase 1.
"""

import argparse
import sys
import time

import requests

OLLAMA_URL = "http://localhost:11434/api/generate"

SAMPLE_JOB_POSTING = (
    "We are hiring a Backend Engineer to design and maintain REST APIs, "
    "optimize PostgreSQL queries, and collaborate with the frontend team "
    "on a Python/Django platform. 3+ years of experience required. "
    "Remote-friendly, competitive salary, health benefits included."
)

DEFAULT_PROMPT = f"Summarize this job posting in 2 sentences: {SAMPLE_JOB_POSTING}"


def run_test(model: str, prompt: str, timeout: float) -> None:
    payload = {"model": model, "prompt": prompt, "stream": False}

    print(f"Model:  {model}")
    print(f"Prompt: {prompt}\n")

    start = time.perf_counter()
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
    except requests.exceptions.ConnectionError:
        print(
            "ERROR: could not connect to Ollama at http://localhost:11434.\n"
            "Is the Ollama service running? (see env/setup.md)"
        )
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f"ERROR: request timed out after {timeout}s.")
        sys.exit(1)
    elapsed = time.perf_counter() - start

    if response.status_code != 200:
        print(f"ERROR: Ollama returned HTTP {response.status_code}: {response.text}")
        sys.exit(1)

    data = response.json()
    output_text = data.get("response", "").strip()

    eval_count = data.get("eval_count")
    eval_duration_ns = data.get("eval_duration")
    prompt_eval_count = data.get("prompt_eval_count")
    total_duration_ns = data.get("total_duration")

    print("--- Response ---")
    print(output_text)
    print("----------------\n")

    print(f"Total wall-clock latency: {elapsed:.2f}s")
    if total_duration_ns is not None:
        print(f"Ollama-reported total duration: {total_duration_ns / 1e9:.2f}s")
    if prompt_eval_count is not None:
        print(f"Prompt tokens: {prompt_eval_count}")

    if eval_count is not None and eval_duration_ns:
        tokens_per_sec = eval_count / (eval_duration_ns / 1e9)
        print(f"Generated tokens: {eval_count}")
        print(f"Tokens/sec (generation): {tokens_per_sec:.2f}")
    else:
        print("Tokens/sec: not reported by this Ollama version/response.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark a local Ollama model.")
    parser.add_argument(
        "--model",
        default="qwen2.5:3b",
        help="Model tag to test, e.g. qwen2.5:3b, phi3:mini, qwen2.5:7b-instruct-q4_0 (default: qwen2.5:3b)",
    )
    parser.add_argument(
        "--prompt",
        default=DEFAULT_PROMPT,
        help="Prompt to send. Defaults to a sample job-posting summarization prompt.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="Request timeout in seconds (default: 120).",
    )
    args = parser.parse_args()

    run_test(args.model, args.prompt, args.timeout)


if __name__ == "__main__":
    main()
