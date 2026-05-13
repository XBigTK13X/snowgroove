#! /bin/bash

source script/variables.sh

cd web-server

uv run python -m pytest -p no:warnings --verbose -s bin/test/*