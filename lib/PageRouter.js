'use strict'

// Provides URLs and hrefs
module.exports = class PageRouter {
  constructor(baseUrl, pageEntries) {
    const pathToEntry = this.pathToEntry = {}
    const hrefToPath = this.hrefToPath = {} // to check for duplicates or check an href is valid

    for (const pageEntry of pageEntries) {
      const path = pageEntry.path
      if (pathToEntry.hasOwnProperty(path)) {
        throw new Error(`Two page specs have path "${path}". Please edit or delete one.`)
      }
      pathToEntry[path] = pageEntry

      for (const { href, model } of pageEntry.hrefs) {
        if (hrefToPath.hasOwnProperty(href)) {
          throw new Error(`Two page specs have href "${href}". One page spec is "${hrefToPath[href]}" and the other is "${path}". Please change the page specs or database so that no two entries resolve to the same href.`)
        }
        hrefToPath[href] = path
      }
    }
  }

  // hrefTo('foo/:bar', 'baz') => 'foo/baz' -- or throw Error for wrong params
  hrefTo(path, ...params) {
    if (path[0] === '/') throw new Error(`You called hrefTo() with path '${path}', but paths cannot start with '/'. Please remove the '/'.`)

    const entry = this.pathToEntry[path]
    if (!entry) throw new Error(`There is no page spec with path '${path}'. Please choose a valid path: ${JSON.stringify(Object.keys(this.pathToEntry).sort())}`)

    if (params.length !== entry.modelKeys.length) {
      throw new Error(`Page spec '${path}' requires parameters ${JSON.stringify(entry.modelKeys)}, but you specified ${params.length} ${params.length === 1 ? 'value' : 'values'}`)
    }

    let lookup = entry.hrefLookup
    for (const param of params) {
      lookup = lookup[param]
      if (!lookup) throw new Error(`Page spec '${path}' does not have an entry with parameters ${JSON.stringify(params)}`)
    }

    return lookup
  }

  // like hrefTo(...), but returns an absolute URL
  urlTo(path, ...params) {
    return `${this.baseUrl}${this.hrefTo(path, ...params)}`
  }
}
