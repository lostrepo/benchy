import { http } from './lib/bench.js'

const config = {
  runs: 3, // number of runs for each framework
  warmups: 1, // number of warmup runs
  warmupDuration: 30, // duration of warmup runs
  threads: 2, // wrk threads
  duration: 30, // wrk duration
  conn: 8, // wrk connections
  quiet: false, // turn off terminal output
  strace: true, // run bench with strace and capture output (linux only)
  flame: true, // run bench with flamegraph and output to {name}.svg
  nice: '20'
}

const pinning = ['1', '6,7']

const ssr = [
  {
    name: 'node-ssr-1',
    cwd: 'ssr',
    cmdline: 'node ssr-node.mjs 1',
    port: 3000,
    pinning: pinning,
//    off: true
  },
  {
    name: 'node-ssr-10',
    cwd: 'ssr',
    cmdline: 'node ssr-node.mjs 10',
    port: 3000,
    pinning: pinning,
//    off: true
  },
  {
    name: 'node-ssr-1000',
    cwd: 'ssr',
    cmdline: 'node ssr-node.mjs 1000',
    port: 3000,
    pinning: pinning,
//    off: true
  },
  {
    name: 'deno-ssr-1',
    cwd: 'ssr',
    cmdline: 'deno run -A --unstable-net ssr-deno.js 1',
    port: 4000,
    pinning: pinning,
//    off: true
  },
  {
    name: 'deno-ssr-10',
    cwd: 'ssr',
    cmdline: 'deno run -A --unstable-net ssr-deno.js 10',
    port: 4000,
    pinning: pinning,
//    off: true
  },
  {
    name: 'deno-ssr-1000',
    cwd: 'ssr',
    cmdline: 'deno run -A --unstable-net ssr-deno.js 1000',
    port: 4000,
    pinning: pinning,
//    off: true
  },
  {
    name: 'bun-ssr-1',
    cwd: 'ssr',
    cmdline: 'bun-profile ssr-bun.js 1',
    port: 5000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
//    off: true
  },
  {
    name: 'bun-ssr-10',
    cwd: 'ssr',
    cmdline: 'bun-profile ssr-bun.js 10',
    port: 5000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
//    off: true
  },
  {
    name: 'bun-ssr-1000',
    cwd: 'ssr',
    cmdline: 'bun-profile ssr-bun.js 1000',
    port: 5000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
//    off: true
  },
  {
    name: 'lo-ssr-1',
    cwd: 'ssr',
    cmdline: 'lo ssr-lo.js 1',
    port: 6000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
//    off: true
  },
  {
    name: 'lo-ssr-10',
    cwd: 'ssr',
    cmdline: 'lo ssr-lo.js 10',
    port: 6000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
//    off: true
  },
  {
    name: 'lo-ssr-1000',
    cwd: 'ssr',
    cmdline: 'lo ssr-lo.js 1000',
    port: 6000,
    pinning: pinning, // optional, only works on linux - needs to be tuned for target machine
//    off: true
  },
]

await http({ ssr }, config)
