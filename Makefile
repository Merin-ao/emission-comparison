# Emissions tool server — convenience runner.
#
#   make install     # install server/ deps
#   make tools       # start the tool server on :$(TOOL_PORT)
#   make serve       # start `zap serve` with local widgets
#   make start       # boot tool server + zap serve together (Ctrl+C stops both)
#   make lint-spec   # zap lint the tool server's OpenAPI (server must be running)
#   make eval        # run evals
#   make stop        # kill anything on :$(TOOL_PORT) / :$(SERVE_PORT)

AWS_PROFILE ?= zn-stage
AWS_REGION  ?= eu-west-1
TOOL_PORT   ?= 9001
SERVE_PORT  ?= 3000

.DEFAULT_GOAL := help

.PHONY: help
help:
	@awk 'BEGIN{FS=":.*##"} /^[a-z][a-zA-Z0-9_-]+:.*##/ {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## install deps for the tool server
	cd server && npm install --no-audit --no-fund

.PHONY: tools
tools: ## start the emissions tool server on :$(TOOL_PORT)
	cd server && PORT=$(TOOL_PORT) npm start

.PHONY: patch-splash
patch-splash: ## inject the Vessel Tinder welcome splash into the installed frontend
	node scripts/patch-welcome-splash.mjs

.PHONY: unpatch-splash
unpatch-splash: ## restore the stock ZAP welcome splash
	node scripts/patch-welcome-splash.mjs --restore

.PHONY: serve
serve: patch-splash ## start `zap serve` with local widgets (splash patched first)
	AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) zap serve --widgets ./zap-widgets

.PHONY: start
start: stop patch-splash ## boot tool server + zap serve together (logs interleaved; Ctrl+C stops both)
	@echo ">> launching tool server (:$(TOOL_PORT)) and zap serve (:$(SERVE_PORT))"
	@trap 'echo; echo ">> shutting down"; lsof -ti :$(TOOL_PORT) :$(SERVE_PORT) 2>/dev/null | xargs kill 2>/dev/null; exit 0' INT TERM; \
	(cd server && PORT=$(TOOL_PORT) npm start 2>&1 | sed -e 's/^/[tools] /') & \
	sleep 2; \
	AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) zap serve --widgets ./zap-widgets 2>&1 | sed -e 's/^/[serve] /'; \
	wait

.PHONY: lint-spec
lint-spec: ## zap lint the tool server's OpenAPI (server must be running)
	zap lint http://localhost:$(TOOL_PORT)/openapi.json

.PHONY: eval
eval: ## run all evals
	AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION) zap eval

.PHONY: stop
stop: ## kill anything bound to the tool / serve ports
	@lsof -ti :$(TOOL_PORT) :$(SERVE_PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@echo ">> ports $(TOOL_PORT) and $(SERVE_PORT) are free"
