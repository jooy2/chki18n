"""Promises about the source itself that no other test would fail on."""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

from chki18n._version import PACKAGE_VERSION

SRC = Path("src/chki18n")

#: A zero width space or a stray escape in a source file is invisible in an
#: editor, in a diff and in review. Every one this package needs is written as a
#: `\\u` escape instead, and this is what keeps it that way.
FORBIDDEN = {0x00, 0x1B, 0xA0, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF}


def modules_under(root: Path) -> list[Path]:
    return sorted(root.rglob("*.py"))


def imports_of(path: Path) -> set[str]:
    """Every module name the file imports, as it writes them."""
    names: set[str] = set()

    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module)

    return names


def test_depends_on_nothing_outside_the_standard_library() -> None:
    for path in modules_under(SRC):
        for name in imports_of(path):
            root = name.split(".")[0]

            assert root == "chki18n" or root in sys.stdlib_module_names, (
                f"{path} imports `{name}`, which is neither stdlib nor this package"
            )


def test_the_core_reaches_no_file_system() -> None:
    """`chki18n.core` is importable where the disk is not, so it must stay that way."""
    seen: set[Path] = set()
    queue = [SRC / "core" / "__init__.py"]

    while queue:
        path = queue.pop()

        if path in seen or not path.exists():
            continue

        seen.add(path)

        for name in imports_of(path):
            if not name.startswith("chki18n"):
                assert name not in {"os", "os.path", "pathlib", "shutil", "subprocess"}, (
                    f"{path} imports `{name}`, which the core entry point must not reach"
                )
                continue

            parts = name.split(".")[1:]
            queue.append(SRC.joinpath(*parts).with_suffix(".py"))
            queue.append(SRC.joinpath(*parts) / "__init__.py")


def test_the_source_holds_no_character_a_review_cannot_see() -> None:
    for directory in (SRC, Path("tests")):
        for path in modules_under(directory):
            for index, char in enumerate(path.read_text(encoding="utf-8")):
                code = ord(char)

                assert code not in FORBIDDEN and (code >= 0x20 or char in "\n\t"), (
                    f"{path} holds U+{code:04X} at offset {index}"
                )


def test_the_published_version_is_the_one_pyproject_declares() -> None:
    declared = re.search(
        r'^version\s*=\s*"([^"]+)"', Path("pyproject.toml").read_text(encoding="utf-8"), re.M
    )

    assert declared is not None
    assert declared.group(1) == PACKAGE_VERSION
