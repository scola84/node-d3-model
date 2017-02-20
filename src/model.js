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
    this._auth = null;
    this._mode = null;
    this._state = 'idle';

    this._path = null;
    this._parser = null;
    this._keys = [];

    this._storage = null;
    this._key = () => this._path;

    this._serialize = (o) => o;
    this._deserialize = (o) => o;

    this._local = {};
    this._remote = null;
    this._total = null;
    this._etag = null;

    this._subscribe = false;

    this._request = null;
    this._response = null;

    this._handleOpen = () => this._open();
    this._objectMode();
  }

  destroy() {
    this._end();
    this._unbindConnection();

    this._connection = null;
    this._storage = null;

    this._serialize = null;
    this._unserialize = null;

    this._local = {};
    this._remote = null;
    this._total = null;
    this._etag = null;
  }

  auth(value = null) {
    if (value === null) {
      return this._auth;
    }

    this._auth = value;
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

  storage(value = null, key = null) {
    if (value === null) {
      return this._storage;
    }

    this._storage = value;
    this._key = key || this._key;

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

  diff() {
    return odiff(this._remote, this._local);
  }

  total() {
    return this._total;
  }

  load(callback) {
    const syncObject = this._storage
      .getItem(this._key(), (error, object) => {
        this._load(error, object, callback);
      });

    if (!callback) {
      this._load(null, syncObject);
    }

    return this;
  }

  save(callback) {
    const object = {
      local: this._serialize(merge({}, this._local), 'local'),
      remote: this._serialize(merge({}, this._local), 'remote')
    };

    this._storage.setItem(this._key(),
      JSON.stringify(object), callback);

    return this;
  }

  remove(callback) {
    this._storage.removeItem(this._key(), callback);
    return this;
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

  flush(storage = false) {
    this._local = {};
    this._remote = {};

    if (storage) {
      this.remove();
    }

    return this;
  }

  select() {
    if (this._state === 'busy') {
      return this;
    }

    this._state = 'busy';

    if (this._subscribe === true) {
      this._end();
    }

    const [path, local] = this._parse();

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

    this._request.once('error', (error) => {
      this._end();
      this._error(error);
    });

    this._request.once('response', (response) => {
      this._select(response);
    });

    if (this._subscribe === true) {
      this._request.write('');
    } else {
      this._request.end();
    }

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
      request.removeAllListeners();
      this._error(error);
    });

    request.once('response', (response) => {
      request.removeAllListeners();
      this._insert(response);
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
      request.removeAllListeners();
      this._error(error);
    });

    request.once('response', (response) => {
      request.removeAllListeners();
      this._update(response);
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
      request.removeAllListeners();
      this._error(error);
    });

    request.once('response', (response) => {
      request.removeAllListeners();
      this._delete(response);
    });

    request.end();
    return this;
  }

  subscribe(action = null) {
    if (action === null) {
      return this._subscribe;
    }

    this._subscribe = action;

    if (action === true) {
      return this.select();
    }

    if (this._request) {
      this._request.header('x-etag', false);
      this._request.end();

      this._etag = null;
      this._request = null;
    }

    this._end();
    return this;
  }

  _bindConnection() {
    if (!this._connection) {
      return;
    }

    if (this._auth === true) {
      this._connection.on('user', this._handleOpen);
    } else {
      this._connection.on('open', this._handleOpen);
    }
  }

  _unbindConnection() {
    if (!this._connection) {
      return;
    }

    if (this._auth === true) {
      this._connection.removeListener('user', this._handleOpen);
    } else {
      this._connection.removeListener('open', this._handleOpen);
    }
  }

  _select(response) {
    this._state = 'idle';
    this._response = response;

    this._response.on('data', (data) => {
      this._data(data);
    });

    this._response.on('end', () => {
      this._end();
    });

    this._response.on('error', (error) => {
      this._end();
      this._error(error);
    });
  }

  _insert(response) {
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

      this.emit('insert', response.data());
    });
  }

  _update(response) {
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

      this.remote(response.data());
      this.emit('update', this._remote);
    });
  }

  _delete(response) {
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

  _load(error, object, callback = () => {}) {
    if (error) {
      callback(error);
      return;
    }

    if (!object) {
      callback();
      return;
    }

    object = JSON.parse(object);

    this._local = this._deserialize(object.local, 'local');
    this._remote = this._deserialize(object.local, 'remote');

    callback();
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
    this._state = 'idle';
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

  _parse() {
    const local = this._serialize(merge({}, this._local), 'parse');
    const path = this._parser(local);

    this._keys.forEach((key) => {
      delete local[key.name];
    });

    return [path, local];
  }

  _open() {
    if (this._subscribe === true && this._request) {
      this.select();
    }
  }
}
