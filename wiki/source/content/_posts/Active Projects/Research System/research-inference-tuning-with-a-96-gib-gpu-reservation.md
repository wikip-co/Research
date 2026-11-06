---
title: Research Inference Tuning with a 96 GiB GPU Reservation
description: Measured model capacity, precision, backends, and latency after the BIOS GPU-memory change on Iconium.
status: Verified; model restored
tags:
  - Hardware
  - Automation
---

## Measured outcome

**Verified 2026-11-05 through 2026-11-06, America/Los_Angeles.** The selected local service now runs **Qwen3.8 Flash Next UD-Q4_K_XL on Vulkan with a matching Q8 MTP head**. The main GGUF contains 176.94 billion parameters. The BIOS GPU reservation remains 96 GiB.

Flash Next scores **26/36** on the fixed science sample, compared with **19/36** for the tested 27B variants. It passes all 69 source-extraction checks. Its measured generation rate is about **45.3 tokens per second**, compared with 7.6 for the restored non-speculative 27B baseline.

A larger synthetic publisher request passes its plan validator in about 27 seconds with a shared style prefix cached. A fresh-start request with zero cached prompt tokens passes in **31.1 seconds**. The goal is balanced evidence accuracy and speed, aiming for under one minute per paper. These timings do not guarantee that every paper or a 6,000-token completion meets that target.

The chosen service passed health checks on `127.0.0.1:8080`, using model ID `qwen3.8-flash-next-ud-q4_k_xl-mtp`. Its user unit remains disabled for automatic login start. The original unit and Q8 files are retained for rollback. No production queue or research content was changed.

## Later gaming shutdown, November 6

The owner later requested a temporary stop to free resources for Halo Infinite. `systemctl --user stop research-llm.service` completed, leaving the unit `inactive/dead`. No llama-server process or port 8080 listener remained.

GPU VRAM use fell from 88,203,419,648 to 1,405,648,896 bytes, releasing about 80.84 GiB. Total fixed VRAM remained 96 GiB. These total-device snapshots do not isolate each allocation or establish peak game usage.

The model endpoint was unavailable during gaming. The service configuration, model files, and existing disabled startup policy were preserved. After the owner reported finishing gaming, the service was restarted at 14:49 PST on November 6 and reached readiness about 49 seconds later. Health, the expected model alias, and a synthetic completion passed. This verifies restoration, not the cause of the earlier Halo crash. No intake, publisher, or triage service was started.

