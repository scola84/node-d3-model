import md5 from 'crypto-js/md5';
import { ScolaError } from '@scola/error';

export default class Cache {
  constructor() {
    this._model = null;
    this._storage = null;
    this._index = null;

    this._serialize = (v) => v;
    this._deserialize = (v) => v;

    this._local = true;
    this._remote = true;

    this._handleCache = () => this._cache();
    this._handleClear = () => this._clear();
    this._handleError = (e) => this._error(e);
    this._handlePublish = (e) => this._publish(e);
    this._handleSet = (e) => this._set(e);
    this._handleSelect = (d, t, e) => this._select(d, t, e);
    this._handleTotal = (v) => this._total(v);
  }

  destroy() {
    this._unbindModel();
    this._unbindLocal();
    this._unbindRemote();

    this._model = null;
    this._storage = null;
  }

  model(value = null) {
    if (value === null) {
      return this._model;
    }

    this._model = value;
    this._bindModel();

    if (this._local === true) {
      this.local(true);
    }

    if (this._remote === true) {
      this.remote(true);
    }

    return this;
  }

  storage(value = null) {
    if (value === null) {
      return this._storage;
    }

    this._storage = value;
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

    if (value === true) {
      this._bindLocal();
    } else if (value === false) {
      this._unbindLocal();
    }

    return this;
  }

  remote(value = null) {
    if (value === null) {
      return this._remote;
    }

    this._remote = value;

    if (value === true) {
      this._bindRemote();
    } else if (value === false) {
      this._unbindRemote();
    }

    return this;
  }

  load(callback = () => {}) {
    const key = this._modelKey();

    const syncValue = this._getItem(key, (error, value) => {
      this._loadGet(error, value);
      callback();
    });

    if (syncValue instanceof Promise) {
      return this;
    }

    this._loadGet(null, syncValue);
    callback();

    return this;
  }

  select(callback = () => {}) {
    const key = this._model.mode() === 'list' ?
      this._listKey() : this._objectKey();

    const syncValue = this._getItem(key, (error, value) => {
      this._selectGet(error, value);
      callback();
    });

    if (syncValue instanceof Promise) {
      return this;
    }

    this._selectGet(null, syncValue);
    callback();

    return this;
  }

