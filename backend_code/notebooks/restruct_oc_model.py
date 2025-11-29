# restruct_oc_model.py

import sys
from pathlib import Path
import re
import importlib
from datetime import datetime
from opencompass.registry import MODELS
from opencompass.models.base_api import BaseAPIModel

# Ensure project root is on the path so we can import backend_code modules
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend_code import inference
from backend_code import models_config as restruct_models_config

# Optional: define your meta_template or reuse one
api_meta_template = dict(
    round=[
        dict(role='HUMAN', api_role='HUMAN'),
        dict(role='BOT', api_role='BOT', generate=True),
    ]
)


def _get_model_from_config(route_name: str) -> dict:
    """Return the model payload expected by inference.infer."""
    for vendor, vendor_data in restruct_models_config.MODELS.items():
        if route_name in vendor_data.get("models", {}):
            model_cfg = dict(vendor_data["models"][route_name])  # copy to avoid mutating global config
            model_cfg["vendor"] = vendor
            model_cfg["model_name"] = route_name
            model_cfg["api_key"] = vendor_data.get("api_key")
            return model_cfg
    raise ValueError(f"route_name '{route_name}' not found in models_config.MODELS")


def _to_conversation(prompt_input) -> list:
    """Convert an OpenCompass prompt into a list of role/content dicts."""
    

    messages = []

    for r in prompt_input:
        oc_role = r.get("role", "").upper()
        text = r.get("prompt", "")

        if oc_role == "HUMAN":
            role = "user"
        elif oc_role == "BOT":
            role = "assistant"
        else:
            # default fallback if something weird shows up
            role = "user"

        messages.append({"role": role, "content": text})

    return messages

def build_restruct_models():
    """Create OpenCompass model entries from backend_code.models_config."""
    models_module = importlib.import_module("backend_code.models_config")
    models_dict = models_module.MODELS

    model_entries = []
    for vendor, vendor_data in models_dict.items():
        for model_name, model_cfg in vendor_data.get("models", {}).items():
            abbr = f"restruct_{vendor}_{model_name}".replace("-", "_")
            model_entries.append(
                dict(
                    abbr=abbr,
                    type=RestructAPIModel,
                    route_name=model_name,
                    max_seq_len=model_cfg.get("max_tokens", 4096),
                    max_out_len=512,
                    batch_size=1,
                    query_per_second=1,
                    run_cfg=dict(num_gpus=0, num_procs=1),
                )
            )
    return model_entries


@MODELS.register_module()  # <-- this makes it visible as "RestructAPIModel"
class RestructAPIModel(BaseAPIModel):
    is_api: bool = True

    def __init__(
        self,
        route_name: str,
        max_seq_len: int = 4096,
        query_per_second: int = 1,
        retry: int = 2,
        **kwargs,
    ):
        super().__init__(
            path=route_name,
            max_seq_len=max_seq_len,
            meta_template=api_meta_template,
            query_per_second=query_per_second,
            retry=retry,
        )
        self.route_name = route_name
        self.model = _get_model_from_config(route_name)

    def generate(self, inputs, max_out_len: int = 512, temperature: float = 0.7):
        # `inputs` is usually a list of formatted prompt strings
        outputs = []
        for prompt in inputs:
            logs_dir = Path(__file__).resolve().parents[2] / "logs"
            logs_dir.mkdir(parents=True, exist_ok=True)
            log_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_restruct_oc_model.txt"
            (logs_dir / log_name).write_text(str(type(prompt)))
            conversation = _to_conversation(prompt)
            result = inference.infer(self.model, conversation)
            outputs.append(result.get("text", ""))
        return outputs

    def get_token_len(self, prompt: str) -> int:
        # Simple fallback; you can plug in tiktoken or your router’s estimator
        return len(prompt.split())
