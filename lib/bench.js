import * as colors from 'https://deno.land/std@0.164.0/fmt/colors.ts'
import { run, watch, usage } from './proc.js'
import { parsers } from './parsers.js'

const { green, yellow, magenta, cyan } = colors
const decoder = new TextDecoder()

const sleep = ms => new Promise(ok => setTimeout(ok, ms))

async function versions () {
  const versions = {
    deno: decoder.decode((await run('deno', ['--version']).waitfor()).out).trim(),
    node: decoder.decode((await run('node', ['-v']).waitfor()).out).trim(),
    bun: decoder.decode((await run('bun', ['--version']).waitfor()).out).trim(),
  }
/*
  try {
    versions['deno-canary'] = decoder.decode((await run('deno-canary', ['--version']).waitfor()).out).trim()
  } catch (err) {
    console.log('deno-canary not found for versions, ignoring')
  }
*/
  return versions
}

async function load (path) {
  let results = {}
  try {
    results = JSON.parse(await Deno.readTextFile(path))
  } catch (err) {}
  return results
}

function save (path, results) {
  return Deno.writeTextFile(path, JSON.stringify(results))
}

async function test (httpd, port = 3000, path = '', attempts = 10) {
  while (attempts--) {
    const curl = run ('curl', [
      '-f', '-s', '--http1.1', '-o', '/dev/null', `http://127.0.0.1:${port}/${path}`
    ])
    await curl.waitfor()
//    console.log(`test ${curl.status.code}`)
    if (curl.status.code === 0) return
    Deno.stdout.write(curl.out)
    Deno.stdout.write(curl.err)
    await sleep(1000)
  }
  await httpd.waitfor()
  console.error(`httpd exit status ${httpd.status.code}`)
  console.error(`out\n${decoder.decode(httpd.out)}`)
  console.error(`err\n${decoder.decode(httpd.err)}`)
  throw new Error('Httpd not responding')
}

async function testWS (httpd, port = 3000, attempts = 10) {
  while (attempts--) {
    try {
      await Deno.connect({ port })
      return
    } catch (err) {
      await sleep(1000)
    }
  }
  await httpd.waitfor()
  console.error(`httpd exit status ${httpd.status.code}`)
  console.error(`out\n${decoder.decode(httpd.out)}`)
  console.error(`err\n${decoder.decode(httpd.err)}`)
  throw new Error('Httpd not responding')
}

async function web (name, cmd, args, port = 3000, cwd = '', config, pinning) {
  const { 
    runs = 3, warmups = 3, threads = 2, warmupDuration = 10, duration = 30, 
    conn = 256, quiet = false
  } = config

  pinning = pinning || config.pinning
  if (Deno.build.os !== 'linux') pinning = null

  let pwd = Deno.cwd()
  const results = []

  for (let r = 1; r <= runs; r++) {
    let httpd
    if (cwd) Deno.chdir(cwd)
    if (pinning) {
      httpd = run('taskset', ['--cpu-list', pinning[0], cmd, ...args])
    } else {
      httpd = run(cmd, args)
    }
    if (cwd) Deno.chdir(pwd)
    await test(httpd, port)
    for (let w = 1; w <= warmups; w++) {
      const wrk = run('wrk', [
        '-t', threads, '-d', warmupDuration, '-c', conn, 
        `http://127.0.0.1:${port}/`
      ])
      await wrk.waitfor()
      const bench = parsers.wrk(decoder.decode(wrk.out))
      if (!quiet) console.log(`${green(name)} warmup ${w} ${yellow('rps')} ${bench.rps}`)
    }
    watch(httpd)
    let wrk
    if (pinning) {
      wrk = watch(run('taskset', ['--cpu-list', pinning[1], 'wrk',
        '-t', threads, '-d', duration, '-c', conn, '-s', './bench.lua', 
        `http://127.0.0.1:${port}/`
      ]))
    } else {
      wrk = watch(run('wrk', [
        '-t', threads, '-d', duration, '-c', conn, '-s', './bench.lua', 
        `http://127.0.0.1:${port}/`
      ]))
    }
    await wrk.waitfor()
    httpd.kill()
    await httpd.waitfor()
    const result = {
      wrk: { status: wrk.status.code },
      httpd: { status: httpd.status.code }
    }
    result.wrk.stats = wrk.stats
    result.httpd.stats = httpd.stats
    result.wrk.usage = usage(wrk.stats)
    result.httpd.usage = usage(httpd.stats)
    result.bench = parsers.wrk(decoder.decode(wrk.out))
    const { rps, latency } = result.bench
    const { cpu, memory } = result.httpd.usage
    const ratepercore = Math.ceil(rps / cpu)
    result.bench.rate = rps
    result.bench.ratepercore = ratepercore
    if (!quiet) {
      console.log([
        green(name.slice(0, 16).padEnd(16, ' ')),
        r.toString().padStart(3, ' '),
        ' / ',
        runs.toString().padEnd(3, ' '),
        rps.toString().padStart(10, ' '),
        magenta(' rate '),
        ratepercore.toString().padStart(10, ' '),
        magenta(' rate/core '),
        cpu.toFixed(2).toString().padStart(8, ' '),
        yellow(' cpu '),
        memory.toString().padStart(12, ' '),
        yellow(' mem '),
        result.wrk.usage.cpu.toFixed(2).toString().padStart(8, ' '),
        magenta(' wcpu '),
        latency.average.toFixed(2).toString().padStart(10, ' '),
        cyan(' avg (μs) '),
        latency.max.toFixed(2).toString().padStart(10, ' '),
        cyan(' max (μs)'),
      ].join(''))
    }
    results.push(result)
  }

  if (config.strace) {
    if (!quiet) console.log(`${green(name)} running strace`)
    if (cwd) Deno.chdir(cwd)
    const httpd = run('strace', ['-e', 'trace=\!futex', '-cf', cmd, ...args])
    if (cwd) Deno.chdir(pwd)
    await test(httpd, port)
    const wrk = run('wrk', [
      '-t', threads, '-d', duration, '-c', conn, '-s', './bench.lua', 
      `http://127.0.0.1:${port}/`
    ])
    await wrk.waitfor()
    httpd.kill()
    await httpd.waitfor()
    const result = { 
      wrk: { status: wrk.status.code }, 
      httpd: { status: httpd.status.code }
    }
    result.bench = parsers.wrk(decoder.decode(wrk.out))
    result.strace = parsers.strace(decoder.decode(httpd.err))
    results.push(result)
  }

  if (config.flame) {
    if (!quiet) console.log(`${green(name)} running flamegraph`)
    if (cwd) Deno.chdir(cwd)
    const httpd = run(cmd, args)
    if (cwd) Deno.chdir(pwd)
    await test(httpd, port)
    const wrk = run('wrk', [
      '-t', threads, '-d', duration, '-c', conn, '-s', './bench.lua', 
      `http://127.0.0.1:${port}/`
    ])
    const flame = run('flamegraph', [
      '--freq', '4000', '--no-inline', '-o', `${name}.svg`, '--pid', httpd.pid
    ], Deno.cwd(), { stdout: 'null', stderr: 'null', stdin: 'null' })
    await wrk.waitfor()
    httpd.kill('SIGINT')
    await httpd.waitfor()
    await flame.waitfor(true)
    const result = { 
      wrk: { status: wrk.status.code }, 
      httpd: { status: httpd.status.code }
    }
    result.bench = parsers.wrk(decoder.decode(wrk.out))
    result.flame = `${name}.svg`
    results.push(result)
  }

  return results
}

