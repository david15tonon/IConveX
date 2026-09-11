// Stand-in worker: exits without saying anything, which is what happens when a
// worker is killed outright — running out of memory during a large conversion,
// for instance. The parent must reject rather than leave the job converting
// forever.
process.exit(3);
