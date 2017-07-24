'use strict'

const escapeAttr = require('escape-html')
const ValidJsIdentifierRegex = require('./ValidJsIdentifierRegex')

const PageEntry = require('./PageEntry')
const PageRouter = require('./PageRouter')
const MarkoCompiler = require('./MarkoCompiler')
const StaticWebsite = require('in-memory-website').StaticWebsite

const DefaultHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300'
}

const GlobalVarnames = 'href model partial routes'.split(' ')

function validateBaseUrl(baseUrl) {
  if (!baseUrl) throw new Error('You must specify options.baseUrl: for instance, http://localhost:3000')
  if (!/^https?:/.test(baseUrl)) {
    throw new Error(`You set options.baseUrl to ${BaseUrl}. Change it to start with "http://" or "https://" because Facebook/Twitter can't use any other URL schema`)
  }
  if (baseUrl.split('/').length !== 3) {
    throw new Error(`Your options.baseUrl must be a URL without subdirectories, such as 'http://example.com'`)
  }
}

function validateBasePath(basePath) {
  if (!basePath && basePath !== '') throw new Error(`You must specify options.basePath: for instance, '/2017/SLUG' or even the empty string, ''`)
}

function validateDatabase(database) {
  // anything goes
}

function validateGlobals(globals) {
  for (const key of GlobalVarnames) {
    if (globals.hasOwnProperty(key)) {
      throw new Error(`You cannot specify options.globals.${key}: '${key}' is already a global. Rename or remove the ${key} property from your globals.`)
    }
  }

  for (const key of 'input out'.split(' ')) {
    if (globals.hasOwnProperty(key)) {
      // We _could_ avoid this error if we tweaked our MarkoComipler.
      // Does this affect you? File a bug!
      throw new Error(`You cannot specify options.globals.${key}: '${key}' is a special name in MarkoJS`)
    }
  }

  for (const key of Object.keys(globals)) {
    if (!ValidJsIdentifierRegex.test(key)) {
      throw new Error(`You cannot specify options.globals.${key}: '${key}' is not a valid JavaScript identifier. Rename it or remove it from your globals.`)
    }
  }
}

function validatePages(pages) {
  if (!pages) throw new Error(`You must pass options.pages, an Array of page-specification Objects.`)
  if (!pages.map) throw new Error(`options.pages must be an Array`)
}

class Renderer {
  constructor(basePath, routes, globals) {
    this.basePath = basePath
    this.routes = routes // for redirects
    this.globals = globals
    this.markoCompiler = new MarkoCompiler(Object.keys(globals).concat(GlobalVarnames))
  }

  render(templateKey, href, model, locals) {
    const vars = Object.assign({}, this.globals, {
      href: href,
      model: model,
      locals: locals,
      partial: (key, locals) => this.render(key, href, model, locals)
    })

    return this.markoCompiler.render(`${this.basePath}/${templateKey}.marko`, vars)
  }

  renderEntry(pageEntry, href, model) {
    const headers = Object.assign({}, DefaultHeaders, pageEntry.headers)

    switch (pageEntry.type) {
    case 'redirect':
      const redirect = pageEntry.redirect
      let url
      if (/^https?:\/\//.test(redirect)) {
        url = redirect
      } else {
        // Custom error message for most-common problem
        const redirectEntry = this.routes.pathToEntry[redirect]
        if (!redirectEntry) {
          throw new Error(`Path ${pageEntry.path} tried to redirect to '${redirect}' but that is not a valid path in this project. Use a valid path.`)
        }

        url = this.routes.hrefTo(redirectEntry.path, ...(redirectEntry.modelKeys.map(k => model[k])))
      }

      const html = `<!doctype html><head><meta charset="utf-8"><title>Redirect</title></head><body>You are being <a href="${escapeAttr(url)}">redirected</a>...</body></html>`

      return {
        path: href,
        headers: Object.assign(headers, { Location: url }),
        body: Buffer.from(html)
      }
    case 'blob':
      const blob = model[pageEntry.blob]
      if (blob === null || typeof blob === 'undefined') throw new Error(`There is no "${pageEntry.blob}" blob on the model for "${href}"`)
      return {
        path: href,
        headers: headers,
        body: Buffer.from(blob)
      }
    case 'page':
      const buf = this.render(pageEntry.template, href, model, {})
      return {
        path: href,
        headers: headers,
        body: buf
      }
    default:
      throw new Error(`Framework error: invalid page entry type ${pageEntry.type}`)
    }
  }
}

module.exports = {
  // Generates a StaticWebsite according to config and code.
  //
  // Options:
  //   baseUrl (required): a URL -- it should start with "http://" or "https://" and
  //                       should NOT contain subdirectories.
  //   baseHref (required): a subpath, such as "/2017/SLUG". May be the empty string,
  //                        but can't be undefined or null.
  //   basePath (required): where templates are stored.
  //   pages (required): an Array of Objects describing which pages to render. See README.md.
  //   database (optional): an Object that the router, renderer and your code may use.
  //   globals (optional): an Object whose entries your code may use. For instance, pass
  //                       { assets: [an AssetBucket] } and your code may call
  //                       `assets.urlTo('images/foo.png')`
  generate: function(options) {
    if (!options) throw new Error('You must pass options to PageCompiler')

    const baseUrl = options.baseUrl; validateBaseUrl(baseUrl)
    const baseHref = options.baseHref; validateBasePath(baseHref)
    const basePath = options.basePath; validateBasePath(basePath)
    const database = options.database; validateDatabase(database)
    const userGlobals = options.globals || {}; validateGlobals(userGlobals)

    // parse all page entries before rendering any. This way, if a developer has two
    // config errors and one render error, fixing the first config error will make
    // the second config error throw: when a render error is thrown, the developer
    // knows there are no config errors.
    validatePages(options.pages)
    const pageEntries = options.pages.map(e => new PageEntry(baseHref, database, e))

    const routes = new PageRouter(baseUrl, pageEntries)

    const globals = Object.assign({}, userGlobals, {
      routes: routes
    })

    const renderer = new Renderer(basePath, routes, globals)

    const endpoints = []
    for (const pageEntry of pageEntries) {
      for (const { href, model } of pageEntry.hrefs) {
        endpoints.push(renderer.renderEntry(pageEntry, href, model))
      }
    }

    return new StaticWebsite(endpoints)
  }
}
