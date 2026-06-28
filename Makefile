.PHONY: install build test dev compose-up compose-down tree

install:
	corepack enable
	pnpm install

build:
	pnpm -r build

test:
	pnpm -r test

dev:
	pnpm -r --parallel dev

compose-up:
	docker compose -f docker-compose.dev.yml up -d

compose-down:
	docker compose -f docker-compose.dev.yml down

tree:
	find . -maxdepth 4 -type f | sort
