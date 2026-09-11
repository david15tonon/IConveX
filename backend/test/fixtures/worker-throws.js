// Stand-in worker: fails before it can report anything, so the parent only sees
// the Worker 'error' event.
throw new Error('worker blew up on startup');
