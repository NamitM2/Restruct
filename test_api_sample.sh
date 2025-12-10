#!/bin/bash
# Quick test of Restruct API with curl

curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer rst_oYVXpEl6jw45n8COI7d8sMDcRxSCOJHwPu2xx56GZbc" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
