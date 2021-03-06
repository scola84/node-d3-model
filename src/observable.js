import EventEmitter from 'events';
import get from 'lodash-es/get';
import has from 'lodash-es/has';
import isEqual from 'lodash-es/isEqual';
import merge from 'lodash-es/merge';
import set from 'lodash-es/set';
import unset from 'lodash-es/unset';
import odiff from 'odiff';
import pathToRegexp from 'path-to-regexp';
import { ScolaError } from '@scola/error';
import State from './state';

export default class Observable extends EventEmitter {
  constructor() {
    super();

    this._path = null;
    this._parser = null;
    this._keys = [];

    this._connection = null;

    this._deserialize = (v) => v;
    this._serialize = (v) => v;

    this._mode = 'object';

    this._local = {};
    this._remote = {};

    this._etag = '';
    this._total = 0;

    this._locked = false;
    this._subscribed = false;

    this._state = null;

    this._request = null;
    this._response = null;

    this._handleData = (d) => this._data(d);
    this._handleEnd = () => this._destroy();
    this._handleError = (e) => this._select(e);
    this._handleResponse = (r) => this._select(null, r);
    this._handleSet = (e) => this._set(e);
  }

  destroy() {
    this._destroy();

    this._connection = null;
    this._local = {};
    this._remote = {};
  }

  path(value = null) {
    if (value === null) {
      return this._path;
    }

    if (value === true) {
      return this._parser(this._local);
    }

    this._path = value;
    this._parser = pathToRegexp.compile(value);

    pathToRegexp(value, this._keys);

    return this;
  }

  connection(value = null) {
    if (value === null) {
      return this._connection;
    }

    this._connection = value;
    return this;
  }

  deserialize(value = null) {
    if (value === null) {
      return this._deserialize;
    }

    this._deserialize = value;
    return this;
  }

  serialize(value = null) {
    if (value === null) {
      return this._serialize;
    }

    this._serialize = value;
    return this;
  }

  mode(value = null) {
    if (value === null) {
      return this._mode;
    }

    this._mode = value;
    return this;
  }

  local(value = null) {
    if (value === null) {
      return merge({}, this._local);
    }

    this._local = value;
    return this;
  }

  remote(value = null) {
    if (value === null) {
      return this._remote;
    }

    this._remote = value;

    if (this._mode === 'object') {
      this.assign(this._remote);
    }

    this.emit('select', this._remote, this._etag, this._total);
    return this;
  }

  values() {
    return this._serialize(this.local());
  }

  etag(value = null) {
    if (value === null) {
      return this._etag;
    }

    this._etag = value;
    return this;
  }

  total(value = null) {
    if (value === null) {
      return this._total;
    }

    this._total = value;
    this.emit('total', value);

    return this;
  }

  connected() {
    return this._connection.connected();
  }

  diff() {
    return odiff(this._remote, this._local);
  }

