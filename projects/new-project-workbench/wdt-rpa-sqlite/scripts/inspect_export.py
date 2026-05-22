from __future__ import annotations

import argparse
from pathlib import Path

from import_exports import detect_entity, load_config, read_export


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect WDT export headers.")
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--config", type=Path, default=None)
    args = parser.parse_args()

    config = load_config(args.config)
    for path in args.files:
        sheets = read_export(path, config)
        print(f"\n{path}")
        for sheet in sheets:
            entity = detect_entity(path, sheet["headers"], config)
            headers = " | ".join(sheet["headers"][:30])
            print(f"  sheet: {sheet['sheet_name'] or '(csv)'}")
            print(f"  suggested_type: {entity}")
            print(f"  rows: {len(sheet['rows'])}")
            print(f"  headers: {headers}")


if __name__ == "__main__":
    main()

