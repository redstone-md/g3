package httpd

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"path"
	"strings"
)

// distFS holds the embedded static frontend. The build copies Next's `out/`
// into ./dist before `go build`. A committed .gitkeep keeps this compilable
// before the first frontend build (the handler then serves a placeholder).
//
//go:embed all:dist
var distFS embed.FS

// contentTypes maps file extensions to MIME types explicitly, avoiding
// platform-dependent results from mime.TypeByExtension (e.g. Windows registry).
var contentTypes = map[string]string{
	".html": "text/html; charset=utf-8",
	".js":   "text/javascript; charset=utf-8",
	".css":  "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg":  "image/svg+xml",
	".ico":  "image/x-icon",
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".webp": "image/webp",
	".woff2": "font/woff2",
	".woff":  "font/woff",
	".txt":   "text/plain; charset=utf-8",
	".map":   "application/json; charset=utf-8",
}

type spaHandler struct {
	fsys fs.FS
}

func newStaticHandler() (http.Handler, error) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, err
	}
	return spaHandler{fsys: sub}, nil
}

// existsFile reports whether name is a regular file (not a directory). The
// static export emits both `route.html` and a `route/` directory, so matching
// directories here would shadow the HTML we actually want to serve.
func existsFile(fsys fs.FS, name string) bool {
	info, err := fs.Stat(fsys, name)
	return err == nil && !info.IsDir()
}

// resolve maps a request path to a file in the export. Static export emits one
// `<route>.html` per route (e.g. /dashboard/users -> dashboard/users.html).
func resolve(fsys fs.FS, urlPath string) (name string, status int) {
	p := strings.TrimPrefix(path.Clean("/"+urlPath), "/")
	if p == "" {
		return "index.html", http.StatusOK
	}
	if existsFile(fsys, p) {
		return p, http.StatusOK
	}
	if !strings.Contains(path.Base(p), ".") {
		if existsFile(fsys, p+".html") {
			return p + ".html", http.StatusOK
		}
		if existsFile(fsys, p+"/index.html") {
			return p + "/index.html", http.StatusOK
		}
	}
	if existsFile(fsys, "404.html") {
		return "404.html", http.StatusNotFound
	}
	return "", http.StatusNotFound
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name, status := resolve(h.fsys, r.URL.Path)
	if name == "" {
		http.Error(w, "frontend bundle not built", http.StatusNotFound)
		return
	}

	f, err := h.fsys.Open(name)
	if err != nil {
		log.Printf("static open %q: %v", name, err)
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		log.Printf("static read %q: %v", name, err)
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}

	if ct, ok := contentTypes[strings.ToLower(path.Ext(name))]; ok {
		w.Header().Set("Content-Type", ct)
	}
	// Next emits content-hashed asset filenames — safe to cache aggressively.
	if strings.HasPrefix(name, "_next/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else if strings.HasSuffix(name, ".html") {
		w.Header().Set("Cache-Control", "no-cache")
	}

	w.WriteHeader(status)
	_, _ = w.Write(data)
}
