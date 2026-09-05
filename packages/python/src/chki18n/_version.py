"""The published version of this package.

Read off the installed distribution's metadata when it is installed, and
otherwise from the constant below. `tests/test_source.py` asserts the constant
matches `pyproject.toml`, so a release that bumps one and forgets the other
fails before it is published.
"""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

#: The version `chki18n --version` prints.
PACKAGE_VERSION = "1.2.0"


def installed_version() -> str:
    """The version this package was installed as, or the constant above."""
    try:
        return version("chki18n")
    except PackageNotFoundError:
        # Running from a source checkout that was never installed.
        return PACKAGE_VERSION
