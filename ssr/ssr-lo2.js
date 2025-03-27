import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { mem, cputime, colors } from '../lib/bench.mjs'
import * as html from './lib/html.mjs'
import { Server } from './lo2.server.js'

const { getenv, ptr, utf8_encode_into_ptr } = lo
const { read_file } = lo.core
const { AC, AD, AY } = colors

function update_headers () {
  htmlx = `content-type: text/html;charset=utf-8\r\nDate: ${(new Date()).toUTCString()}\r\n`
}

function on_timer () {
  const [ usr, , sys ] = cputime()
  console.log(`${AC}rps${AD} ${rps} ${AC}rss${AD} ${mem()} ${AY}usr${AD} ${usr.toString().padStart(3, ' ')} ${AY}sys${AD}  ${sys.toString().padStart(3, ' ')} ${AY}tot${AD} ${(usr + sys).toString().padStart(3, ' ')}`)
  rps = 0
  update_headers()
}

function status_line (status = 200, message = 'OK') {
  return `HTTP/1.1 ${status} ${message}\r\n`
}

let rps = 0
const rows = parseInt(lo.args[2] || '10', 10)
const decoder = new TextDecoder()
const encoder = new TextEncoder()
const escape_html = false
const data = JSON.parse(decoder.decode(read_file('data.json'))).slice(0, rows)
const data_fn = html.compile(encoder.encode(`<!DOCTYPE html><html lang=en><body><table>{{#each this}}<tr><td>{{id}}</td><td>{{name}}</td></tr>{{/each}}</table></body></html>`), 'data', 'data',
{ rawStrings: false, escape: escape_html }).call
const send_buf = ptr(new Uint8Array(1 * 1024 * 1024))
// console.log(data_fn.toString())
// throw ''
let htmlx =
  `Content-Type: text/html;charset=utf-8\r\nDate: ${(new Date()).toUTCString()}\r\n`
const address = getenv('IP') || getenv('ADDRESS') || '127.0.0.1'
const port = parseInt(getenv('PORT') || '22801', 10)
const loop = new Loop()
const timer = new Timer(loop, 1000, on_timer)

const server = new Server(address, port, loop, (socket) => {
  let rc = -1
  switch (socket.read()) {
    case 0:
    break
    case -1:
      rc = lo.errno === Loop.Blocked ? 0 : -1
    break
    default: {
      const { parser } = socket
      switch (parser.parse()) {
        case -2:
          // rc = 0
          rc = -1
        break
        case -1:
        case 0:
        break
        default: {
          switch (parser.method) {
            case 'GET':
              switch (parser.path) {
                case '/zz':
                break
                case '/':
                default: {
                  rc = 0
                  const body_start = send_buf.ptr + 4096
                  const body_size = utf8_encode_into_ptr(data_fn.call(data), body_start)
                  const pre = `${status_line()}${htmlx}Content-Length: ${body_size}\r\n\r\n`
                  const addr = body_start - pre.length
                  socket.write(addr, utf8_encode_into_ptr(pre, addr) + body_size)
                  rps++
                }
              }
            break
          }
          break
        }
      }
    }
  }
  return rc
}, console.log)
while (loop.poll() > 0) lo.runMicroTasks()
timer.close()
server.close()
