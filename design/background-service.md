# Shared

## expo app

- queue hook to manage calls to the queue and music session
- audio context to manage calls to the players

# Android side
- queue operations from expo send events to the native side
- expo can request the latest session and player state
- native module manages remote and local playback state and queue

# Web side
- playback state and music session are kept in the expo app