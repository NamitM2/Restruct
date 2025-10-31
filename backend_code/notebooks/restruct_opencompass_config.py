# restruct_opencompass_config.py

import sys
from pathlib import Path
from mmengine.config import read_base


from opencompass.partitioners import NaivePartitioner
from opencompass.runners import LocalRunner
from opencompass.tasks import OpenICLInferTask


infer = dict(
    partitioner=dict(
        type=NaivePartitioner,  # one task per (model, dataset)
    ),
    runner=dict(
        type=LocalRunner,
        max_num_workers=32,     # <-- how many tasks in parallel
        task=dict(type=OpenICLInferTask),
    ),
)


# Ensure repo root on path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
del REPO_ROOT
del sys

from restruct_oc_model import RestructAPIModel

# Let workers import your custom modules if needed
custom_imports = dict(
    imports=['restruct_oc_model'],  # no backend_code.models_config here
    allow_failed_imports=False,
)

with read_base():
    from opencompass.configs.datasets.subjective.multiround.mtbench_single_judge_diff_temp import \
        mtbench_datasets

datasets = [*mtbench_datasets]

# 2. Define the specific routes you want to benchmark BY HAND
models = [
    dict(
        abbr='gpt-5',
        type=RestructAPIModel,
        route_name='gpt-5',
        max_seq_len=128000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gpt-5-mini',
        type=RestructAPIModel,
        route_name='gpt-5-mini',
        max_seq_len=128000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gpt-5-nano',
        type=RestructAPIModel,
        route_name='gpt-5-nano',
        max_seq_len=128000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gemini-2.5-pro',
        type=RestructAPIModel,
        route_name='gemini-2.5-pro',
        max_seq_len=1000000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gemini-2.5-flash',
        type=RestructAPIModel,
        route_name='gemini-2.5-flash',
        max_seq_len=1000000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gemini-2.5-flash-lite',
        type=RestructAPIModel,
        route_name='gemini-2.5-flash-lite',
        max_seq_len=1000000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gemini-2.0-flash',
        type=RestructAPIModel,
        route_name='gemini-2.0-flash',
        max_seq_len=512000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='gemini-2.0-flash-lite',
        type=RestructAPIModel,
        route_name='gemini-2.0-flash-lite',
        max_seq_len=512000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='claude-opus-4-1',
        type=RestructAPIModel,
        route_name='claude-opus-4-1',
        max_seq_len=200000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='claude-sonnet-4-5',
        type=RestructAPIModel,
        route_name='claude-sonnet-4-5',
        max_seq_len=200000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
    dict(
        abbr='claude-haiku-4-5',
        type=RestructAPIModel,
        route_name='claude-haiku-4-5',
        max_seq_len=200000,
        max_out_len=512,
        batch_size=1,
        query_per_second=32,
        run_cfg=dict(num_gpus=0, num_procs=32),
    ),
]
