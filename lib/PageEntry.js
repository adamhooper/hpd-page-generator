'use strict'

module.exports = class PageEntry {
  constructor(baseHref, database, entry) {
    if (!entry.path) throw new Error(`Page spec must have a "path"; please set one: ${JSON.stringify(entry)}`)

    if (entry.path === '/') {
      throw new Error(`Page spec cannot have path "/"; try "_root" or "_root/": ${JSON.stringify(entry)}`)
    }
    if (entry.path[0] === '/') {
      throw new Error(`Page spec paths cannot start with "/". Please delete that character: ${JSON.stringify(entry)}`)
    }
    if (/:/.test(entry.path) && !entry.model && !entry.collection) {
      throw new Error(`Page spec path includes replacement character ":" but has no "model" or "collection"; please add one: ${JSON.stringify(entry)}`)
    }
    if (entry.blob && !entry.model && !entry.collection) {
      throw new Error(`Page spec includes "blob" but has no "model" or "collection"; please add one: ${JSON.stringify(entry)}`)
    }
    if (entry.model && entry.collection) {
      throw new Error(`Page spec includes both "model" and "collection", which conflict; please use just one: ${JSON.stringify(entry)}`)
    }
    if (entry.model && !database) {
      throw new Error(`Page spec includes "model" but there is no database; please add a database: ${JSON.stringify(entry)}`)
    }
    if (entry.collection && !database) {
      throw new Error(`Page spec includes "collection" but there is no database; please add a database: ${JSON.stringify(entry)}`)
    }
    if (entry.model && !database[entry.model]) {
      throw new Error(`Page spec references model database['${entry.model}'] which does not exist; please add it to the database: ${JSON.stringify(entry)}`)
    }
    if (entry.collection && !database[entry.collection]) {
      throw new Error(`Page spec references collection database['${entry.collection}'] which does not exist; please add it to the database: ${JSON.stringify(entry)}`)
    }
    if (entry.collection && !(database[entry.collection] instanceof Array)) {
      throw new Error(`Page spec references collection database['${entry.collection}'] which is not an Array; please use an Array: ${JSON.stringify(entry)}`)
    }

    const models = []
    if (entry.model) models.push(database[entry.model])
    if (entry.collection) models.splice(0, 0, ...database[entry.collection])

    this.path = entry.path
    this.databaseKey = entry.model || entry.collection || null // for callers to build error messages
    this.models = models
    this.headers = entry.headers || {}

    if (entry.redirect) {
      if (entry.template) throw new Error(`Page spec has both "template" and "redirect"; please delete one: ${JSON.stringify(entry)}`)
      if (entry.blob) throw new Error(`Page spec has both "template" and "blob"; please delete one: ${JSON.stringify(entry)}`)

      this.type = 'redirect'
      this.redirect = entry.redirect
    } else if (entry.blob) {
      if (!entry.headers || !entry.headers['Content-Type']) {
        throw new Error(`Page spec has "blob" but is missing "headers['Content-Type']" (case-sensitive); please add one: ${JSON.stringify(entry)}`)
      }
      this.type = 'blob'
      this.blob = entry.blob
    } else {
      this.type = 'page'
      this.template = entry.template || entry.path
    }

    // this.modelKeys: parts of the path we'll replace
    const modelKeys = this.modelKeys = []
    if (/:/.test(this.path)) {
      const modelKeysRe = /:(\w*)/g
      let m
      while ((m = modelKeysRe.exec(this.path)) !== null) {
        this.modelKeys.push(m[1])
      }
    }

    // Iterate over models to figure out all valid hrefs.
    //
    // this.hrefs: all valid { href, model } pairs
    // this.hrefLookup: { key1 => key2 => ... => href }
    if (/:/.test(this.path)) {
      const hrefs = this.hrefs = []
      this.hrefLookup = {}

      for (const model of this.models) {
        let lookup = this.hrefLookup
        let hrefEnd = this.path
        for (let i = 0; i < this.modelKeys.length; i++) {
          const modelKey = this.modelKeys[i]
          const value = model[modelKey]

          if (!value) throw new Error(`Path entry ${entry.path} refers to database entry 'database[${entry.model || entry.collection}]', but that model is missing a '${modelKey}' value. Please set one.`)

          hrefEnd = hrefEnd.replace(`:${modelKey}`, value)
          if (i === this.modelKeys.length - 1) {
            if (lookup.hasOwnProperty(value)) {
              throw new Error(`Two models for ${entry.path} collection 'database.${database[entry.model || entry.collection]}' resolve to the same href, '${baseHref}/${hrefEnd}'. Please change or remove a database model or adjust the path so each model gets a unique URL.`)
            }

            const href = `${baseHref}/${hrefEnd}`

            hrefs.push({ href: href, model: model })
            lookup[value] = href
          } else {
            if (!lookup.hasOwnProperty(value)) lookup[value] = {}
            lookup = lookup[value]
          }
        }
      }
    } else {
      this.hrefLookup = /^_root\b/.test(this.path) ? `${baseHref}${this.path.slice(5)}` : `${baseHref}/${this.path}`
      this.hrefs = [ { href: this.hrefLookup, model: this.models[0] || null } ]
    }
  }
}
