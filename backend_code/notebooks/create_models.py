"""
Generate a models.txt snippet for restruct_opencompass_config.py based on models_config.MODELS.

Run this script to produce a ready-to-paste models array.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend_code import models_config  # noqa: E402


def render_entry(vendor: str, model_name: str, model_cfg: dict) -> str:
    abbr = f"restruct_{vendor}_{model_name}".replace("-", "_")
    max_seq_len = model_cfg.get("max_tokens", 4096)
    return (
        "    dict(\n"
        f"        abbr='{model_name}',\n"
        "        type=RestructAPIModel,\n"
        f"        route_name='{model_name}',\n"
        f"        max_seq_len={max_seq_len},\n"
        "        max_out_len=512,\n"
        "        batch_size=1,\n"
        "        query_per_second=1,\n"
        "        run_cfg=dict(num_gpus=0, num_procs=1),\n"
        "    ),"
    )


def build_models_snippet() -> str:
    entries = []
    for vendor, vendor_data in models_config.MODELS.items():
        for model_name, model_cfg in vendor_data.get("models", {}).items():
            entries.append(render_entry(vendor, model_name, model_cfg))
    joined = "\n".join(entries)
    return f"models = [\n{joined}\n]"


def main():
    out_path = Path(__file__).resolve().parent / "models.txt"
    out_path.write_text(build_models_snippet())
    print(f"models.txt written to {out_path}")


if __name__ == "__main__":
    main()
