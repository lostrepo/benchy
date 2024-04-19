import pidusage from "npm:pidusage"

function usage (stats) {
  if (!(stats && stats.length)) {
    return { memory: 0, cpu: 0 }
  }
  let { elapsed, ctime } = stats[0]
  const last = stats.length -1
  let cpu = 0.0

  for (const stat of stats.slice(1)) {
    const cdiff = stat.ctime - ctime
    const ediff = stat.elapsed - elapsed
    cpu += cdiff / ediff
    elapsed = stat.elapsed
    ctime = stat.ctime
  }

  cpu = Math.ceil((cpu / last) * 100) / 100 
  const memory = Math.max(...stats.map(st => st.memory))
  return { memory, cpu }
}

function run (cmdline = '', args = [], path = Deno.cwd(), 
  stdio = { stdout: 'piped', stderr: 'piped', stdin: 'null' }) {
  const config = {
    cmd: [cmdline, ...args],
    cwd: path,
    stdout: stdio.stdout || 'piped',
    stderr: stdio.stdout || 'piped',
    stdin: stdio.stdin || 'piped',
  }
  const child = Deno.run(config)
  child.waitfor = async (ignoreOutput = false) => {
    child.status = await child.status()
    if (!ignoreOutput) {
      child.out = await child.output()
      child.err = await child.stderrOutput()
    }
    child.close()
    return child
  }
  // there seems to be no way of testing whether process has failed after
  // launching, without awaiting proc.status()
  // if i expect the process to be long running, i need to be able to
  // poll the status to see if it exits early.
  return child
}

function watch (child) {
  const { pid } = child
  child.stats = []
  async function stat () {
    try {
      child.stats.push(await pidusage(pid))
      setTimeout(stat, 1000)
    } catch (err) {}
  }
  setTimeout(stat, 1000)
  return child
}

export { run, watch, usage }
