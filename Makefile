# Makefile for Descargador
.PHONY: help build up down logs shell test lint format clean

# Default target
help:
	@echo "Descargador - Docker Commands"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  build       Build Docker image"
	@echo "  up          Start production container"
	@echo "  up-dev      Start development container with hot reload"
	@echo "  down        Stop and remove containers"
	@echo "  logs        Follow container logs"
	@echo "  shell       Open shell in running container"
	@echo "  test        Run tests in container"
	@echo "  lint        Run linters (ruff, mypy)"
	@echo "  format      Format code (ruff, black)"
	@echo "  clean       Remove containers, images, volumes"
	@echo "  restart     Restart production container"

# Build production image
build:
	docker compose build app

# Build development image
build-dev:
	docker compose build app-dev

# Start production
up:
	docker compose up -d app

# Start development with hot reload
up-dev:
	docker compose --profile dev up -d app-dev

# Stop and remove
down:
	docker compose down

# Stop and remove with volumes
down-v:
	docker compose down -v

# Follow logs
logs:
	docker compose logs -f

# Shell into running container
shell:
	docker compose exec app bash

# Shell into dev container
shell-dev:
	docker compose exec app-dev bash

# Run tests
test:
	docker compose run --rm app pytest -v

# Run tests with coverage
test-cov:
	docker compose run --rm app pytest --cov=app --cov-report=term-missing

# Lint
lint:
	docker compose run --rm app ruff check .
	docker compose run --rm app mypy app

# Format
format:
	docker compose run --rm app ruff check --fix .
	docker compose run --rm app black .

# Clean everything
clean:
	docker compose down -v --rmi all --remove-orphans
	docker system prune -f

# Restart production
restart:
	docker compose restart app

# Show status
ps:
	docker compose ps

# Health check
health:
	curl -f http://localhost:8000/api/health || exit 1

# View image size
size:
	docker images descargador*

# Development workflow: build, up, logs
dev: build-dev up-dev logs

# Production workflow: build, up
prod: build up