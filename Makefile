.PHONY: install build test dev db-migrate compose-up compose-down tree

install:
	./scripts/pnpm-workspace.sh install

build:
	./scripts/pnpm-workspace.sh -r build

test:
	./scripts/pnpm-workspace.sh -r test

dev:
	./scripts/pnpm-workspace.sh -r --parallel dev

db-migrate:
	./scripts/pnpm-workspace.sh --filter @buildsphere/service-core db:migrate

compose-up:
	docker compose -f docker-compose.dev.yml up -d

compose-down:
	docker compose -f docker-compose.dev.yml down

tree:
	find . -maxdepth 4 -type f | sort
