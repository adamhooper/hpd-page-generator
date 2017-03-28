module.exports = {
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
      template: 'friend',         // the same template for all paths
      collection: 'friends',      // each path gets `model` set as a value from `database.friends`
    },

    {
      // An Array doesn't need to be a collection. Here, we pass the Array as a model to
      // `views/friends.marko`, which we'll render only once.

      path: 'friends',
      model: 'friends'
    },

    {
      // Sets content directly, without MarkoJS.
      //
      // This is useful for providing raw data -- for instance, source data or API responses

      path: 'friends/:permalink.txt',
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
}
