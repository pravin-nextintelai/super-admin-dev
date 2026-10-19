# infrastructure/queue
Reserved for a message queue adapter (e.g. Cloud Tasks / Pub/Sub). Today long-running work (reconciliation runs, document processing) executes in-process; move it behind a queue here when scaling to multiple instances.
