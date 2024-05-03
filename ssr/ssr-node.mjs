import { mem, cputime, colors } from '../lib/bench.mjs'
import { createServer } from 'node:http'
import { compile } from './lib/html.mjs'
import foo from './data.json' assert { type: 'json' };

const encoder = new TextEncoder()
const escape_html = false
const Template = compile(encoder.encode(`<!DOCTYPE html><html lang=en><body><table>{{#each this}}<tr><td>{{id}}</td><td>{{name}}</td></tr>{{/each}}</table></body></html>`), 'data', 'data', { rawStrings: false, escape: escape_html }).call

const rows = parseInt(process.argv[2] || '10', 10)
const data = foo.slice(0, rows)

const { AC, AD, AY } = colors

let rps = 0

createServer((_, res) => {
    res.setHeader("content-type", "text/html");
    res.end(Template.call(data));
    rps++
  })
  .listen(3000)

setInterval(() => {
  const [ usr, , sys ] = cputime()
  console.log(`${AC}rps${AD} ${rps} ${AC}rss${AD} ${mem()} ${AY}usr${AD} ${usr.toString().padStart(3, ' ')} ${AY}sys${AD}  ${sys.toString().padStart(3, ' ')} ${AY}tot${AD} ${(usr + sys).toString().padStart(3, ' ')}`)
  rps = 0
}, 1000);