  _bindModel() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() + 1);
      this._model.on('clear', this._handleClear);
    }
  }

  _unbindModel() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() - 1);
      this._model.removeListener('clear', this._handleClear);
    }
  }

  _bindLocal() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() + 1);
      this._model.on('set', this._handleSet);
    }
  }

  _unbindLocal() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() - 1);
      this._model.removeListener('set', this._handleSet);
    }
  }

  _bindRemote() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() + 1);
      this._model.on('cache', this._handleCache);
      this._model.on('error', this._handleError);
      this._model.on('publish', this._handlePublish);
      this._model.on('select', this._handleSelect);
      this._model.on('total', this._handleTotal);
    }
  }

  _unbindRemote() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() - 1);
      this._model.removeListener('cache', this._handleCache);
      this._model.removeListener('error', this._handleError);
      this._model.removeListener('publish', this._handlePublish);
      this._model.removeListener('select', this._handleSelect);
      this._model.removeListener('total', this._handleTotal);
    }
  }

  _cache() {
    const key = this._model.mode() === 'list' ?
      this._listKey() : this._objectKey();

    const syncValue = this._getItem(key, (error, value) => {
      this._cacheGet(error, value);
    });

    if (syncValue instanceof Promise) {
      return this;
    }

    this._cacheGet(null, syncValue);
    return this;
  }

  _clear() {
    this._removeItem(this._modelKey());

    const key = this._model.mode() === 'list' ?
      this._listKey() : this._objectKey();

    this._removeItem(key);

    if (this._index === null) {
      return;
    }

    this._index.forEach((dataKey) => {
      this._removeItem(dataKey);
    });

    this._index.clear();
  }

  _error(error) {
    if (error.status !== 404) {
      return;
    }

    this._delete();
  }

  _publish(event) {
    const cancel =
      event.type !== 'delete' ||
      event.path !== this._model.path(true);

    if (cancel === true) {
      return;
    }

    this._delete();
  }

  _select(data, etag) {
    const key = this._model.mode() === 'list' ?
      this._listKey() : this._objectKey();

    this._addKey(key);

    this._setItem(key, {
      etag,
      data
    });
  }

  _set() {
    const value = {
      local: this._serialize(this._model.local())
    };

    if (this._remote === true) {
      value.total = this._model.total();
    }

    this._setItem(this._modelKey(), value);
  }

  _total() {
    const local = this._serialize(this._model.local());
    const total = this._model.total();

    this._setItem(this._modelKey(), {
      local,
      total
    });
  }

  _delete() {
    const key = this._model.mode() === 'list' ?
      this._listKey() : this._objectKey();

    this._deleteKey(key);
    this._removeItem(key);
  }

  _addKey(key) {
    const indexKey = this._indexKey();

    const syncValue = this._getItem(indexKey, (error, value) => {
      this._addKeyGet(error, value, indexKey, key);
    });

    if (syncValue instanceof Promise) {
      return;
    }

    this._addKeyGet(null, syncValue, indexKey, key);
  }

  _addKeyGet(error, value, indexKey, key) {
    if (error instanceof Error === true) {
      error = new ScolaError('500 invalid_data ' + error.message);
      this._model.emit('error', error);
      return;
    }

    value = value || [];

    if (this._index === null) {
      this._index = new Set(value);
    }

    this._index.add(key);
    this._setItem(indexKey, Array.from(this._index));
  }

  _deleteKey(key) {
    const indexKey = this._indexKey();

    const syncValue = this._getItem(indexKey, (error, value) => {
      this._deleteKeyGet(error, value, indexKey, key);
    });

    if (syncValue instanceof Promise) {
      return;
    }

    this._deleteKeyGet(null, syncValue, indexKey, key);
  }

  _deleteKeyGet(error, value, indexKey, key) {
    if (error instanceof Error === true) {
      error = new ScolaError('500 invalid_data ' + error.message);
      this._model.emit('error', error);
      return;
    }

    value = value || [];

    if (this._index === null) {
      this._index = new Set(value);
    }

    this._index.delete(key);
    this._setItem(indexKey, Array.from(this._index));
  }

  _cacheGet(error, value = null) {
    if (error instanceof Error === true) {
      error = new ScolaError('500 invalid_data ' + error.message);
      this._model.emit('error', error);
      return;
    }

    if (value !== null) {
      this._model.remote(value.data);
    }
  }

  _loadGet(error, value = null) {
    if (error instanceof Error === true) {
      error = new ScolaError('500 invalid_data ' + error.message);
      this._model.emit('error', error);
      return;
    }

    if (value === null) {
      return;
    }

    const total = value.total;
    const local = this._deserialize(value.local);

    this._model.total(total);
    this._model.assign(local);
  }

  _selectGet(error, value = null) {
    if (error instanceof Error === true) {
      error = new ScolaError('500 invalid_data ' + error.message);
      this._model.emit('error', error);
      return;
    }

    this._model.etag(value === null ? '' : value.etag);

    if (this._model.connected() === true) {
      this._model.select();
    } else if (value !== null) {
      this._model.remote(value.data);
    } else {
      error = new ScolaError('500 invalid_data ' + error.message);
      this._model.emit('error', error);
    }
  }

  _getItem(key, callback) {
    const syncValue = this._storage.getItem(key, (error, value) => {
      callback(error, typeof value === 'string' ?
        JSON.parse(value) : null);
    });

    return typeof syncValue === 'string' ?
      JSON.parse(syncValue) : syncValue;
  }

  _setItem(key, value) {
    value = JSON.stringify(value);
    this._storage.setItem(key, value);
  }

  _removeItem(key) {
    this._storage.removeItem(key);
  }

  _modelKey(data = 'model', parse = null) {
    return md5(JSON.stringify({
      path: this._model.path(parse),
      data
    })).toString();
  }

  _indexKey() {
    return this._modelKey('index');
  }

  _listKey() {
    return this._modelKey(this._model.local());
  }

  _objectKey() {
    return this._modelKey('object', true);
  }
}
