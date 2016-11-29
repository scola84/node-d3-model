import EventEmitter from 'events';
import get from 'lodash-es/get';
import set from 'lodash-es/set';
import odiff from 'odiff';
import pathToRegexp from 'path-to-regexp';

export default class Model extends EventEmitter {
  constructor() {
    super();

    this._cache = null;
    this._connection = null;
    this._path = null;
    this._keys = [];
    this._state = 'idle';

    this._local = {};
    this._remote = {};
    this._last = false;
  }

  cache(value) {
    this._cache = value;
    return this;
  }

  connection(value) {
    this._connection = value;
    return this;
  }

  path(value) {
    this._parse = pathToRegexp.compile(value);
    this._path = value;

    pathToRegexp(value, this._keys);

    return this;
  }

  local(value = null) {
    if (value === null) {
      return this._local;
    }

    this._local = value;
    return this;
  }

  remote(value = null) {
    if (value === null) {
      return this._remote;
    }

    this._remote = value;
    return this;
  }

  get(name) {
    let value = get(this._local, name);

    if (typeof value === 'undefined') {
      value = get(this._remote, name);
    }

    return value;
  }

  set(name, value) {
    set(this._local, name, value);
    this.emit('set', { name, value });
    return this;
  }

  add(name, value, action) {
    const values = this.get(name) || [];

    if (action === true) {
      values.push(value);
    } else if (action === false) {
      values.splice(values.indexOf(value), 1);
    }

    return this.set(name, values.sort());
  }

  diff() {
    return odiff(this._remote, this._local);
  }

  load(callback = () => {}) {
    this._cache.get(this.id(), (error, object, valid) => {
      if (error) {
        callback(error);
        return;
      }

      if (!object || !valid) {
        this._remote = null;
        this._last = false;
        return;
      }

      this._local = object.local;
      this._remote = object.remote;
      this._last = object.last;

      callback();
    });
  }

  save(callback = () => {}) {
    const object = {
      local: this._local,
      remote: this._remote,
      last: this._last
    };

    this._cache.set(this.id(), object, callback);
  }

  remove(callback = () => {}) {
    this._cache.delete(this.id(), callback);
  }

  select(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new Error('500 model_state busy'));
      return;
    }

    this._state = 'busy';
    this.load();

    const [path, local = {}] = this.parse();

    const request = this._connection
      .request()
      .method('GET')
      .path(path)
      .query(local)
      .header('x-last', this._last);

    request.once('error', (error) => {
      this._state = 'idle';
      callback(error);
    });

    request.end(null, (response) => {
      this._handleSelect(response, callback);
    });
  }

  data() {
    throw new Error('Not implemented');
  }

  id() {
    throw new Error('Not implemented');
  }

  parse() {
    throw new Error('Not implemented');
  }

  _handleSelect(response, callback) {
    if (response.status() >= 300) {
      this._state = 'idle';
    }

    if (response.status() >= 500) {
      callback(new Error(response.status()));
      return;
    }

    if (response.status() >= 400) {
      callback(new Error(response.status()));
      return;
    }

    if (response.status() === 304) {
      this.emit('data', this._remote);
      callback(null, this._remote);
      return;
    }

    this._handleResponse(response, (error, data) => {
      this._state = 'idle';
      callback(null, data);
    });
  }

  _handleResponse(response, callback) {
    if (response.header('x-last')) {
      this._last = response.header('x-last');
    }

    let data = '';

    response.once('error', (error) => {
      this._state = 'idle';
      response.removeAllListeners();
      callback(error);
    });

    response.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        data += chunk;
      } else {
        data = chunk;
      }
    });

    response.once('end', () => {
      response.removeAllListeners();

      this
        .data(data)
        .save((error) => {
          if (error) {
            callback(error);
            return;
          }

          this.emit('data', this._remote);
          callback(null, this._remote);
        });
    });
  }
}
