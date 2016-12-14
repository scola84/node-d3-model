import EventEmitter from 'events';
import get from 'lodash-es/get';
import has from 'lodash-es/has';
import merge from 'lodash-es/merge';
import set from 'lodash-es/set';
import odiff from 'odiff';
import pathToRegexp from 'path-to-regexp';

export default class Model extends EventEmitter {
  constructor() {
    super();

    this._cache = null;
    this._id = null;
    this._connection = null;
    this._path = null;

    this._serialize = (o) => o;
    this._deserialize = (o) => o;

    this._parser = null;
    this._keys = [];
    this._state = 'idle';

    this._local = {};
    this._remote = {};
    this._last = false;
  }

  cache(value = null, id = (p, l) => [p, l]) {
    if (value === null) {
      return this._cache;
    }

    this._cache = value;
    this._id = id;

    return this;
  }

  connection(value = null) {
    if (value === null) {
      return this._connection;
    }

    this._connection = value;
    return this;
  }

  path(value = null) {
    if (value === null) {
      return this._path;
    }

    this._path = value;
    this._parser = pathToRegexp.compile(value);

    pathToRegexp(value, this._keys);

    return this;
  }

  serialize(value = null) {
    if (value === null) {
      return this._serialize;
    }

    this._serialize = value;
    return this;
  }

  deserialize(value = null) {
    if (value === null) {
      return this._deserialize;
    }

    this._deserialize = value;
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

  has(name) {
    if (has(this._local, name)) {
      return true;
    }

    return has(this._remote, name);
  }

  set(name, value, scope) {
    set(this._local, name, value);

    this.emit('set', {
      name,
      value,
      scope
    });

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

  flush() {
    this._local = {};
    this._remote = {};
    this._last = false;

    return this;
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

        callback();
        return;
      }

      this._local = this._deserialize(object.local, 'local');
      this._remote = this._deserialize(object.remote, 'remote');
      this._last = object.last;

      callback();
    });
  }

  save(callback = () => {}) {
    const object = {
      local: this._serialize(merge({}, this._local), 'local'),
      remote: this._serialize(merge({}, this._remote), 'remote'),
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

    const [path, local = {}] = this._parse();

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
      this._handleSelect(response, (error, data) => {
        this._state = 'idle';
        callback(error, data);
      });
    });
  }

  data() {
    throw new Error('Not implemented');
  }

  id() {
    throw new Error('Not implemented');
  }

  _parse() {
    const local = this._serialize(merge({}, this._local), 'parse');
    const path = this._parser(local);

    this._keys.forEach((key) => {
      delete local[key.name];
    });

    return [path, local];
  }

  _extract(response, callback) {
    let data = '';

    response.once('error', (error) => {
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
      response.data(data);
      callback();
    });
  }

  _handleSelect(response, callback) {
    this._extract(response, (extractError) => {
      if (extractError) {
        callback(extractError);
        return;
      }

      if (response.status() >= 300) {
        this._state = 'idle';
      }

      if (response.status() >= 500) {
        callback(new Error(response.data()));
        return;
      }

      if (response.status() >= 400) {
        callback(new Error(response.data()));
        return;
      }

      if (response.status() === 304) {
        this.emit('data', this._remote);
        callback(null, this._remote);
        return;
      }

      this._handleResponse(response, (error, data) => {
        callback(null, data);
      });
    });
  }

  _handleResponse(response, callback) {
    if (response.header('x-last')) {
      this._last = response.header('x-last');
    }

    this.data(response.data());
    this.emit('data', this._remote);

    callback(null, this._remote);
  }
}
