"""The Python side of `run.mjs`.

Times each step over the generated data and prints the medians as one line of
JSON:

    PYTHONPATH=packages/python/src python3 tools/bench/python.py <data dir> <runs>

The package is timed from its source tree, as the parity test reads it.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Callable

from chki18n import (
    Input,
    Options,
    ReportInit,
    check_translation_files,
    create_analyzer,
    flatten_translations,
    format_result,
)

LOCALES = ["en", "ko", "ja", "de", "ru"]


def median(runs: int, step: Callable[[], Any]) -> float:
    for _ in range(3):
        step()

    times = []

    for _ in range(runs):
        started_at = time.perf_counter()
        step()
        times.append((time.perf_counter() - started_at) * 1000)

    times.sort()

    return times[len(times) // 2]


def main() -> None:
    data_dir = Path(sys.argv[1])
    runs = int(sys.argv[2])
    locales_dir = str(data_dir / "locales")
    source_dir = str(data_dir / "src")
    texts = [(data_dir / "locales" / f"{locale}.json").read_text("utf-8") for locale in LOCALES]
    nested = [json.loads(text) for text in texts]
    flat = {locale: flatten_translations(nested[index]) for index, locale in enumerate(LOCALES)}
    analyzer = create_analyzer(Options(target="en", flattened=True))
    result = analyzer.analyze(Input(locales=flat))

    times = {
        "parse": median(runs, lambda: [json.loads(text) for text in texts]),
        "flatten": median(runs, lambda: [flatten_translations(item) for item in nested]),
        "analyze": median(runs, lambda: analyzer.analyze(Input(locales=flat))),
        "format": median(
            runs,
            lambda: format_result(result, analyzer.options, ReportInit(color=False, width=100)),
        ),
        "check": median(runs, lambda: check_translation_files(locales_dir, Options(target="en"))),
        "check + source": median(
            runs,
            lambda: check_translation_files(locales_dir, Options(target="en", source=source_dir)),
        ),
    }

    print(json.dumps({"issues": len(result.issues), **times}))


if __name__ == "__main__":
    main()
