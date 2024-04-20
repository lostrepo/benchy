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

const ssr = [
  {
    name: 'node-ssr',
    cwd: 'ssr',
    cmdline: 'node ssr-node.mjs 1000',
    port: 3000,
    pinning: pinning,
  },
  {
    name: 'deno-ssr',
    cwd: 'ssr',
    cmdline: 'deno run -A --unstable-net ssr-deno.js 1000',
    port: 4000,
    pinning: pinning,
  },
  {
    name: 'bun-ssr',
    cwd: 'ssr',
    cmdline: 'bun-profile ssr-bun.js 1000',
    port: 5000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
  },
  {
    name: 'lo-ssr',
    cwd: 'ssr',
    cmdline: 'lo ssr-lo.js 1000',
    port: 6000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
  },
]

await http({ ssr }, config)
