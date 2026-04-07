#! /bin/bash

cd web-server
source venv/bin/activate
uv run python -m bin.worker.py