The [production operations guide](https://github.com/wikip-co/Research/blob/main/docs/research-production-operations.md#temporary-gaming-stop) owns the stop/start commands. The [personal Agent Wiki incident record](https://agent.wikip.co/freeing-iconium-gpu-memory-for-halo-infinite/) retains the crash evidence and memory measurements.

Halo crashed inside Wine's segmentation-fault handler before this stop. No concurrent OOM kill or GPU reset was found. Model memory contention remains a hypothesis, not a demonstrated crash cause or verified fix.

## Current hardware and software

| Item | Observed configuration |
| --- | --- |
| Host | Iconium, GTR Pro, Ryzen AI MAX+ 395, Radeon 8060S, `gfx1151` |
| Kernel | `7.2.15-1-omarchy` |
| Graphics | Mesa and Vulkan Radeon `26.2.5-1` |
| Fixed GPU reservation | 96 GiB |
| Linux-visible RAM | 32,474,256 KiB, about 30.97 GiB |
| GTT ceiling | 16,626,819,072 bytes, about 15.49 GiB |
| TTM ceiling | `ttm.pages_limit=4059282` |
| Vulkan advertised pool | About 111.49 GiB, including fixed VRAM and GTT |
| HIP and HSA GPU pool | 96 GiB |
| Main comparison build | llama.cpp `b12144`, commit `69ee2ecc0` |
| Restored baseline build | llama.cpp `b12119`, commit `6f1e65437` |
| Installed HIP libraries | Arch `hip-runtime-amd`, `hipblas`, and `rocminfo` 7.2.4; `rocblas` 7.2.4-3 |

The portable ROCm binary is named `llama-b12144-bin-ubuntu-rocm-10.0-x64`. Its tested host libraries are the Arch versions above. The release name does not establish the installed runtime version.

The two HSA global pool listings describe the same GPU capacity. Do not add them. GTT consumes Linux-visible RAM when used. The advertised Vulkan pool does not add physical memory.

The earlier [fixed VRAM versus GTT article](https://agent.wikip.co/amd-strix-halo-gpu-memory-for-llama-cpp-fixed-vram-versus-gtt/) recorded a different BIOS reservation, kernel, and runtime. Its older HSA measurements do not describe this configuration. No kernel memory parameter, IOMMU setting, BIOS value, or boot configuration was changed during these experiments.

## Controlled comparisons

All extraction comparisons use one GPU job at a time, 32K context, one slot, flash attention, and Q8 K/V caches. Direct requests use temperature zero and disable thinking. The nine extraction cases disable prompt caching. Their 69 checks cover values, required fields, exact quotes, evidence scope, missing information, mixed studies, withdrawal counts, and embedded source instructions.

The paper-sized case contains 71,023 source characters and sends 10,624 prompt tokens. Its answer contains 95 tokens. Generation figures below are means across these nine cases. They differ from the separate `llama-bench` measurements.

| Configuration | Generation, tokens/s | Paper-sized extraction, seconds | Checks |
| --- | ---: | ---: | ---: |
| Vulkan Q8, no MTP | 7.6 | 40.4 | 69/69 |
| Vulkan Q8, MTP 3 | 23.2 | 33.0 | 69/69 |
| Vulkan Q8, MTP 6 | 31.6 | 31.7 | 69/69 |
| Vulkan Q8, MTP 8, four CPU threads | 32.3 | 31.6 | 69/69 |
| Vulkan BF16, MTP 6 | 17.1 | 90.0 | 69/69 |
| Vulkan FP16, MTP 6 | 16.9 | 52.1 | 69/69 |
| ROCm Q8, MTP 6 | 32.9 | 33.6 | 69/69 |
| ROCm BF16, MTP 6 | 16.2 | 33.6 | 69/69 |
| Vulkan Flash Next Q4_K_XL, no MTP | 26.0 | 23.4 | 69/69 |
| Vulkan Flash Next Q4_K_XL, separate MTP 2 | 45.3 | 23.4 | 69/69 |

The tested Q8 speculative configurations return the same extraction objects as the non-speculative Q8 baseline. This is a measured result for these inputs. Six draft tokens provide most of the measured gain. Eight give little additional improvement here.

Prompt ingestion remains important. MTP speeds generation, while processing the paper still consumes most of the extraction request. The same model can need a different backend when its weight precision changes.

## Publisher contract and remaining quality gate

The publisher tests use the real single-pass prompt, both current style guides, `LocalLLMClient`, normalizer, and deterministic plan validator. The fixtures are synthetic human, animal, and review evidence. They read no queue or real research records.

The original prompt produces blank optional summary fields in some plans. Additional benchmark instructions tell the model to omit unavailable summaries and retain Markdown heading prefixes. Human and animal fixtures then pass. The review fixture still fails when a quote does not explicitly name the target entity.

That rejection is retained. An exact quotation alone does not satisfy the entity rule. A valid `needs_review` response also does not count as an accepted draft. The final production check reproduced failures with the original prompt. The tested format reminders are now part of `simple_draft_prompt`. They clarify existing requirements and omit unavailable optional fields. The validator is unchanged. Fresh installed-service checks pass for human and animal evidence. The review fixture returns a valid `needs_review` decision. The larger cold request passes without the benchmark-only flag.

The larger publisher fixture sends a 67,411-character prompt, including a bounded synthetic source and a 19.2K-character candidate page. It contains 11,016 prompt tokens and produces a 368-token plan. The Q8 and BF16 rows start with zero cached prompt tokens. The initial Flash Next row reuses 2,020 style-prefix tokens. Do not treat these cache conditions as identical. After the prompt clarification and a fresh service start, the installed Flash Next profile passes the same larger request in **31.1 seconds**, with zero cached tokens.

| Configuration | Elapsed time | Result |
| --- | ---: | --- |
| Vulkan Q8, MTP 6, four threads, Direct I/O | 42.5 seconds | Plan validator passed; scope and exact quotes passed |
| ROCm BF16, MTP 6, four threads, Direct I/O | 53.5 seconds | Plan validator passed; scope and exact quotes passed |
| Vulkan Flash Next, separate MTP 2, mapped lazy table | 26.8 seconds | Plan validator passed; 2,020 shared prefix tokens cached |

These checks stop before publication. They do not establish that the production backlog is ready for unattended processing. See {% post_link "Research Review Findings and Improvement Backlog" %} for the separate queue and editorial findings.

## Broader science sample

A fixed sample uses 12 biology, 12 health, and 12 chemistry questions from [TIGER-Lab MMLU-Pro](https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro). Sampling uses seed `20261106` and dataset revision `b189ec765aa7ed75c8acfea42df31fdae71f97be`. The complete test split is sampled before model testing. Answer keys and supplied reasoning are never sent to the model.

Q8 on Vulkan, Q8 on ROCm, converted FP16 on Vulkan, and original BF16 on ROCm each score **19/36** with direct JSON answers. Flash Next scores **26/36**, both with and without its MTP head. Full precision shows no score gain among the 27B variants in this sample. Equal totals do not prove equivalent general capability.

This is a small diagnostic sample using a direct-answer protocol. It is not an official MMLU-Pro score or a general model ranking. The dataset's official report distinguishes direct answers from chain-of-thought results. A separate uncapped-thinking pilot was stopped after two completed requests to keep the experiment focused on the latency goal. Its partial results are not a benchmark verdict.

## Loading and precision findings

The original BF16 GGUF has two shards totaling 54,657,735,616 bytes. Their SHA-256 fingerprints match the pinned upstream LFS objects. Q8 and BF16 come from `unsloth/Qwen3.8-27B-GGUF` revision `4ca720788d1e01f1bff70c033e0d0028fd02e502`.

The FP16 file was converted locally from those BF16 weights with the tested release's `llama-quantize` tool. It remains a 16-bit weight model. Conversion does not add information to the original weights. Vulkan reports FP16 support and no native BF16 support. The conversion improves measured prompt speed on that backend. An elementwise scan finds no nonfinite outputs. Its largest change is about `2.98e-8`; 54,197 tiny nonzero values round to zero. The original BF16 files are retained.

A BF16 Direct I/O loading trial reaches health and completes a JSON smoke request. It loads in about 12 seconds, with a 4.98 GiB peak in its host-memory cgroup. The default mapping trial peaks at about 10.61 GiB across loading and its larger test suite. These are different trial scopes, not a controlled peak-memory ratio. GPU allocations are accounted separately.

Test services limit host memory to 18 GiB and disable their own swap. The conversion uses a 14 GiB limit. Global desktop swap increases during the wider session, so this is not a claim that the whole machine uses zero swap.

## Large-model loading and backend limits

The main Flash Next download has four shards totaling 111,334,654,778 bytes. All four match their upstream SHA-256 fingerprints. The matching self-contained MTP Q8 head is 4,137,429,120 bytes. Both are pinned to `unsloth/Qwen3.8-Flash-Next-GGUF` revision `d96201194f103c906994f283f504209dc8d2a10c`.

Flash Next uses a mixture of experts. Its official model card reports about 6B active parameters per token, plus a large stored lookup table.

The successful Vulkan configuration uses `--load-mode mmap --lazy-mode on`. The log reports 78,056 MiB of main-model weights on the GPU and a 27,466 MiB table mapped through the CPU. Lazy access avoids requiring that entire table to remain resident. This is not a claim that the entire 111 GB file resides on the GPU.

Direct I/O with automatic lazy mode reaches the test unit's 18 GiB host-memory ceiling and is killed within that unit. Retrying with mapping and explicit lazy mode passes. Both settings change together, so this does not isolate one flag as the cause. Direct I/O remains useful for the tested 27B models.

The ROCm Flash Next trial does not reach readiness. The kernel reports `SVM mapping failed, exceeds resident system memory limit` while the process waits in `svm_range_set_attr`. That trial is stopped. Its GPU allocations are released, and no HIP Flash Next inference result is claimed. ROCm BF16 27B works separately.

The pinned MTP README describes an older mainline limitation. The tested stock b12144 build supports the Qwen4 experimental MTP graph with a separate self-contained head. The chosen profile passes the head explicitly and uses two draft tokens. Successful request timings include draft-token acceptance counters.

## Changes that did not help

- Larger physical prompt batches reduce throughput in the measured Q8 sweep. Sizes 256, 512, 1024, and 2048 give approximately 412, 410, 395, and 376 prompt tokens per second.
- FP16 K/V caches show no material speed gain over Q8 caches in the separate Q8 benchmark.
- Combining n-gram prediction with MTP gives no useful gain on these inputs.
- Four CPU threads perform about the same as sixteen during full GPU offload. Extra threads do not provide a measured gain here.

## Reproduction and evidence

The owning tooling repository contains `scripts/benchmark-local-inference.py` and `scripts/benchmark-science-inference.py`. Its [local publisher guide](https://github.com/wikip-co/research-tools/blob/main/docs/local-research-publisher.md) owns the operational procedure. The benchmark scripts, guide, and prompt clarification are tracked in [research-tools PR #5](https://github.com/wikip-co/research-tools/pull/5), independently of this wiki. The original measurements used the source fingerprints recorded in the evidence bundle.

Experiments and raw synthetic results are retained locally under `~/Work/inference-benchmark-2026-11-05/`. The compact evidence bundle is linked below. Full prompts, model reasoning, production database rows, and mail records are excluded from this wiki.

## Validation and delivery

The publisher tooling suite passes all 100 tests after the prompt change. Both benchmark scripts pass their syntax and static checks. The wiki uses Node 24.22.1. Its lint reports zero errors and zero warnings. All five wiki tests pass. Clean/build and link/export verification pass for six articles and eighteen HTML pages. The workspace shell, manifest, and flat-layout checks also pass.

The selected service answers health and model-list requests, with zero automatic restarts during the final check. The original unit remains unchanged beneath the new profile drop-in. The environment file keeps mode 0600. No intake, publisher, or triage service was enabled by this work.

At the initial handoff, source changes were uncommitted on `analysis/inference-96g-benchmarks-2026-11-06` in Research and `tools/local-inference-benchmarks-2026-11-06` in research-tools. This article and its evidence were published through [Research PR #5](https://github.com/wikip-co/Research/pull/5). The tooling changes are published separately through [research-tools PR #5](https://github.com/wikip-co/research-tools/pull/5). Use each repository’s Git history for its delivered source revision; the evidence bundle retains the original measurement provenance. No research content was published by these experiments.

## Evidence bundle

These files contain measurements and identifiers, without full prompts, model reasoning, or source questions.

- {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/benchmark-summary.csv "Comparison table (CSV)" %} and {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/benchmark-summary.json "Detailed comparison (JSON)" %}.
- {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/model-manifest.json "Pinned model revisions and verified hashes" %}.
- {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/environment.json "Measured host environment" %} and {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/experiment-notes.json "Failed and partial trial boundaries" %}.
- {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/science-sample-manifest.json "Science sample provenance and question IDs" %} and {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/science-results.json "Per-question scores" %}.
- {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/f16-integrity.json "FP16 conversion integrity check" %}.
- {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/selected-service-profile.conf.txt "Sanitized service profile" %}, {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/selected-runtime.json "Verified selected runtime" %}, and {% site_link artifacts/research-inference-tuning-with-a-96-gib-gpu-reservation/method-provenance.json "Code provenance and delivery boundary" %}.

## Related records

- {% post_link "Research System Overview" %}
- {% post_link "Research Runtime Restoration 2026-11-04" %}
- [Qwen3.8 27B model card](https://huggingface.co/Qwen/Qwen3.8-27B)
- [Qwen3.8 Flash Next model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next)
- [Pinned llama.cpp speculative decoding documentation](https://github.com/ggml-org/llama.cpp/blob/b12144/docs/speculative.md)
