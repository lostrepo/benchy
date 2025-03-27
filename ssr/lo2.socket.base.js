import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
// import { RequestParser } from 'lib/pico.js'

import { noop } from './lo2.noop.js'
import { RequestParser } from './lo2.pico.requestparser.js'
// import './lo2.pico.requestparser.template.js'

const { Blocked, Readable, Writable, EdgeTriggered } = Loop
const { ptr } = lo
const { SOL_SOCKET, SOCKADDR_LEN, EINPROGRESS, SO_ERROR, EAGAIN, MSG_TRUNC, MSG_PEEK,
  connect, recv2, close, getsockopt, send2 } = net
const { sockaddr_in } = net.types
const BUFSIZE = 64 * 1024
const parser = new RequestParser(ptr(new Uint8Array(BUFSIZE)), 18)

/**
 * @template {SocketBase} T
 */
export class SocketBase {
  #b = new Uint32Array(3)
  get fd(){ return this.#b[0] }
  get ip(){ return this.#b[1] }
  get port(){ return this.#b[2] }
  set fd(v){ this.#b[0] = v }
  set ip(v){ this.#b[1] = v }
  set port(v){ this.#b[2] = v }
  /**@type {typeof parser} */
  parser = /**@type {any} */(null)
  /**@type {(socket: T) => -1 | 0 | void}*/
  readable = noop
  /**@type {Loop} */
  loop = /**@type {any} */(null)

  /**
   * @param {Loop} loop
   * @param {number} fd
   * @param {number} [parser_bufsize]
   * @param {number} [parser_max_headers]
   */
  constructor(loop, fd, parser_bufsize, parser_max_headers) {
    this.init(loop, fd, parser_bufsize, parser_max_headers)
  }

  /**
   * @param {Loop} loop
   * @param {number} fd
   */
  init(loop, fd, parser_bufsize = BUFSIZE, parser_max_headers = 18){
    // per socket parser
    this.#b = new Uint32Array(3 + (parser_bufsize >> 2) + 1)
    this.parser = new RequestParser(ptr(new Uint8Array(this.#b.buffer, 3 * 4, parser_bufsize)), parser_max_headers)
    this.fd = fd
    // this.parser = parser
    this.loop = loop
    SocketBase.sockets[fd] = this
  }

  /** @param {(socket: T) => void | 0 | -1} on_readable */
  addonreadable(on_readable, readable = SocketBase.readable, readable_error = SocketBase.close, modify = 0){
    this.readable = on_readable
    return modify
      ? this.loop.modify(this.fd, readable, Readable, readable_error)
      : this.loop.add(this.fd, readable, Readable, readable_error)
  }
  removefromloop(){
    return this.loop.remove(this.fd)
  }
  delete(){
    SocketBase.sockets[this.fd] = fake_socket_base
  }
  /**
   * @param {number} pointer
   * @param {number} size
   */
  write(pointer, size){
    return SocketBase.write(this.fd, pointer, size, 0)
  }
  read(size = this.parser.rb.size) {
    return SocketBase.read(this.fd, this.parser.rb.ptr, size, 0)
  }
  peek(size = this.parser.rb.size) {
    return SocketBase.read(this.fd, this.parser.rb.ptr, size, MSG_PEEK)
  }
  discard(size = this.parser.rb.size) {
    return SocketBase.read(this.fd, this.parser.rb.ptr, size, MSG_TRUNC)
  }
  close() {
    const { fd } = this
    if (fd === 0) return
    this.delete()
    this.fd = 0
    // this.removefromloop()
    close(fd)
  }

  /**
   * @param {number} fd
   */
  static delete (fd) { SocketBase.sockets[fd].delete() }
  static write = send2
  static read = recv2
  /**
   * @param {number} fd
   */
  static close (fd) {
    return SocketBase.sockets[fd].close()
  }
  /**
   * @type {import("lib/loop.js").eventCallback}
   */
  static readable (fd) {
    const socket = SocketBase.sockets[fd]
    if (socket.readable(socket) === -1) socket.close()
  }
  /**@param {SocketBase} socket*/
  static try_read (socket, size = socket.parser.rb.size) {
    const bytes = socket.read(size)
    if (bytes > 0) return bytes
    if (bytes < 0 && lo.errno === Blocked) return 0
    return -1
  }
  /**@param {SocketBase} socket*/
  static try_peek (socket, size = socket.parser.rb.size) {
    const bytes = socket.peek(size)
    if (bytes > 0) return bytes
    if (bytes < 0 && lo.errno === Blocked) return 0
    return -1
  }
  /**
   * @param {SocketBase} socket
   */
  static try_write (socket, pointer = socket.parser.rb.ptr, size = 0, callback = (written = false) => undefined) {
    const bytes = socket.write(pointer, size)
    if (bytes > 0) return callback(true), 0
    if (bytes < 0 && lo.errno === Blocked) return socket.loop.add(socket.fd, (fd) => {
      const written = socket.write(pointer, size) > 0
      if (!written && lo.errno === EAGAIN) return
      socket.loop.remove(fd, Writable | EdgeTriggered)
      callback(written)
    }, Writable | EdgeTriggered), 1
    return callback(false), -1
  }
  /**
   * @param {SocketBase} socket
   * @param {string} addr
   * @param {number} port
   */
  static try_connect (socket, addr, port, callback = (connected = false) => undefined) {
    // blocking has no error
    if (connect(socket.fd, sockaddr_in(addr, port), SOCKADDR_LEN) != -1) return callback(true), 0
    // blocking has error
    if (lo.errno !== EINPROGRESS) return callback(false), -1
    // non-blocking
    const getsockopt_res = new Uint32Array(1)
    const getsockopt_size = ptr(new Uint32Array([1]))
    socket.loop.add(socket.fd, (fd) => {
      const rc = getsockopt(fd, SOL_SOCKET, SO_ERROR, getsockopt_res, getsockopt_size.ptr)
      const connected = rc === 0
      if (!connected && lo.errno === EINPROGRESS) return
      socket.loop.remove(fd, Writable | EdgeTriggered)
      callback(connected)
    }, Writable | EdgeTriggered, callback.bind(null, false))
    return 1
  }
  /**@param {SocketBase['parser']} parser */
  static try_parse (parser, size = parser.rb.size) {
    const bytes = parser.parse(size)
    if (bytes > 0) return bytes
    if (bytes === -2) return 0
    return -1
  }
  /**@type {SocketBase[]} */
  static sockets = []
}

export class FakeLoop extends Loop {
  callbacks = []
  size = 0
  add(){ return 0 }
  modify() { return 0 }
  poll() { return 0 }
  remove() { return 0 }
}
export const fake_loop = new FakeLoop()
/**@type {0} */
const m0 = 0
export class FakeSocketBase extends SocketBase {
  get fd(){ return 0 }
  set fd(_){}
  get ip() { return 0 }
  set ip(_){}
  get port() { return 0 }
  set port(_){}
  loop = fake_loop
  parser = parser
  init() {}
  readable = () => { return m0 }
  close(){}
  delete(){}
  discard(){ return m0 }
  addonreadable(){ return m0 }
  peek(){ return m0 }
  read(){ return m0 }
  write(){ return m0 }
  removefromloop(){ return m0 }
}
export const fake_socket_base = new SocketBase(fake_loop, 0, 0, 0)
