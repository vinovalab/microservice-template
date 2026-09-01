# __MICROSERVICE_NAME__

__DESCRIPTION__

## How this service is built

This service started from the Vinova Lab microservice template. Logging,
configuration, health, `/status/*`, graceful shutdown and the Redis bus are
already provided by `@vinovalab/backbone-shared` — none of them should be
reimplemented here.

**Read [Using the service template](https://vinovalab.ai/work-with-us/use-of-template)
before adding anything.** It covers what the template already solves, how to use
the logger and the Redis bus, and — the rule most often broken — how to add new
behaviour in its own file instead of growing `server.js`.

The conventions every delivery is reviewed against are in the
[engineering guidelines](https://vinovalab.ai/work-with-us/engineering-guidelines).

## Documentation

- `GET /` — Express landing page.
- `GET /docs/readme` — this README rendered as HTML.
- `GET /docs/readme.md` — raw Markdown.
- `GET /status/health` — machine-readable health status.
- `GET /health` — human-readable health page.
