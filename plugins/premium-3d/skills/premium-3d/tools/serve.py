#!/usr/bin/env python3
"""Serveur local du dossier courant : python3 tools/serve.py [port]  (par défaut 5180)

Plusieurs requêtes à la fois (le navigateur de check.mjs charge modules, polices et images en
parallèle), port réutilisable tout de suite après un arrêt, et pas de cache : une page modifiée
est relue telle quelle au contrôle suivant."""
import http.server, sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml",
        ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
        ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".ktx2": "image/ktx2",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):  # silencieux : le rapport de check.mjs suffit
        pass


class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


with Server(("127.0.0.1", port), Handler) as httpd:
    print(f"http://127.0.0.1:{port}", flush=True)
    httpd.serve_forever()
