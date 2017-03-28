A _fast_, understandable static page generator, for
[HuffPostData](https://data.huffingtonpost.com) stories.

Takes a JSON configuration (or JavaScript object, if you want code) as input. Outputs
a [StaticWebsite](https://github.com/huffpostdata/in-memory-website) so you can upload
the website to S3 or host it locally.

(This was designed to work well with
[hpd-asset-generator](https://github.com/huffpostdata/hpd-asset-pipeline): upload a
website full of assets with hpd-asset-generator, then upload a website full of pages
with hpd-page-generator. See
[hpd-project-skeleton](https://github.com/huffpostdata/hpd-project-skeleton) for an
example framework.)

The idea is to compile your website (HTML, SVG, dynamically-generated images, JSON blobs,
whatever) within milliseconds. The tasteful feature list:

* [MarkoJS](http://markojs.com/) compilation, with convenience variables like `helpers`
* Simple and flexible `database` is any in-memory object you want
* Simple and flexible `globals` are anything you desire (such as helper functions or an
  [AssetBucket](https://github.com/huffpostdata/hpd-asset-pipeline))
* Built-in `partial()` function lets you call the same template with different `locals`
* `collection` concept lets you generate multiple pages from a simple configuration
* Built-in `router` makes sure all your internal links are valid

StaticWebsite makes your development server behave almost exactly like an S3-hosted
website. Most other frameworks write to files, and that pattern can give unpleasant
surprises on launch day: your production server might emit the wrong `Content-Type` or
it might not behave the same as on development when a URL ends with `/`. This framework
doesn't have that problem.

# Usage

```javascript
'use strict'

const Generator = reqiure('hpd-page-generator')

// Returns a StaticWebsite.
const website = Generator.generate({
  baseUrl: 'http://localhost:3000', // For generating URLs
  baseHref: '/2017/my-project',     // For generating URLs and hrefs
  basePath: `${__dirname}/views`,   // Where we read our templates

  database: {
    // a Database is just an Object. It's optional: the simplest project doesn't need one.
    // An elections dashboard will `require()` a nest of JavaScript that ends up producing
    // `module.exports = ...`. Code is allowed.
    hero: { name: 'Superman', nFriends: 2000 },
    friends: [
      { name: 'Bill', permalink: 'bill' },
      { name: 'Ted', permalink: 'ted' }
    ]
  },

  globals: {
    // a Globals is just an Object. It's optional. Code is allowed. All your views can
    // refer to all the variables within.
    helpers: {
      int: function(n) { return new Intl.NumberFormat('en-US').format(Math.round(n)) }
    }

    // it's really useful to supply an AssetBucket as a global called `assets`: then
    // your templates can refer to them as `assets.urlTo('images/foo.png')` or
    // `assets.dataUriFor('images/badge.svg')`.
  },

  pages: [
    // Each Object in this (required) Array generates one or more endpoints. (An endpoint
    // specifies what happens when a user requests a URL.)

    {
      // Data-free rendering: makes http://localhost:3000/2017/my-project/simple return
      // the result of rendering `views/simple.marko`; uses default
      // `Content-Type: text/html; charset=utf-8` and `Cache-Control: public, max-age=300`

      path: 'simple'
    },

    {
      // Renders `views/hero.marko` and passes `model = database.hero` to it

      path: 'my-hero',
      template: 'hero', // you can set this explicitly
      model: 'hero'     // so `model` in the template is `database.hero`
    },

    {
      // Renders `views/friend.marko` multiple times with each `friend`

      path: 'friends/:permalink', // one path per `model.permalink`
      template: 'friend',          // the same template for all paths
      collection: 'friends',       // each path gets `model` set as a value from `database.friends`
    },

    {
      // An Array doesn't need to be a collection. Here, we pass the Array as a model to
      // `views/friend-list.marko`, which we'll render only once.

      path: 'friends',
      model: 'friends'
    },

    {
      // Sets content directly, without MarkoJS.
      //
      // This is useful for providing raw data -- for instance, source data or API responses

      path: '/friends/:permalink.txt',
      collection: 'friends',
      blob: 'name',          // output bytes will be `Buffer.from(database.friends[i].name)`
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    },

    {
      // Sets a redirect. An entry with a slash at the end is different from an entry without,
      // so you have to be explicit. Sometimes users (or robots) type in the wrong URL.

      path: 'simple/',
      redirect: 'simple' // you can use an absolute URL or a path defined in this config
    },

    {
      // You can redirect collections, too.

      path: 'friends/:permalink/',
      collection: 'friends',
      redirect: 'friends/:permalink'
    },

    {
      // Since the path '/' would be ambiguous (do you mean '/2017/my-project' or
      // '/2017/my-project/'?), use the path '_root' instead

      path: '_root',
      redirect: 'simple'
    },

    {
      // So "_root" means "/2017/my-project". "_root/" means "/2017/my-project/".

      path: '_root/',
      redirect: 'simple'
    }
  ]
})
```

# Template primer

Refer to the [MarkoJS](http://markojs.com) site for syntax. Marko lets you code in HTML style
and in HAML style. The HAML style is simpler, but these examples use HTML syntax so there's
less of a learning curve.

## Simplest usage

The simplest template -- `templates/simple.marko` -- is plain HTML.

```marko
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Simple</title></head>
  <body>This is a simple web page</body>
</html>
```

## Using variables

This example template -- `templates/hero.marko` -- showcases the `model` variable and one
of the `globals` we set above, `helpers`:

```marko
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Hero</title></head>
  <body>
    <p><strong>${model.name}</strong> is my hero!</p>
    <p>My hero has ${helpers.int(model.nFriends)} friends.</p>
  </body>
</html>
```

## Collections

This example -- `templates/friend.marko` -- shows that the `model` variable works from
within a collection, too.


```marko
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Friend</title></head>
  <body>${model.name} is my friend.</body>
</html>
```

## Router

Our next example -- `templates/friends-list.marko` -- shows how to use the `routes`
variable. (It's also a simple looping example in Marko.)

```marko
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>All My Friends</title></head>
  <body>
    <!-- This will link to '/2017/my-project/my-hero'.
         You can use routes.urlTo() to add the baseUrl, but you usually won't want that. -->
    <p>Go see my <a href="${routes.hrefTo('my-hero')}">hero</a></p>

    <!-- routes.hrefTo() takes one parameter per path variable. -->
    <p>Here are my friends:</p>
    <ul>
      <!-- `model` here is an Array -->
      <li for(friend in model)>
        <a href="${routes.hrefTo('friends/:permalink', friend.permalink)}">${friend.name}</a>
      </li>
    </ul>
  </body>
</html>
```

# Page specification

Each `pages` entry must have a `path`. All other parameters are optional:

| name | example | description |
|------|---------|-------------|
| path | `/foo`, `_root`, `/items/:id` | path to the endpoint, without this project's prefix. Cannot conflict with other paths. Subpaths with `:varname` are replaced with values from the `model` or `collection` items, if you have one. |
| redirect | `/items/foo` | path or URL to redirect to, without this project's prefix.  A redirect means no content is rendered. |
| headers | `{ 'Content-Type': 'application/octet-stream' }` | The headers for the endpoint. See [in-memory-website](https://github.com/huffpostdata/in-memory-website) for supported headers. |
| template | `foo` | basename of template to render for this endpoint, without the `.marko` extension. For instance, `methodology` means `views/methodology.marko`. Defaults to `path` (without the leading `/`, if there is one). Conflicts with `blob`. |
| model | `hero` | key in the `database` object. The value will be passed to the `template` as the `model` variable. (If you're using `blob` instead of `template`, then the rendered content will be `model[blob]`.) Conflicts with `collection`.
| collection | `friends` | key in the `database` object. Each value will be passed to the template as a `model` variable. Your `path` should contain `:keys` to replace; those will be looked up in the model. |
| blob | `name` | key in the `model` object (which you must set). The value, a `String`, `Buffer` or `UInt8Array`, will be byte-for-byte what the endpoint returns. Conflicts with `template`. |

# Handy conventions

Use this library however you like. At The Huffington Post, we've adopted the following practices
that make us happy:

* **Set `pages` in JSON or [YAML](https://github.com/nodeca/js-yaml).** This lets you add
  code later or avoid code altogether.
* **Set baseUrl from an environment variable.** That lets you set different values in your
  development, staging and production environments.
* **require() your database.** You can start it off as `database.json` and later change it
  to a `database.js` with `module.exports = ...`. The obvious alternative to `require()` is
  asynchronous code, which is
  [slower](https://medium.com/@adamhooper/node-synchronous-code-runs-faster-than-asynchronous-code-b0553d5cf54e)
  and harder to read.
* **require() some `helpers` in your skeleton project.** This library is designed to be used
  as part of a skeleton project. As a convention, add a `helpers.js` with `module.exports = {}`.
* **Pass [hpd-asset-pipeline](https://github.com/huffpostdata/hpd-asset-pipeline)'s output as globals.assets.**
  It makes for readable MarkoJS like `img alt="easy" src=${assets.hrefTo('images/foo.png')}`.
  (If your assets are at a different `baseUrl` than your pages, use `assets.urlTo()`
  instead of `assets.hrefTo()`.)
* **When publishing, upload all your assets before uploading all your pages.** That way,
  pages that depend on assets will render without broken links.

## Huge websites

This library is perfect for websites that stay under 1GB. Above 1GB, rendering will probably
take >1s, at which point a conventional framework will probably let you develop more quickly.

Another option is to develop in pieces.
[We The Tweeple](http://data.huffingtonpost.com/2016/we-the-tweeple) renders about 30 endpoints
in development mode and 100,000 in staging and production. The staging and production websites
are too big to fit in memory all at once. The solution is to 1) `render()` 1,000 or so endpoints;
2) publish them; 3) `render()` the next 1,000; 4) publish them; et cetera.

# License

MIT.  See LICENSE.
