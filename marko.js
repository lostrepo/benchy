import { http } from './lib/bench.js'

const config = {
  runs: 3, // number of runs for each framework
  warmups: 0, // number of warmup runs
  warmupDuration: 30, // duration of warmup runs
  threads: 2, // wrk threads
  duration: 30, // wrk duration
  conn: 8, // wrk connections
  quiet: false, // turn off terminal output
  strace: true, // run bench with strace and capture output (linux only)
  flame: true // run bench with flamegraph and output to {name}.svg
}

const pinning = ['0,1', '6,7']

const marko = [
  {
    name: 'node-marko',
    cwd: 'marko',
    cmdline: 'node marko-node.mjs',
    port: 5000,
    pinning: pinning,
  },
  {
    name: 'deno-marko',
    cwd: 'marko',
    cmdline: 'deno run -A --unstable-net marko-deno.js',
    port: 4000,
    pinning: pinning,
  },
  {
    name: 'bun-marko',
    cwd: 'marko',
    cmdline: 'bun-profile marko-bun.js',
    port: 3000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
  },
]

await http({ marko }, config)
