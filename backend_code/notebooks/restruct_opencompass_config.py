# restruct_opencompass_config.py

from mmengine.config import read_base
from restruct_oc_model import RestructAPIModel, api_meta_template

# Make sure workers can import your model wrapper
custom_imports = dict(
    imports=['restruct_oc_model'],  # module name, not a path
    allow_failed_imports=False,
)

# 1. Use the built-in GSM8K demo chat dataset
with read_base():
    from opencompass.configs.datasets.demo.demo_gsm8k_chat_gen import gsm8k_datasets

# Just take the provided dataset list as-is
datasets = gsm8k_datasets

# 2. Define your Restruct-backed models
models = [
    dict(
        abbr='restruct_gpt5',
        type=RestructAPIModel,
        route_name='gpt5',          # your router route name
        max_seq_len=4096,
        max_out_len=512,
        batch_size=1,
        query_per_second=1,
        run_cfg=dict(num_gpus=0, num_procs=1),
    ),
    dict(
        abbr='restruct_claude_sonnet',
        type=RestructAPIModel,
        route_name='claude-sonnet',
        max_seq_len=4096,
        max_out_len=512,
        batch_size=1,
        query_per_second=1,
        run_cfg=dict(num_gpus=0, num_procs=1),
    ),
]
