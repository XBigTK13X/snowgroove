#! /bin/bash

cd web-server
source venv/bin/activate
npx nodemon --exec python -m bin.worker.py
