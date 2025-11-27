# restruct_oc_model.py

from typing import List
from opencompass.registry import MODELS
from opencompass.models.base_api import BaseAPIModel

# Optional: define your meta_template or reuse one
api_meta_template = dict(
    round=[
        dict(role='HUMAN', api_role='HUMAN'),
        dict(role='BOT', api_role='BOT', generate=True),
    ]
)


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

    def generate(self, inputs, max_out_len: int = 512, temperature: float = 0.7):
        # `inputs` is usually a list of formatted prompt strings
        prompts = [x if isinstance(x, str) else str(x) for x in inputs]
        return f"route name: {self.route_name}"

    def get_token_len(self, prompt: str) -> int:
        # Simple fallback; you can plug in tiktoken or your router’s estimator
        return len(prompt.split())
