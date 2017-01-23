import EventEmitter from 'events';
import get from 'lodash-es/get';
import has from 'lodash-es/has';
import merge from 'lodash-es/merge';
import set from 'lodash-es/set';
import odiff from 'odiff';
import pathToRegexp from 'path-to-regexp';
import { ScolaError } from '@scola/error';
import { helper as extract } from '@scola/extract';

export default class Model extends EventEmitter {
  constructor() {
    super();

    this._connection = null;
    this._cache = null;
    this._path = null;

    this._parser = null;
    this._keys = [];
    this._state = 'idle';

    this._serialize = (o) => o;
    this._deserialize = (o) => o;

    this._local = {};
    this._remote = {};
    this._last = false;
  }

  connection(value = null) {
    if (value === null) {
      return this._connection;
    }

    this._connection = value;
    return this;
  }

  cache(value = null) {
    if (value === null) {
      return this._cache;
    }

    this._cache = value;
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

  last(value = null) {
    if (value === null) {
      return this._last;
    }

    this._last = value;
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

  add(name, value, action = true) {
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
    this._cache.get(this._key(), (error, object, valid) => {
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

    this._cache.set(this._key(), object, callback);
  }

  remove(callback = () => {}) {
    this._cache.delete(this._key(), callback);
  }

  select(stream = false) {
    if (this._state === 'busy') {
      return this;
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
      this.emit('error', error);
    });

    request.once('response', (response) => {
      this._handleSelect(response);
    });

    if (stream === true) {
      request.write('');
      return request;
    }

    request.end();
    return this;
  }

  insert() {
    if (this._state === 'busy') {
      return this;
    }

    this._state = 'busy';
    const [path, local] = this._parse();

    const request = this._connection
      .request()
      .method('POST')
      .path(path);

    request.once('error', (error) => {
      this._state = 'idle';
      this.emit('error', error);
    });

    request.once('response', (response) => {
      this._handleInsert(response);
    });

    request.end(local);
    return this;
  }

  update() {
    if (this._state === 'busy') {
      return this;
    }

    this._state = 'busy';
    const [path, local] = this._parse();

    const request = this._connection
      .request()
      .method('PUT')
      .path(path);

    request.once('error', (error) => {
      this._state = 'idle';
      this.emit('error', error);
    });

    request.once('response', (response) => {
      this._handleUpdate(response);
    });

    request.end(local);
    return this;
  }

  delete() {
    if (this._state === 'busy') {
      return this;
    }

    this._state = 'busy';
    const [path] = this._parse();

    const request = this._connection
      .request()
      .method('DELETE')
      .path(path);

    request.once('error', (error) => {
      this._state = 'idle';
      this.emit('error', error);
    });

    request.once('response', (response) => {
      this._handleDelete(response);
    });

    request.end();
    return this;
  }

  _handleSelect(response) {
    this._state = 'idle';

    response.on('error', (error) => {
      this.emit('error', error);
    });

    response.on('data', (data) => {
      if (response.status() >= 400) {
        this.emit('error', new Error(data));
        return;
      }

      if (response.status() === 304) {
        this.emit('select', this._remote);
        return;
      }

      if (response.header('x-last')) {
        this._last = response.header('x-last');
      }

      this._remote = data;
      this.emit('select', data);
    });
  }

  _handleInsert(response) {
    this._state = 'idle';

    extract(response, (error) => {
      if (error) {
        this.emit('error', error);
        return;
      }

      if (response.status() !== 201) {
        this.emit('error', new ScolaError(response.data()));
        return;
      }

      this._remote = response.data();
      this.emit('insert', this._remote);
    });
  }

  _handleUpdate(response) {
    this._state = 'idle';

    extract(response, (error) => {
      if (error) {
        this.emit('error', error);
        return;
      }

      if (response.status() !== 200) {
        this.emit('error', new ScolaError(response.data()));
        return;
      }

      this._remote = response.data();
      this.emit('update', this._remote);
    });
  }

  _handleDelete(response) {
    this._state = 'idle';

    extract(response, (error) => {
      if (error) {
        this.emit('error', error);
        return;
      }

      if (response.status() !== 200) {
        this.emit('error', new ScolaError(response.data()));
        return;
      }

      this.remove(() => {
        this.flush();
        this.emit('delete');
      });
    });
  }

  _key() {
    const [path] = this._parse();
    return { path };
  }

  _parse() {
    const local = this._serialize(merge({}, this._local), 'parse');
    const path = this._parser(local);

    this._keys.forEach((key) => {
      delete local[key.name];
    });

    return [path, local];
  }
}
