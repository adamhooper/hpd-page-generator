const StubServer = require('in-memory-website').StubServer

describe('code in README.md', () => {
  const config = require('./fixtures/readme/config')
  const website = index.generate(config)
  const server = new StubServer(website)

  function get(path) {
    return server.get(`/2017/my-project/${path}`)
  }

  it('should render simple HTML', () => {
    expect(get('simple').body.toString('utf-8')).to.eq('<!doctype html><html><head><meta charset="utf-8"><title>Simple</title></head><body>This is a simple web page</body></html>')
  })

  it('should set `path` and `template` separately', () => {
    expect(get('hero')).to.eq(null)
    expect(get('my-hero')).not.to.eq(null)
  })

  it('should handle `model` variables', () => {
    const html = get('my-hero').body.toString('utf-8')
    expect(html).to.match(/<strong>Superman<\/strong>/)
  })

  it('should handle `helpers` code', () => {
    const html = get('my-hero').body.toString('utf-8')
    expect(html).to.match(/My hero has 2,000 friends\./)
  })

  it('should render collections', () => {
    expect(get('friends/bill').body.toString('utf-8')).to.match(/Bill is my friend/)
    expect(get('friends/ted').body.toString('utf-8')).to.match(/Ted is my friend/)
  })

  it('should resolve routes', () => {
    const html = get('friends').body.toString('utf-8')
    expect(html).to.match(/href="\/2017\/my-project\/my-hero"/)
    expect(html).to.match(/href="\/2017\/my-project\/friends\/bill"/)
    expect(html).to.match(/href="\/2017\/my-project\/friends\/ted"/)
  })

  it('should render a `blob` directly', () => {
    expect(get('friends/bill.txt').body).to.deep.eq(Buffer.from('Bill', 'utf-8'))
  })

  it('should set a redirect', () => {
    expect(get('simple/').headers['Location']).to.eq('/2017/my-project/simple')
  })

  it('should redirect a collection', () => {
    expect(get('friends/bill/').headers['Location']).to.eq('/2017/my-project/friends/bill')
    expect(get('friends/ted/').headers['Location']).to.eq('/2017/my-project/friends/ted')
  })

  it('should handle "_root" and "_root/"', () => {
    expect(server.get('/2017/my-project').headers['Location']).to.eq('/2017/my-project/simple')
    expect(server.get('/2017/my-project/').headers['Location']).to.eq('/2017/my-project/simple')
  })
})
