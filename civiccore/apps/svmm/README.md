# Scientific Society - CivicCore Template

This is a template demonstrating how to use the CivicCore framework to build a backend for a Scientific Society.

## Features Mapped to CivicCore

- **Members**: Represent Researchers, Fellows, and Students.
- **Governance**: Used for electing the board of directors and approving resolutions.
- **Authorship** (Planned): To record official minutes and publications.

## Project Structure

- `app.py`: The main FastAPI application factory.
- `.env`: Configuration file.

## Running the Template

Ensure you have installed the `civiccore` backend package.

```bash
# 1. Copy the environment variables template
cp .env.example .env

# 2. Run the application
uvicorn app:app --reload
```
