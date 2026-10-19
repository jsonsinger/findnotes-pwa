# Local test server for FindNotes. Run:  python serve.py
# Then open the address it prints on your phone (same Wi-Fi as this computer).
# Unlike "python -m http.server", it tells the browser never to cache, so the phone
# always gets your latest files instead of a mix of old and new ones.
import gzip
import http.server
import io
import os
import socket
import subprocess
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # Text files go out compressed, as GitHub Pages sends them, so a Lighthouse test on this
    # computer measures what phones really download.
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        if not (path.endswith((".html", ".js", ".css", ".svg", ".webmanifest")) and os.path.isfile(path)
                and "gzip" in self.headers.get("Accept-Encoding", "")):
            return super().send_head()
        with open(path, "rb") as f:
            data = gzip.compress(f.read())
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        return io.BytesIO(data)


def my_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # nothing is sent, this just picks the network card
        return s.getsockname()[0]
    except OSError:
        return "<this computer's IP>"


PORT = 8000
# Before anything else: is sw.js ready to work offline? (see check.py)
subprocess.run([sys.executable, "check.py"], cwd=os.path.dirname(os.path.abspath(__file__)))
print()
print(f"On this computer: http://localhost:{PORT}")
print(f"On your phone:    http://{my_address()}:{PORT}")
http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCache).serve_forever()
