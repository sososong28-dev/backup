from __future__ import annotations

from import_exports import connect_db, init_db, load_config


def main() -> None:
    config = load_config()
    conn = connect_db(config)
    init_db(conn)
    conn.close()
    print(f"SQLite database initialized: {config['database_path']}")


if __name__ == "__main__":
    main()