async function websock (name, cmd, args, port = 3000, config, pinning) {
  const { 
    runs = 3, warmups = 3, warmupTimeouts = 2, timeouts = 10, 
    conn = 256, size = 1, quiet = false
  } = config

  pinning = pinning || config.pinning
  if (Deno.build.os !== 'linux') pinning = null

  const results = []

  for (let r = 1; r <= runs; r++) {
    let httpd
    if (pinning) {
      httpd = run('taskset', ['--cpu-list', pinning[0], cmd, ...args])
    } else {
      httpd = run(cmd, args)
    }
    await testWS(httpd, port)
    for (let w = 1; w <= warmups; w++) {
      const wsb = run('./ws_bench', [conn, '127.0.0.1', port, size, warmupTimeouts])
      await wsb.waitfor()
      const bench = parsers.wsb(decoder.decode(wsb.out))
      const rate = Math.max(...bench.map(v => v.rate))
      if (!quiet) console.log(`${green(name)} warmup ${w} ${yellow('rate')} ${rate}`)
    }
    watch(httpd)
    let wsb
    if (pinning) {
      wsb = watch(run('taskset', ['--cpu-list', pinning[1], './ws_bench',
        conn, '127.0.0.1', port, size, timeouts
      ]))
    } else {
      wsb = watch(run('./ws_bench', [conn, '127.0.0.1', port, size, timeouts]))
    }
    await wsb.waitfor()
    httpd.kill()
    await httpd.waitfor()
    const result = {
      wsb: { status: wsb.status.code },
      httpd: { status: httpd.status.code }
    }
    result.wsb.stats = wsb.stats
    result.httpd.stats = httpd.stats
    result.wsb.usage = usage(wsb.stats)
    result.httpd.usage = usage(httpd.stats)
    result.bench = { data: parsers.wsb(decoder.decode(wsb.out)) }
    const rate = Math.max(...result.bench.data.map(v => v.rate))
    const { cpu, memory } = result.httpd.usage
    const ratepercore = Math.ceil(rate / cpu)
    result.bench.ratepercore = ratepercore
    result.bench.rate = rate
    if (!quiet) {
      console.log([
        green(name.slice(0, 16).padEnd(16, ' ')),
        r.toString().padStart(3, ' '),
        ' / ',
        runs.toString().padEnd(3, ' '),
        rate.toString().padStart(10, ' '),
        magenta(' rate '),
        ratepercore.toString().padStart(10, ' '),
        magenta(' rate/core '),
        cpu.toFixed(2).toString().padStart(8, ' '),
        yellow(' cpu '),
        memory.toString().padStart(12, ' '),
        yellow(' mem '),
        result.wsb.usage.cpu.toFixed(2).toString().padStart(8, ' '),
        magenta(' wcpu '),
      ].join(''))
    }
    results.push(result)
  }

  if (config.strace) {
    if (!quiet) console.log(`${green(name)} running strace`)
    const httpd = run('strace', ['-e', 'trace=\!futex', '-cf', cmd, ...args])
    await testWS(httpd, port)
    const wsb = run('./ws_bench', [conn, '127.0.0.1', port, size, timeouts])
    await wsb.waitfor()
    httpd.kill()
    await httpd.waitfor()
    const result = { 
      wsb: { status: wsb.status.code }, 
      httpd: { status: httpd.status.code }
    }
    result.bench = parsers.wsb(decoder.decode(wsb.out))
    result.strace = parsers.strace(decoder.decode(httpd.err))
    results.push(result)
  }

  if (config.flame) {
    if (!quiet) console.log(`${green(name)} running flamegraph`)
    const httpd = run(cmd, args)
    await testWS(httpd, port)
    const wsb = run('./ws_bench', [conn, '127.0.0.1', port, size, timeouts])
    const flame = run('flamegraph', [
      '--freq', '4000', '--no-inline', '-o', `${name}.svg`, '--pid', httpd.pid
    ], Deno.cwd(), { stdout: 'null', stderr: 'null', stdin: 'null' })
    await wsb.waitfor()
    httpd.kill('SIGINT')
    await httpd.waitfor()
    await flame.waitfor(true)
    const result = { 
      wsb: { status: wsb.status.code }, 
      httpd: { status: httpd.status.code }
    }
    result.bench = parsers.wsb(decoder.decode(wsb.out))
    result.flame = `${name}.svg`
    results.push(result)
  }

  return results
}

