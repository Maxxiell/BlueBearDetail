#!/usr/bin/env bash
# Serves the site so book-flow.html works (ES modules + Supabase need http://, not file://).
cd "$(dirname "$0")"
echo "Open in your browser: http://127.0.0.1:8765/book-flow.html"
echo "Press Ctrl+C to stop."
python3 -m http.server 8765
