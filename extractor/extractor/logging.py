from pathlib import Path
import logging as py_logging


def setup_logging():
    logs_dir = Path("logs")
    logs_dir.mkdir(parents=True, exist_ok=True)

    formatter = py_logging.Formatter(
        fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    debug_handler = py_logging.FileHandler(logs_dir / "debug.log", encoding="utf-8")
    debug_handler.setLevel(py_logging.DEBUG)
    debug_handler.setFormatter(formatter)

    info_handler = py_logging.FileHandler(logs_dir / "info.log", encoding="utf-8")
    info_handler.setLevel(py_logging.INFO)
    info_handler.setFormatter(formatter)

    console_handler = py_logging.StreamHandler()
    console_handler.setLevel(py_logging.INFO)
    console_handler.setFormatter(formatter)

    root = py_logging.getLogger()
    # Reset handlers to avoid duplicates on repeated runs
    root.handlers.clear()
    root.setLevel(py_logging.DEBUG)
    root.addHandler(debug_handler)
    root.addHandler(info_handler)
    root.addHandler(console_handler)

