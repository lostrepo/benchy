Bun.serve({
  fetch () {
    return new Response('Hello, World!') 
  },
  port: 6000
})