async function http (suites, config) {
  config.type = 'http'
  config.timestamp = new Date()
  config.versions = await versions()
  const results = await load('http.json')
  if (!results.config) {
    results.config = { suites, config }
  }
  if (Deno.build.os !== 'linux') config.strace = false
  if (Deno.build.os == 'linux' && !results.cpuinfo) {
    results.cpuinfo = parsers.cpuinfo(decoder.decode(await Deno.readFile('/proc/cpuinfo')))
  }
  const names = Object.keys(suites)
  for (const suiteName of names) {
    const suite = suites[suiteName]
    const bench = results[suiteName] = (results[suiteName] || {})
    for (const test of suite) {
      if (test.off) continue
      const { name, cmdline, port, pinning, cwd = '' } = test
      const [cmd, ...args] = cmdline.split(' ')
      if (!(await runtimeAvailable(cmd))) {
        console.error(`runtime ${cmd} not found, skipping`)
        continue
      }
      if (bench[name]) {
        console.log(`skipping ${green(name)} in ${yellow(suiteName)}`)
        continue
      }
      bench[name] = await web(name, cmd, args, port, cwd, config, pinning)
      await save('http.json', results)
      console.log(`saving ${green(name)} in ${yellow(suiteName)}`)
    }
  }
  return results
}

async function runtimeAvailable (cmd) {
  try {
    const test = run(cmd, ['--help'], Deno.cwd(), 
      { stdin: 'null', stdout: 'null', stderr: 'null' })
    const timeout = () => new Promise(ok => setTimeout(ok, 3000))
    const p = await Promise.race([test.waitfor(true), timeout()])
    if (!p) {
      // the process ran but is hung, so we need to kill it
      test.kill()
      await test.status()
    }
    return true
  } catch (err) {
    // the process failed to run
    return false
  }
}

async function websocket (suites, config) {
  config.type = 'websocket'
  config.timestamp = new Date()
  config.versions = await versions()
  const results = await load('websocket.json')
  if (!results.config) {
    results.config = { suites, config }
  }
  if (Deno.build.os !== 'linux') config.strace = false
  if (Deno.build.os == 'linux' && !results.cpuinfo) {
    results.cpuinfo = parsers.cpuinfo(decoder.decode(await Deno.readFile('/proc/cpuinfo')))
  }
  const names = Object.keys(suites)
  for (const suiteName of names) {
    const suite = suites[suiteName]
    const bench = results[suiteName] = (results[suiteName] || {})
    for (const test of suite) {
      if (test.off) continue
      const { name, cmdline, port, pinning } = test
      const [cmd, ...args] = cmdline.split(' ')
      if (!(await runtimeAvailable(cmd))) {
        console.error(`runtime ${cmd} not found, skipping`)
        continue
      }
      if (bench[name]) {
        console.log(`skipping ${green(name)} in ${yellow(suiteName)}`)
        continue
      }
      bench[name] = await websock(name, cmd, args, port, config, pinning)
      await save('websocket.json', results)
      console.log(`saving ${green(name)} in ${yellow(suiteName)}`)
    }
  }
  return results
}

export { http, websocket, versions }
