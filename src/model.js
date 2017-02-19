import EventEmitter from 'events';
import get from 'lodash-es/get';
import has from 'lodash-es/has';
import isEqual from 'lodash-es/isEqual';
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
    this._mode = null;

    this._parser = null;
    this._keys = [];

    this._serialize = (o) => o;
    this._deserialize = (o) => o;

    this._local = {};
    this._remote = null;
    this._total = null;
    this._etag = null;

    this._request = null;
    this._response = null;

    this._auth = null;
    this._subscribe = false;

    this._handleOpen = () => this._open();

    this._handleData = (d) => this._data(d);
    this._handleEnd = () => this._end();
    this._handleError = (e) => this._error(e);

    this._handleSelect = (r) => this._select(r);
    this._handleInsert = (r) => this._insert(r);
    this._handleUpdate = (r) => this._update(r);
    this._handleDelete = (r) => this._delete(r);

    this._objectMode();
  }

  destroy() {
    this._end();
    this._unbindConnection();

    this._connection = null;
    this._cache = null;
    this._serialize = null;
    this._unserialize = null;
  }

  auth(value = null) {
    if (value === null) {
      return this._auth;
    }

    this._auth = value;
    return this;
  }

  cache(value = null) {
    if (value === null) {
      return this._cache;
    }

    this._cache = value;
    return this;
  }

  connection(value = null) {
    if (value === null) {
      return this._connection;
    }

    this._connection = value;
    this._bindConnection();

    return this;
  }

  mode(value = null) {
    if (value === null) {
      return this._mode;
    }

    if (value === 'list') {
      this._listMode();
    } else if (value === 'object') {
      this._objectMode();
    }

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

  subscribe(action = null) {
    if (action === null) {
      return this._subscribe;
    }

    this._subscribe = action;

    if (action === false) {
      if (this._request) {
        this._request.end();
      }

      this._end();
    }

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

    this.assign(value);
    return this;
  }

  remote(value = null) {
    if (value === null) {
      return this._remote;
    }

    this._remote = value;

    if (this._mode === 'object') {
      this.local(value);
    }

    return this;
  }

  total() {
    return this._total;
  }

  get(name) {
    return get(this._local, name);
  }

  has(name) {
    return has(this._local, name);
  }

  set(name, value, scope) {
    const old = this.get(name);
    const changed = !isEqual(old, value);

    set(this._local, name, value);

    this.emit('set', {
      changed,
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

  assign(values, scope) {
    Object.keys(values).forEach((key) => {
      this.set(key, values[key], scope);
    });

    return this;
  }

  flush() {
    this._local = {};
    this._remote = {};

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
        this._remote = {};
        callback();
        return;
      }

      this._local = this._deserialize(object.local, 'local');
      this._remote = this._deserialize(object.remote, 'remote');

      callback();
    });
  }

  save(callback = () => {}) {
    const object = {
      local: this._serialize(merge({}, this._local), 'local'),
      remote: this._serialize(merge({}, this._remote), 'remote')
    };

    this._cache.set(this._key(), object, callback);
  }

  remove(callback = () => {}) {
    this._cache.delete(this._key(), callback);
  }

  select() {
    if (this._subscribe === true) {
      this._end();
    }

    if (this._request) {
      return this;
    }

    const [path, local = {}] = this._parse();

    this._request = this._connection
      .request()
      .method('GET')
      .path(path);

    if (this._mode === 'list') {
      this._request.query(local);
    }

    if (this._etag) {
      this._request.header('x-etag', this._etag);
    }

    this._request.once('error', this._handleError);
    this._request.once('response', this._handleSelect);

    if (this._subscribe === true) {
      this._request.write('');
    } else {
      this._request.end();
    }

    return this;
  }

  insert() {
    if (this._request) {
      return this;
    }

    const [path, local] = this._parse();

    this._request = this._connection
      .request()
      .method('POST')
      .path(path);

    this._request.once('error', this._handleError);
    this._request.once('response', this._handleInsert);
    this._request.end(local);

    return this;
  }

  update() {
    if (this._request) {
      return this;
    }

    const [path, local] = this._parse();

    this._request = this._connection
      .request()
      .method('PUT')
      .path(path);

    this._request.once('error', this._handleError);
    this._request.once('response', this._handleUpdate);
    this._request.end(local);

    return this;
  }

  delete() {
    if (this._request) {
      return this;
    }

    const [path] = this._parse();

    this._request = this._connection
      .request()
      .method('DELETE')
      .path(path);

    this._request.once('error', this._handleError);
    this._request.once('response', this._handleDelete);
    this._request.end();

    return this;
  }

  _bindConnection() {
    if (this._connection) {
      if (this._auth === true) {
        this._connection.on('user', this._handleOpen);
      } else {
        this._connection.on('open', this._handleOpen);
      }
    }
  }

  _unbindConnection() {
    if (this._connection) {
      if (this._auth === true) {
        this._connection.removeListener('user', this._handleOpen);
      } else {
        this._connection.removeListener('open', this._handleOpen);
      }
    }
  }

  _select(response) {
    this._response = response;
    this._response.once('error', this._handleError);
    this._response.once('end', this._handleEnd);
    this._response.on('data', this._handleData);
  }

  _data(data) {
    if (this._response.status() >= 400) {
      this._error(new ScolaError(data));
      return;
    }

    if (this._response.status() === 304) {
      return;
    }

    if (this._response.header('x-change')) {
      this.emit('change', data);
      return;
    }

    if (this._response.header('x-etag')) {
      this._etag = this._response.header('x-etag');
    }

    if (this._response.header('x-total')) {
      this._total = this._response.header('x-total');
    }

    this.remote(data);
    this.emit('select', data);
  }

  _insert(response) {
    this._end();

    extract(response, (error) => {
      if (error) {
        this.emit('error', error);
        return;
      }

      if (response.status() !== 201) {
        this.emit('error', new ScolaError(response.data()));
        return;
      }

      this.emit('insert', response.data());
    });
  }

  _update(response) {
    this._end();

    extract(response, (error) => {
      if (error) {
        this.emit('error', error);
        return;
      }

      if (response.status() !== 200) {
        this.emit('error', new ScolaError(response.data()));
        return;
      }

      this.remote(response.data());
      this.emit('update', this._remote);
    });
  }

  _delete(response) {
    this._end();

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

  _end() {
    if (this._request) {
      this._request.removeAllListeners();
      this._request.destroy();
      this._request = null;
    }

    if (this._response) {
      this._response.removeAllListeners();
      this._response.destroy();
      this._response = null;
    }
  }

  _error(error) {
    this._end();
    this.emit('error', error);
  }

  _listMode() {
    this._mode = 'list';
    this._remote = [];
  }

  _objectMode() {
    this._mode = 'object';
    this._remote = {};
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

  _open() {
    if (this._subscribe === true) {
      this.select();
    }
  }
}
