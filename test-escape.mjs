var ma = /["'&<>]/;

if (!globalThis.assert) {
  function assert (condition, message, ErrorType = Error) {
    if (!condition) {
      throw new ErrorType(message || "Assertion failed")
    }
  }

  globalThis.assert = assert
}

function escapeHtml (a) {
  if ("boolean" === typeof a || "number" === typeof a) return "" + a;
  a = "" + a;
  var b = ma.exec(a);
  if (b) {
    var c = "", d, f = 0;
    for (d = b.index; d < a.length; d++) {
      switch (a.charCodeAt(d)) {
          case 34:
            b = "&quot;";
            break;
          case 38:
            b = "&amp;";
            break;
          case 39:
            b = "&#x27;";
            //b = "&apos;";
            break;
          case 60:
            b = "&lt;";
            break;
          case 62:
            b = "&gt;";
            break;
          default:
            continue
      }
      f !== d && (c += a.substring(f, d));
      f = d + 1;
      c += b
    }
    a = f !== d ? c + a.substring(f, d) : c
  }
  return a
}

if (globalThis.lo) {
  const { ptr, load, utf8_decode, utf8_length } = lo
  const buf = ptr(new Uint8Array(65536))

  const { hescape } = load('hescape')

  function escape_html (v) {
    if ("boolean" === typeof v || "number" === typeof v) return "" + v;
    v = '' + v
    var len = hescape.hesc_escape_html(buf.ptr, v, utf8_length(v))
    if (len === 0) return v
    return utf8_decode(buf.ptr, len)
  }

  escapeHtml = escape_html
} else if (globalThis.Bun) {
  escapeHtml = Bun.escapeHTML
}

const data = [
  [
    1,
    'fortune: No such file or directory'
  ],
  [
    2,
    'A computer scientist is someone who fixes things that aren\'t broken.'
  ],
  [
    3,
    'After enough decimal places, nobody gives a damn.'
  ],
  [
    4,
    'A bad random number generator: 1, 1, 1, 1, 1, 4.33e+67, 1, 1, 1'
  ],
  [
    5,
    'A computer program does what you tell it to do, not what you want it to do.'
  ],
  [
    6,
    'Emacs is a nice operating system, but I prefer UNIX. — Tom Christaensen'
  ],
  [
    7,
    'Any program that runs right is obsolete.'
  ],
  [
    8,
    'A list is only as strong as its weakest link. — Donald Knuth'
  ],
  [
    9,
    'Feature: A bug with seniority.'
  ],
  [
    10,
    'Computers make very fast, very accurate mistakes.'
  ],
  [
    11,
    '<script>alert("This should not be displayed in a browser alert box.");</script>'
  ],
  [
    12,
    'フレームワークのベンチマーク'
  ],
  [
    0,
    'Additional fortune added at request time.'
  ]
]

const iter = 5
const runs = 1000000

function flatstr (s) {
  s | 0
  return s
}

function foo (rows) {
  let s = '<!DOCTYPE html><html><head><title>Fortunes</title></head><body><table><tr><th>id</th><th>message</th></tr>'
  for (let i = 0; i < rows.length; i++) {
    const v1 = rows[i]
    s = s + `<tr><td>${escapeHtml(v1.id)}</td><td>${escapeHtml(v1.message)}</td></tr>`
  }
  return s + '</table></body></html>'
}

const rows = data.map(v => ({ id: v[0], message: v[1] })).sort((a, b) => {
  if (a.message < b.message) return -1
  if (a.message > b.message) return 1
  return 0
})
const expected = '<!DOCTYPE html><html><head><title>Fortunes</title></head><body><table><tr><th>id</th><th>message</th></tr><tr><td>11</td><td>&lt;script&gt;alert(&quot;This should not be displayed in a browser alert box.&quot;);&lt;/script&gt;</td></tr><tr><td>4</td><td>A bad random number generator: 1, 1, 1, 1, 1, 4.33e+67, 1, 1, 1</td></tr><tr><td>5</td><td>A computer program does what you tell it to do, not what you want it to do.</td></tr><tr><td>2</td><td>A computer scientist is someone who fixes things that aren&#x27;t broken.</td></tr><tr><td>8</td><td>A list is only as strong as its weakest link. — Donald Knuth</td></tr><tr><td>0</td><td>Additional fortune added at request time.</td></tr><tr><td>3</td><td>After enough decimal places, nobody gives a damn.</td></tr><tr><td>7</td><td>Any program that runs right is obsolete.</td></tr><tr><td>10</td><td>Computers make very fast, very accurate mistakes.</td></tr><tr><td>6</td><td>Emacs is a nice operating system, but I prefer UNIX. — Tom Christaensen</td></tr><tr><td>9</td><td>Feature: A bug with seniority.</td></tr><tr><td>1</td><td>fortune: No such file or directory</td></tr><tr><td>12</td><td>フレームワークのベンチマーク</td></tr></table></body></html>'

assert(expected === foo(rows))

const expected_len = expected.length

while (1) {

for (let i = 0; i < iter; i++) {
  const start = Date.now()
  for (let j = 0; j < runs; j++) assert(flatstr(foo(rows)).length === expected_len)
  //for (let j = 0; j < runs; j++) assert(foo(rows).length === expected_len)
  const end = Date.now()
  const elapsed = (end - start) / 1000
  const rate = runs / elapsed
  console.log(rate)
}

}
