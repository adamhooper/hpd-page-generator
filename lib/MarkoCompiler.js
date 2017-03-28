const fs = require('fs')
const nodePath = require('path')
const markoCompiler = require('marko/compiler')
const Module = require('module').Module

const MarkoOptions = Object.assign({}, markoCompiler.defaultOptions, {
  checkUpToDate: false,
  writeToDisk: false
})

function filenameToTemplate(filename, varnames) {
  const marko = fs.readFileSync(filename, 'utf-8')

  const varsString = varnames.map(id => `${id} = input.${id}`).join(', ')

  // This is super-hacky. Really, we should extend Marko's code generator so it
  // outputs the variables we want. That would also let us define `input` and `out`
  // variables, and it would probably make compilation and rendering a few
  // microseconds faster.
  const js = markoCompiler.compile(marko, filename, MarkoOptions)
    .replace('var data = input;', `var ${varsString};`)

  // turn the JavaScript into a module; load it and return it
  const templateModule = new Module(filename, module)
  templateModule.paths = Module._nodeModulePaths(nodePath.dirname(filename))
  templateModule.filename = filename
  templateModule._compile(js, filename)

  const ret = templateModule.exports
  ret.code = js
  return ret
}

const ShimThatMakesMarkoThinkItDidInitWeDontWant = new Proxy({}, {
  get: () => {
    return true
  }
})

class MarkoSink {
  constructor() {
    this.parts = []
    this.global = ShimThatMakesMarkoThinkItDidInitWeDontWant
  }

  w(s) {
    this.parts.push(Buffer.from(s, 'utf-8'))
  }

  isSync() {
    return true
  }

  toBuffer() {
    return Buffer.concat(this.parts)
  }
}

function runTemplate(template, data) {
  const sink = new MarkoSink()

  try {
    template._(data, sink)
  } catch (e) {
    // Marko doesn't do anything special with line numbers, and the error happens
    // on a line of JavaScript, not a line of Marko. We need to show the context.
    const m = /\((.*\.marko):(\d+):\d+\)$/m.exec(e.stack.split(/\r\n|\n\r|\n/g, 3)[1])
    if (m) {
      // if the error occurs in a partial, ignore it (because we already handled it
      // when we rendered the partial)
      const path = m[1]

      const lineNumber = +m[2]
      const lines = template.code.split(/\r\n|\n\r|\n/g)
      if (path === template.path && lines.length > lineNumber) {
        const message = e.message + ` in this JavaScript derived from ${path}: ${lines[lineNumber - 1]}`
        throw new e.constructor(message)
      }
    }

    throw e
  }

  return sink.toBuffer()
}

// This is _basically_ MarkoJS, except:
//
// * there are no options. Cache is in-memory; we fs.readFileSync(); we never write
// * we don't support components or includes
// * instead of just `input`, code can use all the variables you pass as `varnames`
//   when you construct the MarkoCompiler.
// * the return value is a Buffer, utf-8 encoded
module.exports = class MarkoCompiler {
  // parameters:
  constructor(varnames) {
    this.varnames = varnames
    this.cache = new Map()
  }

  _filenameToCachedTemplate(filename) {
    if (!this.cache.has(filename)) {
      this.cache.set(filename, filenameToTemplate(filename, this.varnames))
    }

    return this.cache.get(filename)
  }

  render(templateKey, data) {
    const template = this._filenameToCachedTemplate(templateKey)
    return runTemplate(template, data)
  }
}
