import get from 'lodash-es/get';
import set from 'lodash-es/set';
import merge from 'lodash-es/merge';
import odiff from 'odiff';
import Model from './model';

export default class ObjectModel extends Model {
  constructor() {
    super();

    this._storage = null;
    this._lock = false;
    this._origin = {};
    this._values = {};
  }

  destroy() {
    this.clear();
    super.destroy();
  }

  storage(value) {
    this._storage = value;
    return this;
  }

  lock() {
    this._lock = true;
    return this;
  }

  clear() {
    this._origin = {};
    this._values = {};

    return this;
  }

  load() {
    const values = this._storage.getItem(this._name);

    if (values) {
      this.values(JSON.parse(values));
    }

    return this;
  }

  save() {
    this._storage.setItem(this._name, JSON.stringify(this._origin));
    return this;
  }

  unload() {
    this._storage.removeItem(this._name);
    return this;
  }

  get(name) {
    return get(this._values, name);
  }

  set(name, value) {
    if (this._lock === true) {
      return this;
    }

    set(this._values, name, value);

    this.emit('set', {
      diff: this.diff(),
      name,
      value
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

  values(value) {
    if (typeof value === 'undefined') {
      return this._values;
    }

    Object.keys(value).forEach((name) => {
      this.set(name, value[name]);
    });

    return this;
  }

  diff() {
    return odiff(this._origin, this._values);
  }

  commit() {
    merge(this._origin, this._values);
    this.emit('commit');

    return this;
  }

  rollback() {
    this._values = this._origin;
    this.emit('rollback');

    return this;
  }

  select(callback) {
    this._model
      .select()
      .execute((error, data) => {
        this._handleSelect(error, data, callback);
      });
  }

  insert(callback) {
    this._model
      .insert()
      .execute(this._values, callback);
  }

  update(callback) {
    this._model
      .update()
      .execute(this._values, callback);
  }

  delete(callback) {
    this._model
      .delete()
      .execute(callback);
  }

  fetch(callback) {
    this._model.fetch((fetchError) => {
      if (fetchError) {
        callback(fetchError);
        return;
      }

      this._model.data((dataError, data) => {
        this._handleSelect(dataError, data, callback);
      });
    });
  }

  _handleSelect(error, data, callback = () => {}) {
    if (error) {
      callback(error);
      return;
    }

    this
      .values(data)
      .commit();

    callback(null, data);
  }
}