  state() {
    if (this._state === null) {
      this._state = new State();
    }

    return this._state;
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

  assign(values = {}, changed = null) {
    Object.keys(values).forEach((key) => {
      this.set(key, values[key], changed);
    });

    return this;
  }

  get(name = null) {
    return name === null ?
      this._local :
      get(this._local, name);
  }

  has(name) {
    return has(this._local, name);
  }

  reset() {
    const remote = this._remote;
    this.clear();

    this._remote = remote;
    this.assign(remote, false);

    return this;
  }

  set(name = null, value = null, changed = null) {
    const old = this.get(name);

    changed = changed === null ?
      !isEqual(old, value) : changed;

    if (typeof value === 'function') {
      value = value(old, changed);
    }

    if (name === null) {
      this.assign(value, false);
    } else {
      set(this._local, name, value);
    }

    this.emit('set', {
      changed,
      name,
      value
    });

    return this;
  }

  unset(name) {
    const old = this.get(name);
    unset(this._local, name);

    return old;
  }

  clear() {
    Object.keys(this._local).forEach((name) => {
      this.emit('set', {
        changed: true,
        name
      });
    });

    this._local = {};
    this._remote = {};

    this.emit('clear');
    return this;
  }

  subscribe(action = null) {
    if (action === null) {
      return this._subscribed;
    }

    this._subscribed = action;
    return this;
  }

  unsubscribe(properties = true) {
    if (this._request) {
      this._request.header('x-etag', false);
      this._request.end();
    }

    if (properties === true) {
      this._etag = '';
      this._total = 0;
    }

    this._destroy();
  }

  select() {
    if (this.connected() === false) {
      this._error('500 invalid_socket');
      return this;
    }

    if (this._subscribed === true) {
      this.unsubscribe(false);
    }

    const [path, local] = this._parse();

    this._request = this._connection
      .request()
      .method('GET')
      .path(path);

    if (this._mode === 'list') {
      this._request.query(local);
    }

    if (this._etag.length > 0) {
      this._request.header('x-etag', this._etag);
    }

    this._bindRequest();

    if (this._subscribed === true) {
      this._request.write('');
    } else {
      this._request.end();
    }

    return this;
  }

  insert() {
    if (this._locked === true) {
      this._error('500 invalid_state');
      return this;
    }

    if (this.connected() === false) {
      this._error('500 invalid_socket');
      return this;
    }

    this._locked = true;

    const [path, local] = this._parse();

    const request = this._connection
      .request()
      .method('POST')
      .path(path);

    request.once('error', (error) => {
      request.removeAllListeners();
      this._insert(error);
    });

    request.once('response', (response) => {
      request.removeAllListeners();
      this._insert(null, response);
    });

    request.end(local);
    return this;
  }

  update() {
    if (this._locked === true) {
      this._error('500 invalid_state');
      return this;
    }

    if (this.connected() === false) {
      this._error('500 invalid_socket');
      return this;
    }

    this._locked = true;

    const [path, local] = this._parse();

    const request = this._connection
      .request()
      .method('PUT')
      .path(path);

    request.once('error', (error) => {
      request.removeAllListeners();
      this._update(error);
    });

    request.once('response', (response) => {
      request.removeAllListeners();
      this._update(null, response);
    });

    request.end(local);
    return this;
  }

  delete() {
    if (this._locked === true) {
      this._error('500 invalid_state');
      return this;
    }

    if (this.connected() === false) {
      this._error('500 invalid_socket');
      return this;
    }

    this._locked = true;

    const [path] = this._parse();

    const request = this._connection
      .request()
      .method('DELETE')
      .path(path);

    request.once('error', (error) => {
      request.removeAllListeners();
      this._delete(error);
    });

    request.once('response', (response) => {
      request.removeAllListeners();
      this._delete(null, response);
    });

    request.end();
    return this;
  }

  _bindRequest() {
    if (this._request) {
      this._request.setMaxListeners(this._request.getMaxListeners() + 1);
      this._request.on('error', this._handleError);
      this._request.on('response', this._handleResponse);
    }
  }

  _unbindRequest() {
    if (this._request) {
      this._request.setMaxListeners(this._request.getMaxListeners() - 1);
      this._request.removeListener('error', this._handleError);
      this._request.removeListener('response', this._handleResponse);
    }
  }

  _bindResponse() {
    if (this._response) {
      this._response.setMaxListeners(this._response.getMaxListeners() + 1);
      this._response.on('data', this._handleData);
      this._response.on('end', this._handleEnd);
      this._response.on('error', this._handleError);
    }
  }

  _unbindResponse() {
    if (this._response) {
      this._response.setMaxListeners(this._response.getMaxListeners() - 1);
      this._response.removeListener('data', this._handleData);
      this._response.removeListener('end', this._handleEnd);
      this._response.removeListener('error', this._handleError);
    }
  }

  _select(error, response) {
    if (error instanceof Error === true) {
      this._error(error.message, true);
      return;
    }

    this._response = response;
    this._bindResponse();
  }

  _insert(error, response) {
    this._locked = false;

    if (error instanceof Error === true) {
      this._error(error.message);
      return;
    }

    this._extract(response, (data) => {
      if (response.status() !== 201) {
        this._error(data);
        return;
      }

      this.emit('insert', data);
    });
  }

  _update(error, response) {
    this._locked = false;

    if (error instanceof Error === true) {
      this._error(error.message);
      return;
    }

    this._extract(response, (data) => {
      if (response.status() !== 200) {
        this._error(data);
        return;
      }

      this.emit('update', this._remote);
    });
  }

  _delete(error, response) {
    this._locked = false;

    if (error instanceof Error === true) {
      this._error(error.message);
      return;
    }

    this._extract(response, (data) => {
      if (response.status() !== 200) {
        this._error(data);
        return;
      }

      this.emit('delete');
    });
  }

  _data(data) {
    if (this._response === null) {
      return;
    }

    if (this._response.status() >= 400) {
      this._error(data, true);
      return;
    }

    if (this._response.header('x-publish') === 1) {
      this.emit('publish', data);
      return;
    }

    if (this._response.header('x-etag') !== null) {
      this.emit('etag', String(this._response.header('x-etag')));
    }

    if (this._response.header('x-total') !== null) {
      this.total(Number(this._response.header('x-total')));
    }

    if (this._response.status() === 304) {
      this.emit('cache');
      return;
    }

    if (this._response.status() === 200) {
      this.remote(this._deserialize(data));
    }
  }

  _error(message, destroy = false) {
    this.emit('error', new ScolaError(message));

    if (destroy === true) {
      this._destroy();
    }
  }

  _set(event) {
    this.set(event.name, event.value, event.changed);
  }

  _destroy() {
    if (this._request) {
      this._unbindRequest();
      this._request.destroy();
      this._request = null;
    }

    if (this._response) {
      this._unbindResponse();
      this._response.destroy();
      this._response = null;
    }
  }

  _extract(response, callback) {
    const chunks = [];

    response.once('error', (error) => {
      response.removeAllListeners();
      this._error(error.message);
    });

    response.on('data', (chunk) => {
      chunks.push(chunk);
    });

    response.once('end', () => {
      response.removeAllListeners();

      let data = null;

      if (chunks.length === 1) {
        data = chunks[0];
      } else if (Buffer.isBuffer(chunks[0]) === true) {
        data = Buffer.concat(chunks);
      } else {
        data = chunks.join('');
      }

      callback(data);
    });
  }

  _parse() {
    const local = this._serialize(merge({}, this._local));
    const path = this.path(true);

    this._keys.forEach((key) => {
      delete local[key.name];
    });

    return [path, local];
  }
}
