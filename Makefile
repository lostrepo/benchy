.PHONY: help docker marko benchy ssr upgrade

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9\/_\.-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

docker: ## build the docker image
	docker build -t benchy -f docker-build/Dockerfile docker-build/

benchy: ## run the benchy container with an interactive shell
	sh -c 'docker run -it --rm -v ./:/bench --privileged benchy:latest /bin/bash'

upgrade: ## upgrade the runtimes (inside the container)
	bun upgrade
	deno upgrade

marko: ## run the marko html templating benchmark (inside the container)
	cd marko && bun install && cd ..
	deno run -A --unstable marko.js

ssr: ## run the ssr benchmark (inside the container)
	cd marko && bun install && cd ..
	deno run -A --unstable ssr.js
