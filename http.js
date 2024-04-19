import { http } from './lib/bench.js'

const config = {
  runs: 1, // number of runs for each framework
  warmups: 0, // number of warmup runs
  warmupDuration: 10, // duration of warmup runs
  threads: 2, // wrk threads
  duration: 10, // wrk duration
  conn: 64, // wrk connections
  quiet: false, // turn off terminal output
  strace: true, // run bench with strace and capture output (linux only)
  flame: true // run bench with flamegraph and output to {name}.svg
}

// these need to be changed according to cpu profile of host system
// this is for an 8-core, 16 thread machine
const pinning = ['0,1', '6,7']

const raw = [
  {
    name: 'deno-hello',
    cmdline: 'deno run -A ./deno-hello.js',
    port: 7000,
    pinning: pinning
  },
  {
    name: 'bun-hello',
    cmdline: 'bun ./bun-hello.js',
    port: 6000,
    pinning: pinning // optional, only works on linux - needs to be tuned for target machine
  },
]

await http({ raw }, config)
