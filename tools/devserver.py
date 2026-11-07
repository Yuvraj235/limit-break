#!/usr/bin/env python3
"""Static dev server with caching disabled, so edited ES modules always reload.

Usage: python3 tools/devserver.py [port]   (default 8000, serves the project root)

It also accepts POST /__report from the live gesture check (http://localhost:8000/?check, see
tests/livecheck.js) and appends each report as a JSON line to REPORT_PATH, so live webcam numbers
can be read from a terminal.
"""
import functools
import http.server
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT_PATH = os.environ.get('LB_REPORT', os.path.join(tempfile.gettempdir(), 'limit-break-live.jsonl'))
MAX_REPORT_BYTES = 256 * 1024


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def do_POST(self):
        if self.path != '/__report':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_REPORT_BYTES:
            self.send_error(413)
            return
        try:
            entries = json.loads(self.rfile.read(length))
        except ValueError:
            self.send_error(400)
            return
        with open(REPORT_PATH, 'a', encoding='utf-8') as f:
            for entry in entries if isinstance(entries, list) else [entries]:
                f.write(json.dumps(entry, separators=(',', ':')) + '\n')
        self.send_response(204)
        self.end_headers()


class Server(http.server.ThreadingHTTPServer):
    # The default backlog of 5 resets connections when a tunnel (cloudflared) fetches every module at once.
    request_queue_size = 128


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with Server(('127.0.0.1', port), handler) as httpd:
        print(f'Serving {ROOT} at http://localhost:{port} (no-cache); live check reports → {REPORT_PATH}')
        httpd.serve_forever()
