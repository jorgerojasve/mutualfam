# CivicCore Framework

CivicCore is an open-source framework for building robust, modular backends for civic organizations, cooperatives, mutuals, and scientific societies.

It provides pre-built, decoupled modules for common organizational needs:

- **Membership**: Robust member registry, extensible profiles, statuses (Pending/Active), and role-based access control.
- **Governance**: Proposal lifecycle, deliberation, and extensible voting mechanisms (Simple, Quadratic, Credit-based).
- **Payments** (Coming Soon): Periodic fees, transactions, and verifiable records.
- **Authorship** (Coming Soon): Document records, official minutes, and attribution.

## Core Philosophy

- **Modular**: Use only the modules you need.
- **Extensible**: Designed to be extended without breaking the core models (e.g., via `extra_fields` JSON columns and extensible Enums).
- **Domain-Neutral**: Uses generic terminology (`Member`, `Proposal`, `Payment`) that adapts to your organization's domain (e.g., `Socio`, `Investigador`, `Cuota`).

## Getting Started

CivicCore is built on top of FastAPI and SQLAlchemy. 

### Minimal Application

```python
from civiccore.factory import create_app
from uvicorn import run

# Create a FastAPI app with Membership and Governance modules enabled
app = create_app(
    include_membership=True,
    include_governance=True
)

if __name__ == "__main__":
    run(app, host="0.0.0.0", port=8000)
```

## Documentation

See the `docs/` folder (coming soon) for detailed module documentation.
Check out the `examples/` directory for templates of how to use CivicCore in different domains.
