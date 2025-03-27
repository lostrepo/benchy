// import { try_upgrade_to_ws } from './ws.upgrade.js'
import { SocketBase } from './lo2.socket.base.js'
export { FakeLoop, FakeSocketBase as FakeSocket, fake_loop,
  fake_socket_base as fake_socket } from './lo2.socket.base.js'

export class Socket extends SocketBase {
  /**@param {Socket} socket */
  // static try_upgrade_to_ws = try_upgrade_to_ws
}
