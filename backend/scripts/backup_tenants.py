"""Run an automatic backup for every tenant and the shared global catalogs."""

import asyncio
import sys

from app.services.tenant_backups import run_automatic_backups


def main() -> int:
    try:
        failures = asyncio.run(run_automatic_backups())
    except Exception as exc:
        print(
            f"Error al ejecutar los backups: {type(exc).__name__}",
            file=sys.stderr,
        )
        return 1

    for failure in failures:
        print(f"ERROR: {failure}", file=sys.stderr)
    if failures:
        print(f"Fallaron {len(failures)} backups; el resto fue procesado.", file=sys.stderr)
        return 1
    print("Backups de empresas y catálogos globales completados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
