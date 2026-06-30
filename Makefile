# G3 single-binary build.
DIST := server/internal/httpd/dist
OUT  := g3.exe

.PHONY: build web embed go run clean

build: web embed go ## Full build: frontend export -> embed -> single binary

web: ## Static-export the Next.js frontend to out/
	npm run build

embed: ## Copy the static export into the Go embed directory
	rm -rf $(DIST)
	mkdir -p $(DIST)
	cp -r out/. $(DIST)/
	touch $(DIST)/.gitkeep

go: ## Compile the Go server into the single binary
	go -C server build -o ../$(OUT) ./cmd/g3

run: ## Run the built binary
	./$(OUT)

clean:
	rm -rf out $(DIST)/* $(OUT)
	touch $(DIST)/.gitkeep
