"""
Grade model predictions using a reference answer.

For each prediction JSON referenced in predictions.csv, this script calls
gpt-5-mini via the existing inference.infer helper to produce a score in [0, 1]
and writes it back into the JSON under the key `grader0`.
"""

import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict

import pandas as pd

# Ensure repository root on sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend_code import inference, models_config  # noqa: E402

MAX_WORKERS = 8  # Keep well below rate limit of 400 concurrent requests

OPENAI_CFG = models_config.MODELS["openai"]
SCORER_MODEL = {
    "vendor": "openai",
    "model_name": "gpt-5-mini",
    "api_key": OPENAI_CFG["api_key"],
    "config": OPENAI_CFG["models"]["gpt-5-mini"],
}


def grader0(model_output: str, gold_output: str) -> float:
    """Call gpt-5-mini to score model_output vs gold_output in [0, 1]."""
    system_prompt = (
        "You are a strict grader. Score the model answer against the reference "
        "from 0 to 1, where 1 means fully correct and 0 means completely wrong. "
        "Return ONLY JSON like {\"score\": <float between 0 and 1>}."
    )
    user_prompt = (
        f"Reference answer:\n{gold_output}\n\n"
        f"Model answer:\n{model_output}\n\n"
        "Respond with JSON only."
    )
    conversation = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    response = inference.infer(SCORER_MODEL, conversation)
    text = response.get("text", "")
    match = re.search(r"([0-1](?:\.\d+)?|\.\d+)", text)
    if not match:
        raise ValueError(f"Could not parse score from response: {text}")
    score = float(match.group(1))
    # Clamp to [0, 1]
    return max(0.0, min(1.0, score))


def grade_entry(entry: Dict[str, Any]) -> float:
    return grader0(entry.get("prediction", ""), entry.get("gold", ""))


def grade_file(json_path: Path) -> None:
    data = json.loads(json_path.read_text())
    items = list(data.items())

    results: Dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_key = {
            executor.submit(grade_entry, entry): key for key, entry in items
        }
        for future in as_completed(future_to_key):
            key = future_to_key[future]
            results[key] = future.result()

    for key, score in results.items():
        data[key]["grader0"] = score

    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def grade_from_csv(csv_path: Path) -> None:
    df = pd.read_csv(csv_path, index_col=0)
    for model_name, row in df.iterrows():
        for dataset, path in row.items():
            if not isinstance(path, str) or not path.strip():
                continue
            json_path = Path(path)
            if not json_path.exists():
                continue
            grade_file(json_path)


if __name__ == "__main__":
    default_csv = Path(__file__).resolve().parent / "predictions.csv"
    grade_from_csv(default_csv)
    print(f"Grading complete using {default_csv}")
