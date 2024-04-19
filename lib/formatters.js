const decoder = new TextDecoder()

const http = {
  markdown: async (path, writer) => {
    const bytes = Deno.readFileSync(path)
    const text = decoder.decode(bytes)
    const results = JSON.parse(text)
    const suites = Object.keys(results)
    for (const suite of suites) {
      if (suite === 'cpuinfo') {
        await writer.write(`\n## cpuinfo\n`)
        await writer.write(`\n\`\`\`\n${results.cpuinfo}\n\`\`\`\n`)
        continue
      }
      if (suite === 'config') {
        await writer.write(`\n## config\n`)
        await writer.write(`\n\`\`\`\n${JSON.stringify(results.config, null, '  ')}\n\`\`\`\n`)
        continue
      }
      await writer.write(`# ${suite}\n`)
      const entries = Object.keys(results[suite])
      for (const name of entries) {
        if (name === 'config') continue
        await writer.write(`\n## ${name}\n`)
        const runs = results[suite][name]
        let i = 1
        for (const run of runs) {
          if (run.strace) {
            await writer.write(`\n### strace\n`)
            await writer.write(`\n\`\`\`\n${run.strace}\n\`\`\`\n`)
            continue
          }
          if (run.flame) {
            await writer.write(`\n### flamegraph\n`)
            await writer.write(`\n![flamegraph](${name}.svg)\n`)
            continue
          }
          const { wrk, httpd, bench } = run
          await writer.write(`\n### run ${i}\n`)
          await writer.write(`\n\`\`\`\n${JSON.stringify(bench, null, '  ')}\n\`\`\`\n`)
          i++
        }
      }
    }
  }
}

const websocket = { markdown: http.markdown }

export { http, websocket }
