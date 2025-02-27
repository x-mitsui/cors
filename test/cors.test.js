'use strict';

const assert = require('assert');
const Koa = require('koa');
const request = require('supertest');
const cors = require('../');

describe('cors.test.js', function() {
  describe('default options', function() {
    const app = new Koa();
    app.use(cors());
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should not set `Access-Control-Allow-Origin` when request Origin header missing', function(done) {
      request(app.listen())
        .get('/')
        .expect({ foo: 'bar' })
        .expect(200, function(err, res) {
          assert(!err);
          assert(!res.headers['access-control-allow-origin']);
          done();
        });
    });

    it('should set `Access-Control-Allow-Origin` to request origin header', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')// 这是设置请求头
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should 204 on Preflight Request', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH')
        .expect(204, done);
    });

    it('should not Preflight Request if request missing Access-Control-Request-Method', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .expect(200, done);
    });

    it('should always set `Vary` to Origin', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Vary', 'Origin')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });
  });

  describe('options.origin=*', function() {
    const app = new Koa();
    app.use(cors({
      origin: '*',
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should always set `Access-Control-Allow-Origin` to *', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Origin', '*')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });
  });

  describe('options.secureContext=true', function() {
    const app = new Koa();
    app.use(cors({
      secureContext: true,
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should always set `Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy` on not OPTIONS', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Cross-Origin-Opener-Policy', 'same-origin')
        .expect('Cross-Origin-Embedder-Policy', 'require-corp')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should always set `Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy` on OPTIONS', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Cross-Origin-Opener-Policy', 'same-origin')
        .expect('Cross-Origin-Embedder-Policy', 'require-corp')
        .expect(204, done);
    });
  });

  describe('options.secureContext=false', function() {
    const app = new Koa();
    app.use(cors({
      secureContext: false,
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should not set `Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy`', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect(res => {
          assert(!('Cross-Origin-Opener-Policy' in res.headers));
          assert(!('Cross-Origin-Embedder-Policy' in res.headers));
        })
        .expect({ foo: 'bar' })
        .expect(200, done);
    });
  });

  describe('options.origin=function', function() {
    const app = new Koa();
    app.use(cors({
      origin(ctx) {
        if (ctx.url === '/forbin') {
          return false;
        }
        return '*';
      },
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should disable cors', function(done) {
      request(app.listen())
        .get('/forbin')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect(200, function(err, res) {
          assert(!err);
          assert(!res.headers['access-control-allow-origin']);
          done();
        });
    });

    it('should set access-control-allow-origin to *', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200, done);
    });
  });

  describe('origin whitelist', function() {
    const app = new Koa();
    app.use(cors({
      origin(ctx) { // 设置允许来自指定域名请求
        const whiteList = [ 'http://koajs.com', 'http://localhost:8081' ]; // 可跨域白名单
        const url = ctx.get('Origin');
        if (whiteList.includes(url)) {
          return url;
        }
        return 'http://localhost::3000'; // 默认允许本地请求3000端口可跨域
      },
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should disable cors', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')// 这是设置请求头
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should set access-control-allow-origin to *', function(done) {
      request(app.listen())
        .get('/test2222')
        .set('Origin', 'http://koajs.com')
        // .expect({ foo: 'bar' })
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect(200, done);
    });
  });

  describe('options.origin=async function', function() {
    const app = new Koa();
    app.use(cors({
      async origin(ctx) {
        if (ctx.url === '/forbin') {
          return false;
        }
        return '*';
      },
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should disable cors', function(done) {
      request(app.listen())
        .get('/forbin')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect(200, function(err, res) {
          assert(!err);
          assert(!res.headers['access-control-allow-origin']);
          done();
        });
    });

    it('should set access-control-allow-origin to *', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200, done);
    });
  });

  describe('options.exposeHeaders', function() {
    it('should Access-Control-Expose-Headers: `content-length`', function(done) {
      const app = new Koa();
      app.use(cors({
        exposeHeaders: 'content-length',
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Expose-Headers', 'content-length')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should work with array', function(done) {
      const app = new Koa();
      app.use(cors({
        exposeHeaders: [ 'content-length', 'x-header' ],
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Expose-Headers', 'content-length,x-header')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });
  });

  describe('options.maxAge', function() {
    it('should set maxAge with number', function(done) {
      const app = new Koa();
      app.use(cors({
        maxAge: 3600,
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Max-Age', '3600')
        .expect(204, done);
    });

    it('should set maxAge with string', function(done) {
      const app = new Koa();
      app.use(cors({
        maxAge: '3600',
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Max-Age', '3600')
        .expect(204, done);
    });
    /**
     * Access-Control-Max-Age是什么
     * 浏览器的同源策略，就是出于安全考虑，浏览器会限制从脚本发起的跨域HTTP请求（比如异步请求GET, POST, PUT, DELETE, OPTIONS等等），所以浏览器会向所请求的服务器发起两次请求，第一次是浏览器使用OPTIONS方法发起一个预检请求，第二次才是真正的异步请求，第一次的预检请求获知服务器是否允许该跨域请求：如果允许，才发起第二次真实的请求；如果不允许，则拦截第二次请求。
     * Access-Control-Max-Age用来指定本次预检请求的有效期，单位为秒，，在此期间不用发出另一条预检请求。
     * 例如：
     * resp.addHeader("Access-Control-Max-Age", "0")，表示每次异步请求都发起预检请求，也就是说，发送两次请求。
     * resp.addHeader("Access-Control-Max-Age", "1800")，表示隔30分钟才发起预检请求。也就是说，发送两次请求
     */
    it('should not set maxAge on simple request', function(done) {
      const app = new Koa();
      app.use(cors({
        maxAge: '3600',
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect(200, function(err, res) {
          assert(!err);
          assert(!res.headers['access-control-max-age']);
          done();
        });
    });
  });

  describe('options.credentials', function() {
    const app = new Koa();
    app.use(cors({
      credentials: true,
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should enable Access-Control-Allow-Credentials on Simple request', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should enable Access-Control-Allow-Credentials on Preflight request', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect(204, done);
    });
  });

  describe('options.credentials unset', function() {
    const app = new Koa();
    app.use(cors());
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should disable Access-Control-Allow-Credentials on Simple request', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect(200)
        .end(function(error, response) {
          if (error) return done(error);

          const header = response.headers['access-control-allow-credentials'];
          assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
          done();
        });
    });

    it('should disable Access-Control-Allow-Credentials on Preflight request', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(204)
        .end(function(error, response) {
          if (error) return done(error);

          const header = response.headers['access-control-allow-credentials'];
          assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
          done();
        });
    });
  });

  describe('options.credentials=function', function() {
    const app = new Koa();
    app.use(cors({
      credentials(ctx) {
        return ctx.url !== '/forbin';
      },
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should enable Access-Control-Allow-Credentials on Simple request', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should enable Access-Control-Allow-Credentials on Preflight request', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect(204, done);
    });

    it('should disable Access-Control-Allow-Credentials on Simple request', function(done) {
      request(app.listen())
        .get('/forbin')
        .set('Origin', 'http://koajs.com')
        .expect({ foo: 'bar' })
        .expect(200)
        .end(function(error, response) {
          if (error) return done(error);

          const header = response.headers['access-control-allow-credentials'];
          assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
          done();
        });
    });

    it('should disable Access-Control-Allow-Credentials on Preflight request', function(done) {
      request(app.listen())
        .options('/forbin')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(204)
        .end(function(error, response) {
          if (error) return done(error);

          const header = response.headers['access-control-allow-credentials'];
          assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
          done();
        });
    });
  });

  describe('options.credentials=async function', function() {
    const app = new Koa();
    app.use(cors({
      async credentials() {
        return true;
      },
    }));
    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should enable Access-Control-Allow-Credentials on Simple request', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });

    it('should enable Access-Control-Allow-Credentials on Preflight request', function(done) {
      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect(204, done);
    });
  });

  describe('options.allowHeaders', function() {
    it('should work with allowHeaders is string', function(done) {
      const app = new Koa();
      app.use(cors({
        allowHeaders: 'X-PINGOTHER',
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Headers', 'X-PINGOTHER')
        .expect(204, done);
    });

    it('should work with allowHeaders is array', function(done) {
      const app = new Koa();
      app.use(cors({
        allowHeaders: [ 'X-PINGOTHER' ],
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Headers', 'X-PINGOTHER')
        .expect(204, done);
    });

    it('should set Access-Control-Allow-Headers to request access-control-request-headers header', function(done) {
      const app = new Koa();
      app.use(cors());
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .set('access-control-request-headers', 'X-PINGOTHER')
        .expect('Access-Control-Allow-Headers', 'X-PINGOTHER')
        .expect(204, done);
    });
  });

  describe('options.allowMethods', function() {
    it('should work with allowMethods is array', function(done) {
      const app = new Koa();
      app.use(cors({
        allowMethods: [ 'GET', 'POST' ],
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Methods', 'GET,POST')
        .expect(204, done);
    });

    it('should skip allowMethods', function(done) {
      const app = new Koa();
      app.use(cors({
        allowMethods: null,
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect(204, done);
    });
  });

  describe('options.headersKeptOnError', function() {
    it('should keep CORS headers after an error', function(done) {
      const app = new Koa();
      app.use(cors());
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        throw new Error('Whoops!');
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect('Vary', 'Origin')
        .expect(/Error/)
        .expect(500, done);
    });

    it('should not affect OPTIONS requests', function(done) {
      const app = new Koa();
      app.use(cors());
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        throw new Error('Whoops!');
      });

      request(app.listen())
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect(204, done);
    });

    it('should not keep unrelated headers', function(done) {
      const app = new Koa();
      app.use(cors());
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        ctx.set('X-Example', 'Value');
        throw new Error('Whoops!');
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect(/Error/)
        .expect(500, function(err, res) {
          if (err) {
            return done(err);
          }
          assert(!res.headers['x-example']);
          done();
        });
    });

    it('should not keep CORS headers after an error if keepHeadersOnError is false', function(done) {
      const app = new Koa();
      app.use(cors({
        keepHeadersOnError: false,
      }));
      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        throw new Error('Whoops!');
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect(/Error/)
        .expect(500, function(err, res) {
          if (err) {
            return done(err);
          }
          assert(!res.headers['access-control-allow-origin']);
          assert(!res.headers.vary);
          done();
        });
    });
  });

  describe('other middleware has been set `Vary` header to Accept-Encoding', function() {
    const app = new Koa();
    app.use(function(ctx, next) {
      ctx.set('Vary', 'Accept-Encoding');
      return next();
    });

    app.use(cors());

    app.use(function(ctx) {
      ctx.body = { foo: 'bar' };
    });

    it('should append `Vary` header to Origin', function(done) {
      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Vary', 'Accept-Encoding, Origin')
        .expect({ foo: 'bar' })
        .expect(200, done);
    });
  });
  describe('other middleware has set vary header on Error', function() {
    it('should append `Origin to other `Vary` header', function(done) {
      const app = new Koa();
      app.use(cors());

      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        const error = new Error('Whoops!');
        error.headers = { Vary: 'Accept-Encoding' };
        throw error;
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Vary', 'Accept-Encoding, Origin')
        .expect(/Error/)
        .expect(500, done);
    });
    it('should preserve `Vary: *`', function(done) {
      const app = new Koa();
      app.use(cors());

      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        const error = new Error('Whoops!');
        error.headers = { Vary: '*' };
        throw error;
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Vary', '*')
        .expect(/Error/)
        .expect(500, done);
    });
    it('should not append Origin` if already present in `Vary`', function(done) {
      const app = new Koa();
      app.use(cors());

      app.use(function(ctx) {
        ctx.body = { foo: 'bar' };
        const error = new Error('Whoops!');
        error.headers = { Vary: 'Origin, Accept-Encoding' };
        throw error;
      });

      request(app.listen())
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Vary', 'Origin, Accept-Encoding')
        .expect(/Error/)
        .expect(500, done);
    });
  });
});
